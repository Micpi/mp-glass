import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "custom_components" / "mp_glass"))
import tts_core as t  # noqa: E402


class VoicesTest(unittest.TestCase):
    def test_languages_take_short_and_regional_tags(self):
        for tag in ("fr", "fr-FR", "fr-CA", "en", "en-GB", "de", "it", "ru", "es"):
            self.assertIn(tag, t.LANGUAGES)

    def test_only_multilingual_voices_for_every_language(self):
        self.assertEqual(len(t.CATALOGUE), 12)
        self.assertTrue(all("Multilingual" in v["id"] for v in t.CATALOGUE))
        for lang in ("fr", "en", "ru", "es"):
            self.assertEqual(len(t.voices_for(lang)), 12)
        self.assertTrue(t.voices_for("fr")[0]["id"].startswith("fr-FR-"))

    def test_service_list_removes_gone_voices(self):
        listed = [{"ShortName": "fr-FR-RemyMultilingualNeural"}, {"ShortName": "fr-FR-HenriNeural"}]
        self.assertEqual([v["id"] for v in t.voices_for("fr", listed)], ["fr-FR-RemyMultilingualNeural"])

    def test_pick_voice(self):
        self.assertEqual(t.pick_voice("en-US-AvaMultilingualNeural", "fr"), "en-US-AvaMultilingualNeural")
        self.assertEqual(t.pick_voice("fr-FR-HenriNeural", "fr"), "fr-FR-RemyMultilingualNeural")
        self.assertEqual(t.pick_voice(None, "en-GB"), "en-US-AndrewMultilingualNeural")
        self.assertEqual(t.pick_voice(None, "ru"), "en-US-AndrewMultilingualNeural")


if __name__ == "__main__":
    unittest.main()
