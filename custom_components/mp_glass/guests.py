"""Guests invited by a link or a QR code. Each guest is an ordinary Home Assistant user, never an administrator."""
from __future__ import annotations

from datetime import timedelta
from ipaddress import ip_address
import logging
import re
import secrets
import time

from aiohttp import web
import voluptuous as vol

from homeassistant.auth.const import GROUP_ID_READ_ONLY, GROUP_ID_USER
from homeassistant.components import persistent_notification, websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.components.http.const import KEY_HASS
# Lives in http.auth up to 2026.x and is still imported there by newer versions.
from homeassistant.components.http.auth import async_user_not_allowed_do_auth
from homeassistant.core import callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util.network import is_local

from .guests_core import KINDS, MAX_NAME, PROFILES, GuestBook, Throttle, safe_path, valid_origin

_LOGGER = logging.getLogger(__name__)
KEY = "mp_glass_guests"
CLIENT_NAME = "Invitation MP Nexus"
INVITE_PATH = "/mp-nexus-invite"
GROUPS = {"read": GROUP_ID_READ_ONLY, "user": GROUP_ID_USER}
_WORDS = "abcdefghjkmnpqrstuvwxyz23456789"


class GuestRuntime:
    def __init__(self, hass, store: Store, book: GuestBook):
        self.hass, self.store, self.book, self.throttle = hass, store, book, Throttle()
        self.unsub = None

    async def save(self):
        await self.store.async_save(self.book.as_dict())

    async def end(self, user_id: str):
        """Takes access away for good: the user is deactivated, which also ends every session it has."""
        self.book.end(user_id)
        user = await self.hass.auth.async_get_user(user_id)
        if user and user.is_active and not user.is_owner and not user.is_admin:
            await self.hass.auth.async_deactivate_user(user)
        await self.save()

    async def tick(self, _now=None):
        for user_id in self.book.due():
            _LOGGER.info("MP Nexus guest access ended at its planned time")
            await self.end(user_id)
        if self.book.purge():
            await self.save()

    async def guest_user(self, user_id: str):
        """The Home Assistant user behind a guest, only while it is still one MP Nexus may hand out."""
        if user_id not in self.book.guests:
            return None
        user = await self.hass.auth.async_get_user(user_id)
        if user is None or user.system_generated or user.is_owner or user.is_admin or not user.is_active:
            return None
        return user


async def async_setup_guests(hass):
    store = Store(hass, 1, KEY)
    runtime = GuestRuntime(hass, store, GuestBook(await store.async_load()))
    hass.data[KEY] = runtime
    # Access ends on time, and also after a restart that happened past the end.
    await runtime.tick()
    runtime.unsub = async_track_time_interval(hass, runtime.tick, timedelta(minutes=1))
    if not hass.data.get("mp_glass_guests_registered"):
        for command in (websocket_guests_list, websocket_guests_create, websocket_guests_invite, websocket_guests_password, websocket_guests_end, websocket_guests_remove, websocket_guests_me):
            websocket_api.async_register_command(hass, command)
        hass.http.register_view(GuestInvitePage())
        hass.http.register_view(GuestInviteExchange())
        hass.http.register_view(GuestNetworkProbe())
        hass.data["mp_glass_guests_registered"] = True


def async_unload_guests(hass):
    runtime = hass.data.pop(KEY, None)
    if runtime and runtime.unsub:
        runtime.unsub()


def _runtime(hass, connection, msg) -> GuestRuntime | None:
    runtime = hass.data.get(KEY)
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "MP Nexus is not loaded")
    return runtime


async def _describe(runtime: GuestRuntime, user_id: str, guest: dict) -> dict:
    user = await runtime.hass.auth.async_get_user(user_id)
    sessions = [t for t in user.refresh_tokens.values() if t.token_type == "normal"] if user else []
    used = max((t.last_used_at.timestamp() for t in sessions if t.last_used_at), default=guest.get("last_used"))
    return {
        "id": user_id, "name": guest["name"], "kind": guest["kind"], "profile": guest["profile"], "local_only": guest["local_only"],
        "until": guest["until"], "created": guest["created"], "ended": guest["ended"] or (None if user and user.is_active else guest["created"]),
        "exists": user is not None, "sessions": len(sessions), "last_used": used, "username": guest.get("username"),
        "invite": runtime.book.pending(user_id),
    }


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/guests/list"})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_guests_list(hass, connection, msg):
    if (runtime := _runtime(hass, connection, msg)) is None:
        return
    guests = [await _describe(runtime, user_id, guest) for user_id, guest in runtime.book.guests.items()]
    connection.send_result(msg["id"], {"guests": sorted(guests, key=lambda g: -g["created"])})


@websocket_api.websocket_command({
    vol.Required("type"): "mp_glass/guests/create",
    vol.Required("name"): vol.All(str, vol.Strip, vol.Length(min=1, max=MAX_NAME)),
    vol.Required("kind"): vol.In(KINDS),
    vol.Required("profile"): vol.In(PROFILES),
    vol.Required("local_only"): bool,
    vol.Optional("until"): vol.Any(None, vol.Coerce(float)),
})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_guests_create(hass, connection, msg):
    if (runtime := _runtime(hass, connection, msg)) is None:
        return
    until = msg.get("until") if msg["kind"] == "temporary" else None
    if msg["kind"] == "temporary" and (until is None or until <= time.time()):
        connection.send_error(msg["id"], "invalid_until", "The end of a temporary access must be in the future")
        return
    # Never an administrator: only the two ordinary groups, chosen by name here and not by the page.
    user = await hass.auth.async_create_user(msg["name"], group_ids=[GROUPS[msg["profile"]]], local_only=msg["local_only"])
    if user.is_owner or user.is_admin:  # The very first user of an installation would be its owner.
        await hass.auth.async_remove_user(user)
        connection.send_error(msg["id"], "not_allowed", "A guest cannot be the owner")
        return
    runtime.book.add(user.id, msg["name"], msg["kind"], msg["profile"], msg["local_only"], until)
    await runtime.save()
    connection.send_result(msg["id"], await _describe(runtime, user.id, runtime.book.guests[user.id]))


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/guests/invite", vol.Required("user_id"): str, vol.Required("mode"): vol.In(("qr", "link"))})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_guests_invite(hass, connection, msg):
    if (runtime := _runtime(hass, connection, msg)) is None:
        return
    if await runtime.guest_user(msg["user_id"]) is None:
        connection.send_error(msg["id"], "not_found", "No guest to invite")
        return
    secret, expires = runtime.book.issue(msg["user_id"], msg["mode"])
    await runtime.save()
    # The secret travels in the part of the address after #, which browsers never send to a server or a proxy log.
    connection.send_result(msg["id"], {"path": INVITE_PATH, "secret": secret, "expires": expires})


def _password() -> str:
    return "-".join("".join(secrets.choice(_WORDS) for _ in range(4)) for _ in range(4))


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/guests/password", vol.Required("user_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_guests_password(hass, connection, msg):
    """The fallback: a username and a generated password, shown once, for Home Assistant's own login page."""
    if (runtime := _runtime(hass, connection, msg)) is None:
        return
    user = await runtime.guest_user(msg["user_id"])
    if user is None:
        connection.send_error(msg["id"], "not_found", "No guest")
        return
    from homeassistant.auth.providers import homeassistant as auth_ha
    provider = auth_ha.async_get_provider(hass)
    guest, password = runtime.book.guests[user.id], _password()
    if username := guest.get("username"):
        await provider.async_change_password(username, password)
    else:
        username = f"{re.sub(r'[^a-z0-9]', '', guest['name'].lower())[:16] or 'invite'}.{secrets.randbelow(9000) + 1000}"
        await provider.async_add_auth(username, password)
        credentials = await provider.async_get_or_create_credentials({"username": username})
        await hass.auth.async_link_user(user, credentials)
        guest["username"] = username
        await runtime.save()
    connection.send_result(msg["id"], {"username": username, "password": password})


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/guests/end", vol.Required("user_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_guests_end(hass, connection, msg):
    if (runtime := _runtime(hass, connection, msg)) is None:
        return
    if msg["user_id"] not in runtime.book.guests:
        connection.send_error(msg["id"], "not_found", "No guest")
        return
    await runtime.end(msg["user_id"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/guests/remove", vol.Required("user_id"): str})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_guests_remove(hass, connection, msg):
    if (runtime := _runtime(hass, connection, msg)) is None:
        return
    if msg["user_id"] not in runtime.book.guests:
        connection.send_error(msg["id"], "not_found", "No guest")
        return
    user = await hass.auth.async_get_user(msg["user_id"])
    if user and not user.is_owner and not user.is_admin and not user.system_generated:
        await hass.auth.async_remove_user(user)
    runtime.book.remove(msg["user_id"])
    await runtime.save()
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "mp_glass/guests/me"})
@callback
def websocket_guests_me(hass, connection, msg):
    """What a guest sees about its own access: read only or not, and until when."""
    runtime = hass.data.get(KEY)
    guest = runtime.book.guests.get(connection.user.id) if runtime else None
    connection.send_result(msg["id"], {"guest": bool(guest), **({"profile": guest["profile"], "until": guest["until"]} if guest else {})})


def _remote(request) -> str:
    return request.remote or ""


def _local(request) -> bool:
    try:
        return is_local(ip_address(_remote(request)))
    except ValueError:
        return False


class GuestNetworkProbe(HomeAssistantView):
    """How Home Assistant sees the administrator's address, to tell whether « home network only » can be trusted."""
    url = "/api/mp_glass/guests/probe"
    name = "api:mp_glass:guests:probe"
    requires_auth = True

    async def get(self, request):
        if not request["hass_user"].is_admin:
            return web.json_response({"error": "unauthorized"}, status=403)
        return web.json_response({"local": _local(request), "secure": request.secure})


class GuestInviteExchange(HomeAssistantView):
    """Trades an invitation for a session of its guest. Open without login: the invitation is the only key, and it works once."""
    url = "/api/mp_glass/invite"
    name = "api:mp_glass:invite"
    requires_auth = False

    async def post(self, request):
        hass = request.app[KEY_HASS]
        runtime: GuestRuntime | None = hass.data.get(KEY)
        address = _remote(request)
        if runtime is None:
            return web.json_response({"error": "not_loaded"}, status=503)
        if not runtime.throttle.allowed(address):
            return web.json_response({"error": "too_many"}, status=429)
        try:
            body = await request.json()
        except ValueError:
            body = None
        if not isinstance(body, dict) or not valid_origin(body.get("origin")):
            runtime.throttle.failed(address)
            return web.json_response({"error": "invalid"}, status=400)
        user_id = runtime.book.peek(body.get("secret"))
        user = await runtime.guest_user(user_id) if user_id else None
        if user is None:
            runtime.throttle.failed(address)
            return web.json_response({"error": "invalid"}, status=403)
        # Out of the home network, only over HTTPS; a guest kept to the home network, only from there.
        if not _local(request) and not request.secure:
            return web.json_response({"error": "https_required"}, status=403)
        if async_user_not_allowed_do_auth(hass, user, request):
            return web.json_response({"error": "home_only"}, status=403)
        # Used here, with no wait since the checks above: two pages opening the same invitation get one session.
        if runtime.book.redeem(body["secret"]) != user.id:
            return web.json_response({"error": "invalid"}, status=403)
        await runtime.save()
        refresh = await hass.auth.async_create_refresh_token(user, client_id=f"{body['origin']}/", client_name=CLIENT_NAME)
        access = hass.auth.async_create_access_token(refresh, address)
        guest = runtime.book.guests[user.id]
        french = (hass.config.language or "").startswith("fr")
        persistent_notification.async_create(
            hass, f"{guest['name']} s’est connecté(e) avec son invitation MP Nexus." if french else f"{guest['name']} signed in with their MP Nexus invitation.",
            title="MP Nexus", notification_id=f"mp_glass_guest_{user.id}")
        expires_in = int(refresh.access_token_expiration.total_seconds())
        return web.json_response({"access_token": access, "refresh_token": refresh.token, "expires_in": expires_in, "token_type": "Bearer", "to": safe_path(body.get("to"))},
                                 headers={"Cache-Control": "no-store"})


class GuestInvitePage(HomeAssistantView):
    """The page the link and the QR code open. It reads the invitation from the address, then forgets it."""
    url = INVITE_PATH
    name = "mp_glass:invite"
    requires_auth = False

    async def get(self, request):
        return web.Response(text=INVITE_HTML, content_type="text/html", headers={
            "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
            "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        })


INVITE_HTML = r"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>MP Nexus</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07101d;color:#eef4ff;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{width:min(360px,calc(100% - 32px));padding:28px;border-radius:24px;background:rgba(16,47,73,.6);border:1px solid rgba(255,255,255,.16);text-align:center}
h1{font:400 26px Georgia,serif;margin:0 0 8px}p{margin:0 0 18px;color:rgba(238,244,255,.78)}
button{font:inherit;font-weight:600;border:0;border-radius:14px;padding:12px 18px;margin:4px;background:#69b7ff;color:#07101d;cursor:pointer}button.alt{background:rgba(255,255,255,.12);color:#eef4ff}
</style></head><body><main><h1>MP Nexus</h1><p id="m"></p><div id="a"></div></main><script>
(function(){
var fr=/^fr/i.test(navigator.language||''),T=fr?{wait:'Connexion en cours…',used:'Cette invitation n’est plus valable : elle a déjà servi ou a expiré. Demandez-en une nouvelle.',home:'Cette invitation ne fonctionne que depuis le Wi-Fi de la maison.',https:'Cette adresse n’est pas sécurisée (HTTPS) : connectez-vous au Wi-Fi de la maison.',many:'Trop d’essais. Réessayez dans quelques minutes.',fail:'La connexion a échoué. Réessayez.',other:'Ce navigateur est déjà connecté à Home Assistant. Remplacer cette session par l’invitation ?',yes:'Remplacer',no:'Garder la session actuelle',none:'Aucune invitation dans cette adresse.'}:{wait:'Signing in…',used:'This invitation is no longer valid: it was already used or has expired. Ask for a new one.',home:'This invitation only works from the home Wi-Fi.',https:'This address is not secure (HTTPS): join the home Wi-Fi.',many:'Too many attempts. Try again in a few minutes.',fail:'Signing in failed. Try again.',other:'This browser is already signed in to Home Assistant. Replace that session with the invitation?',yes:'Replace',no:'Keep the current session',none:'No invitation in this address.'};
var m=document.getElementById('m'),a=document.getElementById('a'),secret=location.hash.slice(1),to=new URLSearchParams(location.search).get('to')||'/';if(!/^\/(?![\/\\])[^\\]*$/.test(to))to='/';
history.replaceState(null,'',location.pathname);
function say(t){m.textContent=t;a.textContent='';}
function go(){say(T.wait);fetch('/api/mp_glass/invite',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({secret:secret,origin:location.origin,to:to})}).then(function(r){return r.json().then(function(b){return {s:r.status,b:b};});}).then(function(r){
 if(r.s!==200){say(r.b.error==='home_only'?T.home:r.b.error==='https_required'?T.https:r.b.error==='too_many'?T.many:r.b.error==='invalid'?T.used:T.fail);return;}
 var b=r.b;secret='';
 try{localStorage.setItem('hassTokens',JSON.stringify({hassUrl:location.origin,clientId:location.origin+'/',expires:Date.now()+b.expires_in*1000,refresh_token:b.refresh_token,access_token:b.access_token,expires_in:b.expires_in,token_type:'Bearer'}));}catch(e){say(T.fail);return;}
 location.replace(b.to);
}).catch(function(){say(T.fail);});}
if(!secret){say(T.none);return;}
var current=null;try{current=localStorage.getItem('hassTokens');}catch(e){}
if(current){say(T.other);var y=document.createElement('button');y.textContent=T.yes;y.onclick=go;var n=document.createElement('button');n.className='alt';n.textContent=T.no;n.onclick=function(){location.replace(to);};a.append(y,n);m.textContent=T.other;}else go();
})();
</script></body></html>"""
