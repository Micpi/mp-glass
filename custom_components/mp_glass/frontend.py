"""Encapsulate the HA frontend coupling. See ADR 0002."""
from pathlib import Path
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.exceptions import HomeAssistantError
from .const import BOOTSTRAP_URL, MODULE_URL


async def async_register_module(hass):
    """Serve the bundle and load the dashboard strategy with every page. Idempotent."""
    register_module = getattr(frontend, "add_extra_js_url", None)
    if not callable(register_module):
        raise HomeAssistantError("MP Nexus: frontend module registration unavailable")
    if not hass.data.get("mp_glass_static_registered"):
        await hass.http.async_register_static_paths([StaticPathConfig("/mp_glass_static", str(Path(__file__).parent / "www"), False)])
        hass.data["mp_glass_static_registered"] = True
    register_module(hass, BOOTSTRAP_URL)


def async_unregister_module(hass):
    remove_module = getattr(frontend, "remove_extra_js_url", None)
    if callable(remove_module):
        remove_module(hass, BOOTSTRAP_URL)


async def async_register_studio(hass, show_settings):
    if show_settings:
        await panel_custom.async_register_panel(hass, frontend_url_path="mp-glass-settings", webcomponent_name="mp-glass-settings", sidebar_title="MP Nexus Studio", sidebar_icon="mdi:tune-variant", module_url=MODULE_URL, require_admin=True)


def async_unregister_studio(hass):
    frontend.async_remove_panel(hass, "mp-glass-settings", warn_if_unknown=False)
