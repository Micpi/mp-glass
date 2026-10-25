"""Small, dependency-free helpers for the MP Nexus Music Assistant bridge."""
from hashlib import sha256
from urllib.parse import quote

ADDON_SLUG = "d5369777_music_assistant"
ADDON_REPOSITORY = "https://github.com/music-assistant/home-assistant-addon"

LIBRARY_COMMANDS = {
    "albums": "music/albums/library_items",
    "artists": "music/artists/library_items",
    "tracks": "music/tracks/library_items",
    "playlists": "music/playlists/library_items",
    "radio": "music/radios/library_items",
    "podcasts": "music/podcasts/library_items",
}


def service_items(answer, entity_id=None):
    """Read item arrays returned by current and legacy HA Music Assistant actions."""
    if not isinstance(answer, dict):
        return []
    value = answer.get(entity_id, answer) if entity_id else answer
    return value.get("items", []) if isinstance(value, dict) and isinstance(value.get("items"), list) else []


def search_items(answer):
    """Flatten the typed result groups of the official search action."""
    if not isinstance(answer, dict):
        return []
    result = []
    for kind in ("artists", "albums", "tracks", "playlists", "radio", "podcasts"):
        values = answer.get(kind)
        if isinstance(values, list):
            result.extend(values)
    return result


def image_source(base_url, item, size=400):
    """Return one MA image URL from a media or queue item."""
    media = item.get("media_item") if isinstance(item, dict) else None
    source = media if isinstance(media, dict) else item
    metadata = source.get("metadata") if isinstance(source, dict) else None
    images = metadata.get("images") if isinstance(metadata, dict) else None
    image = images[0] if isinstance(images, list) and images else None
    if not isinstance(image, dict):
        value = item.get("image") if isinstance(item, dict) else None
        return value if isinstance(value, str) and value.startswith(("http://", "https://")) else None
    path = image.get("path")
    if not isinstance(path, str) or not path:
        return None
    if path.startswith(("http://", "https://")) and (image.get("remotely_accessible") or not base_url):
        return path
    if not base_url:
        return None
    if image.get("proxy_id"):
        return f"{base_url.rstrip('/')}/imageproxy/{quote(str(image['proxy_id']), safe='')}?size={size}"
    provider = image.get("provider") or source.get("provider") or "builtin"
    return f"{base_url.rstrip('/')}/imageproxy?path={quote(quote(path, safe=''), safe='')}&provider={quote(str(provider), safe='')}&size={size}"


def artwork_key(url):
    return sha256(url.encode("utf-8")).hexdigest()[:32]


def normalize_item(base_url, item, artwork):
    """Reduce provider-specific MA objects to the stable browser contract."""
    if not isinstance(item, dict):
        return None
    media = item.get("media_item") if isinstance(item.get("media_item"), dict) else item
    uri = media.get("uri") or item.get("uri")
    if not isinstance(uri, str) or not uri:
        return None
    artists = media.get("artists")
    artist = ""
    if isinstance(artists, list):
        artist = ", ".join(str(value.get("name")) for value in artists if isinstance(value, dict) and value.get("name"))
    artist = artist or str(media.get("artist") or item.get("artist") or "")
    image = image_source(base_url, item)
    thumbnail = None
    if image:
        key = artwork_key(image)
        artwork[key] = image
        thumbnail = f"/api/mp_glass/music/artwork/{key}"
    return {
        "title": str(media.get("name") or item.get("name") or item.get("title") or uri),
        "artist": artist,
        "album": str((media.get("album") or {}).get("name", "")) if isinstance(media.get("album"), dict) else str(media.get("album") or ""),
        "media_content_id": uri,
        "media_content_type": str(media.get("media_type") or item.get("media_type") or "music"),
        "thumbnail": thumbnail,
        "favorite": bool(media.get("favorite", False)),
        "queue_item_id": str(item.get("queue_item_id") or ""),
        "index": item.get("index"),
        "duration": item.get("duration") or media.get("duration"),
        "can_play": True,
        "can_expand": False,
    }


def engine_phase(supervisor, addon, linked, running, error):
    """Where the household music engine stands, as the setup screen tells it.

    ready: linked to Home Assistant; preparing: MP Nexus is installing or starting it; failed: the last try stopped;
    unsupported: an installation without apps and without the integration; off: nothing yet, one button away.
    """
    if linked:
        return "ready"
    if running:
        return "preparing"
    if error:
        return "failed"
    if not supervisor:
        return "unsupported"
    return "off" if not (addon or {}).get("installed") or (addon or {}).get("state") != "started" else "linking"
