"""Plans kept under their levels: stored privately, only images, only by identifier, removed once no level shows them."""
import importlib.util
import os
from pathlib import Path
import tempfile
import time
import unittest

ROOT = Path(__file__).parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"custom_components/mp_glass/{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


backdrop = load("backdrop")
project = load("project")
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 32
ID = "0123456789abcdef0123456789abcdef"


class BackdropTest(unittest.TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp()) / "mp_glass_backdrops"

    def tearDown(self):
        backdrop.remove_all(self.folder.parent)

    def test_only_images_that_are_what_they_claim(self):
        self.assertEqual(backdrop.image_extension(PNG, "image/png"), "png")
        self.assertEqual(backdrop.image_extension(b"\xff\xd8\xff\xe0" + b"\0" * 8, "image/jpeg"), "jpg")
        self.assertEqual(backdrop.image_extension(b"RIFF\0\0\0\0WEBPVP8 ", "image/webp"), "webp")
        for data, kind in ((PNG, "image/jpeg"), (b"%PDF-1.4", "application/pdf"), (b"<svg/>", "image/svg+xml"), (b"", "image/png"),
                           (PNG + b"\0" * backdrop.MAX_FILE, "image/png")):
            self.assertIsNone(backdrop.image_extension(data, kind))

    def test_stored_then_found_by_identifier_only(self):
        path = backdrop.store(self.folder, ID, PNG, "png")
        self.assertEqual(path.read_bytes(), PNG)
        self.assertEqual(backdrop.find(self.folder, ID), path)
        self.assertEqual(sorted(p.name for p in self.folder.iterdir()), [f"{ID}.png"])
        for asked in ("../" + ID, ID.upper(), ID[:-1], f"{ID}.png", None, "0" * 31 + "/"):
            self.assertIsNone(backdrop.find(self.folder, asked))
        self.assertIsNone(backdrop.find(self.folder, "f" * 32))
        with self.assertRaises(ValueError):
            backdrop.store(self.folder, "../escape", PNG, "png")

    def test_plans_no_level_shows_are_removed_after_a_while(self):
        kept, applied, dropped = ID, "a" * 32, "b" * 32
        for identifier in (kept, applied, dropped):
            backdrop.store(self.folder, identifier, PNG, "png")
        hour_ago = time.time() - 2 * backdrop.GRACE
        for identifier in (kept, dropped):
            os.utime(self.folder / f"{identifier}.png", (hour_ago, hour_ago))
        saved = project.default_project() | {"spatial": {"version": 1, "enabled": True, "floors": [
            {"id": "rdc", "name": "RDC", "elevation": 0, "height": 2.6, "backdrop": {"id": kept, "width": 1300, "height": 800, "scale": [.01, .01], "origin": [0, 0]},
             "rooms": [{"id": "salon", "name": "Salon", "polygon": [[0, 0], [4, 0], [4, 4], [0, 4]]}]},
        ]}}
        project.validate_project(project.load_validator(), saved)
        self.assertEqual(backdrop.referenced(saved), {kept})
        # The one just applied in the Studio, not saved yet, waits.
        self.assertEqual(backdrop.prune(self.folder, backdrop.referenced(saved)), [f"{dropped}.png"])
        self.assertEqual(sorted(p.stem for p in self.folder.iterdir()), sorted([kept, applied]))
        self.assertEqual(backdrop.prune(self.folder / "missing", set()), [])

    def test_the_contract_accepts_a_plan_only_as_an_identifier_and_its_mapping(self):
        floor = {"id": "rdc", "name": "RDC", "elevation": 0, "height": 2.6, "rooms": [{"id": "salon", "name": "Salon", "polygon": [[0, 0], [4, 0], [4, 4], [0, 4]]}]}
        for wrong in ({"id": "../x", "width": 10, "height": 10, "scale": [.01, .01], "origin": [0, 0]},
                      {"id": ID, "width": 10, "height": 10, "scale": [0, .01], "origin": [0, 0]},
                      {"id": ID, "width": 10, "height": 10, "scale": [.01, .01], "origin": [0, 0], "url": "http://example.com/plan.png"}):
            with self.assertRaises(Exception):
                project.validate_project(project.load_validator(), project.default_project() | {"spatial": {"version": 1, "enabled": True, "floors": [floor | {"backdrop": wrong}]}})


if __name__ == "__main__":
    unittest.main()
