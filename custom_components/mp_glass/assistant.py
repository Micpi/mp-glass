"""What the MP Nexus pages ask of the assistant besides a conversation: whether voice is ready, and speech to text."""
import base64
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

from .assistant_core import MAX_AUDIO_BYTES, STT_MODEL, AssistantError, audio_name, base_url, clean_key, provider_error, read_transcript, stt_language
from .const import DOMAIN

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
    form = FormData()
    form.add_field("file", audio, filename=name, content_type=msg["mime"].split(";")[0])
    form.add_field("model", STT_MODEL)
    form.add_field("response_format", "json")
    form.add_field("temperature", "0")
    if language := stt_language(msg.get("language")):
        form.add_field("language", language)
    try:
        async with async_get_clientsession(hass).post(f"{base_url(options.get('assistant_url'))}/audio/transcriptions", data=form,
                                                       headers={"Authorization": f"Bearer {key}"}, timeout=ClientTimeout(total=30), allow_redirects=False) as response:
            body = await response.read()
            if response.status != 200:
                raise provider_error(response.status, body, key)
        text = read_transcript(body)
    except (ClientError, TimeoutError):
        connection.send_error(msg["id"], "unavailable", "Le service de transcription ne répond pas pour le moment.")
        return
    except AssistantError as err:
        _LOGGER.warning("Nexus transcription: %s", err.detail)
        connection.send_error(msg["id"], err.code, err.detail)
        return
    connection.send_result(msg["id"], {"text": text})


# ——— Wake words trained for this home (« Nexus »): openWakeWord models in ONNX, kept with Home Assistant's backups ———
MAX_WAKE_BYTES = 3 * 1024 * 1024
MAX_WAKE_WORDS = 8


def wake_folder(hass):
    return hass.config.path(".storage", "mp_glass_wake_words")


def _wake_index(folder):
    try:
        with open(os.path.join(folder, "index.json"), encoding="utf-8") as handle:
            index = json.load(handle)
        return {k: str(v) for k, v in index.items() if re.fullmatch(r"[a-f0-9]{16}", k) and os.path.isfile(os.path.join(folder, f"{k}.onnx"))}
    except (OSError, ValueError, AttributeError):
        return {}


def _write_index(folder, index):
    tmp = os.path.join(folder, "index.json.tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(index, handle, ensure_ascii=False)
    os.replace(tmp, os.path.join(folder, "index.json"))


def _add_wake(folder, name, model):
    os.makedirs(folder, exist_ok=True)
    index = _wake_index(folder)
    if len(index) >= MAX_WAKE_WORDS:
        return None
    word = secrets.token_hex(8)
    with open(os.path.join(folder, f"{word}.onnx"), "wb") as handle:
        handle.write(model)
    index[word] = name
    _write_index(folder, index)
    return word


def _remove_wake(folder, word):
    index = _wake_index(folder)
    if index.pop(word, None) is None:
        return False
    os.remove(os.path.join(folder, f"{word}.onnx"))
    _write_index(folder, index)
    return True


def _read_wake(folder, word):
    if word not in _wake_index(folder):
        return None
    with open(os.path.join(folder, f"{word}.onnx"), "rb") as handle:
        return handle.read()


def looks_like_onnx(model):
    """An ONNX model is a protobuf ModelProto, which starts with its ir_version (field 1, a varint)."""
    return len(model) > 1024 and model[:1] == b"\x08"


def wake_name(name):
    return " ".join(str(name or "").split())[:40] or "Nexus"


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/wake_words"})
@websocket_api.async_response
async def websocket_wake_words(hass, connection, msg):
    index = await hass.async_add_executor_job(_wake_index, wake_folder(hass))
    connection.send_result(msg["id"], {"words": [{"id": k, "name": v} for k, v in index.items()], "max": MAX_WAKE_WORDS})


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/wake_word", vol.Required("word"): vol.All(str, vol.Match(r"^[a-f0-9]{16}$"))})
@websocket_api.async_response
async def websocket_wake_word(hass, connection, msg):
    model = await hass.async_add_executor_job(_read_wake, wake_folder(hass), msg["word"])
    if model is None:
        connection.send_error(msg["id"], "not_found", "Ce mot d'éveil n'existe plus.")
        return
    connection.send_result(msg["id"], {"model": base64.b64encode(model).decode()})


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


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "mp_glass/assistant/wake_word/remove", vol.Required("word"): vol.All(str, vol.Match(r"^[a-f0-9]{16}$"))})
@websocket_api.async_response
async def websocket_wake_word_remove(hass, connection, msg):
    if not await hass.async_add_executor_job(_remove_wake, wake_folder(hass), msg["word"]):
        connection.send_error(msg["id"], "not_found", "Ce mot d'éveil n'existe plus.")
        return
    connection.send_result(msg["id"], {})


COMMANDS = (websocket_info, websocket_transcribe, websocket_wake_words, websocket_wake_word, websocket_wake_word_add, websocket_wake_word_remove)
