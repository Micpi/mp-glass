"""Nexus, the assistant of MP Nexus: a Home Assistant conversation agent.

Simple commands are understood by Home Assistant itself, at home, with no AI. Anything else goes to the
language model chosen in the options (Groq by default), which acts through Home Assistant's own Assist tools,
on the entities exposed to Assist only, plus what MP Nexus adds about the household.
"""
import logging

from aiohttp import ClientError, ClientTimeout

from homeassistant.components import conversation
from homeassistant.const import MATCH_ALL
from homeassistant.helpers import intent, llm
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .assistant_core import (
    DEFAULT_MODEL, MAX_TOOL_TURNS, PROMPT, AssistantError, base_url, build_request, clean_key, household,
    provider_error, read_answer, to_messages, tool_result_data, tool_spec, touched_entities,
)
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)
API_ID = "mp_nexus"


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([NexusAgent(entry)])


class HouseholdTool(llm.Tool):
    name = "NexusHousehold"
    description = "Qui habite la maison et qui est à la maison en ce moment."
    # Home Assistant 2026.10+ records which integration provides each tool.
    integration = DOMAIN

    async def async_call(self, hass, tool_input, llm_context):
        persons = [{"name": str(s.attributes.get("friendly_name") or s.entity_id[7:]), "state": s.state}
                   for s in hass.states.async_all("person") if s.state not in ("unavailable", "unknown")]
        data = household(persons)
        # Since 2026.10 a tool returns a ToolResult; before, the data itself.
        result = getattr(llm, "ToolResult", None)
        return result(data=data) if result else data


class NexusAPI(llm.API):
    """Home Assistant's Assist tools, plus what MP Nexus knows about the household."""

    async def async_get_api_instance(self, llm_context):
        assist = await llm.async_get_api(self.hass, llm.LLM_API_ASSIST, llm_context)
        return llm.APIInstance(api=self, api_prompt=assist.api_prompt, llm_context=llm_context,
                               tools=[*assist.tools, HouseholdTool()], custom_serializer=assist.custom_serializer)


def _content(item):
    """A chat log entry as assistant_core reads it."""
    if isinstance(item, conversation.AssistantContent):
        return {"role": "assistant", "content": item.content, "tool_calls": [{"id": c.id, "name": c.tool_name, "args": c.tool_args} for c in item.tool_calls or ()]}
    if isinstance(item, conversation.ToolResultContent):
        return {"role": "tool_result", "tool_call_id": item.tool_call_id, "result": tool_result_data(item)}
    return {"role": item.role, "content": item.content}


class NexusAgent(conversation.ConversationEntity, conversation.AbstractConversationAgent):
    _attr_has_entity_name = True
    _attr_name = "Nexus"
    _attr_supported_features = conversation.ConversationEntityFeature.CONTROL

    def __init__(self, entry):
        self.entry = entry
        self._attr_unique_id = f"{DOMAIN}_assistant"

    @property
    def supported_languages(self):
        return MATCH_ALL

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        conversation.async_set_agent(self.hass, self.entry, self)

    async def async_will_remove_from_hass(self):
        conversation.async_unset_agent(self.hass, self.entry)
        await super().async_will_remove_from_hass()

    async def _async_handle_message(self, user_input, chat_log):
        try:
            return await self._answer(user_input, chat_log)
        except Exception as err:  # noqa: BLE001 - whatever breaks, the household hears why instead of silence.
            _LOGGER.exception("Nexus assistant failed")
            return self._error(user_input, chat_log, f"Nexus a rencontré une erreur ({type(err).__name__}). Le détail est dans le journal de Home Assistant.")

    async def _answer(self, user_input, chat_log):
        # 1. At home first: the sentences Home Assistant understands on its own never leave the house.
        local = await conversation.async_handle_intents(self.hass, user_input, chat_log)
        if local is not None:
            chat_log.async_add_assistant_content_without_tools(conversation.AssistantContent(
                agent_id=user_input.agent_id, content=local.speech.get("plain", {}).get("speech", "")))
            return conversation.ConversationResult(response=local, conversation_id=chat_log.conversation_id)
        options = self.entry.options
        key = clean_key(options.get("assistant_api_key"))
        if not key:
            return self._error(user_input, chat_log, "Je n'ai compris cette demande qu'avec l'IA, et aucune clé n'est configurée. Ajoutez une clé Groq gratuite dans les options de l'intégration MP Nexus.")
        # 2. The language model, with the tools of the house.
        try:
            await chat_log.async_provide_llm_data(user_input.as_llm_context(DOMAIN), NexusAPI(hass=self.hass, id=API_ID, name="MP Nexus"), PROMPT, user_input.extra_system_prompt)
        except conversation.ConverseError as err:
            return err.as_conversation_result()
        start = len(chat_log.content)
        try:
            await self._converse(chat_log, key, options)
        except AssistantError as err:
            _LOGGER.warning("Nexus assistant: %s", err.detail)
            return self._error(user_input, chat_log, err.detail)
        result = conversation.async_get_result_from_chat_log(user_input, chat_log)
        touched = touched_entities([tool_result_data(c) for c in chat_log.content[start:] if isinstance(c, conversation.ToolResultContent)])
        if touched and result.response.response_type != intent.IntentResponseType.ERROR:
            result.response.async_set_results([intent.IntentResponseTarget(name=_name(self.hass, e), type=intent.IntentResponseTargetType.ENTITY, id=e) for e in touched])
        return result

    async def _converse(self, chat_log, key, options):
        api = chat_log.llm_api
        tools = [tool_spec(t.name, t.description, _schema(t, api.custom_serializer)) for t in api.tools] if api else []
        session, url = async_get_clientsession(self.hass), f"{base_url(options.get('assistant_url'))}/chat/completions"
        model = (options.get("assistant_model") or "").strip() or DEFAULT_MODEL
        for _ in range(MAX_TOOL_TURNS):
            payload = build_request(model, to_messages([_content(c) for c in chat_log.content]), tools)
            try:
                async with session.post(url, json=payload, headers={"Authorization": f"Bearer {key}"}, timeout=ClientTimeout(total=45), allow_redirects=False) as response:
                    body = await response.read()
                    if response.status != 200:
                        raise provider_error(response.status, body, key)
            except (ClientError, TimeoutError) as err:
                raise AssistantError("unavailable", "Le service d'IA ne répond pas pour le moment.") from err
            text, calls = read_answer(body)
            content = conversation.AssistantContent(agent_id=self.entity_id, content=text or None,
                                                    tool_calls=[llm.ToolInput(tool_name=c["name"], tool_args=c["args"], id=c["id"]) for c in calls] or None)
            async for _ in chat_log.async_add_assistant_content(content):
                pass
            if not chat_log.unresponded_tool_results:
                return
        chat_log.async_add_assistant_content_without_tools(conversation.AssistantContent(agent_id=self.entity_id, content="Je n'ai pas réussi à terminer cette demande."))

    def _error(self, user_input, chat_log, text):
        response = intent.IntentResponse(language=user_input.language)
        response.async_set_error(intent.IntentResponseErrorCode.UNKNOWN, text)
        return conversation.ConversationResult(response=response, conversation_id=chat_log.conversation_id)


def _name(hass, entity_id):
    state = hass.states.get(entity_id)
    return str(state.attributes.get("friendly_name") or entity_id) if state else entity_id


def _schema(tool, serializer):
    """The tool's parameters as JSON schema: probatio since Home Assistant 2026.10, voluptuous before."""
    try:
        try:
            import probatio  # noqa: PLC0415
        except ImportError:
            probatio = None
        if probatio is not None and isinstance(tool.parameters, probatio.Schema):
            return probatio.to_openapi(tool.parameters, custom_serializer=serializer, openapi_version="3.1.0")
        from voluptuous_openapi import convert  # noqa: PLC0415 - shipped with Home Assistant.
        return convert(tool.parameters, custom_serializer=serializer)
    except Exception:  # noqa: BLE001 - a tool whose parameters cannot be described is offered without them.
        _LOGGER.warning("Nexus assistant: no schema for %s", tool.name, exc_info=True)
        return None
