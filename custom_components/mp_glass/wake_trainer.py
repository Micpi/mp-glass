"""A wake word made from the user's own voice, without Home Assistant: the voice prints, and the small judge trained at home.

The page turns sound into openWakeWord's speech embeddings (96 values every 80 ms) and keeps the 16 last ones, 1.28 s.
The word is recognised in two ways, both cheap enough for a Raspberry Pi:

- voice prints: the windows of the word as the user said it while recording it. A window heard later is compared with
  each print, frame by frame (cosine, once the average sound of a home is taken away); it is the word when it is as
  close to the prints as the prints are to each other, and closer than anything in the background sounds;
- a judge: a tiny network (1536 → 16 → 1) trained on the recordings, made noisier in the page, against background
  sounds: a generic set shipped with the integration (openWakeWord's DiPCo features), the sounds of this home met while
  listening, and the false wakes the user cancelled. It learns again each night with what the screens heard.

Everything here works on numpy arrays; nothing touches files or Home Assistant.
"""
import base64

import numpy as np

WINDOW, DIMS = 16, 96
SIZE = WINDOW * DIMS
# The word's end, as the page finds it in the recording, is not exact: the windows around it count too.
SHIFTS = (-1, 0, 1, 2)
MIN_RECORDINGS = 3
# Hidden units of the judge, and its training.
HIDDEN, EPOCHS, LEARNING_RATE, WEIGHT_DECAY = 16, 220, 0.01, 1e-3
# Negatives used by one training: enough to be general, few enough for a small server.
MAX_NEGATIVES = 6000
# A judge is used once it finds most recordings again with a threshold above the background sounds.
MIN_RECALL = 0.8


def decode(text, tail=(WINDOW, DIMS)):
    """Float32 values sent in base64 by the page, shaped as (-1, *tail)."""
    raw = base64.b64decode(text or "", validate=True)
    if len(raw) % 4:
        raise ValueError("not float32")
    data = np.frombuffer(raw, dtype="<f4").astype(np.float32)
    if not tail:
        return data
    size = int(np.prod(tail))
    if data.size % size or not np.all(np.isfinite(data)):
        raise ValueError("bad shape")
    return data.reshape((-1, *tail))


def encode(array):
    return base64.b64encode(np.ascontiguousarray(array, dtype="<f4").tobytes()).decode()


def dequantise(raw, scale, count=None):
    """The background set as shipped: int8 per value, one scale per dimension."""
    data = np.frombuffer(raw, dtype=np.int8).astype(np.float32).reshape(-1, WINDOW, DIMS)
    if count:
        data = data[:count]
    return data * (np.asarray(scale, np.float32) / 127.0)


def unit(windows, center):
    """Each frame without the home's average sound, at length one: what the cosine compares."""
    moved = np.asarray(windows, np.float32) - center
    return moved / (np.linalg.norm(moved, axis=-1, keepdims=True) + 1e-6)


def print_scores(prints, windows):
    """How close each window is to the voice prints: the mean frame cosine with the two closest prints (both unit)."""
    if not len(windows):
        return np.zeros(0, np.float32)
    sims = np.einsum("tfd,wfd->wt", prints, windows) / WINDOW
    best = np.sort(sims, axis=1)[:, ::-1][:, : min(2, sims.shape[1])]
    return best.mean(axis=1)


def word_windows(sequence, end, shifts=SHIFTS):
    """The windows of 16 frames that end around the word's end, in one recording's frames."""
    sequence = np.asarray(sequence, np.float32)
    out = []
    for shift in shifts:
        stop = min(max(WINDOW, end + shift), len(sequence))
        if stop - WINDOW >= 0:
            out.append(sequence[stop - WINDOW: stop])
    return np.stack(out) if out else np.zeros((0, WINDOW, DIMS), np.float32)


def other_windows(sequence, end, margin=6):
    """Windows of a recording that end well before the word: silence or breath, never the word."""
    sequence = np.asarray(sequence, np.float32)
    out = [sequence[stop - WINDOW: stop] for stop in range(WINDOW, max(WINDOW, end - margin))]
    return np.stack(out) if out else np.zeros((0, WINDOW, DIMS), np.float32)


def voice_prints(recordings, noisy, center):
    """The voice prints, and how close a real « Nexus » comes to them.

    `recordings` are clean (frames, end) pairs; `noisy` are (frames, end, recording) made noisier in the page, so that
    the word is still found with the television on. Each clean recording is compared with the prints of the other
    recordings (best shift): the weakest of these is how close the word comes when it is said again."""
    prints = [unit(word_windows(frames, end, (1,))[0], center) for frames, end in recordings]
    owner = list(range(len(recordings)))
    for frames, end, source in noisy:
        prints.append(unit(word_windows(frames, end, (1,))[0], center))
        owner.append(source)
    prints, owner = np.stack(prints), np.asarray(owner)
    # Compared with the other clean prints only: a noisy print is close to everything a little.
    clean = np.arange(len(prints)) < len(recordings)
    own = [float(print_scores(prints[clean & (owner != i)], unit(word_windows(frames, end), center)).max()) for i, (frames, end) in enumerate(recordings)]
    return prints, own


def _train(x, y, weights, seed):
    rng = np.random.default_rng(seed)
    w1 = rng.normal(0, np.sqrt(2 / x.shape[1]), (x.shape[1], HIDDEN)).astype(np.float32)
    b1 = np.zeros(HIDDEN, np.float32)
    w2 = rng.normal(0, np.sqrt(1 / HIDDEN), (HIDDEN, 1)).astype(np.float32)
    b2 = np.zeros(1, np.float32)
    params = [w1, b1, w2, b2]
    m = [np.zeros_like(p) for p in params]
    v = [np.zeros_like(p) for p in params]
    weights = (weights / weights.mean()).astype(np.float32)
    for step in range(1, EPOCHS + 1):
        hidden = np.maximum(0, x @ w1 + b1)
        p = 1 / (1 + np.exp(-np.clip((hidden @ w2 + b2).ravel(), -30, 30)))
        g = ((p - y) * weights / len(y)).astype(np.float32)
        gw2 = hidden.T @ g[:, None]
        gb2 = g.sum(keepdims=True)
        gh = (g[:, None] @ w2.T) * (hidden > 0)
        gw1 = x.T @ gh
        gb1 = gh.sum(axis=0)
        for i, grad in enumerate((gw1 + WEIGHT_DECAY * w1, gb1, gw2 + WEIGHT_DECAY * w2, gb2)):
            m[i] = 0.9 * m[i] + 0.1 * grad
            v[i] = 0.999 * v[i] + 0.001 * grad * grad
            params[i] -= LEARNING_RATE * (m[i] / (1 - 0.9 ** step)) / (np.sqrt(v[i] / (1 - 0.999 ** step)) + 1e-8)
    return params


def judge_scores(judge, windows):
    x = (np.asarray(windows, np.float32).reshape(len(windows), SIZE) - judge["mean"]) / judge["std"]
    hidden = np.maximum(0, x @ judge["w1"] + judge["b1"])
    return 1 / (1 + np.exp(-np.clip((hidden @ judge["w2"] + judge["b2"]).ravel(), -30, 30)))


def train_judge(positives, negatives, hard=None, seed=0):
    """The judge, its threshold and how it did; None when there is too little to learn from.

    A fifth of the negatives are kept aside: the threshold sits above almost all of them, so that the sounds of the
    home rarely wake Nexus. The cancelled false wakes (`hard`) weigh five times more."""
    positives = np.asarray(positives, np.float32).reshape(-1, SIZE)
    negatives = np.asarray(negatives, np.float32).reshape(-1, SIZE)
    hard = np.zeros((0, SIZE), np.float32) if hard is None or not len(hard) else np.asarray(hard, np.float32).reshape(-1, SIZE)
    if len(positives) < 8 or len(negatives) < 200:
        return None
    rng = np.random.default_rng(seed)
    if len(negatives) > MAX_NEGATIVES:
        negatives = negatives[rng.choice(len(negatives), MAX_NEGATIVES, replace=False)]
    order = rng.permutation(len(negatives))
    aside = negatives[order[: len(order) // 5]]
    kept = negatives[order[len(order) // 5:]]
    x = np.concatenate([positives, kept, hard])
    y = np.concatenate([np.ones(len(positives)), np.zeros(len(kept) + len(hard))]).astype(np.float32)
    balance = max(1.0, (len(kept) + len(hard)) / len(positives))
    weights = np.concatenate([np.full(len(positives), balance), np.ones(len(kept)), np.full(len(hard), 5.0)])
    mean = x.mean(axis=0)
    std = x.std(axis=0) + 1e-3
    w1, b1, w2, b2 = _train((x - mean) / std, y, weights, seed)
    judge = {"mean": mean, "std": std, "w1": w1, "b1": b1, "w2": w2.ravel(), "b2": b2}
    judge["w2"] = judge["w2"][:, None]
    against = np.concatenate([aside, hard]) if len(hard) else aside
    background = judge_scores(judge, against)
    threshold = float(np.clip(np.quantile(background, 0.999) + 0.05, 0.5, 0.95))
    found = float((judge_scores(judge, positives) >= threshold).mean())
    return {**judge, "threshold": threshold, "recall": found, "false": float((background >= threshold).mean())}


# How much closer than the recordings among themselves a sound must come, by sensitivity (the page applies it).
SENSITIVITY = {"high": -0.04, "normal": -0.01, "low": 0.02}


def threshold(own, near, sensitivity="normal"):
    """The prints' threshold: near the recordings' own closeness, always above the closest background sound."""
    return float(min(0.97, max(own + SENSITIVITY.get(sensitivity, -0.01), near + 0.03)))


def windows_of(frames):
    frames = np.asarray(frames, np.float32)
    if len(frames) < WINDOW:
        return np.zeros((0, WINDOW, DIMS), np.float32)
    return np.stack([frames[stop - WINDOW: stop] for stop in range(WINDOW, len(frames) + 1)])


def build(recordings, noisy, background, sentences=(), ambient=None, hard=None, confirmed=None, seed=0):
    """Everything the page needs to hear the word, from what was learned so far.

    `recordings`: clean (frames, end) pairs; `noisy`: (frames, end, recording) made noisier in the page;
    `background`: generic windows; `sentences`: frames of ordinary sentences read by the same voice, the closest
    thing to the word that is not the word; `ambient`: windows met in this home; `hard`: cancelled false wakes;
    `confirmed`: windows that woke Nexus for a real request."""
    if len(recordings) < MIN_RECORDINGS:
        raise ValueError("too few recordings")
    shape = (-1, WINDOW, DIMS)
    spoken = [windows_of(f) for f in sentences]
    spoken = np.concatenate(spoken) if spoken else np.zeros((0, WINDOW, DIMS), np.float32)
    hard = np.concatenate([spoken] + ([np.asarray(hard, np.float32).reshape(shape)] if hard is not None and len(hard) else []))
    negatives = [np.asarray(background, np.float32).reshape(shape)]
    if ambient is not None and len(ambient):
        negatives.append(np.asarray(ambient, np.float32).reshape(shape))
    negatives += [other_windows(frames, end) for frames, end in recordings]
    negatives = np.concatenate(negatives)
    # The home's average sound: this voice and this room, rather than the generic set.
    center = np.concatenate([spoken.reshape(-1, DIMS)] + [np.asarray(f, np.float32) for f, _ in recordings]).mean(axis=0)
    prints, own = voice_prints(recordings, noisy, center)
    # The cancelled false wakes are left to the judge: counted here, one « Lexus » would make every « Nexus » harder.
    heard = print_scores(prints, unit(np.concatenate([negatives, spoken]), center))
    near = float(np.quantile(heard, 0.999)) if len(heard) else 0.0
    positives = [word_windows(frames, end) for frames, end in recordings] + [word_windows(frames, end) for frames, end, _ in noisy]
    if confirmed is not None and len(confirmed):
        positives.append(np.asarray(confirmed, np.float32).reshape(shape))
    positives = np.concatenate(positives)
    judge = train_judge(positives, negatives, hard, seed)
    model = {
        "center": center.astype(np.float32),
        "prints": prints.astype(np.float32),
        "own": float(min(own)),
        "near": near,
        "stats": {"own": round(min(own), 3), "near": round(near, 3), "negatives": int(len(negatives) + len(hard)), "positives": int(len(positives))},
    }
    if judge is not None and judge["recall"] >= MIN_RECALL:
        model["judge"] = judge
        model["stats"].update(recall=round(judge["recall"], 3), false=round(judge["false"], 5))
    return model


def to_client(model):
    """The model as the page reads it: plain numbers and base64 float32."""
    out = {"kind": "voice", "center": encode(model["center"]), "prints": encode(model["prints"]), "count": int(len(model["prints"])),
           "own": model["own"], "near": model["near"], "stats": model["stats"]}
    if judge := model.get("judge"):
        out["judge"] = {"mean": encode(judge["mean"]), "std": encode(judge["std"]), "w1": encode(judge["w1"]), "b1": encode(judge["b1"]),
                        "w2": encode(judge["w2"]), "b2": float(judge["b2"][0]), "hidden": HIDDEN, "threshold": judge["threshold"]}
    return out


def detect(model, windows, sensitivity="normal"):
    """What the page decides for each window (the same rule as frontend/v2/wake.ts), for tests: close enough to the
    prints, and the judge agrees when there is one."""
    found = print_scores(model["prints"], unit(windows, model["center"])) >= threshold(model["own"], model["near"], sensitivity)
    if judge := model.get("judge"):
        found &= judge_scores(judge, windows) >= judge["threshold"]
    return found
