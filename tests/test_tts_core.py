import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "custom_components" / "mp_glass"))
import tts_core as t  # noqa: E402


class VoicesTest(unittest.TestCase):
    def test_languages_take_short_and_regional_tags(self):
        for tag in ("fr", "fr-FR", "fr-CA", "en", "en-GB", "de", "it", "ru"):
            self.assertIn(tag, t.LANGUAGES)

    def test_french_first_from_france(self):
        voices = t.voices_for("fr")
        self.assertEqual(voices[0]["id"], "fr-FR-HenriNeural")
        self.assertGreaterEqual(len(voices), 10)
        self.assertTrue(all(v["locale"].startswith("fr-") for v in voices))
        self.assertEqual(t.voices_for("fr-CA")[0]["locale"], "fr-CA")

    def test_service_list_adds_voices(self):
        listed = [{"ShortName": "fr-FR-NouveauNeural", "Locale": "fr-FR", "Gender": "Female"}, {"ShortName": "bad"}]
        ids = [v["id"] for v in t.voices_for("fr", listed)]
        self.assertIn("fr-FR-NouveauNeural", ids)
        self.assertEqual(ids[0], "fr-FR-HenriNeural")

    def test_pick_voice(self):
        self.assertEqual(t.pick_voice("en-US-AvaMultilingualNeural", "fr"), "en-US-AvaMultilingualNeural")
        self.assertEqual(t.pick_voice("Google français", "fr"), "fr-FR-HenriNeural")
        self.assertEqual(t.pick_voice(None, "en-GB"), "en-GB-RyanNeural")


if __name__ == "__main__":
    unittest.main()
