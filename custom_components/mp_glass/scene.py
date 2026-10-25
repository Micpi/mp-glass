"""MP Nexus scenes remain native scenes: usable by routines, Assist and physical buttons."""
from homeassistant.components.scene import Scene
from homeassistant.core import callback
from homeassistant.helpers.event import async_track_state_change_event
from .scenes import KEY
from .scenes_core import ICONS


async def async_setup_entry(hass, entry, async_add_entities):
    runtime = hass.data[KEY]
    runtime.add_entities = async_add_entities
    async_add_entities([NexusScene(runtime, scene_id) for scene_id in runtime.book.records])
    entry.async_on_unload(lambda: setattr(runtime, "add_entities", None))


class NexusScene(Scene):
    _attr_should_poll = False

    def __init__(self, runtime, scene_id):
        self.runtime, self.scene_id = runtime, scene_id
        self.original = runtime.book.records[scene_id]
        self.unsub = None
        self._attr_unique_id = f"mp_glass_scene_{scene_id}"

    @property
    def name(self):
        return self.record["name"]

    @property
    def record(self):
        return self.runtime.book.records.get(self.scene_id, self.original)

    @property
    def icon(self):
        return f"mdi:{ICONS[self.record['icon']]}"

    @property
    def extra_state_attributes(self):
        record = self.record
        return {"mp_nexus_scene": self.scene_id, "mp_nexus_icon": record["icon"], "mp_nexus_source": record.get("source"), "entity_id": self.runtime.targets(record)}

    @property
    def available(self):
        record = self.runtime.book.records.get(self.scene_id)
        return bool(record and all((s := self.hass.states.get(e)) is not None and s.state != "unavailable" and (s.state != "unknown" or e.startswith("scene.")) for e in self.runtime.targets(record)))

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self.runtime.entities[self.scene_id] = self
        self.refresh()

    @callback
    def refresh(self):
        if self.unsub:
            self.unsub()
        self.unsub = async_track_state_change_event(self.hass, self.runtime.targets(self.record), self.target_changed)
        self.async_write_ha_state()

    @callback
    def target_changed(self, _event):
        self.async_write_ha_state()

    async def async_will_remove_from_hass(self):
        self.runtime.entities.pop(self.scene_id, None)
        if self.unsub:
            self.unsub()
        await super().async_will_remove_from_hass()

    async def async_activate(self, **kwargs):
        await self.runtime.activate(self.runtime.book.records[self.scene_id], self._context)
