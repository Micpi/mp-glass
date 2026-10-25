"""Guests invited by a link or a QR code: the rules, without Home Assistant. See docs/SECURITY.md."""
from __future__ import annotations

from hashlib import sha256
import re
import secrets
import time

# A QR code is shown to someone in the room; a link travels through a messaging app, so it lives longer.
INVITE_TTL = {"qr": 15 * 60, "link": 24 * 3600}
PROFILES = ("read", "user")
KINDS = ("permanent", "temporary")
MAX_NAME = 40
# Failed exchanges per address before it waits, as Home Assistant's own login does.
MAX_FAILURES, FAILURE_WINDOW, BLOCK_TIME = 5, 60, 600
_ORIGIN = re.compile(r"^https?://[A-Za-z0-9.\-\[\]:]+$")


def digest(secret: str) -> str:
    return sha256(secret.encode()).hexdigest()


def valid_origin(origin: object) -> bool:
    return isinstance(origin, str) and len(origin) <= 255 and bool(_ORIGIN.match(origin))


def safe_path(path: object) -> str:
    """Where the guest lands after the exchange: a path of this Home Assistant, never another site."""
    if not isinstance(path, str) or not path.startswith("/") or path.startswith("//") or "\\" in path or len(path) > 200:
        return "/"
    return path


class GuestBook:
    """The guests MP Nexus created and their pending invitations. Only a digest of each invitation is ever kept."""

    def __init__(self, data: dict | None = None):
        data = data or {}
        self.guests: dict[str, dict] = dict(data.get("guests", {}))
        self.invites: dict[str, dict] = dict(data.get("invites", {}))

    def as_dict(self) -> dict:
        return {"guests": self.guests, "invites": self.invites}

    def add(self, user_id: str, name: str, kind: str, profile: str, local_only: bool, until: float | None, now: float | None = None) -> dict:
        now = time.time() if now is None else now
        if kind not in KINDS or profile not in PROFILES:
            raise ValueError("invalid_guest")
        if kind == "temporary" and (until is None or until <= now):
            raise ValueError("invalid_until")
        guest = {"name": name, "kind": kind, "profile": profile, "local_only": bool(local_only), "until": until if kind == "temporary" else None, "created": now, "ended": None, "last_used": None}
        self.guests[user_id] = guest
        return guest

    def issue(self, user_id: str, mode: str, now: float | None = None) -> tuple[str, float]:
        """A new invitation for a guest, replacing the one it had. Returns the secret, shown once, and when it ends."""
        now = time.time() if now is None else now
        guest = self.guests.get(user_id)
        if guest is None or guest["ended"] or mode not in INVITE_TTL:
            raise ValueError("invalid_invite")
        self.invites = {key: invite for key, invite in self.invites.items() if invite["user_id"] != user_id}
        secret = secrets.token_urlsafe(32)  # 256 bits
        expires = now + INVITE_TTL[mode]
        if guest["until"]:
            expires = min(expires, guest["until"])
        self.invites[digest(secret)] = {"user_id": user_id, "mode": mode, "expires": expires}
        return secret, expires

    def peek(self, secret: object, now: float | None = None) -> str | None:
        """The guest an invitation opens, without using it."""
        now = time.time() if now is None else now
        if not isinstance(secret, str) or not 20 <= len(secret) <= 100:
            return None
        invite = self.invites.get(digest(secret))
        if invite is None or invite["expires"] <= now:
            return None
        guest = self.guests.get(invite["user_id"])
        return invite["user_id"] if guest and not guest["ended"] else None

    def redeem(self, secret: str, now: float | None = None) -> str | None:
        """Uses an invitation once: it is gone afterwards, whatever happens next."""
        now = time.time() if now is None else now
        user_id = self.peek(secret, now)
        if user_id is None:
            return None
        self.invites.pop(digest(secret), None)
        self.guests[user_id]["last_used"] = now
        return user_id

    def pending(self, user_id: str, now: float | None = None) -> dict | None:
        now = time.time() if now is None else now
        return next(({"mode": i["mode"], "expires": i["expires"]} for i in self.invites.values() if i["user_id"] == user_id and i["expires"] > now), None)

    def end(self, user_id: str, now: float | None = None) -> None:
        guest = self.guests.get(user_id)
        if guest and not guest["ended"]:
            guest["ended"] = time.time() if now is None else now
        self.invites = {key: invite for key, invite in self.invites.items() if invite["user_id"] != user_id}

    def remove(self, user_id: str) -> None:
        self.end(user_id)
        self.guests.pop(user_id, None)

    def due(self, now: float | None = None) -> list[str]:
        """Temporary guests whose time is up and who still have access."""
        now = time.time() if now is None else now
        return [user_id for user_id, guest in self.guests.items() if not guest["ended"] and guest["until"] and guest["until"] <= now]

    def purge(self, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        kept = {key: invite for key, invite in self.invites.items() if invite["expires"] > now}
        changed = len(kept) != len(self.invites)
        self.invites = kept
        return changed


class Throttle:
    """Counts failed exchanges per address and makes an address that keeps failing wait."""

    def __init__(self):
        self.failures: dict[str, list[float]] = {}
        self.blocked: dict[str, float] = {}

    def allowed(self, address: str, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        until = self.blocked.get(address)
        if until and until > now:
            return False
        self.blocked.pop(address, None)
        return True

    def failed(self, address: str, now: float | None = None) -> None:
        now = time.time() if now is None else now
        recent = [at for at in self.failures.get(address, []) if at > now - FAILURE_WINDOW] + [now]
        self.failures[address] = recent
        if len(recent) >= MAX_FAILURES:
            self.blocked[address] = now + BLOCK_TIME
            self.failures.pop(address, None)
        if len(self.failures) > 1000:  # Never an unbounded table.
            self.failures.clear()
