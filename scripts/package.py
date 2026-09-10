"""Produce a deterministic archive, excluding caches and development artifacts."""
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1] / "custom_components" / "mp_glass"
with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob("*")):
        if not path.is_file() or "__pycache__" in path.parts or path.suffix in {".pyc", ".map"}:
            continue
        info = zipfile.ZipInfo("mp_glass/" + path.relative_to(root).as_posix(), (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
