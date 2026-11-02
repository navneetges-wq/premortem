# sound.py — builds the whole soundtrack for a video from its cue list (cuesN.json), all synthesised:
# a beat-locked music bed (kick, hats, bass pulse, pad) + sound effects at exact frame times.
# Usage: python3 sound.py 1   → audio1.wav
import json, sys, numpy as np, wave

SR = 48000
v = sys.argv[1] if len(sys.argv) > 1 else "1"
spec = json.load(open(f"cues{v}.json"))
DUR = spec["duration"] + 0.6
BPM = spec["bpm"]; MOOD = spec.get("mood", "bright")
N = int(DUR * SR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)
t_ = lambda d: np.arange(int(d * SR)) / SR

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0: return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * (1 + min(0, pan))

def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)

def lowpass(x, k):  # simple one-pole smoothing (k 0..1, smaller = darker)
    y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)): acc += k * (x[i] - acc); y[i] = acc
    return y

def lp_fast(x, k):  # vectorised-ish one-pole via exponential filter on chunks
    from math import exp
    y = np.empty_like(x); acc = 0.0
    a = k
    for i, s in enumerate(x): acc = acc + a * (s - acc); y[i] = acc
    return y

# ---------- sound effects ----------
def beep(len_=0.11, f=988):
    t = t_(len_); return np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.004) * np.minimum(1, (len_ - t) / 0.01) * 0.32
def flat(len_=1.4): return beep(len_, 988) * 0.85
def thump():
    out = np.zeros(int(0.5 * SR))
    for off, g in ((0, 1.0), (0.17, 0.7)):
        t = t_(0.25); f = 60 * np.exp(-t * 6) + 38
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.003, 0.08) * g
        i = int(off * SR); out[i:i + len(s)] += s
    return out * 0.9
def whoosh(len_=0.45):
    n = int(len_ * SR); x = rng.standard_normal(n)
    k = np.linspace(0.02, 0.35, n) ** 1.5
    y = np.empty(n); acc = 0.0
    for i in range(n): acc += k[i] * (x[i] - acc); y[i] = acc
    sh = np.sin(np.linspace(0, np.pi, n)) ** 2
    return y * sh * 0.55
def swish(): return whoosh(0.22) * 0.7
def impact():
    t = t_(0.9); f = 90 * np.exp(-t * 5) + 32
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.35)
    n = rng.standard_normal(len(t)) * env(len(t), 0.001, 0.05) * 0.5
    return (sub * 0.95 + n) * 0.9
def stamp(): return impact()[: int(0.4 * SR)] * 0.55
def thud():
    t = t_(0.45); f = 70 * np.exp(-t * 9) + 40
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.12)
    g = rng.standard_normal(len(t)) * env(len(t), 0.001, 0.025) * 0.35
    return (s + g) * 0.8
def type_():
    n = int(0.035 * SR); x = rng.standard_normal(n) * env(n, 0.0005, 0.006)
    return np.diff(np.concatenate([[0], x])) * 0.5 * rng.uniform(0.7, 1.1)
def click():
    n = int(0.05 * SR); x = rng.standard_normal(n) * env(n, 0.0003, 0.008)
    t = t_(0.05); return (np.diff(np.concatenate([[0], x])) * 0.6 + np.sin(2 * np.pi * 2200 * t) * env(n, 0.0005, 0.01) * 0.2)
def tick():
    t = t_(0.02); return np.sin(2 * np.pi * 3200 * t) * env(len(t), 0.0005, 0.004) * 0.25
def pop():
    t = t_(0.14); f = 500 + 700 * (t / 0.14)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.05) * 0.4
def riser(len_=1.5):
    n = int(len_ * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n); k = np.linspace(0.01, 0.4, n)
    y = np.empty(n); acc = 0.0
    for i in range(n): acc += k[i] * (noise[i] - acc); y[i] = acc
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2 * t / len_)) / SR) * 0.15
    return (y * 0.5 + tone) * (t / len_) ** 2
def drop():
    return impact() * 1.1
def chime():
    t = t_(2.6); s = np.zeros(len(t))
    for f, g in ((880, 1), (1318.5, .55), (1760, .35), (2637, .18)):
        s += np.sin(2 * np.pi * f * t) * g * np.exp(-t * (1.6 + f / 2000))
    return s * np.minimum(1, t / 0.004) * 0.22
def step():
    n = int(0.18 * SR); t = np.arange(n) / SR
    knock = np.sin(2 * np.pi * (140 * np.exp(-t * 30) + 70) * t) * env(n, 0.001, 0.03)
    tap = rng.standard_normal(n) * env(n, 0.0005, 0.006) * 0.4
    dry = (knock + tap) * 0.28
    out = np.zeros(int(0.9 * SR)); out[:n] += dry
    for d, g in ((0.11, .35), (0.23, .2), (0.37, .1)):   # hall echo
        i = int(d * SR); out[i:i + n] += dry * g
    return out
def clunk():
    t = t_(0.5); s = np.sin(2 * np.pi * (95 * np.exp(-t * 18) + 55) * t) * env(len(t), 0.001, 0.09)
    n = rng.standard_normal(len(t)) * env(len(t), 0.0005, 0.012) * 0.6
    hum = np.sin(2 * np.pi * 120 * t) * env(len(t), 0.05, 0.35) * 0.06
    return (s * 0.7 + np.diff(np.concatenate([[0], n])) + hum) * 0.7
def bell(f=523.25):
    t = t_(3.5); s = np.zeros(len(t))
    for m, g, dcy in ((1, 1, 1.1), (2.0, .4, 1.6), (3.0, .22, 2.2), (4.2, .12, 3)):
        s += np.sin(2 * np.pi * f * m * t) * g * np.exp(-t * dcy)
    return s * np.minimum(1, t / 0.006) * 0.16
FX = {"step": step, "clunk": clunk, "bell": bell, "beep": beep, "flat": flat, "thump": thump, "whoosh": whoosh, "swish": swish, "impact": impact, "stamp": stamp, "thud": thud,
      "type": type_, "click": click, "tick": tick, "pop": pop, "riser": riser, "drop": drop, "chime": chime, "riserEnd": lambda: np.zeros(1)}

# ---------- music bed (beat-locked) ----------
beat = 60 / BPM
start = spec.get("musicStart", 0.5 if MOOD == "museum" else min([c["t"] for c in spec["cues"] if c["s"] in ("impact", "drop")] or [0]))
end = spec["duration"] - 2.6
root = 55.0 if MOOD == "bright" else 49.0 if MOOD == "dark" else 43.65                      # A1 or G1
prog = [0, 0, 3, 5] if MOOD == "bright" else [0, 0, 1, -2]    # semitones per bar
music = np.zeros(N)
def kick():
    t = t_(0.35); f = 110 * np.exp(-t * 28) + 44
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.001, 0.13)
def hat():
    n = int(0.05 * SR); x = rng.standard_normal(n); return np.diff(np.concatenate([[0], x])) * env(n, 0.0005, 0.012) * 0.12
k_ = kick()
nb = int((end - start) / beat) if MOOD != "museum" else 0
for b in range(max(0, nb)):
    tb = start + b * beat
    i = int(tb * SR)
    seg = k_[: max(0, min(len(k_), N - i))]; music[i:i + len(seg)] += seg * 0.85
    for half in (0.5,):
        j = int((tb + beat * half) * SR); h = hat(); h = h[: max(0, min(len(h), N - j))]; music[j:j + len(h)] += h
    # bass pulse on the off-beats, following the bar progression
    bar = (b // 4) % 4; f = root * 2 ** (prog[bar] / 12)
    t = t_(beat * 0.45); s = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * t) * 0.5
    s = lp_fast(s, 0.06) * env(len(t), 0.004, beat * 0.25) * 0.55
    j = int((tb + beat * 0.5) * SR); s = s[: max(0, min(len(s), N - j))]; music[j:j + len(s)] += s
# soft pad over the whole bed
t = np.arange(N) / SR
pad = np.zeros(N)
for semi in (0, 7, 12, 15 if MOOD == "dark" else 16):
    f = root * 4 * 2 ** (semi / 12)
    pad += np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * 0.2 * t) * 0.6)
pad *= 0.035 if MOOD != "museum" else 0.05
if MOOD == "museum":                                   # quiet room tone under everything
    room = rng.standard_normal(N); acc = 0.0; rt = np.empty(N)
    for i in range(0, N): acc += 0.004 * (room[i] - acc); rt[i] = acc
    pad += rt * 0.6
fade_in = np.clip((t - max(0, start - 1.5)) / 1.5, 0, 1); fade_out = np.clip((spec["duration"] - t) / 2.5, 0, 1)
music = (music + pad) * fade_in * fade_out
# duck the music a little under impacts
duck = np.ones(N)
for c in spec["cues"]:
    if c["s"] in ("impact", "drop", "thud", "stamp"):
        i = int(c["t"] * SR); n = int(0.35 * SR)
        duck[i:i + n] = np.minimum(duck[i:i + n], 0.45 + 0.55 * np.linspace(0, 1, len(duck[i:i + n])))
music *= duck
L += music * 0.55; R += music * 0.55

# ---------- place the sound effects ----------
for c in spec["cues"]:
    fx = FX.get(c["s"])
    if not fx: continue
    sig = fx(c["len"]) if c["s"] in ("flat", "riser") and "len" in c else fx(c["f"]) if c["s"] == "bell" and "f" in c else fx()
    pan = {"whoosh": 0.0, "swish": rng.uniform(-0.4, 0.4), "type": rng.uniform(-0.2, 0.2), "thud": rng.uniform(-0.3, 0.3)}.get(c["s"], 0.0)
    add(sig, c["t"], 1.0, pan)

# ---------- master: gentle limiter, normalise, write ----------
mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix /= max(1e-6, np.abs(mix).max()) / 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open(f"audio{v}.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", f"audio{v}.wav", round(DUR, 1), "s")
