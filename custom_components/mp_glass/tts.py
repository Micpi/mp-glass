"""Nexus voices: natural neural voices, free, with no account, through the Microsoft Edge read-aloud service.

The voices appear in Home Assistant as one more text-to-speech engine, « Voix Nexus », so the dashboard,
the voice assistant and automations can all use them.
"""
import asyncio
import logging
import time

from homeassistant.components.tts import TextToSpeechEntity, Voice
try:  # Home Assistant 2025.6+: the sound goes out while it is being made.
    from homeassistant.components.tts import TTSAudioRequest, TTSAudioResponse
except ImportError:  # pragma: no cover - older Home Assistant
    TTSAudioRequest = TTSAudioResponse = None
from homeassistant.exceptions import HomeAssistantError

from .tts_core import CATALOGUE, LANGUAGES, default_voice, pick_voice, voices_for

_LOGGER = logging.getLogger(__name__)
LIST_TTL = 86400


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([NexusVoices(entry)])


class NexusVoices(TextToSpeechEntity):
    _attr_has_entity_name = True
    _attr_name = "Voix Nexus"
    _attr_supported_languages = LANGUAGES
    _attr_default_language = "fr-FR"
    _attr_supported_options = ["voice", "rate", "pitch"]

    def __init__(self, entry):
        self._attr_unique_id = f"{entry.entry_id}_voices"
        self._listed: list[dict] | None = None
        self._listed_at = 0.0
        self._lock = asyncio.Lock()

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.hass.async_create_background_task(self._refresh(), "mp_glass voices")

    async def _refresh(self):
        """The full list of the service, refreshed once a day; the built-in catalogue meanwhile, or when it is unreachable."""
        if self._listed is not None and time.monotonic() - self._listed_at < LIST_TTL:
            return
        async with self._lock:
            try:
                import edge_tts
                listed = await asyncio.wait_for(edge_tts.list_voices(), 15)
                self._listed = [v for v in listed if isinstance(v, dict) and v.get("ShortName")]
            except Exception as err:  # noqa: BLE001 - the catalogue below still works.
                _LOGGER.debug("Nexus voices: list unavailable (%s)", err)
            self._listed_at = time.monotonic()

    def async_get_supported_voices(self, language):
        return [Voice(v["id"], v["name"]) for v in voices_for(language, self._listed)]

    async def _chunks(self, message, language, options):
        """The sound, piece by piece, as the service makes it."""
        try:
            import edge_tts
        except ImportError as err:
            raise HomeAssistantError("La bibliothèque edge-tts n'est pas installée") from err
        voice = pick_voice(options.get("voice"), language, self._listed)
        extra = {k: options[k] for k in ("rate", "pitch") if isinstance(options.get(k), str)}
        sent = False
        try:
            async with asyncio.timeout(30):
                async for chunk in edge_tts.Communicate(message, voice, **extra).stream():
                    if chunk.get("type") == "audio" and chunk.get("data"):
                        sent = True
                        yield chunk["data"]
        except Exception as err:  # noqa: BLE001 - network, service or voice error.
            _LOGGER.warning("Nexus voices: %s failed: %s", voice, err)
            raise HomeAssistantError(f"Voix Nexus indisponible : {err}") from err
        if not sent:
            raise HomeAssistantError("Voix Nexus : aucun son reçu")

    async def async_get_tts_audio(self, message, language, options):
        return "mp3", b"".join([c async for c in self._chunks(message, language, options)])

    if TTSAudioResponse is not None:
        async def async_stream_tts_audio(self, request):
            """The first words play while the rest is still being made, instead of after the whole sentence."""
            message = "".join([part async for part in request.message_gen])
            return TTSAudioResponse("mp3", self._chunks(message, request.language, request.options))


__all__ = ["NexusVoices", "CATALOGUE", "default_voice"]
