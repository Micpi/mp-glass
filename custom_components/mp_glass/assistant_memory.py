"""What Nexus learns, without Home Assistant: the requests the AI already solved, replayed at home next time.

A request is learned only when it was the first of a conversation, every tool it used succeeded, and it touched
nothing sensitive (locks, alarms, garage doors, gates). An action is replayed as is, with the same answer, without
the AI. A question replays its readings, and the AI only phrases the fresh values, in a request a few hundred
tokens long instead of several thousand.
"""
import re
import time
import unicodedata

# Phrases kept; the least recently used go first.
MAX_LEARNED = 200
# Times the AI must solve a phrase the same way before Nexus replays it at home.
SEEN_TO_LEARN = 1

SENSITIVE_DOMAINS = {"lock", "alarm_control_panel"}
SENSITIVE_CLASSES = {"garage", "gate", "door"}
# Read-only tools, when Home Assistant does not say it (before 2026.10).
READ_ONLY = {"GetLiveContext", "HassGetState", "NexusHousehold", "HassGetWeather", "GetDateTime", "HassGetCurrentDate", "HassGetCurrentTime",
             "todo_get_items", "calendar_get_events", "HassClimateGetTemperature", "HassListTimers", "HassTimerStatus"}

_PUNCTUATION = re.compile(r"[^\w\s%°]+")


def phrase_key(text):
    """The phrase as Nexus recognises it again: no accents, case, punctuation or extra spaces (Whisper varies them)."""
    plain = unicodedata.normalize("NFKD", (text or "").casefold())
    plain = "".join(c for c in plain if not unicodedata.combining(c))
    return " ".join(_PUNCTUATION.sub(" ", plain).split())


def is_read_only(name, annotated=None):
    if annotated is not None:
        return bool(annotated)
    return name.split("__", 1)[-1] in READ_ONLY


def lesson(calls, answer):
    """What to keep from a request the AI solved, or None when it must not be replayed.

    `calls` are the tools used, in order: name, args, read_only, ok, and the entities they acted on as
    (entity_id, device_class) pairs.
    """
    if not calls or not (answer or "").strip():
        return None
    for call in calls:
        if not call.get("ok"):
            return None
        args = call.get("args") or {}
        domains = args.get("domain") or []
        if isinstance(domains, str):
            domains = [domains]
        if SENSITIVE_DOMAINS & set(domains):
            return None
        for entity_id, device_class in call.get("entities") or ():
            if entity_id.split(".")[0] in SENSITIVE_DOMAINS or (device_class or "") in SENSITIVE_CLASSES:
                return None
        # Reading everything is too big to replay cheaply; a question about one room or device is not.
        if call["name"].split("__", 1)[-1] == "GetLiveContext" and not args:
            return None
    reads = [bool(call.get("read_only")) for call in calls]
    if all(reads):
        kind = "question"
    elif not any(reads):
        kind = "action"
    else:
        # « S'il fait froid, allume le chauffage »: the answer depends on what was read, the AI decides each time.
        return None
    return {"kind": kind, "calls": [{"name": c["name"], "args": c.get("args") or {}} for c in calls], "answer": answer.strip()}


class Memory:
    """Learned phrases: key → {kind, calls, answer, seen, hits, used}."""

    def __init__(self, data=None):
        self.items = dict((data or {}).get("phrases") or {})

    def as_dict(self):
        return {"phrases": self.items}

    def __len__(self):
        return sum(1 for item in self.items.values() if item.get("seen", 0) >= SEEN_TO_LEARN)

    def recall(self, text):
        """The lesson to replay for this phrase, once the AI solved it."""
        item = self.items.get(phrase_key(text))
        return item if item and item.get("seen", 0) >= SEEN_TO_LEARN else None

    def learn(self, text, learned, now=None):
        key = phrase_key(text)
        if not key or learned is None:
            return
        now = time.time() if now is None else now
        previous = self.items.get(key)
        same = previous and previous.get("calls") == learned["calls"]
        self.items[key] = {**learned, "seen": (previous.get("seen", 0) + 1) if same else 1, "hits": previous.get("hits", 0) if same else 0, "used": now}
        if len(self.items) > MAX_LEARNED:
            for old in sorted(self.items, key=lambda k: self.items[k].get("used", 0))[: len(self.items) - MAX_LEARNED]:
                del self.items[old]

    def used(self, text, now=None):
        item = self.items.get(phrase_key(text))
        if item:
            item["hits"] = item.get("hits", 0) + 1
            item["used"] = time.time() if now is None else now

    def forget(self, text=None):
        if text is None:
            self.items.clear()
        else:
            self.items.pop(phrase_key(text), None)


QUESTION_PROMPT = """Tu es Nexus, l'assistant de la maison. Réponds à la question en une phrase courte et naturelle, faite pour être lue à voix haute, uniquement à partir des relevés fournis. Pas de liste, pas de Markdown, pas d'identifiant technique."""


def question_request(model, question, readings, language):
    """A small request: the question and the fresh readings, no tools, no list of devices."""
    import json  # noqa: PLC0415
    lang = f" Réponds dans la langue « {language} »." if language and not language.lower().startswith("fr") else ""
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": QUESTION_PROMPT + lang},
            {"role": "user", "content": f"Question : {question}\nRelevés : {json.dumps(readings, ensure_ascii=False, default=str)[:6000]}"},
        ],
        "temperature": 0.2,
        "max_tokens": 300,
        **({"reasoning_effort": "low"} if "gpt-oss" in (model or "") else {}),
    }


# ——— A lighter list of devices for every request ———
_STATIC = re.compile(r"(Static Context: An overview of the areas and the devices in this smart home:\n)((?:(?:- |  ).*(?:\n|$))+)")


def compact_context(prompt, dead=None):
    """Home Assistant lists every exposed device in YAML, three lines each; the same list grouped by room takes
    about a third of the tokens: « Cuisine: Lampe cuisine (light); Volet cuisine (cover) ».
    `dead` holds (domain, lower-case name) pairs of devices that are unavailable: the model never sees them."""
    dead = dead or set()
    found = _STATIC.search(prompt or "")
    if not found:
        return prompt
    try:
        import yaml  # noqa: PLC0415 - shipped with Home Assistant.
        devices = yaml.safe_load(found.group(2))
    except Exception:  # noqa: BLE001 - an unreadable list is sent as Home Assistant wrote it.
        return prompt
    if not isinstance(devices, list):
        return prompt
    rooms = {}
    for device in devices:
        if not isinstance(device, dict) or not device.get("names"):
            continue
        if (str(device.get("domain") or ""), str(device["names"]).split(",")[0].strip().lower()) in dead:
            continue
        area = str(device.get("areas") or "").split(",")[0].strip() or "Sans pièce"
        rooms.setdefault(area, []).append(f"{device['names']} ({device.get('domain', '?')})")
    lines = [f"{area}: {'; '.join(names)}" for area, names in rooms.items()]
    compact = "Static Context: the devices of this home, by area (names, then domain):\n" + "\n".join(lines) + "\n"
    return prompt[: found.start()] + compact + prompt[found.end():]
