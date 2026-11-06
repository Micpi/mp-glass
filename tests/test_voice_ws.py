"""Exercise the authenticated Nexus voice handler without a running Home Assistant."""
import base64
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch


def load_module():
    vol = types.ModuleType("voluptuous")
    vol.Required = vol.Optional = lambda key: key
    vol.All = vol.Match = vol.Length = lambda *args, **kwargs: None
    ha = types.ModuleType("homeassistant")
    components = types.ModuleType("homeassistant.components")
    ws = types.ModuleType("homeassistant.components.websocket_api")
    ws.websocket_command = lambda schema: lambda func: func
    ws.async_response = lambda func: func
    components.websocket_api = ws
    modules = {"voluptuous": vol, "homeassistant": ha, "homeassistant.components": components, "homeassistant.components.websocket_api": ws}
    with patch.dict(sys.modules, modules):
        spec = importlib.util.spec_from_file_location("voice_ws_test", Path(__file__).resolve().parents[1] / "custom_components/mp_glass/voice_ws.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


class VoiceWsTest(unittest.IsolatedAsyncioTestCase):
    async def test_returns_audio_from_the_matching_nexus_engine(self):
        module = load_module()
        entity = types.SimpleNamespace(entity_id="tts.voix_nexus", async_get_tts_audio=AsyncMock(return_value=("mp3", b"sound")))
        hass = types.SimpleNamespace(data={module.VOICES: entity})
        conn = types.SimpleNamespace(send_result=AsyncMock(), send_error=AsyncMock())
        # Home Assistant's send methods are synchronous.
        conn.send_result = unittest.mock.Mock()
        conn.send_error = unittest.mock.Mock()
        msg = {"id": 1, "engine": "tts.voix_nexus", "message": "Bonjour", "language": "fr", "voice": "fr-FR-RemyNeural"}
        await module.websocket_voice_audio(hass, conn, msg)
        entity.async_get_tts_audio.assert_awaited_once_with("Bonjour", "fr", {"voice": "fr-FR-RemyNeural"})
        conn.send_result.assert_called_once_with(1, {"audio": base64.b64encode(b"sound").decode(), "mime": "audio/mpeg"})
        conn.send_error.assert_not_called()

    async def test_rejects_another_engine_and_empty_audio(self):
        module = load_module()
        entity = types.SimpleNamespace(entity_id="tts.voix_nexus", async_get_tts_audio=AsyncMock(return_value=("mp3", b"")))
        hass = types.SimpleNamespace(data={module.VOICES: entity})
        conn = types.SimpleNamespace(send_result=unittest.mock.Mock(), send_error=unittest.mock.Mock())
        msg = {"id": 2, "engine": "tts.other", "message": "Bonjour", "language": "fr"}
        await module.websocket_voice_audio(hass, conn, msg)
        entity.async_get_tts_audio.assert_not_awaited()
        self.assertEqual(conn.send_error.call_args.args[1], "nexus_voice_unavailable")
        msg["engine"] = "tts.voix_nexus"
        await module.websocket_voice_audio(hass, conn, msg)
        self.assertEqual(conn.send_error.call_args.args[1], "nexus_voice_invalid")
