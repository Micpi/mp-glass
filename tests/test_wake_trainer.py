"""The voice wake word's training, on made-up speech features: a « word » is a fixed path through the 96 dimensions,
said again with small changes in timing and noise; ordinary speech wanders anywhere."""
import base64
import importlib.util
from pathlib import Path
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("mp_wake_trainer", ROOT / "custom_components/mp_glass/wake_trainer.py")
wt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wt)

rng = np.random.default_rng(7)
WORD = rng.normal(0, 3, (12, 96)).astype(np.float32)
OTHER = rng.normal(0, 3, (12, 96)).astype(np.float32)
BASE = rng.normal(0, 1, 96).astype(np.float32)


def speech(path=None, length=30, end=24, noise=0.6, stretch=1.0):
    """Frames of a recording: background, then the path (stretched), ending at `end`."""
    frames = BASE + rng.normal(0, 2.5, (length, 96)).astype(np.float32)
    if path is not None:
        n = max(4, int(round(len(path) * stretch)))
        idx = np.minimum((np.arange(n) / stretch).astype(int), len(path) - 1)
        frames[end - n: end] = BASE + path[idx] + rng.normal(0, noise, (n, 96))
    return frames.astype(np.float32)


def stream(frames):
    return np.stack([frames[e - 16: e] for e in range(16, len(frames) + 1)])


class WakeTrainerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.recordings = [(speech(WORD, stretch=s), 24) for s in (1.0, 0.9, 1.1, 1.0)]
        cls.noisy = [(speech(WORD, stretch=s, noise=1.5), 24, i) for i, s in enumerate((1.0, 0.9, 1.1, 1.0))]
        cls.background = stream(speech(length=4000))[::2][:2000]
        cls.sentences = [speech(OTHER, length=60, end=40)]
        cls.model = wt.build(cls.recordings, cls.noisy, cls.background, cls.sentences)

    def test_the_word_is_heard_again_and_ordinary_sounds_are_not(self):
        heard = [wt.detect(self.model, stream(speech(WORD, stretch=s))).any() for s in (0.95, 1.05, 1.0, 1.1, 0.9)]
        self.assertGreaterEqual(sum(heard), 4)
        self.assertFalse(wt.detect(self.model, stream(speech(OTHER, length=40, end=30))).any())
        self.assertLess(wt.detect(self.model, stream(speech(length=2000))).mean(), 0.002)
        self.assertIn("judge", self.model)

    def test_a_cancelled_false_wake_is_learned(self):
        close = WORD.copy()
        close[:2] = OTHER[:2]
        before = wt.detect(self.model, stream(speech(close))).any()
        hard = stream(speech(close))[-6:]
        after_model = wt.build(self.recordings, self.noisy, self.background, self.sentences, hard=hard)
        self.assertTrue(before)
        self.assertFalse(wt.detect(after_model, stream(speech(close))).any())
        self.assertTrue(wt.detect(after_model, stream(speech(WORD))).any())

    def test_sensitivity_moves_the_threshold_but_never_below_the_background(self):
        own, near = self.model["own"], self.model["near"]
        self.assertLess(wt.threshold(own, near, "high"), wt.threshold(own, near, "normal"))
        self.assertLess(wt.threshold(own, near, "normal"), wt.threshold(own, near, "low"))
        self.assertGreaterEqual(wt.threshold(0.2, 0.8, "high"), 0.83)
        self.assertLessEqual(wt.threshold(0.99, 0.5, "low"), 0.97)

    def test_the_page_reads_what_the_server_computes(self):
        client = wt.to_client(self.model)
        prints = wt.decode(client["prints"])
        np.testing.assert_allclose(prints, self.model["prints"], rtol=1e-6)
        self.assertEqual(client["count"], len(prints))
        self.assertEqual(len(wt.decode(client["judge"]["w1"], ())), wt.SIZE * wt.HIDDEN)

    def test_too_few_recordings_or_bad_data_are_refused(self):
        with self.assertRaises(ValueError):
            wt.build(self.recordings[:2], [], self.background)
        with self.assertRaises(ValueError):
            wt.decode(base64.b64encode(b"abc").decode())
        with self.assertRaises(ValueError):
            wt.decode(base64.b64encode(np.full(96 * 16, np.nan, np.float32).tobytes()).decode())

    def test_shipped_background_sounds_load(self):
        import json
        meta = json.loads((ROOT / "public/wake/background.json").read_text())
        data = wt.dequantise((ROOT / "public/wake/background.bin").read_bytes(), meta["scale"], meta["count"])
        self.assertEqual(data.shape, (3000, 16, 96))
        self.assertTrue(np.isfinite(data).all())


if __name__ == "__main__":
    unittest.main()
