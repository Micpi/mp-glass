"""Plans kept under the rooms of their level in the Studio: private files in Home Assistant's storage, never under www.

No Home Assistant import: the views in spatial.py call these, and the tests run them as they are.
"""
import os
from pathlib import Path
import re
import shutil
import time

MAX_FILE = 8 * 1024 * 1024
EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
CONTENT_TYPES = {extension: mime for mime, extension in EXTENSIONS.items()}
IDENTIFIER = re.compile(r"^[a-f0-9]{32}$")
# A plan applied to a level in the Studio is only referenced once the project is saved: it is left alone meanwhile.
GRACE = 3600


def image_extension(data, content_type):
    """Extension of an image whose first bytes are those of its type (a signature check, not a decoder); None otherwise."""
    signatures = {
        "image/png": data.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": data.startswith(b"\xff\xd8\xff"),
        "image/webp": data[:4] == b"RIFF" and data[8:12] == b"WEBP",
    }
    return EXTENSIONS[content_type] if data and len(data) <= MAX_FILE and signatures.get(content_type) else None


def store(folder, identifier, data, extension):
    """Written whole or not at all."""
    if not IDENTIFIER.match(identifier) or extension not in CONTENT_TYPES:
        raise ValueError("invalid_backdrop")
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{identifier}.{extension}"
    partial = folder / f"{identifier}.part"
    partial.write_bytes(data)
    os.replace(partial, path)
    return path


def find(folder, identifier):
    """The file of a plan, only for a well-formed identifier: nothing outside the folder can be asked for."""
    if not isinstance(identifier, str) or not IDENTIFIER.match(identifier):
        return None
    for extension in CONTENT_TYPES:
        path = Path(folder) / f"{identifier}.{extension}"
        if path.is_file():
            return path
    return None


def referenced(project):
    """Plans shown under the levels of a project."""
    floors = (project.get("spatial") or {}).get("floors", [])
    return {floor["backdrop"]["id"] for floor in floors if isinstance(floor.get("backdrop"), dict) and "id" in floor["backdrop"]}


def prune(folder, keep, now=None, grace=GRACE):
    """Removes the plans no level of the saved project shows any more, once older than `grace` seconds; returns their names."""
    folder = Path(folder)
    if not folder.is_dir():
        return []
    now = time.time() if now is None else now
    removed = []
    for path in folder.iterdir():
        if not path.is_file() or path.stem in keep or now - path.stat().st_mtime < grace:
            continue
        path.unlink()
        removed.append(path.name)
    return sorted(removed)


def remove_all(folder):
    """The integration is removed: its plans go with it."""
    shutil.rmtree(folder, ignore_errors=True)
