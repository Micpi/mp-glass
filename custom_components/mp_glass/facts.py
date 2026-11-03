"""The facts Nexus was taught about the household, kept by Home Assistant (see facts_core.py for the lessons and the rules)."""
import logging

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers import llm
from homeassistant.helpers.storage import Store

from . import facts_core as core
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)
KEY = "mp_glass_facts"
STORE_KEY = f"{DOMAIN}.nexus_facts"


class FactsRuntime:
    def __init__(self, hass):
        self.hass = hass
        self.store = Store(hass, 1, STORE_KEY)
        self.facts = core.Facts()

    async def load(self):
        self.facts = core.Facts(await self.store.async_load())

    def save(self):
        self.store.async_delay_save(self.facts.as_dict, 2)

    def listing(self):
        return {"facts": self.facts.listing(), "progress": self.facts.progress(), "max": core.MAX_FACTS,
                "lessons": [{"id": l["id"], "title": l["title"], "blurb": l["blurb"]} for l in core.LESSONS]}


def runtime(hass):
    found = hass.data.get(KEY)
    if found is None:
        found = hass.data[KEY] = FactsRuntime(hass)
    return found


async def async_setup_facts(hass):
    await runtime(hass).load()


def async_unload_facts(hass):
    hass.data.pop(KEY, None)


# ——— The tools of the language model ———
def _result(data):
    result = getattr(llm, "ToolResult", None)
    return result(data=data) if result else data


class _Tool(llm.Tool):
    integration = DOMAIN
    parameters = vol.Schema({}, extra=vol.ALLOW_EXTRA)
    json_schema = None


class RememberTool(_Tool):
    name = "NexusRemember"
    description = ("Retient un fait durable sur la maison ou ses habitants : un surnom de pièce ou d'appareil, une habitude, une préférence, "
                   "ce que doit faire une ambiance. Une phrase courte et précise, avec les noms exacts. Jamais de mot de passe ni de code.")
    json_schema = {"type": "object", "properties": {
        "fact": {"type": "string", "description": "Le fait, en une phrase"},
        "topic": {"type": "string", "enum": list(core.TOPICS), "description": "maison, pieces, appareils, habitudes, ambiances, style ou autre"}}, "required": ["fact"]}

    async def async_call(self, hass, tool_input, llm_context):
        args = tool_input.tool_args
        rt = runtime(hass)
        fact = rt.facts.add(str(args.get("fact") or ""), str(args.get("topic") or "autre"))
        if fact is None:
            return _result({"error": "Je ne garde pas de mots de passe ni de codes, ni les phrases trop courtes."})
        rt.save()
        return _result({"ok": True, "retenu": fact["text"]})


class ForgetTool(_Tool):
    name = "NexusForget"
    description = "Oublie un fait appris sur la maison, retrouvé par quelques mots de la phrase à oublier."
    json_schema = {"type": "object", "properties": {"about": {"type": "string", "description": "Quelques mots du fait à oublier"}}, "required": ["about"]}

    async def async_call(self, hass, tool_input, llm_context):
        rt = runtime(hass)
        fact = rt.facts.find(str(tool_input.tool_args.get("about") or ""))
        if fact is None:
            return _result({"ok": False, "error": "Je n'ai rien retenu là-dessus."})
        rt.facts.remove(fact["id"])
        rt.save()
        return _result({"ok": True, "oublié": fact["text"]})


TOOLS = (RememberTool, ForgetTool)


def prompt_block(hass, text=""):
    """The paragraph of facts for the instructions of a request."""
    rt = hass.data.get(KEY)
    return rt.facts.block(text) if rt else ""


# ——— WebSocket: the screens list, add and remove facts ———
@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/facts"})
@callback
def websocket_facts(hass, connection, msg):
    connection.send_result(msg["id"], runtime(hass).listing())


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/facts/add", vol.Required("text"): vol.All(str, vol.Length(max=400)),
                                  vol.Optional("topic", default="autre"): str})
@callback
def websocket_add(hass, connection, msg):
    rt = runtime(hass)
    fact = rt.facts.add(msg["text"], msg["topic"])
    if fact is None:
        connection.send_error(msg["id"], "refused", "Je ne garde pas de mots de passe ni de codes, ni les phrases trop courtes.")
        return
    rt.save()
    connection.send_result(msg["id"], rt.listing())


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/facts/remove", vol.Required("fact"): str})
@callback
def websocket_remove(hass, connection, msg):
    rt = runtime(hass)
    rt.facts.remove(msg["fact"])
    rt.save()
    connection.send_result(msg["id"], rt.listing())


COMMANDS = (websocket_facts, websocket_add, websocket_remove)
