"""MP Nexus project storage and authenticated WebSocket API."""
import logging

import voluptuous as vol
from jsonschema.exceptions import ValidationError

from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers.storage import Store

from .const import DOMAIN, VERSION
from .frontend import async_register_module, async_register_studio, async_unregister_module, async_unregister_studio
from .project import ProjectRepository, RevisionConflict, default_project, load_validator, migrate_project
from .backdrop import prune, referenced, remove_all
from .spatial import KEY as SPATIAL_KEY, SpatialBackdropImageView, SpatialBackdropView, SpatialRuntime, SpatialUploadView, backdrop_folder, websocket_cancel, websocket_info, websocket_job, websocket_normalize

_LOGGER = logging.getLogger(__name__)


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
    hass.data[DOMAIN] = ProjectRepository(store, validator, record)
    hass.data[SPATIAL_KEY] = SpatialRuntime(hass, entry.options)
    if not hass.data.get("mp_glass_ws_registered"):
        websocket_api.async_register_command(hass, websocket_get)
        websocket_api.async_register_command(hass, websocket_save)
        websocket_api.async_register_command(hass, websocket_job)
        websocket_api.async_register_command(hass, websocket_cancel)
        websocket_api.async_register_command(hass, websocket_normalize)
        websocket_api.async_register_command(hass, websocket_info)
        hass.http.register_view(SpatialUploadView())
        hass.http.register_view(SpatialBackdropView())
        hass.http.register_view(SpatialBackdropImageView())
        hass.data["mp_glass_ws_registered"] = True
    await async_register_studio(hass, entry.options.get("show_settings", True))
    entry.async_on_unload(entry.add_update_listener(async_reload))
    return True


async def async_reload(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    runtime = hass.data.pop(SPATIAL_KEY, None)
    if runtime:
        await runtime.close()
    # The strategy module stays for the reload that usually follows; the dashboard waits for the entry meanwhile.
    async_unregister_studio(hass)
    hass.data.pop(DOMAIN, None)
    return True


async def async_remove_entry(hass, entry):
    async_unregister_module(hass)
    await hass.async_add_executor_job(remove_all, backdrop_folder(hass))


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
