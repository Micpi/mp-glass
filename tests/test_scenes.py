"""Scene contract and actual API handler bodies, without a Home Assistant installation."""
import ast
import asyncio
from copy import deepcopy
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock
import uuid

ROOT = Path(__file__).parents[1] / "custom_components/mp_glass"
spec = importlib.util.spec_from_file_location("mp_scenes_core", ROOT / "scenes_core.py")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def scene(entities=None, **changes):
    return {"name": "Soirée", "icon": "tv", "transition": 2, "entities": entities if entities is not None else [{"entity_id": "light.salon", "state": "on", "attributes": {"brightness": 75}}], **changes}


class ContractTests(unittest.TestCase):
    def test_persists_and_reloads_exactly_the_saved_targets_and_icon(self):
        book = core.SceneBook()
        saved = book.put("a" * 32, 0, scene())
        loaded = core.SceneBook(book.read())
        self.assertEqual(saved, loaded.records["a" * 32])
        self.assertEqual(saved["revision"], 1)
        saved["entities"][0]["state"] = "off"
        self.assertEqual(loaded.records["a" * 32]["entities"][0]["state"], "on")

    def test_stale_update_and_delete_preserve_newer_edits(self):
        book = core.SceneBook()
        book.put("a", 0, scene())
        book.put("a", 1, scene(name="Lecture", icon="bed"))
        for operation in (lambda: book.put("a", 1, scene()), lambda: book.delete("a", 1)):
            with self.assertRaisesRegex(ValueError, "conflict"):
                operation()
        self.assertEqual(book.records["a"]["name"], "Lecture")

    def test_snapshots_only_actionable_attributes_and_one_active_colour(self):
        target = core.snapshot("light.salon", "on", {"brightness": 90, "color_mode": "color_temp", "rgb_color": [255, 0, 0], "color_temp_kelvin": 2700, "access_token": "secret", "friendly_name": "Lamp"})
        self.assertEqual(target["attributes"], {"brightness": 90, "color_temp_kelvin": 2700})
        self.assertEqual(core.snapshot("cover.store", "opening", {"current_position": 41})["state"], "open")
        self.assertEqual(core.snapshot("media_player.tv", "buffering", {})["state"], "playing")
        self.assertEqual(core.snapshot("light.simple", "on", {"supported_color_modes": ["onoff"], "brightness": 128})["attributes"], {})
        self.assertEqual(core.snapshot("cover.simple", "open", {"supported_features": 3, "current_position": 65})["attributes"], {})
        with self.assertRaises(ValueError):
            core.snapshot("lock.porte", "unlocked", {})

    def test_rejects_unsafe_or_invalid_payloads(self):
        invalid = [scene(name=" "), scene(icon="<svg>"), scene(icon=[]), scene(transition=float("nan")), scene(transition=True), scene(transition=301), scene([]), scene(source="scene.original"), scene([], source="script.untrusted"), scene(service="lock.unlock")]
        invalid += [scene([{"entity_id": "light.salon", "state": "on", "attributes": attrs}]) for attrs in ({"token": "x"}, {"brightness": 256}, {"brightness": True}, {"rgb_color": [255, 0]}, {"rgb_color": [float("nan"), 1, 2]})]
        invalid += [scene([{"entity_id": "lock.front", "state": "unlocked", "attributes": {}}]), scene([scene()["entities"][0]] * 2)]
        for payload in invalid:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                core.validate_scene(payload)

    def test_native_scene_buttons_preserve_the_original_scene_reference(self):
        value = core.validate_scene(scene([], source="scene.vendor"))
        self.assertEqual(value["source"], "scene.vendor")
        self.assertEqual(value["entities"], [])


class FakeState:
    def __init__(self, entity_id, state, attributes=None):
        self.entity_id, self.state, self.attributes = entity_id, state, attributes or {}
        self.domain = entity_id.split(".")[0]


class API(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Execute the production handlers unchanged except for their registration decorators.
        module = ast.parse((ROOT / "scenes.py").read_text(encoding="utf-8"))
        nodes = [n for n in module.body if isinstance(n, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and n.name != "async_setup_scenes"]
        for node in nodes:
            node.decorator_list = []
        self.reproduce = AsyncMock()
        namespace = {"asyncio": asyncio, "deepcopy": deepcopy, "uuid": uuid, "SceneBook": core.SceneBook, "snapshot": core.snapshot, "validate_scene": core.validate_scene, "ATTRS": core.ATTRS, "POLICY_CONTROL": "control", "POLICY_READ": "read", "KEY": "scenes", "State": FakeState, "Context": lambda **kwargs: SimpleNamespace(**kwargs), "HomeAssistantError": RuntimeError, "async_reproduce_state": self.reproduce}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "scenes.py", "exec"), namespace)
        self.api = namespace
        self.states = {"light.salon": FakeState("light.salon", "off"), "cover.store": FakeState("cover.store", "open", {"current_position": 65}), "scene.vendor": FakeState("scene.vendor", "unknown")}
        states = SimpleNamespace(get=lambda key: self.states.get(key), async_all=lambda domain=None: [s for s in self.states.values() if domain is None or s.domain == domain])
        self.allowed = set(self.states)
        self.user = SimpleNamespace(id="member", is_active=True, is_admin=False, permissions=SimpleNamespace(check_entity=lambda entity_id, policy: policy == "read" or entity_id in self.allowed))
        self.hass = SimpleNamespace(states=states, data={}, auth=SimpleNamespace(async_get_user=AsyncMock(return_value=self.user)), services=SimpleNamespace(async_call=AsyncMock()))
        self.store = SimpleNamespace(async_save=AsyncMock())
        self.rt = namespace["SceneRuntime"](self.hass, self.store, core.SceneBook())
        self.hass.data["scenes"] = self.rt
        self.result = self.error = None
        self.connection = SimpleNamespace(user=self.user, send_result=lambda _, value: setattr(self, "result", value), send_error=lambda _, code, _text: setattr(self, "error", code))

    async def command(self, name, **message):
        self.result = self.error = None
        await self.api[f"websocket_{name}"](self.hass, self.connection, {"id": 1, **message})

    async def create(self):
        await self.command("save", scene_id="a" * 32, revision=0, scene=scene())
        self.assertIsNone(self.error)

    async def test_normal_member_can_save_without_administrator_rights(self):
        await self.create()
        self.assertEqual(self.result["icon"], "tv")
        self.assertEqual(self.result["revision"], 1)
        self.store.async_save.assert_awaited_once()
        self.reproduce.assert_not_awaited()

    async def test_read_only_account_cannot_create_preview_capture_or_delete(self):
        await self.create()
        self.allowed.clear()
        for name, payload in [("save", {"scene": scene(), "revision": 0}), ("preview", {"scene": scene()}), ("snapshot", {"entities": ["light.salon"]}), ("delete", {"scene_id": "a" * 32, "revision": 1})]:
            await self.command(name, **payload)
            self.assertEqual(self.error, "forbidden")
        self.reproduce.assert_not_awaited()
        self.assertEqual(len(self.rt.book.records), 1)

    async def test_all_target_permissions_are_checked_before_any_preview_action(self):
        self.allowed.remove("cover.store")
        await self.command("preview", scene=scene([*scene()["entities"], {"entity_id": "cover.store", "state": "closed", "attributes": {}}]))
        self.assertEqual(self.error, "forbidden")
        self.reproduce.assert_not_awaited()

    async def test_preview_passes_the_users_context_without_saving_anything(self):
        await self.command("preview", scene=scene())
        self.assertIsNone(self.error)
        self.reproduce.assert_awaited_once()
        self.assertEqual(self.reproduce.call_args.kwargs["context"].user_id, "member")
        self.assertEqual(self.rt.book.records, {})
        self.store.async_save.assert_not_awaited()

    async def test_never_run_native_scene_is_runnable_and_managed_chains_are_rejected(self):
        await self.command("preview", scene=scene([], source="scene.vendor"))
        self.assertIsNone(self.error)
        self.hass.services.async_call.assert_awaited_once()
        self.states["scene.vendor"].attributes["mp_nexus_scene"] = "managed"
        await self.command("save", scene=scene([], source="scene.vendor"), revision=0)
        self.assertEqual(self.error, "invalid_scene")

    async def test_failed_storage_keeps_the_last_committed_record_for_update_and_delete(self):
        await self.create()
        before = self.rt.book.read()
        self.store.async_save.side_effect = OSError("disk full")
        await self.command("save", scene_id="a" * 32, revision=1, scene=scene(name="Changed"))
        self.assertEqual(self.error, "save_failed")
        self.assertEqual(self.rt.book.read(), before)
        await self.command("delete", scene_id="a" * 32, revision=1)
        self.assertEqual(self.error, "save_failed")
        self.assertEqual(self.rt.book.read(), before)

    async def test_stale_client_never_overwrites_another_screens_changes(self):
        await self.create()
        await self.command("save", scene_id="a" * 32, revision=1, scene=scene(name="New"))
        await self.command("save", scene_id="a" * 32, revision=1, scene=scene(name="Old"))
        self.assertEqual(self.error, "conflict")
        self.assertEqual(self.rt.book.records["a" * 32]["name"], "New")

    async def test_missing_member_can_be_removed_from_a_scene(self):
        await self.create()
        del self.states["light.salon"]
        self.assertTrue(self.rt.can_edit(self.user, self.rt.book.records["a" * 32]))
        await self.command("save", scene_id="a" * 32, revision=1, scene=scene([{ "entity_id": "cover.store", "state": "closed", "attributes": {}}]))
        self.assertIsNone(self.error)

    async def test_out_of_range_thermostat_and_offline_preview_are_rejected(self):
        self.states["climate.room"] = FakeState("climate.room", "heat", {"hvac_modes": ["off", "heat"], "min_temp": 16, "max_temp": 28})
        self.allowed.add("climate.room")
        await self.command("save", revision=0, scene=scene([{ "entity_id": "climate.room", "state": "heat", "attributes": {"temperature": 35}}]))
        self.assertEqual(self.error, "unsupported_setting")
        self.states["light.salon"].state = "unavailable"
        await self.command("preview", scene=scene())
        self.assertEqual(self.error, "unavailable")
        self.reproduce.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
