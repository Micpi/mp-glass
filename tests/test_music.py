import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("mp_music_core", ROOT / "custom_components/mp_glass/music_core.py")
music = importlib.util.module_from_spec(spec)
spec.loader.exec_module(music)


class MusicBridgeTests(unittest.TestCase):
    def test_normalizes_real_music_assistant_artwork_without_exposing_it(self):
        artwork = {}
        item = {"uri": "library://track/42", "name": "Moon Song", "media_type": "track", "artists": [{"name": "Lumen Drift"}], "metadata": {"images": [{"path": "/library/metadata/42/thumb", "provider": "spotify--home", "remotely_accessible": False}]}}
        result = music.normalize_item("http://music.local:8095", item, artwork)
        self.assertEqual(result["media_content_id"], "library://track/42")
        self.assertEqual(result["artist"], "Lumen Drift")
        self.assertTrue(result["thumbnail"].startswith("/api/mp_glass/music/artwork/"))
        self.assertEqual(len(artwork), 1)
        self.assertIn("http://music.local:8095/imageproxy", next(iter(artwork.values())))

    def test_accepts_only_plain_http_server_addresses(self):
        self.assertTrue(music.valid_server_url("http://music.local:8095"))
        self.assertFalse(music.valid_server_url("http://user:secret@music.local:8095"))
        self.assertFalse(music.valid_server_url("http://music.local:8095/?token=secret"))
        self.assertFalse(music.valid_server_url("file:///tmp/music"))


if __name__ == "__main__":
    unittest.main()
