"""Authenticated MP Nexus scene editor. No access to arbitrary service calls or YAML."""
import asyncio
from copy import deepcopy
import uuid

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_CONTROL, POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.core import Context, State
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.state import async_reproduce_state
from homeassistant.helpers.storage import Store
from homeassistant.helpers import area_registry as ar, device_registry as dr, entity_registry as er

from .scenes_core import ATTRS, SceneBook, snapshot, validate_scene

KEY = "mp_glass_scenes"


class SceneRuntime:
    def __init__(self, hass, store, book):
        self.hass, self.store, self.book = hass, store, book
        self.lock = asyncio.Lock()
        self.entities = {}
        self.add_entities = None

    def targets(self, value):
        return [value["source"]] if value.get("source") else [s["entity_id"] for s in value["entities"]]

    def authorize(self, user, value, *, available=False, check_current=True):
        if user is not None and not user.is_active:
            raise ValueError("forbidden")
        for entity_id in self.targets(value):
            if user is not None and not user.permissions.check_entity(entity_id, POLICY_CONTROL):
                raise ValueError("forbidden")
            if not check_current:
                continue
            current = self.hass.states.get(entity_id)
            if current is None or available and (current.state == "unavailable" or current.state == "unknown" and not entity_id.startswith("scene.")):
                raise ValueError("unavailable")
            if value.get("source") and current.attributes.get("mp_nexus_scene"):
                raise ValueError("invalid_scene")
        if not check_current:
            return
        for target in value["entities"]:
            current = self.hass.states.get(target["entity_id"])
            domain, state, attrs = target["entity_id"].split(".", 1)[0], target["state"], target["attributes"]
            if domain == "climate" and state not in current.attributes.get("hvac_modes", [current.state]):
                raise ValueError("unsupported_setting")
            if domain in {"select", "input_select"} and state not in current.attributes.get("options", []):
                raise ValueError("unsupported_setting")
            for field, options in {"preset_mode": "preset_modes", "fan_mode": "fan_modes", "swing_mode": "swing_modes", "effect": "effect_list", "source": "source_list", "sound_mode": "sound_mode_list", "mode": "available_modes"}.items():
                if field in attrs and attrs[field] not in current.attributes.get(options, [attrs[field]]):
                    raise ValueError("unsupported_setting")
            for field, low, high in (("temperature", "min_temp", "max_temp"), ("target_temp_low", "min_temp", "max_temp"), ("target_temp_high", "min_temp", "max_temp"), ("color_temp_kelvin", "min_color_temp_kelvin", "max_color_temp_kelvin"), ("humidity", "min_humidity", "max_humidity")):
                if field in attrs and not current.attributes.get(low, -1000) <= attrs[field] <= current.attributes.get(high, 20000):
                    raise ValueError("unsupported_setting")
            if domain in {"number", "input_number"}:
                try:
                    number = float(state)
                    if not current.attributes.get("min", -1e9) <= number <= current.attributes.get("max", 1e9):
                        raise ValueError
                except (ValueError, TypeError):
                    raise ValueError("unsupported_setting") from None
            if attrs.get("target_temp_low", -1000) > attrs.get("target_temp_high", 1000):
                raise ValueError("unsupported_setting")

    def can_edit(self, user, value):
        try:
            self.authorize(user, value, check_current=False)
            return True
        except ValueError:
            return False

    async def activate(self, value, context):
        user = await self.hass.auth.async_get_user(context.user_id) if context and context.user_id else None
        if context and context.user_id and user is None:
            raise HomeAssistantError("Scene access denied")
        try:
            self.authorize(user, value, available=True)
        except ValueError as error:
            raise HomeAssistantError(str(error)) from error
        if value.get("source"):
            await self.hass.services.async_call("scene", "turn_on", {"entity_id": value["source"], "transition": value["transition"]}, blocking=True, context=context)
        else:
            await async_reproduce_state(self.hass, [State(s["entity_id"], s["state"], s["attributes"]) for s in value["entities"]], context=context, reproduce_options={"transition": value["transition"]})

    def exported(self, value, user):
        entity = self.entities.get(value["id"])
        return {**deepcopy(value), "entity_id": entity.entity_id if entity else None, "editable": self.can_edit(user, value)}


async def async_setup_scenes(hass):
    store = Store(hass, 1, KEY)
    hass.data[KEY] = SceneRuntime(hass, store, SceneBook(await store.async_load()))
    if not hass.data.get("mp_glass_scenes_registered"):
        for command in (websocket_list, websocket_save, websocket_delete, websocket_preview, websocket_snapshot):
            websocket_api.async_register_command(hass, command)
        hass.data["mp_glass_scenes_registered"] = True


def runtime(hass):
    result = hass.data.get(KEY)
    if result is None:
        raise ValueError("not_loaded")
    return result


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/scenes/list"})
@websocket_api.async_response
async def websocket_list(hass, connection, msg):
    try:
        rt, user = runtime(hass), connection.user
        records = [rt.exported(s, user) for s in rt.book.records.values() if all(user.permissions.check_entity(e, POLICY_READ) for e in rt.targets(s))]
        candidates = [s.entity_id for s in hass.states.async_all() if s.domain in ATTRS and s.state not in {"unknown", "unavailable"} and user.permissions.check_entity(s.entity_id, POLICY_CONTROL)]
        native = [s.entity_id for s in hass.states.async_all("scene") if not s.attributes.get("mp_nexus_scene") and user.permissions.check_entity(s.entity_id, POLICY_CONTROL)]
        entities, devices, areas = er.async_get(hass), dr.async_get(hass), ar.async_get(hass)
        rooms = {}
        for entity_id in set(candidates) | {e["entity_id"] for s in records for e in s["entities"]}:
            entity = entities.async_get(entity_id)
            device = devices.async_get(entity.device_id) if entity and entity.device_id else None
            area = areas.async_get_area(entity.area_id or (device.area_id if device else None)) if entity else None
            if area:
                rooms[entity_id] = area.name
        connection.send_result(msg["id"], {"scenes": records, "candidates": candidates, "native": native, "can_create": bool(candidates or native), "areas": rooms})
    except ValueError as error:
        connection.send_error(msg["id"], str(error), str(error))


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/scenes/save", vol.Optional("scene_id"): vol.Match(r"^[a-f0-9]{32}$"), vol.Required("revision"): vol.All(int, vol.Range(min=0)), vol.Required("scene"): dict})
@websocket_api.async_response
async def websocket_save(hass, connection, msg):
    try:
        rt = runtime(hass)
        value = validate_scene(msg["scene"])
        async with rt.lock:
            scene_id = msg.get("scene_id") or uuid.uuid4().hex
            existing = rt.book.records.get(scene_id)
            if existing:
                rt.authorize(connection.user, existing, check_current=False)
            rt.authorize(connection.user, value)
            updated = SceneBook(rt.book.read())
            result = updated.put(scene_id, msg["revision"], value)
            await rt.store.async_save(updated.read())
            rt.book = updated
            entity = rt.entities.get(scene_id)
            if entity:
                entity.refresh()
            elif rt.add_entities:
                from .scene import NexusScene
                rt.add_entities([NexusScene(rt, scene_id)])
        connection.send_result(msg["id"], rt.exported(result, connection.user))
    except ValueError as error:
        connection.send_error(msg["id"], str(error), str(error))
    except Exception:
        connection.send_error(msg["id"], "save_failed", "Scene was not saved")


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/scenes/delete", vol.Required("scene_id"): vol.Match(r"^[a-f0-9]{32}$"), vol.Required("revision"): vol.All(int, vol.Range(min=1))})
@websocket_api.async_response
async def websocket_delete(hass, connection, msg):
    try:
        rt = runtime(hass)
        async with rt.lock:
            existing = rt.book.records.get(msg["scene_id"])
            if existing is None:
                raise ValueError("not_found")
            rt.authorize(connection.user, existing, check_current=False)
            updated = SceneBook(rt.book.read())
            updated.delete(msg["scene_id"], msg["revision"])
            await rt.store.async_save(updated.read())
            rt.book = updated
            entity = rt.entities.get(msg["scene_id"])
            if entity:
                await entity.async_remove()
                registry = er.async_get(hass)
                if registry.async_get(entity.entity_id):
                    registry.async_remove(entity.entity_id)
        connection.send_result(msg["id"], None)
    except ValueError as error:
        connection.send_error(msg["id"], str(error), str(error))
    except Exception:
        connection.send_error(msg["id"], "save_failed", "Scene was not deleted")


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/scenes/preview", vol.Required("scene"): dict})
@websocket_api.async_response
async def websocket_preview(hass, connection, msg):
    try:
        rt = runtime(hass)
        value = validate_scene(msg["scene"])
        rt.authorize(connection.user, value, available=True)
        await rt.activate(value, Context(user_id=connection.user.id))
        connection.send_result(msg["id"], None)
    except (ValueError, HomeAssistantError) as error:
        connection.send_error(msg["id"], str(error), str(error))


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/scenes/snapshot", vol.Required("entities"): vol.All([str], vol.Length(min=1, max=80))})
@websocket_api.async_response
async def websocket_snapshot(hass, connection, msg):
    try:
        runtime(hass)
        result = []
        for entity_id in dict.fromkeys(msg["entities"]):
            if not connection.user.permissions.check_entity(entity_id, POLICY_CONTROL):
                raise ValueError("forbidden")
            state = hass.states.get(entity_id)
            if state is None:
                raise ValueError("unavailable")
            result.append(snapshot(entity_id, state.state, state.attributes))
        connection.send_result(msg["id"], {"entities": result})
    except ValueError as error:
        connection.send_error(msg["id"], str(error), str(error))
