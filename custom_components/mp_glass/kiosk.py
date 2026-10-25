"""Kiosk: MP Nexus is the whole interface for everyone but administrators. See docs/SECURITY.md."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback

STRATEGY = "custom:mp-glass"


async def dashboard_path(hass, admin: bool) -> str | None:
    """The url path of the dashboard running the MP Nexus strategy, a dashboard of its own before the overview."""
    # Imported here: read on demand, Lovelace being only an after_dependency.
    from homeassistant.components.lovelace.const import LOVELACE_DATA

    data = hass.data.get(LOVELACE_DATA)
    if data is None:
        return None
    for url_path, dashboard in sorted(data.dashboards.items(), key=lambda item: (item[0] is None, item[0] != "mp-glass", item[0] or "")):
        if not admin and (dashboard.config or {}).get("require_admin"):
            continue
        try:
            config = await dashboard.async_load(False)
        except Exception:  # No config yet, or a YAML dashboard that fails to read: not this one.
            continue
        if isinstance(config, dict) and (config.get("strategy") or {}).get("type") == STRATEGY:
            return url_path or "lovelace"
    return None


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/kiosk"})
@websocket_api.async_response
async def websocket_kiosk(hass, connection, msg):
    """For any user: where the kiosk keeps them. Administrators are never kept there."""
    admin = connection.user.is_admin
    connection.send_result(msg["id"], {"dashboard": await dashboard_path(hass, admin), "admin": admin})


@callback
def async_setup_kiosk(hass):
    if not hass.data.get("mp_glass_kiosk_registered"):
        websocket_api.async_register_command(hass, websocket_kiosk)
        hass.data["mp_glass_kiosk_registered"] = True
