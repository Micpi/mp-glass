"""Graphical installation and options."""
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from urllib.parse import urlsplit
from .const import DOMAIN
from .spatial_gemini import selected_backend


class MPGlassConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title=user_input["name"], data=user_input)
        return self.async_show_form(step_id="user", data_schema=vol.Schema({vol.Required("name", default="MP Glass"): vol.All(str, vol.Length(min=1, max=100))}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return MPGlassOptionsFlow()


class MPGlassOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self._pending = {**self.config_entry.options, **user_input}
            if user_input.get("spatial_backend") == "addon":
                return await self.async_step_spatial_addon()
            return self.async_create_entry(title="", data=self._pending)
        options = self.config_entry.options
        return self.async_show_form(step_id="init", data_schema=vol.Schema({
            vol.Optional("show_settings", default=options.get("show_settings", True)): bool,
            vol.Required("spatial_backend", default=selected_backend(options)): selector.SelectSelector(selector.SelectSelectorConfig(
                options=["gemini", "addon"], translation_key="spatial_backend", mode=selector.SelectSelectorMode.DROPDOWN)),
            vol.Optional("gemini_api_key", default=options.get("gemini_api_key", "")): selector.TextSelector(selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD)),
        }))

    async def async_step_spatial_addon(self, user_input=None):
        errors = {}
        if user_input is not None:
            url = user_input.get("spatial_url", "")
            try:
                parts = urlsplit(url)
                valid = parts.scheme in {"http", "https"} and parts.hostname and not (parts.username or parts.password or parts.query or parts.fragment)
                _ = parts.port
            except ValueError:
                valid = False
            if not valid:
                errors["spatial_url"] = "invalid_spatial_url"
            else:
                return self.async_create_entry(title="", data={**self._pending, **user_input})
        options = user_input or self.config_entry.options
        return self.async_show_form(step_id="spatial_addon", errors=errors, data_schema=vol.Schema({
            vol.Required("spatial_url", default=options.get("spatial_url", "http://local-mp-glass-spatial:8099")): str,
            vol.Required("spatial_token", default=options.get("spatial_token", "")): selector.TextSelector(selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD)),
        }))
