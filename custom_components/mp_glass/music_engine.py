"""The music engine MP Nexus sets up for the household: the Music Assistant app, started and linked to Home Assistant.

Only an administrator may start it. Everything goes through the Supervisor and the official integration,
so MP Nexus never holds a Music Assistant address or token.
"""
import asyncio
import logging

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import SOURCE_HASSIO

from .music_core import ADDON_REPOSITORY, ADDON_SLUG, engine_phase

_LOGGER = logging.getLogger(__name__)
KEY = "mp_glass_music_engine"
INTEGRATION = "music_assistant"
STEPS = ("repository", "install", "start", "link", "done")


def _supervisor(hass):
    """The Supervisor client, or None on an installation without apps (Container, Core)."""
    try:
        from homeassistant.helpers.hassio import is_hassio
        if not is_hassio(hass):
            return None
        from homeassistant.components.hassio import get_supervisor_client
        return get_supervisor_client(hass)
    except Exception:  # Older or app-less Home Assistant: no Supervisor to talk to.
        return None


class MusicEngine:
    def __init__(self, hass):
        self.hass = hass
        self.task = None
        self.step = None
        self.error = None

    def integration_loaded(self):
        from homeassistant.config_entries import ConfigEntryState
        return any(entry.state is ConfigEntryState.LOADED for entry in self.hass.config_entries.async_entries(INTEGRATION))

    async def addon(self):
        """What the Supervisor knows of the app: None when it is not in any store yet."""
        client = _supervisor(self.hass)
        if client is None:
            return None
        try:
            store = await client.store.addon_info(ADDON_SLUG)
        except Exception:
            return {"available": False, "installed": False}
        info = {"available": bool(store.available), "installed": bool(store.installed)}
        if store.installed:
            addon = await client.addons.addon_info(ADDON_SLUG)
            info.update({"state": str(getattr(addon.state, "value", addon.state)), "version": addon.version, "ingress_entry": addon.ingress_entry if addon.ingress else None})
        return info

    async def status(self):
        client = _supervisor(self.hass)
        addon = await self.addon() if client else None
        running = self.task is not None and not self.task.done()
        return {
            "supervisor": client is not None,
            "phase": engine_phase(client is not None, addon, self.integration_loaded(), running, self.error),
            "step": self.step if running else None,
            "error": self.error,
            "ingress_entry": (addon or {}).get("ingress_entry"),
            "version": (addon or {}).get("version"),
        }

    def start(self):
        if self.task is None or self.task.done():
            self.error = None
            self.task = self.hass.async_create_background_task(self._run(), "mp_glass music engine")

    async def _run(self):
        client = _supervisor(self.hass)
        try:
            from aiohasupervisor.models import StoreAddRepository
            self.step = "repository"
            addon = await self.addon()
            if not addon or not addon.get("available"):
                await client.store.add_repository(StoreAddRepository(repository=ADDON_REPOSITORY))
                await client.store.reload()
            self.step = "install"
            if not (await self.addon() or {}).get("installed"):
                await client.store.install_addon(ADDON_SLUG)
            self.step = "start"
            if (await self.addon() or {}).get("state") != "started":
                await client.addons.start_addon(ADDON_SLUG)
            self.step = "link"
            await self._link()
            self.step = "done"
        except Exception as err:  # Every Supervisor or flow failure ends the same way for the person: try again.
            _LOGGER.warning("MP Nexus could not prepare Music Assistant: %s", err)
            self.error = self.step or "unknown"

    async def _link(self):
        """Confirms the discovery the app announces to Home Assistant, the step an administrator would otherwise click."""
        for _ in range(90):
            if self.integration_loaded():
                return
            for flow in self.hass.config_entries.flow.async_progress_by_handler(INTEGRATION):
                if flow.get("context", {}).get("source") == SOURCE_HASSIO and flow.get("step_id") == "hassio_confirm":
                    await self.hass.config_entries.flow.async_configure(flow["flow_id"], {})
            await asyncio.sleep(2)
        raise TimeoutError("Music Assistant did not link to Home Assistant")


def _engine(hass):
    engine = hass.data.get(KEY)
    if engine is None:
        engine = hass.data[KEY] = MusicEngine(hass)
    return engine


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "mp_glass/music/engine"})
@websocket_api.async_response
async def websocket_engine_status(hass, connection, msg):
    connection.send_result(msg["id"], await _engine(hass).status())


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "mp_glass/music/engine/setup"})
@websocket_api.async_response
async def websocket_engine_setup(hass, connection, msg):
    engine = _engine(hass)
    if _supervisor(hass) is None:
        connection.send_error(msg["id"], "not_supported", "This Home Assistant installation cannot install apps")
        return
    engine.start()
    connection.send_result(msg["id"], await engine.status())


COMMANDS = (websocket_engine_status, websocket_engine_setup)
