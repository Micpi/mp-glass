"""Authenticated Music Assistant bridge kept entirely inside Home Assistant."""
import asyncio
import uuid

import voluptuous as vol
from aiohttp import ClientError, ClientTimeout, web
from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.const import KEY_HASS
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .music_core import LIBRARY_COMMANDS, normalize_item
from .guests import KEY as GUESTS_KEY

KEY = "mp_glass_music"


class MusicAssistantRuntime:
    def __init__(self, hass, options):
        self.hass = hass
        self.url = str(options.get("music_assistant_url", "")).rstrip("/")
        self.token = str(options.get("music_assistant_token", ""))
        self.enabled = bool(options.get("music_assistant_enabled") and self.url and self.token)
        self.artwork = {}
        self.last_error = None
        self.schema = None

    async def call(self, command, **args):
        if not self.enabled:
            raise RuntimeError("Music Assistant is not configured")
        session = async_get_clientsession(self.hass)
        payload = {"message_id": uuid.uuid4().hex, "command": command, "args": args}
        try:
            async with session.post(f"{self.url}/api", json=payload, headers={"Authorization": f"Bearer {self.token}"}, timeout=ClientTimeout(total=20)) as response:
                data = await response.json(content_type=None)
                if response.status >= 400:
                    raise RuntimeError(f"HTTP {response.status}")
        except (ClientError, asyncio.TimeoutError, ValueError) as err:
            self.last_error = type(err).__name__
            raise RuntimeError("Music Assistant is unavailable") from err
        if not isinstance(data, dict) or data.get("error_code") is not None or data.get("error_message"):
            self.last_error = str(data.get("error_message", "invalid_response")) if isinstance(data, dict) else "invalid_response"
            raise RuntimeError(self.last_error)
        self.last_error = None
        return data.get("result")

    async def status(self):
        if not self.enabled:
            return {"configured": False, "connected": False}
        try:
            players = await self.call("players/all")
            return {"configured": True, "connected": True, "player_count": len(players or []), "url": self.url}
        except RuntimeError:
            return {"configured": True, "connected": False, "error": self.last_error or "unavailable"}

    def items(self, values):
        result = []
        for value in values or []:
            item = normalize_item(self.url, value, self.artwork)
            if item:
                result.append(item)
        if len(self.artwork) > 800:
            self.artwork = dict(list(self.artwork.items())[-500:])
        return result


async def _runtime(hass, connection, msg):
    runtime = hass.data.get(KEY)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "Music Assistant bridge is not loaded")
    return runtime


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/music/status"})
@websocket_api.async_response
async def websocket_music_status(hass, connection, msg):
    runtime = await _runtime(hass, connection, msg)
    if runtime:
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
    runtime = await _runtime(hass, connection, msg)
    if not runtime:
        return
    try:
        args = {"offset": msg["offset"], "limit": msg["limit"], "order_by": "sort_name"}
        if "favorite" in msg:
            args["favorite"] = msg["favorite"]
        values = await runtime.call(LIBRARY_COMMANDS[msg["kind"]], **args)
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
    runtime = await _runtime(hass, connection, msg)
    if not runtime:
        return
    try:
        answer = await runtime.call("music/search", search_query=msg["query"], media_types=["artist", "album", "track", "playlist", "radio", "podcast"], limit=msg["limit"], library_only=False)
        groups = []
        for kind in ("artists", "albums", "tracks", "playlists", "radio", "podcasts"):
            groups.extend((answer or {}).get(kind, []) if isinstance(answer, dict) else [])
        connection.send_result(msg["id"], {"items": runtime.items(groups)})
    except RuntimeError as err:
        connection.send_error(msg["id"], "music_unavailable", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/music/queue",
    vol.Required("entity_id"): vol.Match(r"^media_player\.[a-z0-9_]+$"),
})
@websocket_api.async_response
async def websocket_music_queue(hass, connection, msg):
    runtime = await _runtime(hass, connection, msg)
    if not runtime:
        return
    try:
        state = hass.states.get(msg["entity_id"])
        queue_id = state.attributes.get("active_queue") if state else None
        if not isinstance(queue_id, str) or not queue_id:
            connection.send_result(msg["id"], {"queue_id": None, "items": [], "current_index": None})
            return
        queue = await runtime.call("player_queues/get", queue_id=queue_id)
        if isinstance(queue, dict):
            queue_id = queue.get("queue_id") or queue_id
        values = await runtime.call("player_queues/items", queue_id=queue_id, limit=500, offset=0) if queue_id else []
        connection.send_result(msg["id"], {"queue_id": queue_id, "items": runtime.items(values), "current_index": queue.get("current_index") if isinstance(queue, dict) else None})
    except RuntimeError as err:
        connection.send_error(msg["id"], "music_unavailable", str(err))


_ACTIONS = {
    "play_now": ("player_queues/play_media", ("queue_id", "media")),
    "play_next": ("player_queues/play_media", ("queue_id", "media")),
    "add": ("player_queues/play_media", ("queue_id", "media")),
    "clear": ("player_queues/clear", ("queue_id",)),
    "delete": ("player_queues/delete_item", ("queue_id", "item_id_or_index")),
    "play_index": ("player_queues/play_index", ("queue_id", "index")),
    "move": ("player_queues/move_item", ("queue_id", "queue_item_id", "pos_shift")),
    "transfer": ("player_queues/transfer", ("source_queue_id", "target_queue_id", "auto_play")),
}


@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/music/action",
    vol.Required("action"): vol.In(tuple(_ACTIONS)),
    vol.Required("data"): dict,
})
@websocket_api.async_response
async def websocket_music_action(hass, connection, msg):
    runtime = await _runtime(hass, connection, msg)
    if not runtime:
        return
    guests = hass.data.get(GUESTS_KEY)
    guest = guests.book.guests.get(connection.user.id) if guests else None
    if guest and guest.get("profile") == "read":
        connection.send_error(msg["id"], "not_allowed", "This guest has read-only access")
        return
    command, allowed = _ACTIONS[msg["action"]]
    missing = [key for key in allowed if key not in msg["data"]]
    if missing:
        connection.send_error(msg["id"], "invalid_format", "Missing action data")
        return
    data = {key: msg["data"][key] for key in allowed if key in msg["data"]}
    if msg["action"] in {"play_now", "play_next", "add"}:
        data["option"] = {"play_now": "replace", "play_next": "next", "add": "add"}[msg["action"]]
        data["radio_mode"] = False
    try:
        await runtime.call(command, **data)
        connection.send_result(msg["id"], {"ok": True})
    except RuntimeError as err:
        connection.send_error(msg["id"], "music_unavailable", str(err))


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
        headers = {"Authorization": f"Bearer {runtime.token}"} if url.startswith(runtime.url) else {}
        try:
            async with session.get(url, headers=headers, timeout=ClientTimeout(total=20)) as response:
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
