"""Zero-configuration Music Assistant bridge through its official HA integration."""
import asyncio

import voluptuous as vol
from aiohttp import ClientError, ClientTimeout, web
from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.const import KEY_HASS
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .guests import KEY as GUESTS_KEY
from .music_core import LIBRARY_COMMANDS, normalize_item, search_items, service_items

KEY = "mp_glass_music"
SERVICE_DOMAINS = ("music_assistant", "mass")
MEDIA_TYPES = {"albums": "album", "artists": "artist", "tracks": "track", "playlists": "playlist", "radio": "radio", "podcasts": "podcast"}


class MusicAssistantRuntime:
    def __init__(self, hass, _options):
        self.hass = hass
        self.artwork = {}
        self.last_error = None

    @property
    def domain(self):
        return next((domain for domain in SERVICE_DOMAINS if self.hass.services.has_service(domain, "get_library")), None)

    @property
    def enabled(self):
        return self.domain is not None

    async def service(self, service, data, context=None, response=True):
        domain = self.domain
        if not domain or not self.hass.services.has_service(domain, service):
            raise RuntimeError("Music Assistant is not connected to Home Assistant")
        try:
            answer = await self.hass.services.async_call(domain, service, data, blocking=True, context=context, return_response=response)
        except Exception as err:  # HA exposes integration failures through several exception types.
            self.last_error = type(err).__name__
            raise RuntimeError("Music Assistant is unavailable") from err
        self.last_error = None
        return answer or {}

    async def status(self):
        domain = self.domain
        players = [state for state in self.hass.states.async_all({"media_player"}) if state.attributes.get("mass_player_type") or state.attributes.get("active_queue")]
        return {"configured": bool(domain), "connected": bool(domain), "player_count": len(players), "domain": domain}

    def items(self, values):
        result = []
        for value in values or []:
            item = normalize_item("", value, self.artwork)
            if item:
                result.append(item)
        if len(self.artwork) > 800:
            self.artwork = dict(list(self.artwork.items())[-500:])
        return result


def _runtime(hass, connection, msg):
    runtime = hass.data.get(KEY)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "Music Assistant bridge is not loaded")
    return runtime


def _context(connection, msg):
    return connection.context(msg) if hasattr(connection, "context") else None


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/music/status"})
@websocket_api.async_response
async def websocket_music_status(hass, connection, msg):
    if runtime := _runtime(hass, connection, msg):
        connection.send_result(msg["id"], await runtime.status())


@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/music/library",
    vol.Required("kind"): vol.In(tuple(LIBRARY_COMMANDS)),
    vol.Optional("offset", default=0): vol.All(int, vol.Range(min=0, max=10000)),
    vol.Optional("limit", default=60): vol.All(int, vol.Range(min=1, max=200)),
    vol.Optional("favorite"): bool,
})
@websocket_api.async_response
async def websocket_music_library(hass, connection, msg):
    if not (runtime := _runtime(hass, connection, msg)):
        return
    try:
        data = {"media_type": MEDIA_TYPES[msg["kind"]], "offset": msg["offset"], "limit": msg["limit"], "order_by": "sort_name"}
        if "favorite" in msg:
            data["favorite"] = msg["favorite"]
        answer = await runtime.service("get_library", data, _context(connection, msg))
        values = service_items(answer)
        connection.send_result(msg["id"], {"kind": msg["kind"], "offset": msg["offset"], "items": runtime.items(values)})
    except RuntimeError as err:
        connection.send_error(msg["id"], "music_unavailable", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/music/search",
    vol.Required("query"): vol.All(str, vol.Strip, vol.Length(min=1, max=200)),
    vol.Optional("limit", default=20): vol.All(int, vol.Range(min=1, max=50)),
})
@websocket_api.async_response
async def websocket_music_search(hass, connection, msg):
    if not (runtime := _runtime(hass, connection, msg)):
        return
    try:
        answer = await runtime.service("search", {"name": msg["query"], "limit": msg["limit"], "library_only": False}, _context(connection, msg))
        connection.send_result(msg["id"], {"items": runtime.items(search_items(answer))})
    except RuntimeError as err:
        connection.send_error(msg["id"], "music_unavailable", str(err))


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/music/queue", vol.Required("entity_id"): vol.Match(r"^media_player\.[a-z0-9_]+$")})
@websocket_api.async_response
async def websocket_music_queue(hass, connection, msg):
    if not (runtime := _runtime(hass, connection, msg)):
        return
    try:
        answer = await runtime.service("get_queue", {"entity_id": msg["entity_id"]}, _context(connection, msg))
        queue = answer.get(msg["entity_id"], answer) if isinstance(answer, dict) else {}
        values = service_items(answer, msg["entity_id"])
        connection.send_result(msg["id"], {"queue_id": queue.get("queue_id") if isinstance(queue, dict) else None, "items": runtime.items(values), "current_index": queue.get("current_index") if isinstance(queue, dict) else None})
    except RuntimeError as err:
        connection.send_error(msg["id"], "music_unavailable", str(err))


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/music/action", vol.Required("action"): vol.In(("play_now", "play_next", "add", "clear")), vol.Required("data"): dict})
@websocket_api.async_response
async def websocket_music_action(hass, connection, msg):
    if not (runtime := _runtime(hass, connection, msg)):
        return
    guests = hass.data.get(GUESTS_KEY)
    guest = guests.book.guests.get(connection.user.id) if guests else None
    if guest and guest.get("profile") == "read":
        connection.send_error(msg["id"], "not_allowed", "This guest has read-only access")
        return
    entity_id = msg["data"].get("entity_id")
    if not isinstance(entity_id, str) or not entity_id.startswith("media_player."):
        connection.send_error(msg["id"], "invalid_format", "Missing player entity")
        return
    try:
        if msg["action"] == "clear":
            await hass.services.async_call("media_player", "clear_playlist", {"entity_id": entity_id}, blocking=True, context=_context(connection, msg))
        else:
            media = msg["data"].get("media")
            if not isinstance(media, str) or not media:
                connection.send_error(msg["id"], "invalid_format", "Missing media")
                return
            await runtime.service("play_media", {"entity_id": entity_id, "media_id": media, "media_type": msg["data"].get("media_type", "music"), "enqueue": {"play_now": "replace", "play_next": "next", "add": "add"}[msg["action"]], "radio_mode": False}, _context(connection, msg), response=False)
        connection.send_result(msg["id"], {"ok": True})
    except Exception as err:
        runtime.last_error = type(err).__name__
        connection.send_error(msg["id"], "music_unavailable", "Music Assistant is unavailable")


class MusicArtworkView(HomeAssistantView):
    url = "/api/mp_glass/music/artwork/{key}"
    name = "api:mp_glass:music:artwork"
    requires_auth = True

    async def get(self, request, key):
        hass = request.app[KEY_HASS]
        runtime = hass.data.get(KEY)
        url = runtime.artwork.get(key) if runtime else None
        if not url:
            raise web.HTTPNotFound()
        session = async_get_clientsession(hass)
        try:
            async with session.get(url, timeout=ClientTimeout(total=20)) as response:
                content_type = response.headers.get("Content-Type", "")
                if response.status != 200 or not content_type.startswith("image/"):
                    raise web.HTTPBadGateway()
                body = await response.read()
        except (ClientError, asyncio.TimeoutError) as err:
            raise web.HTTPBadGateway() from err
        if len(body) > 10_000_000:
            raise web.HTTPRequestEntityTooLarge(max_size=10_000_000, actual_size=len(body))
        return web.Response(body=body, content_type=content_type.split(";", 1)[0], headers={"Cache-Control": "private, max-age=3600"})


COMMANDS = (websocket_music_status, websocket_music_library, websocket_music_search, websocket_music_queue, websocket_music_action)
