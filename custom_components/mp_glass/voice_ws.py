"""Deliver Nexus speech over the dashboard's authenticated Home Assistant connection."""
import base64
import logging

import voluptuous as vol
from homeassistant.components import websocket_api

_LOGGER = logging.getLogger(__name__)
MAX_TEXT = 8000
MAX_AUDIO = 4 * 1024 * 1024
VOICES = "mp_glass_voices"


@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/assistant/voice_audio",
    vol.Required("engine"): vol.All(str, vol.Match(r"^tts\.[a-z0-9_]+$")),
    vol.Required("message"): vol.All(str, vol.Length(min=1, max=MAX_TEXT)),
    vol.Required("language"): vol.All(str, vol.Length(min=1, max=20)),
    vol.Optional("voice"): vol.All(str, vol.Length(max=200)),
})
@websocket_api.async_response
async def websocket_voice_audio(hass, connection, msg):
    """Render only the installed Nexus voice, with the same options as its TTS entity."""
    entity = hass.data.get(VOICES)
    if entity is None or entity.entity_id != msg["engine"]:
        connection.send_error(msg["id"], "nexus_voice_unavailable", "Voix Nexus indisponible ou différente du moteur choisi.")
        return
    try:
        extension, audio = await entity.async_get_tts_audio(msg["message"], msg["language"], {"voice": msg["voice"]} if msg.get("voice") else {})
        if extension != "mp3" or not audio or len(audio) > MAX_AUDIO:
            connection.send_error(msg["id"], "nexus_voice_invalid", "Son vocal vide, trop long ou dans un format inattendu.")
            return
        connection.send_result(msg["id"], {"audio": base64.b64encode(audio).decode("ascii"), "mime": "audio/mpeg"})
    except Exception as err:  # noqa: BLE001 - do not expose external-service details to the client.
        _LOGGER.warning("Nexus voice generation failed: %s", err)
        connection.send_error(msg["id"], "nexus_voice_failed", "Voix Nexus n'a pas pu générer le son. Consultez les journaux Home Assistant.")


COMMANDS = (websocket_voice_audio,)
