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

    def test_normalizes_remote_artwork_from_the_official_ha_action_without_server_settings(self):
        artwork = {}
        item = {"uri": "library://album/7", "name": "Blue", "media_type": "album", "metadata": {"images": [{"path": "https://i.example.test/blue.jpg", "remotely_accessible": True}]}}
        result = music.normalize_item("", item, artwork)
        self.assertTrue(result["thumbnail"].startswith("/api/mp_glass/music/artwork/"))
        self.assertEqual(next(iter(artwork.values())), "https://i.example.test/blue.jpg")

    def test_reads_official_home_assistant_action_responses(self):
        album = {"uri": "library://album/7"}
        track = {"uri": "library://track/42"}
        self.assertEqual(music.service_items({"items": [album]}), [album])
        self.assertEqual(music.service_items({"media_player.salon": {"items": [track]}}, "media_player.salon"), [track])
        self.assertEqual(music.search_items({"albums": [album], "tracks": [track], "unknown": [1]}), [album, track])


    def test_engine_phase_tells_the_setup_screen_where_music_stands(self):
        self.assertEqual(music.engine_phase(True, None, True, False, None), "ready")
        self.assertEqual(music.engine_phase(True, {"installed": False}, False, True, None), "preparing")
        self.assertEqual(music.engine_phase(True, {"installed": True, "state": "started"}, False, False, "install"), "failed")
        self.assertEqual(music.engine_phase(False, None, False, False, None), "unsupported")
        self.assertEqual(music.engine_phase(True, {"installed": False, "available": True}, False, False, None), "off")
        self.assertEqual(music.engine_phase(True, {"installed": True, "state": "started"}, False, False, None), "linking")
        self.assertTrue(music.ADDON_SLUG.endswith("_music_assistant"))


if __name__ == "__main__":
    unittest.main()
