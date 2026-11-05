"""What the MP Nexus pages ask of the assistant besides a conversation: whether voice is ready, and speech to text."""
import base64
import time
import binascii
import json
import logging
import os
import re
import secrets

import voluptuous as vol
from aiohttp import ClientError, ClientTimeout, FormData

from homeassistant.components import websocket_api
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .assistant_core import (GROQ_URL, MAX_AUDIO_BYTES, STT_FALLBACKS, STT_MODEL, SHELF_KEY, AssistantError, ModelShelf, audio_name, base_url, clean_key, is_daily_quota,
                             provider_error, read_transcript, retry_in, stt_language)
from . import wake_trainer as trainer, wake_voice as voice
from .const import DOMAIN

_WORD = vol.All(str, vol.Match(r"^[a-f0-9]{16}$"))

_LOGGER = logging.getLogger(__name__)


def _options(hass):
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0].options if entries else {}


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/info"})
@websocket_api.async_response
async def websocket_info(hass, connection, msg):
    connection.send_result(msg["id"], {"transcription": bool(clean_key(_options(hass).get("assistant_api_key")))})


@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/assistant/transcribe",
    vol.Required("audio"): vol.All(str, vol.Length(max=MAX_AUDIO_BYTES * 4 // 3 + 8)),
    vol.Required("mime"): vol.All(str, vol.Length(max=80)),
    vol.Optional("language"): vol.All(str, vol.Length(max=20)),
})
@websocket_api.async_response
async def websocket_transcribe(hass, connection, msg):
    options = _options(hass)
    key, name = clean_key(options.get("assistant_api_key")), audio_name(msg["mime"])
    if not key:
        connection.send_error(msg["id"], "no_key", "Aucune clé IA n'est configurée dans les options de l'intégration MP Nexus.")
        return
    if not name:
        connection.send_error(msg["id"], "unsupported", "Format audio non pris en charge.")
        return
    try:
        audio = base64.b64decode(msg["audio"], validate=True)
    except (binascii.Error, ValueError):
        connection.send_error(msg["id"], "invalid_audio", "Enregistrement illisible.")
        return
    if not audio or len(audio) > MAX_AUDIO_BYTES:
        connection.send_error(msg["id"], "invalid_audio", "Enregistrement vide ou trop long.")
        return
    shelf = hass.data.setdefault(SHELF_KEY, ModelShelf())
    # The transcription has its own daily quota, per model too: the second Whisper takes over when the first is spent.
    models = [m for m in (STT_MODEL, *STT_FALLBACKS) if shelf.spent.get(m, 0) <= time.time()] if base_url(options.get("assistant_url")) == GROQ_URL else [STT_MODEL]
    text, failure = None, None
    for model in models:
        form = FormData()
        form.add_field("file", audio, filename=name, content_type=msg["mime"].split(";")[0])
        form.add_field("model", model)
        # verbose_json says, for each segment, how likely it was silence and how sure Whisper was.
        form.add_field("response_format", "verbose_json")
        form.add_field("temperature", "0")
        if language := stt_language(msg.get("language")):
            form.add_field("language", language)
        try:
            async with async_get_clientsession(hass).post(f"{base_url(options.get('assistant_url'))}/audio/transcriptions", data=form,
                                                           headers={"Authorization": f"Bearer {key}"}, timeout=ClientTimeout(total=30), allow_redirects=False) as response:
                body = await response.read()
                if response.status == 429 and model != models[-1]:
                    _LOGGER.warning("Nexus transcription: quota of %s spent, next model", model)
                    shelf.spend(model, retry_in(body) if is_daily_quota(response.status, body) else 60.0, time.time())
                    continue
                if response.status != 200:
                    raise provider_error(response.status, body, key)
            text = read_transcript(body)
            break
        except (ClientError, TimeoutError):
            connection.send_error(msg["id"], "unavailable", "Le service de transcription ne répond pas pour le moment.")
            return
        except AssistantError as err:
            failure = err
            break
    if text is None:
        err = failure or AssistantError("quota", "Le quota gratuit de transcription est atteint pour le moment. Réessayez plus tard.")
        _LOGGER.warning("Nexus transcription: %s", err.detail)
        connection.send_error(msg["id"], err.code, err.detail)
        return
    connection.send_result(msg["id"], {"text": text})


# ——— Wake words for this home: openWakeWord models (.onnx, trained on Colab) or made from the user's voice ———
MAX_WAKE_BYTES = 3 * 1024 * 1024
MAX_WAKE_WORDS = 8


def wake_folder(hass):
    return hass.config.path(".storage", "mp_glass_wake_words")


def _entry(value):
    """An index entry: a name (an .onnx model, as in 0.37) or {name, kind}."""
    if isinstance(value, dict):
        return {"name": str(value.get("name") or "Nexus"), "kind": "voice" if value.get("kind") == "voice" else "model"}
    return {"name": str(value), "kind": "model"}


def _wake_index(folder):
    try:
        with open(os.path.join(folder, "index.json"), encoding="utf-8") as handle:
            index = json.load(handle)
        out = {}
        for key, value in index.items():
            entry = _entry(value)
            path = voice.voice_path(folder, key) if entry["kind"] == "voice" else os.path.join(folder, f"{key}.onnx")
            if re.fullmatch(r"[a-f0-9]{16}", key) and os.path.isfile(path):
                out[key] = entry
        return out
    except (OSError, ValueError, AttributeError):
        return {}


def _write_index(folder, index):
    tmp = os.path.join(folder, "index.json.tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump({k: (v["name"] if v["kind"] == "model" else v) for k, v in index.items()}, handle, ensure_ascii=False)
    os.replace(tmp, os.path.join(folder, "index.json"))


def _add_wake(folder, name, model):
    os.makedirs(folder, exist_ok=True)
    index = _wake_index(folder)
    if len(index) >= MAX_WAKE_WORDS:
        return None
    word = secrets.token_hex(8)
    with open(os.path.join(folder, f"{word}.onnx"), "wb") as handle:
        handle.write(model)
    index[word] = {"name": name, "kind": "model"}
    _write_index(folder, index)
    return word


def _add_voice(folder, name, data, background):
    """Saves a word made from the voice and trains it at once; returns (word, model) or None when full."""
    os.makedirs(folder, exist_ok=True)
    index = _wake_index(folder)
    if len(index) >= MAX_WAKE_WORDS:
        return None
    word = secrets.token_hex(8)
    voice.save_voice(folder, word, data)
    try:
        model = voice.train(folder, word, background)
    except Exception:
        voice.remove_voice(folder, word)
        raise
    index[word] = {"name": name, "kind": "voice"}
    _write_index(folder, index)
    return word, model


def _redo_voice(folder, word, name, data, background):
    """Records a voice word again: same id, so the screens keep choosing it. What the home taught it (cancelled false
    wakes, real requests, ordinary sounds) is kept; a failed training puts the old recordings back. None when gone."""
    index = _wake_index(folder)
    if index.get(word, {}).get("kind") != "voice":
        return None
    before = voice.load_voice(folder, word)
    old_model = voice.read_model(folder, word)
    voice.save_voice(folder, word, {**data, "confirmed": before["confirmed"], "hard": before["hard"]})
    try:
        model = voice.train(folder, word, background)
    except Exception:
        voice.save_voice(folder, word, before)
        if old_model is not None:
            voice.write_model(folder, word, old_model)
        raise
    index[word] = {"name": name, "kind": "voice"}
    _write_index(folder, index)
    return word, model


def _moved(folder):
    try:
        with open(os.path.join(folder, "moved.json"), encoding="utf-8") as handle:
            moved = json.load(handle)
        return {k: v for k, v in moved.items() if isinstance(k, str) and isinstance(v, str)} if isinstance(moved, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_moved(folder, moved):
    tmp = os.path.join(folder, "moved.json.tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(dict(list(moved.items())[-64:]), handle)
    os.replace(tmp, os.path.join(folder, "moved.json"))


def _remove_wake(folder, word):
    index = _wake_index(folder)
    entry = index.pop(word, None)
    if entry is None:
        return False
    if entry["kind"] == "voice":
        voice.remove_voice(folder, word)
    else:
        os.remove(os.path.join(folder, f"{word}.onnx"))
    _write_index(folder, index)
    # A twin of the same name stays: the screens that listened for the one removed now listen for it.
    name = str(entry.get("name", "")).casefold()
    twin = next((k for k, v in index.items() if v["kind"] == entry["kind"] and str(v.get("name", "")).casefold() == name), None)
    moved = {k: v for k, v in _moved(folder).items() if k != word}
    if twin:
        moved = {k: (twin if v == word else v) for k, v in moved.items()}
        moved[word] = twin
    else:
        moved = {k: v for k, v in moved.items() if v != word}
    _write_moved(folder, moved)
    return True


def _resolve_wake(folder, word):
    """The word itself, or the twin that replaced it when it was removed; None when it is gone."""
    index = _wake_index(folder)
    if word in index:
        return word
    target = _moved(folder).get(word)
    return target if target in index else None


def _read_wake(folder, word):
    """{"model": bytes} for an .onnx word, {"voice": model} for a voice word, None when it is gone."""
    entry = _wake_index(folder).get(word)
    if entry is None:
        return None
    if entry["kind"] == "voice":
        model = voice.read_model(folder, word)
        return {"voice": model} if model else None
    with open(os.path.join(folder, f"{word}.onnx"), "rb") as handle:
        return {"model": handle.read()}


def _voice_words(folder):
    return [k for k, v in _wake_index(folder).items() if v["kind"] == "voice"]


def looks_like_onnx(model):
    """An ONNX model is a protobuf ModelProto, which starts with its ir_version (field 1, a varint)."""
    return len(model) > 1024 and model[:1] == b"\x08"


def wake_name(name):
    return " ".join(str(name or "").split())[:40] or "Nexus"


def _runtime(hass):
    folder = wake_folder(hass)

    async def words():
        return await hass.async_add_executor_job(_voice_words, folder)
    return voice.async_setup_nightly(hass, folder, words)


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/wake_words"})
@websocket_api.async_response
async def websocket_wake_words(hass, connection, msg):
    index = await hass.async_add_executor_job(_wake_index, wake_folder(hass))
    connection.send_result(msg["id"], {"words": [{"id": k, **v} for k, v in index.items()], "max": MAX_WAKE_WORDS})


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/wake_word", vol.Required("word"): _WORD})
@websocket_api.async_response
async def websocket_wake_word(hass, connection, msg):
    folder = wake_folder(hass)
    word = await hass.async_add_executor_job(_resolve_wake, folder, msg["word"])
    found = await hass.async_add_executor_job(_read_wake, folder, word) if word else None
    if found is None:
        connection.send_error(msg["id"], "not_found", "Ce mot d'éveil n'existe plus.")
        return
    if "voice" in found:
        connection.send_result(msg["id"], {"id": word, "voice": found["voice"]})
        return
    connection.send_result(msg["id"], {"id": word, "model": base64.b64encode(found["model"]).decode()})


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/assistant/wake_word/add",
    vol.Required("name"): vol.All(str, vol.Length(max=80)),
    vol.Required("model"): vol.All(str, vol.Length(max=MAX_WAKE_BYTES * 4 // 3 + 8)),
})
@websocket_api.async_response
async def websocket_wake_word_add(hass, connection, msg):
    try:
        model = base64.b64decode(msg["model"], validate=True)
    except (binascii.Error, ValueError):
        model = b""
    if not looks_like_onnx(model) or len(model) > MAX_WAKE_BYTES:
        connection.send_error(msg["id"], "invalid_model", "Ce fichier n'est pas un modèle de mot d'éveil (.onnx d'openWakeWord).")
        return
    name = wake_name(msg["name"])
    word = await hass.async_add_executor_job(_add_wake, wake_folder(hass), name, model)
    if word is None:
        connection.send_error(msg["id"], "too_many", f"{MAX_WAKE_WORDS} mots d'éveil au plus : retirez-en un d'abord.")
        return
    connection.send_result(msg["id"], {"id": word, "name": name})


def _frames(text):
    frames = trainer.decode(text, (trainer.DIMS,))
    if not trainer.WINDOW <= len(frames) <= voice.MAX_FRAMES:
        raise ValueError("length")
    return frames


def _windows(text, most):
    windows = trainer.decode(text)
    if len(windows) > most:
        raise ValueError("too many")
    return windows


@websocket_api.require_admin
@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/assistant/wake_word/create",
    vol.Required("name"): vol.All(str, vol.Length(max=80)),
    vol.Optional("word"): _WORD,
    vol.Required("recordings"): vol.All([{vol.Required("frames"): voice._FRAMES, vol.Required("end"): vol.All(int, vol.Range(min=1, max=voice.MAX_FRAMES))}],
                                        vol.Length(min=trainer.MIN_RECORDINGS, max=voice.MAX_RECORDINGS)),
    vol.Optional("noisy", default=[]): vol.All([{vol.Required("frames"): voice._FRAMES, vol.Required("end"): vol.All(int, vol.Range(min=1, max=voice.MAX_FRAMES)),
                                                 vol.Required("source"): vol.All(int, vol.Range(min=0, max=voice.MAX_RECORDINGS - 1))}], vol.Length(max=voice.MAX_NOISY)),
    vol.Optional("sentences", default=[]): vol.All([voice._FRAMES], vol.Length(max=voice.MAX_SENTENCES)),
})
@websocket_api.async_response
async def websocket_wake_word_create(hass, connection, msg):
    try:
        data = {
            "recordings": [(_frames(r["frames"]), r["end"]) for r in msg["recordings"]],
            "noisy": [(_frames(r["frames"]), r["end"], r["source"]) for r in msg["noisy"] if r["source"] < len(msg["recordings"])],
            "sentences": [_frames(f) for f in msg["sentences"]],
        }
    except (binascii.Error, ValueError):
        connection.send_error(msg["id"], "invalid_voice", "Les enregistrements sont illisibles : recommencez.")
        return
    runtime = _runtime(hass)
    background = await runtime.background()
    name = wake_name(msg["name"])
    again = msg.get("word")
    async with runtime.lock:
        if not again:
            # The same name said again is the same word recorded again, not a second « Nexus » in the list.
            index = await hass.async_add_executor_job(_wake_index, wake_folder(hass))
            again = next((k for k, v in index.items() if v.get("kind") == "voice" and str(v.get("name", "")).casefold() == name.casefold()), None)
        if again:
            made = await hass.async_add_executor_job(_redo_voice, wake_folder(hass), again, name, data, background)
            if made is None:
                connection.send_error(msg["id"], "not_found", "Ce mot d'éveil n'existe plus.")
                return
        else:
            made = await hass.async_add_executor_job(_add_voice, wake_folder(hass), name, data, background)
    if made is None:
        connection.send_error(msg["id"], "too_many", f"{MAX_WAKE_WORDS} mots d'éveil au plus : retirez-en un d'abord.")
        return
    word, model = made
    connection.send_result(msg["id"], {"id": word, "name": name, "voice": model})


@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/assistant/wake_word/learn",
    vol.Required("word"): _WORD,
    vol.Optional("ambient"): voice._WINDOWS,
    vol.Optional("confirmed"): voice._WINDOWS,
    vol.Optional("cancelled"): voice._WINDOWS,
})
@websocket_api.async_response
async def websocket_wake_word_learn(hass, connection, msg):
    """What a screen heard while listening: ordinary sounds of the home, the word that woke Nexus for a real request,
    and the false wakes the user cancelled (learned within a minute)."""
    folder = wake_folder(hass)
    try:
        ambient = _windows(msg["ambient"], voice.MAX_AMBIENT_SENT) if msg.get("ambient") else None
        confirmed = _windows(msg["confirmed"], voice.MAX_EXAMPLES_SENT) if msg.get("confirmed") else None
        cancelled = _windows(msg["cancelled"], voice.MAX_EXAMPLES_SENT) if msg.get("cancelled") else None
    except (binascii.Error, ValueError):
        connection.send_error(msg["id"], "invalid_voice", "Exemples illisibles.")
        return
    if msg["word"] not in await hass.async_add_executor_job(_voice_words, folder):
        connection.send_error(msg["id"], "not_found", "Ce mot d'éveil n'existe plus.")
        return
    runtime = _runtime(hass)
    async with runtime.lock:
        if ambient is not None:
            await hass.async_add_executor_job(voice.add_ambient, folder, ambient)
        if confirmed is not None or cancelled is not None:
            await hass.async_add_executor_job(voice.add_examples, folder, msg["word"], confirmed, cancelled)
    if cancelled is not None:
        runtime.train_soon(msg["word"])
    connection.send_result(msg["id"], {})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/wake_word/train", vol.Required("word"): _WORD})
@websocket_api.async_response
async def websocket_wake_word_train(hass, connection, msg):
    if msg["word"] not in await hass.async_add_executor_job(_voice_words, wake_folder(hass)):
        connection.send_error(msg["id"], "not_found", "Ce mot d'éveil n'existe plus.")
        return
    model = await _runtime(hass).train(msg["word"])
    connection.send_result(msg["id"], {"voice": model})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/wake_word/remove", vol.Required("word"): _WORD})
@websocket_api.async_response
async def websocket_wake_word_remove(hass, connection, msg):
    async with _runtime(hass).lock:
        removed = await hass.async_add_executor_job(_remove_wake, wake_folder(hass), msg["word"])
    if not removed:
        connection.send_error(msg["id"], "not_found", "Ce mot d'éveil n'existe plus.")
        return
    connection.send_result(msg["id"], {})


async def async_setup_wake(hass):
    """The nightly training, from the integration's start."""
    _runtime(hass)


def async_unload_wake(hass):
    if runtime := hass.data.pop(voice.KEY, None):
        runtime.close()


COMMANDS = (websocket_info, websocket_transcribe, websocket_wake_words, websocket_wake_word, websocket_wake_word_add, websocket_wake_word_create,
            websocket_wake_word_learn, websocket_wake_word_train, websocket_wake_word_remove)
