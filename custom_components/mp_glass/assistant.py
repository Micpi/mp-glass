"""What the MP Nexus pages ask of the assistant besides a conversation: whether voice is ready, and speech to text."""
import base64
import binascii
import logging

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


COMMANDS = (websocket_info, websocket_transcribe)
