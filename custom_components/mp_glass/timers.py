"""Timers and alarms of Nexus, kept by Home Assistant and rung on every open MP Nexus screen.

Created by voice (understood at home first, then by the language model's tools), listed and stopped from the screens.
Each ring also fires an event on Home Assistant's bus (`mp_glass_timer_done`, `mp_glass_alarm`) for automations, and
becomes a persistent notification when no screen is open to ring.
"""
import logging
import time
import uuid

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers import llm
from homeassistant.helpers.event import async_call_later, async_track_point_in_utc_time
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import timers_core as core
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)
KEY = "mp_glass_timers"
STORE_KEY = f"{DOMAIN}.timers"
MAX_ITEMS = 20
# A ring that nobody stops ends by itself; a ring missed while Home Assistant was off is still rung if it is recent.
RING_SECONDS = 300
LATE_SECONDS = 600
SNOOZE_SECONDS = 9 * 60


class TimerRuntime:
    def __init__(self, hass):
        self.hass = hass
        self.store = Store(hass, 1, STORE_KEY)
        self.items = {}
        self.ringing = {}
        self._handles = {}
        self._stops = {}
        self._subscribers = set()

    # ——— Storage and schedule ———
    async def load(self):
        data = await self.store.async_load() or {}
        now = time.time()
        for item in data.get("items", []):
            self.items[item["id"]] = item
        for item in list(self.items.values()):
            if item["next"] >= now:
                self._schedule(item)
            elif now - item["next"] <= LATE_SECONDS:
                self._fire(item["id"])
            elif item["kind"] == "alarm" and item.get("days"):
                self._advance(item)
            else:
                self.items.pop(item["id"], None)
        self._save()

    def _save(self):
        self.store.async_delay_save(lambda: {"items": list(self.items.values())}, 2)

    def _schedule(self, item):
        if cancel := self._handles.pop(item["id"], None):
            cancel()
        when = dt_util.utc_from_timestamp(item["next"])
        self._handles[item["id"]] = async_track_point_in_utc_time(self.hass, callback(lambda _now, i=item["id"]: self._fire(i)), when)

    def close(self):
        for cancel in [*self._handles.values(), *self._stops.values()]:
            cancel()
        self._handles.clear()
        self._stops.clear()
        self._subscribers.clear()

    # ——— What there is ———
    def full(self):
        return len(self.items) >= MAX_ITEMS

    def start_timer(self, seconds, label=""):
        seconds = int(max(1, min(seconds, core.MAX_TIMER_SECONDS)))
        item = {"id": uuid.uuid4().hex[:8], "kind": "timer", "label": (label or "")[: core.MAX_LABEL], "seconds": seconds, "next": time.time() + seconds}
        self._add(item)
        return item

    def set_alarm(self, hour, minute, days=(), tomorrow=False, weekday=None, label=""):
        ring = core.next_ring(dt_util.now(), int(hour), int(minute), tuple(days or ()), bool(tomorrow), weekday)
        item = {"id": uuid.uuid4().hex[:8], "kind": "alarm", "label": (label or "")[: core.MAX_LABEL], "hour": int(hour), "minute": int(minute),
                "days": sorted(set(days or ())), "next": ring.timestamp()}
        self._add(item)
        return item

    def _add(self, item):
        self.items[item["id"]] = item
        self._schedule(item)
        self._save()
        self._push()

    def find(self, kind="any", label="", when=None):
        """The items a sentence points to: by kind, then by label or by time of day."""
        found = [i for i in self.items.values() if kind == "any" or i["kind"] == kind]
        if label:
            wanted = core.plain(label)
            named = [i for i in found if wanted in core.plain(i["label"])]
            found = named or found
        if when:
            timed = [i for i in found if i["kind"] == "alarm" and (i["hour"], i["minute"]) == tuple(when)]
            found = timed or ([] if kind == "alarm" else found)
        return sorted(found, key=lambda i: i["next"])

    def cancel(self, item_id):
        item = self.items.pop(item_id, None)
        if cancel := self._handles.pop(item_id, None):
            cancel()
        if item is not None:
            self._save()
            self._push()
        return item

    # ——— Ringing ———
    def _advance(self, item):
        """An alarm that repeats goes on to its next day."""
        ring = core.next_ring(dt_util.now(), item["hour"], item["minute"], tuple(item["days"]))
        item["next"] = ring.timestamp()
        self._schedule(item)

    @callback
    def _fire(self, item_id):
        item = self.items.get(item_id)
        if item is None:
            return
        self._handles.pop(item_id, None)
        if item["kind"] == "alarm" and item.get("days"):
            self._advance(item)
        else:
            self.items.pop(item_id, None)
        self._save()
        self._ring(item["kind"], item.get("label", ""), item_id)

    def _ring(self, kind, label, source):
        ring_id = uuid.uuid4().hex[:8]
        self.ringing[ring_id] = {"id": ring_id, "kind": kind, "label": label, "since": time.time(), "source": source}
        self.hass.bus.async_fire("mp_glass_alarm" if kind == "alarm" else "mp_glass_timer_done", {"label": label, "id": source})
        if not self._subscribers:
            text = (label or ("Réveil" if kind == "alarm" else "Minuteur")) + (" : c'est l'heure." if kind == "alarm" else " : terminé.")
            self.hass.async_create_task(self.hass.services.async_call("persistent_notification", "create", {"title": "Nexus", "message": text, "notification_id": f"{DOMAIN}_ring_{ring_id}"}))
        self._stops[ring_id] = async_call_later(self.hass, RING_SECONDS, callback(lambda _now, r=ring_id: self.stop(r)))
        self._push()

    def stop(self, ring_id=None):
        """Silences one ring, or all of them; returns the rings that were silenced."""
        ids = [ring_id] if ring_id else list(self.ringing)
        stopped = [self.ringing.pop(r) for r in ids if r in self.ringing]
        for r in ids:
            if cancel := self._stops.pop(r, None):
                cancel()
        if stopped:
            self._push()
        return stopped

    def snooze(self, ring_id=None, seconds=SNOOZE_SECONDS):
        """Silences the ring and rings again later (an alarm stays an alarm)."""
        done = []
        for ring in self.stop(ring_id):
            item = {"id": uuid.uuid4().hex[:8], "kind": ring["kind"], "label": ring["label"], "seconds": int(seconds), "next": time.time() + int(seconds), "snoozed": True}
            if ring["kind"] == "alarm":
                item.update(hour=0, minute=0, days=[])
            self._add(item)
            done.append(item)
        return done

    # ——— The screens ———
    def snapshot(self):
        return {"now": time.time() * 1000, "timers": [self._public(i) for i in sorted(self.items.values(), key=lambda i: i["next"])],
                "ringing": list(self.ringing.values())}

    @staticmethod
    def _public(item):
        out = {"id": item["id"], "kind": item["kind"], "label": item.get("label", ""), "ends": item["next"] * 1000}
        if item["kind"] == "timer" or item.get("snoozed"):
            out["seconds"] = item.get("seconds", 0)
        if item["kind"] == "alarm" and not item.get("snoozed"):
            out.update(hour=item["hour"], minute=item["minute"], days=item.get("days", []))
        if item.get("snoozed"):
            out["snoozed"] = True
        return out

    def _push(self):
        snapshot = self.snapshot()
        for send in list(self._subscribers):
            send(snapshot)

    def subscribe(self, send):
        self._subscribers.add(send)
        send(self.snapshot())
        return lambda: self._subscribers.discard(send)

    # ——— Words ———
    def describe(self, item, language="fr"):
        """A timer or an alarm in a few words: « minuteur des pâtes, il reste 8 minutes », « réveil demain à 7 heures 30 »."""
        fr = (language or "fr").lower().startswith("fr")
        label = item.get("label") or ""
        if item["kind"] == "timer" or item.get("snoozed"):
            left = core.say_duration(item["next"] - time.time(), language)
            if fr:
                return f"{'minuteur' if item['kind'] == 'timer' else 'réveil reporté'}{' ' + label if label else ''}, il reste {left}"
            return f"{'timer' if item['kind'] == 'timer' else 'snoozed alarm'}{' ' + label if label else ''}, {left} left"
        now = dt_util.now()
        ring = dt_util.as_local(dt_util.utc_from_timestamp(item["next"]))
        days = core.say_days(item.get("days") or (), language)
        return f"{'réveil' if fr else 'alarm'}{' ' + label if label else ''} {core.say_when(ring, now, language)}{', ' + days if days else ''}"


def runtime(hass):
    found = hass.data.get(KEY)
    if found is None:
        found = hass.data[KEY] = TimerRuntime(hass)
    return found


async def async_setup_timers(hass):
    await runtime(hass).load()


def async_unload_timers(hass):
    if found := hass.data.pop(KEY, None):
        found.close()


# ——— Sentences handled at home, with no AI ———
def handle_sentence(hass, text, language="fr"):
    """The spoken answer when `text` is about timers and alarms and could be dealt with; None to let the assistant go on."""
    rt = hass.data.get(KEY)
    if rt is None:
        return None
    fr = (language or "fr").lower().startswith("fr")
    if rt.ringing:
        asked = core.understand_ringing(text)
        if asked and asked["action"] == "stop":
            rt.stop()
            return "D'accord." if fr else "Okay."
        if asked and asked["action"] == "snooze":
            done = rt.snooze(None, asked["seconds"])
            return (f"Je vous reparle dans {core.say_duration(asked['seconds'], language)}." if fr else f"Ringing again in {core.say_duration(asked['seconds'], language)}.") if done else None
    asked = core.understand(text)
    if asked is None:
        return None
    action = asked["action"]
    if action == "start_timer":
        if rt.full():
            return "Il y a déjà trop de minuteurs et de réveils." if fr else "There are too many timers and alarms already."
        item = rt.start_timer(asked["seconds"], asked["label"])
        left = core.say_duration(item["seconds"], language)
        if fr:
            return f"C'est parti : minuteur de {left}{' pour ' + item['label'] if item['label'] else ''}."
        return f"Timer set for {left}{' for ' + item['label'] if item['label'] else ''}."
    if action == "set_alarm":
        if rt.full():
            return "Il y a déjà trop de minuteurs et de réveils." if fr else "There are too many timers and alarms already."
        item = rt.set_alarm(asked["hour"], asked["minute"], asked["days"], asked["tomorrow"], asked["weekday"], asked["label"])
        return ("C'est réglé : " if fr else "Done: ") + rt.describe(item, language) + "."
    kind = asked["kind"]
    items = rt.find(kind, asked.get("label", ""), asked.get("when"))
    if action == "list":
        if not items:
            # « quels réveils » with none: maybe about something else (an alarm panel); the assistant takes it.
            if kind == "timer":
                return "Aucun minuteur en cours." if fr else "No timer is running."
            return None if kind == "any" else ("Aucun réveil programmé." if fr else "No alarm is set.")
        return ("Vous avez : " if fr else "You have: ") + " ; ".join(rt.describe(i, language) for i in items) + "."
    if action == "cancel":
        if not items:
            return ("Aucun minuteur à annuler." if fr else "There is no timer to cancel.") if kind == "timer" else None
        targets = items if asked["all"] or len(items) == 1 else items[:1]
        for item in targets:
            rt.cancel(item["id"])
        if fr:
            return "C'est annulé." if len(targets) == 1 else f"C'est annulé : {len(targets)} éléments."
        return "Cancelled." if len(targets) == 1 else f"Cancelled {len(targets)}."
    return None


# ——— The tools of the language model ———
def _result(data):
    result = getattr(llm, "ToolResult", None)
    return result(data=data) if result else data


class _Tool(llm.Tool):
    integration = DOMAIN
    # Home Assistant before 2026.10 validates the arguments with this; the model reads json_schema.
    parameters = vol.Schema({}, extra=vol.ALLOW_EXTRA)
    json_schema = None

    def _rt(self, hass):
        rt = hass.data.get(KEY)
        if rt is None:
            raise ValueError("timers not ready")
        return rt


class StartTimerTool(_Tool):
    name = "NexusStartTimer"
    description = "Démarre un minuteur (compte à rebours) qui sonnera sur les écrans de la maison."
    json_schema = {"type": "object", "properties": {"seconds": {"type": "integer", "description": "Durée en secondes"}, "label": {"type": "string", "description": "À quoi sert le minuteur (facultatif)"}}, "required": ["seconds"]}

    async def async_call(self, hass, tool_input, llm_context):
        args = tool_input.tool_args
        rt = self._rt(hass)
        if rt.full():
            return _result({"error": "trop de minuteurs et de réveils"})
        item = rt.start_timer(float(args.get("seconds") or 0), str(args.get("label") or ""))
        return _result({"ok": True, "minuteur": rt.describe(item)})


class SetAlarmTool(_Tool):
    name = "NexusSetAlarm"
    description = "Programme un réveil (alarme) à une heure précise. Les jours se donnent de 0 (lundi) à 6 (dimanche) ; sans jours, il sonne une fois."
    json_schema = {"type": "object", "properties": {
        "hour": {"type": "integer", "minimum": 0, "maximum": 23}, "minute": {"type": "integer", "minimum": 0, "maximum": 59},
        "days": {"type": "array", "items": {"type": "integer", "minimum": 0, "maximum": 6}, "description": "Jours de répétition, 0 = lundi"},
        "tomorrow": {"type": "boolean", "description": "Seulement à partir de demain"}, "label": {"type": "string"}}, "required": ["hour", "minute"]}

    async def async_call(self, hass, tool_input, llm_context):
        args = tool_input.tool_args
        rt = self._rt(hass)
        if rt.full():
            return _result({"error": "trop de minuteurs et de réveils"})
        try:
            hour, minute = int(args["hour"]), int(args["minute"])
            days = [int(d) for d in args.get("days") or [] if 0 <= int(d) <= 6]
        except (KeyError, TypeError, ValueError):
            return _result({"error": "heure illisible"})
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            return _result({"error": "heure invalide"})
        item = rt.set_alarm(hour, minute, days, bool(args.get("tomorrow")), None, str(args.get("label") or ""))
        return _result({"ok": True, "reveil": rt.describe(item)})


class ListTimersTool(_Tool):
    name = "NexusListTimers"
    description = "Liste les minuteurs en cours (avec le temps restant) et les réveils programmés."
    annotations = getattr(llm, "ToolAnnotations", None) and llm.ToolAnnotations(read_only=True, destructive=False, idempotent=True, open_world=False)
    json_schema = {"type": "object", "properties": {}}

    async def async_call(self, hass, tool_input, llm_context):
        rt = self._rt(hass)
        return _result({"items": [{"id": i["id"], "description": rt.describe(i)} for i in rt.find()]})


class CancelTimerTool(_Tool):
    name = "NexusCancelTimer"
    description = "Annule un minuteur ou un réveil (par son id donné par NexusListTimers), ou tous si all est vrai."
    json_schema = {"type": "object", "properties": {"id": {"type": "string"}, "all": {"type": "boolean"}}}

    async def async_call(self, hass, tool_input, llm_context):
        args = tool_input.tool_args
        rt = self._rt(hass)
        ids = [i["id"] for i in rt.find()] if args.get("all") else [str(args.get("id") or "")]
        done = [i for i in (rt.cancel(x) for x in ids) if i]
        return _result({"ok": bool(done), "annulés": len(done)})


TOOLS = (StartTimerTool, SetAlarmTool, ListTimersTool, CancelTimerTool)


# ——— WebSocket ———
@websocket_api.websocket_command({vol.Required("type"): "mp_glass/timers/subscribe"})
@callback
def websocket_subscribe(hass, connection, msg):
    rt = runtime(hass)

    def send(snapshot):
        connection.send_message(websocket_api.event_message(msg["id"], snapshot))

    connection.send_result(msg["id"])
    connection.subscriptions[msg["id"]] = rt.subscribe(send)


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/timers/get"})
@callback
def websocket_get(hass, connection, msg):
    connection.send_result(msg["id"], runtime(hass).snapshot())


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/timers/stop", vol.Optional("ring"): str})
@callback
def websocket_stop(hass, connection, msg):
    runtime(hass).stop(msg.get("ring"))
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/timers/snooze", vol.Optional("ring"): str, vol.Optional("seconds"): vol.All(int, vol.Range(min=30, max=3600))})
@callback
def websocket_snooze(hass, connection, msg):
    runtime(hass).snooze(msg.get("ring"), msg.get("seconds", SNOOZE_SECONDS))
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/timers/cancel", vol.Required("item"): str})
@callback
def websocket_cancel_item(hass, connection, msg):
    runtime(hass).cancel(msg["item"])
    connection.send_result(msg["id"])


COMMANDS = (websocket_get, websocket_subscribe, websocket_stop, websocket_snooze, websocket_cancel_item)
