"""Voice model migration keeps labelled examples and excludes unlabelled ambient sound."""
import importlib.util
import asyncio
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "custom_components" / "mp_glass"


def load_voice_module():
    package = types.ModuleType("wake_policy_test")
    package.__path__ = [str(PACKAGE)]
    vol = types.ModuleType("voluptuous")
    vol.All = lambda *args, **kwargs: None
    vol.Length = lambda *args, **kwargs: None
    vol.Match = lambda *args, **kwargs: None
    ha = types.ModuleType("homeassistant")
    components = types.ModuleType("homeassistant.components")
    components.websocket_api = types.ModuleType("homeassistant.components.websocket_api")
    core = types.ModuleType("homeassistant.core")
    core.callback = lambda f: f
    helpers = types.ModuleType("homeassistant.helpers")
    event = types.ModuleType("homeassistant.helpers.event")
    event.async_call_later = lambda *args: None
    event.async_track_time_change = lambda *args, **kwargs: None
    modules = {"wake_policy_test": package, "voluptuous": vol, "homeassistant": ha, "homeassistant.components": components,
               "homeassistant.core": core, "homeassistant.helpers": helpers, "homeassistant.helpers.event": event}
    with patch.dict(sys.modules, modules):
        spec = importlib.util.spec_from_file_location("wake_policy_test.wake_voice", PACKAGE / "wake_voice.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


class WakeVoicePolicyTest(unittest.TestCase):
    def test_rebuild_uses_explicit_examples_and_keeps_ambient_file(self):
        voice = load_voice_module()
        data = {"recordings": ["word"], "noisy": ["noisy"], "sentences": ["sentence"], "hard": ["cancelled"], "confirmed": ["confirmed"]}
        with tempfile.TemporaryDirectory() as folder:
            ambient = Path(voice.ambient_path(folder))
            ambient.write_bytes(b"not-a-labelled-example")
            with patch.object(voice, "load_voice", return_value=data), patch.object(voice.trainer, "build", return_value={}) as build, patch.object(voice.trainer, "to_client", return_value={"kind": "voice"}):
                model = voice.train(folder, "word", "known-background")
            build.assert_called_once_with(data["recordings"], data["noisy"], "known-background", data["sentences"], hard=data["hard"], confirmed=data["confirmed"])
            self.assertEqual(model["training_revision"], voice.TRAINING_REVISION)
            self.assertEqual(ambient.read_bytes(), b"not-a-labelled-example")
            self.assertFalse(voice.stale(folder, "word"))
            voice.write_model(folder, "word", {"trained": model["trained"]})
            self.assertTrue(voice.stale(folder, "word"))


class WakeVoiceMigrationTest(unittest.IsolatedAsyncioTestCase):
    async def test_two_screens_rebuild_the_old_model_only_once(self):
        voice = load_voice_module()
        class Hass:
            async def async_add_executor_job(self, func, *args):
                await asyncio.sleep(0)
                return func(*args)
        runtime = voice.WakeVoice(Hass(), "folder")
        runtime._background = "background"
        model = {"training_revision": 0}
        def rebuild(*_args):
            model["training_revision"] = voice.TRAINING_REVISION
            return dict(model)
        with patch.object(voice, "read_model", side_effect=lambda *_args: dict(model)), patch.object(voice, "train", side_effect=rebuild) as train:
            results = await asyncio.gather(runtime.current_model("word"), runtime.current_model("word"))
        self.assertEqual([m["training_revision"] for m in results], [voice.TRAINING_REVISION] * 2)
        train.assert_called_once()


if __name__ == "__main__":
    unittest.main()
