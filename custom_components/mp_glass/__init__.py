"""MP Nexus project storage and authenticated WebSocket API."""
import logging

import voluptuous as vol
from jsonschema.exceptions import ValidationError

from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.const import Platform
from homeassistant.helpers.storage import Store

from .const import DOMAIN, VERSION
from .frontend import async_register_module, async_register_studio, async_unregister_module, async_unregister_studio
from .project import ProjectRepository, RevisionConflict, default_project, load_validator, migrate_project
from .backdrop import prune, referenced, remove_all
from .guests import async_setup_guests, async_unload_guests
from .kiosk import async_setup_kiosk
from .spatial import KEY as SPATIAL_KEY, SpatialBackdropImageView, SpatialBackdropView, SpatialRuntime, SpatialUploadView, backdrop_folder, websocket_cancel, websocket_info, websocket_job, websocket_normalize
from .music import COMMANDS as MUSIC_COMMANDS, KEY as MUSIC_KEY, MusicArtworkView, MusicAssistantRuntime
from .music_engine import COMMANDS as ENGINE_COMMANDS
from .assistant import COMMANDS as ASSISTANT_COMMANDS, async_setup_wake, async_unload_wake
from .timers import COMMANDS as TIMER_COMMANDS, async_setup_timers, async_unload_timers
from .facts import COMMANDS as FACT_COMMANDS, async_setup_facts, async_unload_facts
from .voice_ws import COMMANDS as VOICE_COMMANDS
from .wallpaper import COMMANDS as WALLPAPER_COMMANDS, VIEWS as WALLPAPER_VIEWS, wallpaper_folder
from .scenes import KEY as SCENES_KEY, async_setup_scenes

_LOGGER = logging.getLogger(__name__)
# Nexus scenes, and Nexus the assistant.
PLATFORMS = [Platform.SCENE, Platform.CONVERSATION, Platform.TTS]


async def async_setup_entry(hass, entry):
    # First, before any executor job: Home Assistant serves pages while integrations start,
    # and a page opened before this line never gets the dashboard strategy.
    await async_register_module(hass)
    validator = await hass.async_add_executor_job(load_validator)
    store = Store(hass, 1, DOMAIN)
    record = await store.async_load()
    if record is None:
        record = {"revision": 0, "project": default_project(entry.data["name"])}
        await store.async_save(record)
    else:
        migrated = migrate_project(record["project"])
        if migrated != record["project"]:
            record = {"revision": record["revision"] + 1, "project": migrated}
            await store.async_save(record)
    legacy_music = {"music_assistant_enabled", "music_assistant_url", "music_assistant_token"}
    if legacy_music.intersection(entry.options):
        hass.config_entries.async_update_entry(entry, options={key: value for key, value in entry.options.items() if key not in legacy_music})
    hass.data[DOMAIN] = ProjectRepository(store, validator, record)
    hass.data[SPATIAL_KEY] = SpatialRuntime(hass, entry.options)
    hass.data[MUSIC_KEY] = MusicAssistantRuntime(hass, entry.options)
    if not hass.data.get("mp_glass_ws_registered"):
        websocket_api.async_register_command(hass, websocket_get)
        websocket_api.async_register_command(hass, websocket_save)
        websocket_api.async_register_command(hass, websocket_job)
        websocket_api.async_register_command(hass, websocket_cancel)
        websocket_api.async_register_command(hass, websocket_normalize)
        websocket_api.async_register_command(hass, websocket_info)
        for command in (*MUSIC_COMMANDS, *ENGINE_COMMANDS, *WALLPAPER_COMMANDS, *ASSISTANT_COMMANDS, *TIMER_COMMANDS, *FACT_COMMANDS, *VOICE_COMMANDS):
            websocket_api.async_register_command(hass, command)
        hass.http.register_view(SpatialUploadView())
        hass.http.register_view(SpatialBackdropView())
        hass.http.register_view(SpatialBackdropImageView())
        hass.http.register_view(MusicArtworkView())
        for view in WALLPAPER_VIEWS:
            hass.http.register_view(view())
        hass.data["mp_glass_ws_registered"] = True
    await async_setup_guests(hass)
    await async_setup_scenes(hass)
    await async_setup_wake(hass)
    await async_setup_timers(hass)
    await async_setup_facts(hass)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    async_setup_kiosk(hass)
    await async_register_studio(hass, entry.options.get("show_settings", True))
    entry.async_on_unload(entry.add_update_listener(async_reload))
    return True


async def async_reload(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    hass.data.pop(SCENES_KEY, None)
    runtime = hass.data.pop(SPATIAL_KEY, None)
    if runtime:
        await runtime.close()
    hass.data.pop(MUSIC_KEY, None)
    async_unload_wake(hass)
    async_unload_timers(hass)
    async_unload_facts(hass)
    # The strategy module stays for the reload that usually follows; the dashboard waits for the entry meanwhile.
    async_unregister_studio(hass)
    async_unload_guests(hass)
    hass.data.pop(DOMAIN, None)
    return True


async def async_remove_entry(hass, entry):
    async_unregister_module(hass)
    await hass.async_add_executor_job(remove_all, backdrop_folder(hass))
    await hass.async_add_executor_job(remove_all, wallpaper_folder(hass))


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/project/get"})
@callback
def websocket_get(hass, connection, msg):
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "MP Nexus is not loaded")
        return
    connection.send_result(msg["id"], {**runtime.read(), "version": VERSION})


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/project/save", vol.Required("revision"): vol.All(int, vol.Range(min=0)), vol.Required("project"): dict})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_save(hass, connection, msg):
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "MP Nexus is not loaded")
        return
    try:
        record = await runtime.save(msg["revision"], msg["project"])
    except (ValidationError, ValueError):
        connection.send_error(msg["id"], "invalid_project", "Invalid project schema")
        return
    except RevisionConflict:
        connection.send_error(msg["id"], "conflict", "Reload before saving")
        return
    connection.send_result(msg["id"], record)
    # Plans no saved level shows any more are removed from the storage.
    try:
        await hass.async_add_executor_job(prune, backdrop_folder(hass), referenced(record["project"]))
    except OSError as err:
        _LOGGER.warning("MP Nexus could not remove unused plans: %s", err)
