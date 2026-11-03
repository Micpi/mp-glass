"""The MP Nexus assistant without Home Assistant: what is sent to the language model and how its answer is read.

The model is reached through the OpenAI-compatible chat API that Groq (and most hosted models) offer.
"""
import json
import re

GROQ_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "openai/gpt-oss-120b"
# Turns between the model and the tools of the house for a single request.
MAX_TOOL_TURNS = 8
# Messages of an ongoing conversation kept for the model, besides the instructions.
MAX_HISTORY = 12

PROMPT = """Tu es Nexus, l'assistant de la maison dans MP Nexus, le tableau de bord Home Assistant du foyer.
Tu réponds dans la langue de la personne, en une ou deux phrases courtes, naturelles, faites pour être lues à voix haute : pas de liste, pas de Markdown, pas d'identifiant technique.
Tu agis avec les outils fournis plutôt que de décrire ce qu'il faudrait faire. Pour une demande en plusieurs étapes (une ambiance, « mode cinéma », « je pars »), enchaîne les actions utiles puis résume ce que tu as fait.
Avant de déverrouiller une serrure, de désarmer une alarme ou d'ouvrir une porte de garage ou un portail, demande une confirmation explicite et n'agis qu'après un « oui ».
Si un appareil ou une pièce n'existe pas, dis-le simplement. N'invente jamais un état : lis-le avec les outils."""


def clean_key(api_key):
    """The key as typed, without the spaces a copy and paste leaves; None when it cannot be one."""
    key = (api_key or "").strip()
    return key if key and not re.search(r"[^\x21-\x7e]", key) else None


def base_url(url):
    return (url or "").strip().rstrip("/") or GROQ_URL


def tool_spec(name, description, parameters):
    spec = {"name": name, "parameters": parameters or {"type": "object", "properties": {}}}
    if description:
        spec["description"] = description
    return {"type": "function", "function": spec}


def to_messages(contents):
    """The chat log as the OpenAI chat API reads it.

    Each entry is a dict: role (system, user, assistant, tool_result), content, and for the assistant its tool calls
    (id, name, args); for a tool result its call id and result. Only the last MAX_HISTORY messages after the system
    prompt are kept, and never a tool result whose call was cut off.
    """
    messages = []
    for item in contents:
        role = item.get("role")
        if role in ("system", "user"):
            messages.append({"role": role, "content": item.get("content") or ""})
        elif role == "assistant":
            calls = item.get("tool_calls") or []
            message = {"role": "assistant", "content": item.get("content") or (None if calls else "")}
            if calls:
                message["tool_calls"] = [{"id": c["id"], "type": "function", "function": {"name": c["name"], "arguments": json.dumps(c.get("args") or {}, ensure_ascii=False)}} for c in calls]
            messages.append(message)
        elif role == "tool_result":
            messages.append({"role": "tool", "tool_call_id": item["tool_call_id"], "content": json.dumps(item.get("result"), ensure_ascii=False, default=str)})
    system = [m for m in messages if m["role"] == "system"][:1]
    rest = [m for m in messages if m["role"] != "system"]
    if len(rest) > MAX_HISTORY:
        rest = rest[-MAX_HISTORY:]
        # A history never starts on an answer to a call it no longer holds.
        while rest and rest[0]["role"] != "user":
            rest.pop(0)
    return system + rest


def build_request(model, messages, tools):
    model = model or DEFAULT_MODEL
    # The free tier counts the tokens a request may produce against its per-minute quota: short answers, little reasoning.
    payload = {"model": model, "messages": messages, "temperature": 0.3, "max_tokens": 700}
    if "gpt-oss" in model:
        payload["reasoning_effort"] = "low"
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    return payload


def _arguments(raw):
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(raw or "{}")
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def read_answer(body):
    """(text, tool calls) of a chat completion; tool calls as dicts with id, name and args, empty or None values dropped."""
    try:
        message = (json.loads(body) if isinstance(body, (str, bytes, bytearray)) else body)["choices"][0]["message"]
    except (ValueError, KeyError, IndexError, TypeError) as err:
        raise AssistantError("bad_answer", "Réponse illisible du fournisseur IA.") from err
    calls = []
    for index, call in enumerate(message.get("tool_calls") or []):
        function = call.get("function") or {}
        if not function.get("name"):
            continue
        args = {k: v for k, v in _arguments(function.get("arguments")).items() if v not in (None, "", [])}
        calls.append({"id": call.get("id") or f"call_{index}", "name": function["name"], "args": args})
    return (message.get("content") or "").strip(), calls


class AssistantError(Exception):
    def __init__(self, code, detail):
        super().__init__(detail)
        self.code, self.detail = code, detail


def provider_error(status, body, api_key=""):
    """A refusal of the provider in words the household understands, without ever repeating the key."""
    try:
        message = str((json.loads(body).get("error") or {}).get("message") or "")
    except (ValueError, AttributeError):
        message = ""
    if api_key:
        message = message.replace(api_key, "***")
    if status in (401, 403):
        return AssistantError("auth", "La clé de l'IA est refusée : vérifiez-la dans les options de l'intégration MP Nexus.")
    if status == 429:
        if re.search(r"per day|\(RPD\)|\(TPD\)", message, re.I):
            return AssistantError("quota", "Le quota gratuit du jour de l'IA est atteint. Les commandes simples marchent toujours ; le reste reviendra demain.")
        return AssistantError("quota", "Le quota gratuit de l'IA est atteint pour le moment. Réessayez dans une minute.")
    if status == 404 or "model" in message.lower() and status == 400:
        return AssistantError("model", f"Le modèle d'IA choisi n'est pas disponible ({message or status}). Changez-le dans les options de l'intégration MP Nexus.")
    if status >= 500:
        return AssistantError("unavailable", "Le service d'IA ne répond pas pour le moment.")
    return AssistantError("request", f"Le service d'IA a refusé la demande ({message or status}).")


# Longest wait for the per-minute quota before giving up: a spoken request cannot hang longer.
MAX_QUOTA_WAIT = 12.0


def quota_wait(status, retry_after, body):
    """Seconds to wait before the same request fits the per-minute quota again; None when it is not worth waiting."""
    if status != 429:
        return None
    try:
        wait = float(retry_after)
    except (TypeError, ValueError):
        try:
            message = str((json.loads(body).get("error") or {}).get("message") or "")
        except (ValueError, AttributeError, TypeError):
            message = ""
        found = re.search(r"try again in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s", message)
        if not found:
            return None
        hours, minutes, seconds = found.groups()
        wait = int(hours or 0) * 3600 + int(minutes or 0) * 60 + float(seconds)
    return wait if 0 <= wait <= MAX_QUOTA_WAIT else None


_POLITE = re.compile(r"[\s,;.!?]*\b(?:s['’]il (?:te|vous) pla[iî]t|stp|svp|merci(?: beaucoup)?|please|thanks?(?: you)?|bitte|danke|per favore|grazie|пожалуйста|спасибо)(?=$|[\s,;.!?])[\s,;.!?]*", re.I)
_CALL = re.compile(r"^\s*(?:(?:hey|hé|ok|dis)\s+)?nexus\b[\s,;.!?]*", re.I)


def plain_command(text):
    """The request without its name call and politeness, as Home Assistant's own sentences expect: « Nexus, éteins la cuisine s'il te plaît » → « éteins la cuisine »."""
    plain = _POLITE.sub(" ", _CALL.sub("", text or ""))
    return " ".join(plain.split()).strip(" ,;.!?")


def done_answer(names, language):
    """What Nexus says when the actions are done but the AI could not phrase the answer."""
    listed = ", ".join(names)
    if (language or "").lower().startswith("fr"):
        return f"C'est fait : {listed}." if listed else "C'est fait."
    return f"Done: {listed}." if listed else "Done."


def touched_entities(results):
    """Entities the tools acted on, from their results (Home Assistant intent responses), in order and once each."""
    seen = []
    for result in results:
        data = (result or {}).get("data") if isinstance(result, dict) else None
        for target in (data or {}).get("success") or []:
            entity = target.get("id") if isinstance(target, dict) else None
            if target.get("type") == "entity" and isinstance(entity, str) and "." in entity and entity not in seen:
                seen.append(entity)
    return seen


def tool_result_data(item):
    """What a tool answered, whatever Home Assistant wraps it in: `result.data` since 2026.10, `tool_result` before."""
    result = getattr(item, "result", None)
    if result is not None and hasattr(result, "data"):
        return result.data
    return getattr(item, "tool_result", None)


def household(persons):
    """Who lives here and who is home, from person states (entity_id, name, state)."""
    home = [p["name"] for p in persons if p["state"] == "home"]
    away = [p["name"] for p in persons if p["state"] != "home"]
    return {"à_la_maison": home, "absents": away}


# ——— Voice: speech to text with Whisper on the same provider ———
STT_MODEL = "whisper-large-v3-turbo"
# Half a minute of speech is about 150 kB; Home Assistant refuses WebSocket messages over 4 MB, base64 included.
MAX_AUDIO_BYTES = 2 * 1024 * 1024
AUDIO_TYPES = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a", "audio/aac": "m4a"}


def audio_name(mime):
    """The file name Whisper expects for a recording type (it reads the format from the extension); None when unsupported."""
    ext = AUDIO_TYPES.get((mime or "").split(";")[0].strip().lower())
    return f"voice.{ext}" if ext else None


def stt_language(language):
    """Whisper takes the two-letter code: « fr-FR » becomes « fr »; anything else lets it guess."""
    code = (language or "").split("-")[0].split("_")[0].lower()
    return code if re.fullmatch(r"[a-z]{2}", code) else None


def read_transcript(body):
    try:
        text = (json.loads(body) if isinstance(body, (str, bytes, bytearray)) else body).get("text")
    except (ValueError, AttributeError) as err:
        raise AssistantError("bad_answer", "Transcription illisible.") from err
    return " ".join(str(text or "").split())
