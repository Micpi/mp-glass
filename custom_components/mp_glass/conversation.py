"""Nexus, the assistant of MP Nexus: a Home Assistant conversation agent.

Simple commands are understood by Home Assistant itself, at home, with no AI. Anything else goes to the
language model chosen in the options (Groq by default), which acts through Home Assistant's own Assist tools,
on the entities exposed to Assist only, plus what MP Nexus adds about the household.
"""
import asyncio
import dataclasses
import json
import logging
import time

from aiohttp import ClientError, ClientTimeout

from homeassistant.components import conversation
from homeassistant.const import MATCH_ALL
from homeassistant.helpers import intent, llm
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.storage import Store
from homeassistant.util.ulid import ulid_now

from .assistant_core import (
    NUDGE, DATA_BOUNDARY, claims_action, language_block, localized, compact_live, honest_answer, pick_tools,
    DEFAULT_MODEL, MAX_TOOL_TURNS, PROMPT, AssistantError, bad_tool_call, base_url, build_request, clean_key, done_answer,
    SHELF_KEY, GROQ_URL, ModelShelf, offered_models, too_large, household, is_daily_quota, plain_command, provider_error, retry_in, with_model, quota_wait, read_answer, shorten_text, short_names, to_messages,
    tool_result_data, tool_spec, touched_entities,
)
from .assistant_memory import Memory, compact_context, is_read_only, lesson, question_request
from .const import DOMAIN
from .facts import TOOLS as FACT_TOOLS, prompt_block as facts_block, KEY as FACTS_KEY, runtime as facts_runtime, style_block
from .facts_core import LESSON_MARK, dress, lesson_marker, lesson_prompt
from .timers import TOOLS as TIMER_TOOLS, handle_sentence as timers_handle

_LOGGER = logging.getLogger(__name__)
DAILY_SPENT = "Le quota gratuit du jour de l'IA est atteint, sur tous les modèles. Les commandes simples marchent toujours ; le reste reviendra plus tard."


MINUTE_SPENT = "Le quota gratuit de l'IA est atteint pour le moment. Réessayez dans une minute."


class _DailyQuota(Exception):
    """The chosen model's quota of the day is spent; `seconds` until it comes back."""

    def __init__(self, seconds):
        super().__init__(seconds)
        self.seconds = seconds
API_ID = "mp_nexus"
MEMORY_KEY = f"{DOMAIN}.nexus_learned"


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([NexusAgent(entry)])


class HouseholdTool(llm.Tool):
    name = "NexusHousehold"
    description = ("Qui habite la maison et qui est à la maison en ce moment, la météo actuelle et les prévisions des prochains jours, "
                   "et la consommation électrique du moment. Fonctionne même si ces entités ne sont pas exposées à Assist. "
                   "Une personne absente dont l'état est un nom de lieu (« Bureau ») est à cet endroit : dites-le.")
    # Home Assistant 2026.10+ records which integration provides each tool.
    integration = DOMAIN

    async def async_call(self, hass, tool_input, llm_context):
        persons = [{"name": str(s.attributes.get("friendly_name") or s.entity_id[7:]), "state": s.state}
                   for s in hass.states.async_all("person") if s.state not in ("unavailable", "unknown")]
        data = household(persons, await _weather(hass), _power(hass))
        # Since 2026.10 a tool returns a ToolResult; before, the data itself.
        result = getattr(llm, "ToolResult", None)
        return result(data=data) if result else data


async def _weather(hass):
    """The weather the dashboard shows: now, and the next two days when the integration forecasts them."""
    state = next((s for s in hass.states.async_all("weather") if s.state not in ("unavailable", "unknown")), None)
    if state is None:
        return None
    a = state.attributes
    unit = a.get("temperature_unit") or "°C"
    now = {"ciel": state.state, "température": f"{a.get('temperature')} {unit}" if a.get("temperature") is not None else None,
           "humidité": f"{a.get('humidity')} %" if a.get("humidity") is not None else None,
           "vent": f"{a.get('wind_speed')} {a.get('wind_speed_unit') or ''}".strip() if a.get("wind_speed") is not None else None}
    weather = {"lieu": str(a.get("friendly_name") or ""), "maintenant": {k: v for k, v in now.items() if v is not None}}
    try:
        answer = await hass.services.async_call("weather", "get_forecasts", {"entity_id": state.entity_id, "type": "daily"}, blocking=True, return_response=True)
        days = ((answer or {}).get(state.entity_id) or {}).get("forecast") or []
        weather["prévisions"] = [{k: d.get(k) for k in ("datetime", "condition", "temperature", "templow", "precipitation", "precipitation_probability") if d.get(k) is not None} for d in days[:3]]
    except Exception:  # noqa: BLE001 - a weather integration without daily forecasts still gives the weather now.
        pass
    return weather


_MAIN_METER = ("total", "maison", "house", "home", "linky", "compteur", "general", "général", "main", "grid", "réseau")


def _power(hass):
    """The power used now: the house meter when one is recognised, otherwise the largest readings."""
    found = []
    for s in hass.states.async_all("sensor"):
        if s.attributes.get("device_class") != "power":
            continue
        try:
            value = float(s.state)
        except (TypeError, ValueError):
            continue
        unit = s.attributes.get("unit_of_measurement") or "W"
        watts = value * 1000 if unit == "kW" else value
        name = str(s.attributes.get("friendly_name") or s.entity_id)
        found.append((any(w in (name + s.entity_id).lower() for w in _MAIN_METER), watts, name, f"{value:g} {unit}"))
    found.sort(key=lambda f: (not f[0], -f[1]))
    return [{"nom": name, "puissance": shown} for _, _, name, shown in found[:4]]


class NexusAPI(llm.API):
    """Home Assistant's Assist tools, plus what MP Nexus knows about the household."""

    async def async_get_api_instance(self, llm_context):
        assist = await llm.async_get_api(self.hass, llm.LLM_API_ASSIST, llm_context)
        # The list of devices, grouped by room: a third of the tokens of Home Assistant's YAML.
        return llm.APIInstance(api=self, api_prompt=compact_context(assist.api_prompt, _dead(self.hass)), llm_context=llm_context,
                               tools=[*assist.tools, HouseholdTool(), *(tool() for tool in TIMER_TOOLS), *(tool() for tool in FACT_TOOLS)], custom_serializer=assist.custom_serializer)


def _content(item, names):
    """A chat log entry as assistant_core reads it, with the tool names the model is offered."""
    if isinstance(item, conversation.AssistantContent):
        return {"role": "assistant", "content": item.content, "tool_calls": [{"id": c.id, "name": names.get(c.tool_name, c.tool_name), "args": c.tool_args} for c in item.tool_calls or ()]}
    if isinstance(item, conversation.ToolResultContent):
        result = tool_result_data(item)
        # The live states of the whole house come back as YAML: the same in one line a device costs half the tokens.
        if isinstance(result, dict) and isinstance(result.get("result"), str):
            result = {**result, "result": compact_live(result["result"])}
        return {"role": "tool_result", "tool_call_id": item.tool_call_id, "result": result}
    if item.role == "system":
        return {"role": "system", "content": shorten_text(item.content or "", names)}
    # The screen opens a lesson with a marker; the model reads it as the person asking to begin.
    if item.role == "user" and (item.content or "").startswith(LESSON_MARK):
        return {"role": "user", "content": "Commençons la leçon."}
    return {"role": item.role, "content": item.content}


class NexusAgent(conversation.ConversationEntity, conversation.AbstractConversationAgent):
    _attr_has_entity_name = True
    _attr_name = "Nexus"
    _attr_supported_features = conversation.ConversationEntityFeature.CONTROL

    def __init__(self, entry):
        self.entry = entry
        self._attr_unique_id = f"{DOMAIN}_assistant"
        self.memory = Memory()
        self._store = None

    @property
    def extra_state_attributes(self):
        return {"learned_requests": len(self.memory)}

    @property
    def learning(self):
        return self.entry.options.get("assistant_learn", True) is not False

    @property
    def supported_languages(self):
        return MATCH_ALL

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self._store = Store(self.hass, 1, MEMORY_KEY)
        if self.learning:
            self.memory = Memory(await self._store.async_load())
        else:
            await self._store.async_remove()
        conversation.async_set_agent(self.hass, self.entry, self)

    async def async_will_remove_from_hass(self):
        conversation.async_unset_agent(self.hass, self.entry)
        await super().async_will_remove_from_hass()

    async def _async_handle_message(self, user_input, chat_log):
        try:
            # The spoken answer's connection opens while the request is understood.
            from .tts import warm_voices  # noqa: PLC0415
            warm_voices(self.hass)
        except Exception:  # noqa: BLE001 - only a head start.
            pass
        try:
            return await self._answer(user_input, chat_log)
        except Exception as err:  # noqa: BLE001 - whatever breaks, the household hears why instead of silence.
            _LOGGER.exception("Nexus assistant failed")
            return self._error(user_input, chat_log, f"Nexus a rencontré une erreur ({type(err).__name__}). Le détail est dans le journal de Home Assistant.")

    def _persona(self):
        return facts_runtime(self.hass).facts.persona if FACTS_KEY in self.hass.data else "standard"

    async def _answer(self, user_input, chat_log):
        first = next((c for c in chat_log.content if isinstance(c, conversation.UserContent)), None)
        lesson_id = lesson_marker(first.content) if first else None
        # 0. Timers and alarms, understood at home: « un minuteur de 10 minutes », « réveille-moi à 7 h », « stop » while it rings.
        spoken = None if lesson_id else timers_handle(self.hass, user_input.text, user_input.language)
        if spoken:
            spoken = dress(spoken, self._persona(), user_input.language)
            chat_log.async_add_assistant_content_without_tools(conversation.AssistantContent(agent_id=user_input.agent_id, content=spoken))
            response = intent.IntentResponse(language=user_input.language)
            response.async_set_speech(spoken)
            return conversation.ConversationResult(response=response, conversation_id=chat_log.conversation_id)
        # 1. At home first: the sentences Home Assistant understands on its own never leave the house.
        local = None if lesson_id else await conversation.async_handle_intents(self.hass, user_input, chat_log)
        plain = plain_command(user_input.text)
        if local is None and not lesson_id and plain and plain != user_input.text.strip():
            # « Nexus, éteins la cuisine s'il te plaît » is still « éteins la cuisine ».
            local = await conversation.async_handle_intents(self.hass, dataclasses.replace(user_input, text=plain), chat_log)
        if local is not None and _empty_answer(local) and clean_key(self.entry.options.get("assistant_api_key")):
            # « Personne », « Aucun appareil »: Home Assistant only sees what is exposed to Assist; the AI looks further and says it better.
            local = None
        if local is not None:
            said = local.speech.get("plain", {}).get("speech", "")
            styled = dress(said, self._persona(), user_input.language)
            if styled != said:
                local.async_set_speech(styled)
            chat_log.async_add_assistant_content_without_tools(conversation.AssistantContent(
                agent_id=user_input.agent_id, content=styled))
            return conversation.ConversationResult(response=local, conversation_id=chat_log.conversation_id)
        options = self.entry.options
        key = clean_key(options.get("assistant_api_key"))
        if not key:
            return self._error(user_input, chat_log, "Je n'ai compris cette demande qu'avec l'IA, et aucune clé n'est configurée. Ajoutez une clé Groq gratuite dans les options de l'intégration MP Nexus.")
        # 2. The language model, with the tools of the house.
        try:
            # What the household taught Nexus goes with the instructions, and a lesson turns the conversation into an interview.
            known = facts_block(self.hass, "" if lesson_id else user_input.text)
            instructions = PROMPT + style_block(self.hass) + known + (lesson_prompt(lesson_id, known.count("\n- ")) if lesson_id else "") + DATA_BOUNDARY + language_block(user_input.language)
            await chat_log.async_provide_llm_data(user_input.as_llm_context(DOMAIN), NexusAPI(hass=self.hass, id=API_ID, name="MP Nexus"), instructions, user_input.extra_system_prompt)
        except conversation.ConverseError as err:
            return err.as_conversation_result()
        start = len(chat_log.content)
        phrase = plain or user_input.text
        fresh = sum(1 for c in chat_log.content if isinstance(c, conversation.UserContent)) == 1
        # 3. A request the AI already solved is replayed at home.
        learned = self.memory.recall(phrase) if self.learning and fresh and not lesson_id else None
        if learned:
            replayed = await self._replay(user_input, chat_log, learned, key, options, start)
            if replayed is not None:
                self.memory.used(phrase)
                self._save()
                return replayed
            self.memory.forget(phrase)
            self._save()
            start = len(chat_log.content)
        try:
            await self._converse(chat_log, key, options, start, user_input.language)
        except AssistantError as err:
            _LOGGER.warning("Nexus assistant: %s", err.detail)
            touched = self._touched(chat_log, start)
            if not touched:
                return self._error(user_input, chat_log, err.detail)
            # The house already did what was asked; only the sentence saying so is missing.
            chat_log.async_add_assistant_content_without_tools(conversation.AssistantContent(
                agent_id=self.entity_id, content=dress(done_answer([_name(self.hass, e) for e in touched], user_input.language), self._persona(), user_input.language)))
        else:
            if self.learning and fresh and not lesson_id:
                self.memory.learn(phrase, lesson(self._calls(chat_log, start), self._last_answer(chat_log, start)))
                self._save()
        return self._result(user_input, chat_log, start)

    def _result(self, user_input, chat_log, start):
        result = conversation.async_get_result_from_chat_log(user_input, chat_log)
        touched = self._touched(chat_log, start)
        if touched and result.response.response_type != intent.IntentResponseType.ERROR:
            result.response.async_set_results([intent.IntentResponseTarget(name=_name(self.hass, e), type=intent.IntentResponseTargetType.ENTITY, id=e) for e in touched])
        return result

    def _save(self):
        if self._store is not None:
            self._store.async_delay_save(self.memory.as_dict, 5)
            self.async_write_ha_state()

    def _calls(self, chat_log, start):
        """The tools used since `start`: name, args, read-only, success and the entities acted on."""
        api = chat_log.llm_api
        tools = {t.name: t for t in api.tools} if api else {}
        results = {c.tool_call_id: c for c in chat_log.content[start:] if isinstance(c, conversation.ToolResultContent)}
        calls = []
        for item in chat_log.content[start:]:
            if not isinstance(item, conversation.AssistantContent):
                continue
            for call in item.tool_calls or ():
                result = results.get(call.id)
                data = tool_result_data(result) if result else None
                tool = tools.get(call.tool_name)
                annotated = getattr(getattr(tool, "annotations", None), "read_only", None)
                entities = [(e, (self.hass.states.get(e).attributes.get("device_class") if self.hass.states.get(e) else None)) for e in touched_entities([data])]
                calls.append({"name": call.tool_name, "args": dict(call.tool_args or {}), "read_only": is_read_only(call.tool_name, annotated),
                              "ok": result is not None and _succeeded(result, data), "entities": entities})
        return calls

    @staticmethod
    def _last_answer(chat_log, start):
        for item in reversed(chat_log.content[start:]):
            if isinstance(item, conversation.AssistantContent) and item.content:
                return item.content
        return ""

    async def _replay(self, user_input, chat_log, learned, key, options, start):
        """Plays a learned request again: the actions with the same answer, or fresh readings phrased in a small request.
        None when something no longer works the same way (the AI then takes over)."""
        content = conversation.AssistantContent(agent_id=self.entity_id, content=None, tool_calls=[
            llm.ToolInput(tool_name=c["name"], tool_args=c["args"], id=ulid_now()) for c in learned["calls"]])
        async for _ in chat_log.async_add_assistant_content(content):
            pass
        calls = self._calls(chat_log, start)
        if not calls or not all(c["ok"] for c in calls):
            _LOGGER.debug("Nexus assistant: learned request no longer works, asking the AI")
            return None
        if learned["kind"] == "action":
            answer = learned["answer"]
        else:
            readings = [tool_result_data(c) for c in chat_log.content[start:] if isinstance(c, conversation.ToolResultContent)]
            model = (options.get("assistant_model") or "").strip() or DEFAULT_MODEL
            try:
                body = await self._post(async_get_clientsession(self.hass), f"{base_url(options.get('assistant_url'))}/chat/completions",
                                        question_request(model, user_input.text, readings, user_input.language), key)
                answer = read_answer(body)[0]
            except AssistantError as err:
                _LOGGER.warning("Nexus assistant: %s", err.detail)
                return self._error(user_input, chat_log, err.detail)
            if not answer:
                return None
        chat_log.async_add_assistant_content_without_tools(conversation.AssistantContent(agent_id=self.entity_id, content=answer))
        return self._result(user_input, chat_log, start)

    @staticmethod
    def _touched(chat_log, start):
        return touched_entities([tool_result_data(c) for c in chat_log.content[start:] if isinstance(c, conversation.ToolResultContent)])

    async def _post(self, session, url, payload, key):
        """The model's answer. When the chosen model's quota is spent (the minute or the day), the next free model answers
        at once instead of waiting (Groq counts each model apart), until the first one comes back."""
        shelf = self.hass.data.setdefault(SHELF_KEY, ModelShelf())
        custom = self.entry.options.get("assistant_url")
        if base_url(custom) == GROQ_URL and shelf.needs_list(time.time()):
            shelf.listed(await self._models(session, key), time.time())
        for round_ in range(2):
            for model in shelf.candidates(payload["model"], custom, time.time()):
                try:
                    return await self._post_once(session, url, with_model(payload, model) if model != payload["model"] else payload, key)
                except _DailyQuota as spent:
                    _LOGGER.info("Nexus assistant: %s is busy for %d s, next model", model, spent.seconds)
                    shelf.spend(model, spent.seconds, time.time())
                except AssistantError as err:
                    # A stand-in the provider no longer offers is skipped for a day; the chosen model's own errors are said.
                    if err.code != "model" or model == payload["model"]:
                        raise
                    _LOGGER.warning("Nexus assistant: stand-in model %s refused: %s", model, err.detail)
                    shelf.spend(model, 86400, time.time())
            back = shelf.back_in(time.time())
            # Every model's minute is full: when one frees up soon, it is worth the wait.
            if round_ or not 0 < back <= 15:
                break
            await asyncio.sleep(back + 0.3)
        back = shelf.back_in(time.time())
        raise AssistantError("quota", MINUTE_SPENT if back <= 120 else DAILY_SPENT)

    async def _models(self, session, key):
        """The models the key may use (Groq lists them for free); None when the list cannot be read."""
        try:
            async with session.get(f"{GROQ_URL}/models", headers={"Authorization": f"Bearer {key}"}, timeout=ClientTimeout(total=6)) as response:
                return offered_models(await response.read()) if response.status == 200 else None
        except Exception:  # noqa: BLE001 - the list only narrows the stand-ins; without it, all are tried.
            return None

    async def _post_once(self, session, url, payload, key):
        """One model's answer. A full quota is not waited for here: the next model is tried first."""
        for attempt in range(2):
            try:
                async with session.post(url, json=payload, headers={"Authorization": f"Bearer {key}"}, timeout=ClientTimeout(total=45), allow_redirects=False) as response:
                    body = await response.read()
                    if response.status == 200:
                        return body
                    if attempt == 0 and bad_tool_call(response.status, body):
                        continue
                    if too_large(response.status, body):
                        _LOGGER.info("Nexus assistant: a request of about %d characters is too large for %s", len(json.dumps(payload, ensure_ascii=False)), payload.get("model"))
                        raise _DailyQuota(3600.0)
                    if is_daily_quota(response.status, body):
                        raise _DailyQuota(retry_in(body))
                    if response.status == 429:
                        wait = quota_wait(response.status, response.headers.get("retry-after"), body)
                        raise _DailyQuota(wait if wait is not None else retry_in(body, 60.0))
                    raise provider_error(response.status, body, key)
            except (ClientError, TimeoutError) as err:
                raise AssistantError("unavailable", "Le service d'IA ne répond pas pour le moment.") from err
        raise AssistantError("request", "Le service d'IA a refusé la demande.")

    def _acted(self, chat_log, start):
        """True when a tool that changes the house (or a timer, or a fact) succeeded since `start`."""
        return any(c["ok"] and not c["read_only"] for c in self._calls(chat_log, start))

    async def _converse(self, chat_log, key, options, start=None, language="fr"):
        api = chat_log.llm_api
        names = short_names([t.name for t in api.tools]) if api else {}
        real = {short: name for name, short in names.items()}
        said = " ".join(c.content or "" for c in chat_log.content if isinstance(c, conversation.UserContent))
        lesson_on = any((c.content or "").startswith(LESSON_MARK) for c in chat_log.content if isinstance(c, conversation.UserContent))
        offered = set(pick_tools([t.name for t in api.tools], said, lesson_on)) if api else set()
        # Tools already used in this conversation stay offered, so that a follow-up works the same way.
        offered |= {call.tool_name for c in chat_log.content if isinstance(c, conversation.AssistantContent) for call in (c.tool_calls or ())}
        tools = [tool_spec(names[t.name], t.description, _schema(t, api.custom_serializer)) for t in api.tools if t.name in offered] if api else []
        session, url = async_get_clientsession(self.hass), f"{base_url(options.get('assistant_url'))}/chat/completions"
        model = (options.get("assistant_model") or "").strip() or DEFAULT_MODEL
        start = len(chat_log.content) if start is None else start
        nudged = False
        for _ in range(MAX_TOOL_TURNS):
            messages = to_messages([_content(c, names) for c in chat_log.content])
            if nudged:
                messages.append({"role": "user", "content": NUDGE})
            payload = build_request(model, messages, tools)
            body = await self._post(session, url, payload, key)
            text, calls = read_answer(body)
            # An answer that says it acted while no tool acted is a made-up action: the model is told so once, then Nexus says the truth.
            if not calls and claims_action(text) and not self._acted(chat_log, start):
                if not nudged:
                    _LOGGER.info("Nexus assistant: an action was announced without a tool call, asking again")
                    nudged = True
                    continue
                text = honest_answer(language)
            content = conversation.AssistantContent(agent_id=self.entity_id, content=text or None,
                                                    tool_calls=[llm.ToolInput(tool_name=real.get(c["name"], c["name"]), tool_args=c["args"], id=c["id"]) for c in calls] or None)
            async for _ in chat_log.async_add_assistant_content(content):
                pass
            if not chat_log.unresponded_tool_results:
                return
        chat_log.async_add_assistant_content_without_tools(conversation.AssistantContent(agent_id=self.entity_id, content=localized("Je n'ai pas réussi à terminer cette demande.", language)))

    def _error(self, user_input, chat_log, text):
        response = intent.IntentResponse(language=user_input.language)
        response.async_set_error(intent.IntentResponseErrorCode.UNKNOWN, localized(text, user_input.language))
        return conversation.ConversationResult(response=response, conversation_id=chat_log.conversation_id)


def _dead(hass):
    """(domain, name) of the exposed devices that are unavailable or gone: dozens of them only cost tokens and mislead the model."""
    from homeassistant.helpers import entity_registry as er  # noqa: PLC0415

    registry = er.async_get(hass)
    dead = set()
    for entry in registry.entities.values():
        state = hass.states.get(entry.entity_id)
        # « unknown » is a normal state (a scene never played): only devices that are unavailable or gone are left out.
        if state is not None and state.state != "unavailable":
            continue
        for name in (state.attributes.get("friendly_name") if state else None, entry.name, entry.original_name):
            if name:
                dead.add((entry.domain, str(name).strip().lower()))
    for state in hass.states.async_all():
        if state.state == "unavailable":
            dead.add((state.domain, str(state.attributes.get("friendly_name") or "").strip().lower()))
    return dead


def _empty_answer(response):
    """A question Home Assistant answered at home with nothing found (« Personne », « Aucun appareil »)."""
    return response.response_type == intent.IntentResponseType.QUERY_ANSWER and not response.matched_states


def _succeeded(result, data):
    """A tool result that is not an error, in either Home Assistant shape."""
    if getattr(getattr(result, "result", None), "error", False):
        return False
    if not isinstance(data, dict):
        return data is not None
    if "error" in data or data.get("response_type") == "error":
        return False
    return not (data.get("data") or {}).get("failed")


def _name(hass, entity_id):
    state = hass.states.get(entity_id)
    return str(state.attributes.get("friendly_name") or entity_id) if state else entity_id


def _schema(tool, serializer):
    """The tool's parameters as JSON schema: probatio since Home Assistant 2026.10, voluptuous before."""
    if getattr(tool, "json_schema", None):
        return tool.json_schema
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
