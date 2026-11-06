"""Wake words made from the user's voice, kept by Home Assistant: the recordings' features, the sounds met at home,
the model the pages use, and its training (at once, after a cancelled false wake, and each night).

Only speech embeddings are kept (96 numbers every 80 ms), never sound: they cannot be played back.
"""
import asyncio
import json
import logging
import os
import time

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers.event import async_call_later, async_track_time_change

from . import wake_trainer as trainer

_LOGGER = logging.getLogger(__name__)

KEY = "mp_glass_wake_voice"
AMBIENT_MAX = 4000
KEPT_MAX = 300
# Limits of what a page may send at once.
MAX_RECORDINGS, MAX_NOISY, MAX_SENTENCES, MAX_FRAMES = 8, 48, 4, 120
MAX_AMBIENT_SENT, MAX_EXAMPLES_SENT = 64, 4
# A cancelled false wake is learned quickly; the rest waits for the night.
RETRAIN_DELAY = 20
# Models built before this revision may have learned missed wake words as background sounds.
TRAINING_REVISION = 1
_FRAMES = vol.All(str, vol.Length(max=MAX_FRAMES * trainer.DIMS * 4 * 4 // 3 + 8))
_WINDOWS = vol.All(str, vol.Length(max=MAX_AMBIENT_SENT * trainer.SIZE * 4 * 4 // 3 + 8))
_WORD = vol.All(str, vol.Match(r"^[a-f0-9]{16}$"))


# ——— Files, in the wake words' folder ———
def voice_path(folder, word):
    return os.path.join(folder, f"{word}.voice.npz")


def model_path(folder, word):
    return os.path.join(folder, f"{word}.model.json")


def ambient_path(folder):
    return os.path.join(folder, "ambient.npy")


def _ragged(items):
    """Sequences of frames of different lengths, as one array and their lengths."""
    items = [trainer.np.asarray(i, trainer.np.float32).reshape(-1, trainer.DIMS) for i in items]
    if not items:
        return trainer.np.zeros((0, trainer.DIMS), trainer.np.float16), trainer.np.zeros(0, trainer.np.int32)
    return trainer.np.concatenate(items).astype(trainer.np.float16), trainer.np.asarray([len(i) for i in items], trainer.np.int32)


def _split(frames, lengths):
    out, at = [], 0
    for n in lengths:
        out.append(frames[at: at + n].astype(trainer.np.float32))
        at += n
    return out


def save_voice(folder, word, data):
    np = trainer.np
    os.makedirs(folder, exist_ok=True)
    rec_frames, rec_lengths = _ragged([f for f, _ in data["recordings"]])
    noisy_frames, noisy_lengths = _ragged([f for f, _, _ in data["noisy"]])
    sent_frames, sent_lengths = _ragged(data["sentences"])
    empty = np.zeros((0, trainer.WINDOW, trainer.DIMS), np.float16)
    tmp = voice_path(folder, word) + ".tmp.npz"
    np.savez(tmp, rec_frames=rec_frames, rec_lengths=rec_lengths, rec_ends=np.asarray([e for _, e in data["recordings"]], np.int32),
             noisy_frames=noisy_frames, noisy_lengths=noisy_lengths, noisy_ends=np.asarray([e for _, e, _ in data["noisy"]], np.int32),
             noisy_sources=np.asarray([s for _, _, s in data["noisy"]], np.int32), sent_frames=sent_frames, sent_lengths=sent_lengths,
             confirmed=np.asarray(data.get("confirmed", empty), np.float16)[-KEPT_MAX:], hard=np.asarray(data.get("hard", empty), np.float16)[-KEPT_MAX:])
    os.replace(tmp, voice_path(folder, word))


def load_voice(folder, word):
    with trainer.np.load(voice_path(folder, word), allow_pickle=False) as data:
        recs = _split(data["rec_frames"], data["rec_lengths"])
        noisy = _split(data["noisy_frames"], data["noisy_lengths"])
        return {
            "recordings": list(zip(recs, data["rec_ends"].tolist())),
            "noisy": list(zip(noisy, data["noisy_ends"].tolist(), data["noisy_sources"].tolist())),
            "sentences": _split(data["sent_frames"], data["sent_lengths"]),
            "confirmed": data["confirmed"].astype(trainer.np.float32),
            "hard": data["hard"].astype(trainer.np.float32),
        }


def load_ambient(folder):
    try:
        return trainer.np.load(ambient_path(folder), allow_pickle=False).astype(trainer.np.float32)
    except (OSError, ValueError):
        return trainer.np.zeros((0, trainer.WINDOW, trainer.DIMS), trainer.np.float32)


def add_ambient(folder, windows):
    np = trainer.np
    os.makedirs(folder, exist_ok=True)
    kept = np.concatenate([load_ambient(folder), windows])[-AMBIENT_MAX:].astype(np.float16)
    tmp = ambient_path(folder) + ".tmp.npy"
    np.save(tmp, kept)
    os.replace(tmp, ambient_path(folder))
    return len(kept)


def add_examples(folder, word, confirmed=None, hard=None):
    data = load_voice(folder, word)
    np = trainer.np
    if confirmed is not None and len(confirmed):
        data["confirmed"] = np.concatenate([data["confirmed"], confirmed])
    if hard is not None and len(hard):
        data["hard"] = np.concatenate([data["hard"], hard])
    save_voice(folder, word, data)


def read_model(folder, word):
    try:
        with open(model_path(folder, word), encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return None


def write_model(folder, word, model):
    tmp = model_path(folder, word) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(model, handle)
    os.replace(tmp, model_path(folder, word))


def remove_voice(folder, word):
    for path in (voice_path(folder, word), model_path(folder, word)):
        if os.path.exists(path):
            os.remove(path)


def load_background():
    """The generic background sounds shipped with the integration (openWakeWord's DiPCo features, int8)."""
    base = os.path.join(os.path.dirname(__file__), "www", "wake")
    try:
        with open(os.path.join(base, "background.json"), encoding="utf-8") as handle:
            meta = json.load(handle)
        with open(os.path.join(base, "background.bin"), "rb") as handle:
            return trainer.dequantise(handle.read(), meta["scale"], meta.get("count"))
    except (OSError, ValueError, KeyError) as err:
        _LOGGER.warning("Nexus wake word: background sounds unavailable (%s)", err)
        return trainer.np.zeros((0, trainer.WINDOW, trainer.DIMS), trainer.np.float32)


def train(folder, word, background):
    """Trains the word again with all it knows; returns the model for the pages."""
    data = load_voice(folder, word)
    # Unlabelled room audio can contain an unrecognised wake word. Never teach it as a negative.
    # Keep the old file intact, but rebuild from recorded words, explicit feedback and the shipped background.
    model = trainer.build(data["recordings"], data["noisy"], background, data["sentences"],
                          hard=data["hard"], confirmed=data["confirmed"])
    client = {**trainer.to_client(model), "trained": time.time(), "training_revision": TRAINING_REVISION}
    write_model(folder, word, client)
    return client


def stale(folder, word):
    """Whether the screens taught something since the last training."""
    model = read_model(folder, word)
    if model is None or model.get("training_revision") != TRAINING_REVISION:
        return True
    newest = max((os.path.getmtime(p) for p in (voice_path(folder, word),) if os.path.exists(p)), default=0)
    return newest > float(model.get("trained", 0))


# ——— In Home Assistant ———
class WakeVoice:
    def __init__(self, hass, folder):
        self.hass, self.folder = hass, folder
        self.lock = asyncio.Lock()
        self._background = None
        self._later = {}
        self._nightly = None

    async def background(self):
        if self._background is None:
            self._background = await self.hass.async_add_executor_job(load_background)
        return self._background

    async def train(self, word):
        background = await self.background()
        async with self.lock:
            return await self.hass.async_add_executor_job(train, self.folder, word, background)

    async def current_model(self, word):
        """Rebuild an older model once even when several screens request it together."""
        async with self.lock:
            model = await self.hass.async_add_executor_job(read_model, self.folder, word)
            if model and model.get("training_revision") == TRAINING_REVISION:
                return model
            background = await self.background()
            return await self.hass.async_add_executor_job(train, self.folder, word, background)

    @callback
    def train_soon(self, word):
        if cancel := self._later.pop(word, None):
            cancel()

        async def run(_now):
            self._later.pop(word, None)
            try:
                await self.train(word)
            except Exception:  # noqa: BLE001 - a failed training keeps the previous model.
                _LOGGER.exception("Nexus wake word: training failed")

        self._later[word] = async_call_later(self.hass, RETRAIN_DELAY, run)

    async def nightly(self, words):
        for word in words:
            if await self.hass.async_add_executor_job(stale, self.folder, word):
                try:
                    stats = (await self.train(word))["stats"]
                    _LOGGER.debug("Nexus wake word %s trained again: %s", word, stats)
                except Exception:  # noqa: BLE001
                    _LOGGER.exception("Nexus wake word: nightly training failed")

    def close(self):
        for cancel in self._later.values():
            cancel()
        self._later.clear()
        if self._nightly:
            self._nightly()
            self._nightly = None


def voice_runtime(hass, folder):
    runtime = hass.data.get(KEY)
    if runtime is None or runtime.folder != folder:
        runtime = hass.data[KEY] = WakeVoice(hass, folder)
    return runtime


@callback
def async_setup_nightly(hass, folder, words):
    """Each night at 3:21, the words that heard something new learn it."""
    runtime = voice_runtime(hass, folder)
    if runtime._nightly is None:
        async def night(_now):
            await runtime.nightly(await words())
        runtime._nightly = async_track_time_change(hass, night, hour=3, minute=21, second=0)
    return runtime
