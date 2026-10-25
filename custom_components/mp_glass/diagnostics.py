"""Diagnostics intentionally exclude names, entities, states and mappings."""
from homeassistant.const import __version__ as ha_version
from .const import DOMAIN, VERSION


async def async_get_config_entry_diagnostics(hass, entry):
    record = hass.data[DOMAIN].read()
    music = hass.data.get("mp_glass_music")
    return {"mp_glass_version": VERSION, "ha_version": ha_version, "schema_version": record["project"]["schema_version"], "revision": record["revision"], "override_count": len(record["project"]["overrides"]), "role_count": len(record["project"]["roles"]), "music_assistant": {"configured": bool(music and music.enabled), "last_error": music.last_error if music else None}}
