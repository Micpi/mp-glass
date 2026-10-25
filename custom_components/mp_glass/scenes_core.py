"""Persistent scene contract, independent of Home Assistant for validation tests."""
from copy import deepcopy
import math
import re

ICONS = {
    "sparkle": "creation", "home": "home", "bulb": "lightbulb", "moon": "weather-night",
    "sun": "white-balance-sunny", "tv": "television", "music": "music", "speaker": "speaker",
    "heart": "heart", "coffee": "coffee", "bed": "bed", "sofa": "sofa", "kitchen": "silverware-fork-knife",
    "shutter": "window-shutter", "curtain": "curtains", "flame": "fire", "snow": "snowflake",
    "thermo": "thermometer", "leaf": "leaf", "door": "door", "shield": "shield-home",
    "power": "power", "clock": "clock-outline", "party": "party-popper", "star": "star",
}
ATTRS = {
    "light": {"brightness", "color_temp_kelvin", "rgb_color", "hs_color", "xy_color", "rgbw_color", "rgbww_color", "effect"},
    "cover": {"current_position", "current_tilt_position"},
    "climate": {"temperature", "target_temp_low", "target_temp_high", "preset_mode", "fan_mode", "swing_mode"},
    "media_player": {"volume_level", "is_volume_muted", "source", "sound_mode"},
    "fan": {"percentage", "preset_mode", "direction", "oscillating"},
    "humidifier": {"humidity", "mode"},
    "switch": set(), "input_boolean": set(), "select": set(), "input_select": set(),
    "number": set(), "input_number": set(), "valve": {"current_position"},
}
ENTITY = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
BOUNDS = {"brightness": (0, 255), "color_temp_kelvin": (500, 20000), "current_position": (0, 100), "current_tilt_position": (0, 100), "temperature": (-100, 150), "target_temp_low": (-100, 150), "target_temp_high": (-100, 150), "volume_level": (0, 1), "percentage": (0, 100), "humidity": (0, 100)}


def snapshot(entity_id, state, attributes):
    """Keep only reproducible state, never measured readings, credentials or arbitrary attributes."""
    domain = entity_id.split(".", 1)[0]
    if not ENTITY.fullmatch(entity_id) or domain not in ATTRS or state in {"unknown", "unavailable"}:
        raise ValueError("unsupported_entity")
    attrs = {key: deepcopy(value) for key, value in attributes.items() if key in ATTRS[domain] and value is not None}
    features = attributes.get("supported_features")
    if isinstance(features, int):
        gated = {"cover": {"current_position": 4, "current_tilt_position": 128}, "media_player": {"volume_level": 4, "is_volume_muted": 8, "source": 2048, "sound_mode": 65536}, "fan": {"percentage": 1, "oscillating": 2, "direction": 4, "preset_mode": 8}}
        for key, flag in gated.get(domain, {}).items():
            if not features & flag:
                attrs.pop(key, None)
    # One colour representation, matching the active colour mode, rather than conflicting stale attributes.
    if domain == "light":
        mode = attributes.get("color_mode")
        if attributes.get("supported_color_modes") and set(attributes["supported_color_modes"]) <= {"onoff", "unknown"}:
            attrs.pop("brightness", None)
        colour = {"color_temp": "color_temp_kelvin", "rgb": "rgb_color", "hs": "hs_color", "xy": "xy_color", "rgbw": "rgbw_color", "rgbww": "rgbww_color"}.get(mode)
        for key in ("color_temp_kelvin", "rgb_color", "hs_color", "xy_color", "rgbw_color", "rgbww_color"):
            if key != colour:
                attrs.pop(key, None)
    if domain in {"cover", "valve"}:
        state = "closed" if state == "closed" else "open"
    elif domain == "media_player" and state == "buffering":
        state = "playing"
    attrs = {key: list(value) if isinstance(value, tuple) else value for key, value in attrs.items()}
    return {"entity_id": entity_id, "state": str(state), "attributes": attrs}


def validate_scene(value):
    if not isinstance(value, dict) or set(value) - {"name", "icon", "transition", "entities", "source"}:
        raise ValueError("invalid_scene")
    name, icon = value.get("name"), value.get("icon", "sparkle")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80 or not isinstance(icon, str) or icon not in ICONS:
        raise ValueError("invalid_scene")
    transition = value.get("transition", 0)
    if isinstance(transition, bool) or not isinstance(transition, (float, int)) or not math.isfinite(transition) or not 0 <= transition <= 300:
        raise ValueError("invalid_scene")
    entities, source = value.get("entities", []), value.get("source")
    if not isinstance(entities, list) or len(entities) > 80:
        raise ValueError("invalid_scene")
    if source is not None and (not isinstance(source, str) or not ENTITY.fullmatch(source) or not source.startswith("scene.") or entities):
        raise ValueError("invalid_scene")
    if not entities and not source:
        raise ValueError("empty_scene")
    seen = set()
    for entity in entities:
        if not isinstance(entity, dict) or set(entity) != {"entity_id", "state", "attributes"}:
            raise ValueError("invalid_scene")
        entity_id, state, attrs = entity["entity_id"], entity["state"], entity["attributes"]
        if not isinstance(entity_id, str) or not ENTITY.fullmatch(entity_id) or entity_id in seen:
            raise ValueError("invalid_scene")
        seen.add(entity_id)
        domain = entity_id.split(".", 1)[0]
        if domain not in ATTRS or not isinstance(state, str) or not 1 <= len(state) <= 255 or state in {"unknown", "unavailable"} or not isinstance(attrs, dict) or set(attrs) - ATTRS[domain]:
            raise ValueError("invalid_scene")
        allowed = {"light": {"on", "off"}, "switch": {"on", "off"}, "input_boolean": {"on", "off"}, "fan": {"on", "off"}, "humidifier": {"on", "off"}, "cover": {"open", "closed"}, "valve": {"open", "closed"}, "media_player": {"on", "off", "playing", "paused", "idle", "standby"}}
        if domain in allowed and state not in allowed[domain]:
            raise ValueError("invalid_scene")
        for key, val in attrs.items():
            if key in BOUNDS:
                if isinstance(val, bool) or not isinstance(val, (float, int)) or not math.isfinite(val) or not BOUNDS[key][0] <= val <= BOUNDS[key][1]:
                    raise ValueError("invalid_scene")
            elif key in {"rgb_color", "hs_color", "xy_color", "rgbw_color", "rgbww_color"}:
                limits = {"rgb_color": [255]*3, "hs_color": [360,100], "xy_color": [1,1], "rgbw_color": [255]*4, "rgbww_color": [255]*5}[key]
                if not isinstance(val, list) or len(val) != len(limits) or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not 0 <= v <= lim for v,lim in zip(val,limits)):
                    raise ValueError("invalid_scene")
            elif key in {"is_volume_muted", "oscillating"}:
                if not isinstance(val, bool):
                    raise ValueError("invalid_scene")
            elif not isinstance(val, str) or not 1 <= len(val) <= 255:
                raise ValueError("invalid_scene")
    return {"name": name.strip(), "icon": icon, "transition": transition, "entities": deepcopy(entities), **({"source": source} if source else {})}


class SceneBook:
    def __init__(self, record=None):
        self.records = deepcopy((record or {}).get("scenes", {}))

    def read(self):
        return {"scenes": deepcopy(self.records)}

    def put(self, scene_id, revision, value):
        existing = self.records.get(scene_id)
        if revision != (existing["revision"] if existing else 0):
            raise ValueError("conflict")
        if not existing and len(self.records) >= 100:
            raise ValueError("too_many")
        scene = {**validate_scene(value), "id": scene_id, "revision": revision + 1}
        self.records[scene_id] = scene
        return deepcopy(scene)

    def delete(self, scene_id, revision):
        existing = self.records.get(scene_id)
        if not existing:
            raise ValueError("not_found")
        if revision != existing["revision"]:
            raise ValueError("conflict")
        del self.records[scene_id]
