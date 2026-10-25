"""Wallpapers imported from the dashboard or the Studio: kept in Home Assistant's private storage, shown to signed-in users."""
import asyncio
from uuid import uuid4

import voluptuous as vol
from aiohttp import web
from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.const import KEY_HASS

from .backdrop import CONTENT_TYPES, EXTENSIONS, IDENTIFIER, MAX_FILE, MAX_WALLPAPERS, find, image_extension, listing, remove, store


def wallpaper_folder(hass):
    """In Home Assistant's private storage, so its backups keep them; never served as static files."""
    return hass.config.path(".storage", "mp_glass_wallpapers")


class WallpaperUploadView(HomeAssistantView):
    """Keeps an image chosen as wallpaper. Administrators only: the browser has already reduced it."""
    url = "/api/mp_glass/wallpaper"
    name = "api:mp_glass:wallpaper"
    requires_auth = True

    async def post(self, request):
        if not request["hass_user"].is_admin:
            return web.json_response({"error": "unauthorized"}, status=403)
        if request.content_type not in EXTENSIONS:
            return web.json_response({"error": "invalid_file"}, status=415)
        if request.content_length and request.content_length > MAX_FILE:
            return web.json_response({"error": "file_too_large"}, status=413)
        data = bytearray()
        try:
            async with asyncio.timeout(60):
                async for chunk in request.content.iter_chunked(65536):
                    data.extend(chunk)
                    if len(data) > MAX_FILE:
                        return web.json_response({"error": "file_too_large"}, status=413)
        except TimeoutError:
            return web.json_response({"error": "timeout"}, status=408)
        extension = image_extension(bytes(data), request.content_type)
        if not extension:
            return web.json_response({"error": "invalid_file"}, status=400)
        hass = request.app[KEY_HASS]
        folder = wallpaper_folder(hass)
        if len(await hass.async_add_executor_job(listing, folder)) >= MAX_WALLPAPERS:
            return web.json_response({"error": "too_many"}, status=409)
        identifier = uuid4().hex
        await hass.async_add_executor_job(store, folder, identifier, bytes(data), extension)
        return web.json_response({"id": identifier}, status=201)


class WallpaperImageView(HomeAssistantView):
    """An imported wallpaper, for every signed-in user, guests included. Its identifier names one image for good."""
    url = "/api/mp_glass/wallpaper/{wallpaper_id}"
    name = "api:mp_glass:wallpaper:image"
    requires_auth = True

    async def get(self, request, wallpaper_id):
        hass = request.app[KEY_HASS]
        path = await hass.async_add_executor_job(find, wallpaper_folder(hass), wallpaper_id)
        if path is None:
            return web.json_response({"error": "not_found"}, status=404)
        return web.FileResponse(path, headers={"Content-Type": CONTENT_TYPES[path.suffix[1:]], "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"})


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/wallpaper/list"})
@websocket_api.async_response
async def websocket_list(hass, connection, msg):
    connection.send_result(msg["id"], {"wallpapers": await hass.async_add_executor_job(listing, wallpaper_folder(hass)), "max": MAX_WALLPAPERS})


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/wallpaper/delete", vol.Required("wallpaper_id"): vol.Match(IDENTIFIER.pattern)})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_delete(hass, connection, msg):
    removed = await hass.async_add_executor_job(remove, wallpaper_folder(hass), msg["wallpaper_id"])
    if not removed:
        connection.send_error(msg["id"], "not_found", "No such wallpaper")
        return
    connection.send_result(msg["id"], {"removed": msg["wallpaper_id"]})


COMMANDS = (websocket_list, websocket_delete)
VIEWS = (WallpaperUploadView, WallpaperImageView)
