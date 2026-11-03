"""A corpus of what people say, kept as a measure: Nexus understands these at home, and leaves the rest to the usual pipeline."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("mp_timers_core", ROOT / "custom_components/mp_glass/timers_core.py")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
CORPUS = json.loads((ROOT / "tests/fixtures/nexus_timers_corpus.json").read_text(encoding="utf-8"))


def mismatch(case):
    got, want = core.understand(case["say"]), case["expect"]
    if want is None:
        return None if got is None else f"expected nothing, got {got}"
    if got is None:
        return f"expected {want}, got nothing"
    for key, value in want.items():
        if got.get(key) != value:
            return f"{key}: expected {value!r}, got {got.get(key)!r}"
    return None


class CorpusTests(unittest.TestCase):
    def test_every_sentence_is_understood_or_left_alone(self):
        wrong = [(c["say"], m) for c in CORPUS if (m := mismatch(c))]
        self.assertEqual(wrong, [], f"{len(wrong)} of {len(CORPUS)} sentences misunderstood")

    def test_the_corpus_covers_enough(self):
        kinds = {}
        for c in CORPUS:
            kinds[(c["expect"] or {}).get("action", "other")] = kinds.get((c["expect"] or {}).get("action", "other"), 0) + 1
        self.assertGreaterEqual(len(CORPUS), 100)
        for action in ("start_timer", "set_alarm", "cancel", "list", "other"):
            self.assertGreaterEqual(kinds[action], 5, action)


if __name__ == "__main__":
    unittest.main()
