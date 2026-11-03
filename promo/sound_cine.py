# sound_cine.py — cinematic soundtrack for the remastered videos, synthesised from scratch (no samples, no copyright).
# Reads cuesN.json (sound-effect cues + music sections) and writes audioN.wav.
#   python3 sound_cine.py 5
# Music: intro drone → tension pulse → build (arp opens up, snare roll) → groove (drums, bass, pad, arp) →
#        dark (graveyard) → lift (riser) → stop (only hits) → outro (major, soft). Everything is beat-locked.
# Effects: heartbeat, monitor beep, flatline, booms, braam, glitch, keys, zip, slams, sub drop, reverse swells,
#          data blips, card passes, stone slams with crumble, whips, swipes, risers, lock, paper flips, stamps,
#          electric zaps, dings, sparkles, chimes, shimmer. A shared reverb gives it all one room.
import json, sys, numpy as np, wave

SR = 48000
v = sys.argv[1] if len(sys.argv) > 1 else "5"
spec = json.load(open(f"cues{v}.json"))
DUR = spec["duration"] + 1.2
N = int(DUR * SR)
BPM = spec["bpm"]; BEAT = 60 / BPM
MUSIC = spec.get("music") or [{"a": 0, "b": spec["duration"], "kind": "groove"}]
rng = np.random.default_rng(11)
dryL = np.zeros(N); dryR = np.zeros(N); revL = np.zeros(N); revR = np.zeros(N)
mus = np.zeros(N); musRev = np.zeros(N)
T = lambda d: np.arange(int(d * SR)) / SR

def put(buf, sig, t, g=1.0):
    i = int(round(t * SR))
    if i < 0: sig = sig[-i:]; i = 0
    if i >= len(buf) or len(sig) == 0: return
    n = min(len(sig), len(buf) - i); buf[i:i + n] += sig[:n] * g

def fx(sig, t, g=1.0, pan=0.0, send=0.25):
    gl, gr = g * np.sqrt(0.5 * (1 - pan)) * 1.414, g * np.sqrt(0.5 * (1 + pan)) * 1.414
    if sig.ndim == 2:
        put(dryL, sig[0], t, g); put(dryR, sig[1], t, g); put(revL, sig[0], t, g * send); put(revR, sig[1], t, g * send)
    else:
        put(dryL, sig, t, gl); put(dryR, sig, t, gr); put(revL, sig, t, gl * send); put(revR, sig, t, gr * send)

# ---------- filters (FFT based, zero phase) ----------
def spec_filter(x, fn):
    n = 1 << int(np.ceil(np.log2(len(x) + 1)))
    X = np.fft.rfft(x, n); f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X * fn(f), n)[: len(x)]
def lpf(x, fc, order=2): return spec_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))
def hpf(x, fc, order=2): return spec_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))
def bpf(x, fc, q=1.0): return spec_filter(x, lambda f: 1 / np.sqrt(1 + (q * (f / fc - fc / np.maximum(f, 1e-3))) ** 2))
def sweep(x, f0, f1, kind="lp", q=1.5, blocks=24):
    # time-varying filter by overlap-add of short blocks, each filtered at its own frequency
    n = len(x); hop = max(256, n // blocks); win = np.hanning(hop * 2); out = np.zeros(n + hop * 2)
    xs = np.concatenate([x, np.zeros(hop * 2)])
    for s in range(0, n, hop):
        seg = xs[s:s + hop * 2] * win; u = s / max(1, n)
        fc = f0 * (f1 / f0) ** u
        seg = lpf(seg, fc) if kind == "lp" else bpf(seg, fc, q) if kind == "bp" else hpf(seg, fc)
        out[s:s + hop * 2] += seg
    return out[:n]
def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
def adsr(n, a, r):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.minimum(1, (n / SR - t) / max(r, 1e-4))
def sine_glide(d, f0, f1, curve=6):
    t = T(d); f = f1 + (f0 - f1) * np.exp(-t * curve); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def saw(f, t): return 2 * ((f * t) % 1) - 1
def noise(d): return rng.standard_normal(int(d * SR))

# ---------- sound effects ----------
def heart():
    out = np.zeros(int(0.6 * SR))
    for off, g, f in ((0, 1.0, 62), (0.17, 0.75, 52)):
        s = sine_glide(0.3, f * 1.8, f, 18) * env(int(0.3 * SR), 0.004, 0.07) * g
        put(out, s, off)
    out += lpf(noise(0.6), 180) * env(len(out), 0.002, 0.03) * 0.6
    return np.tanh(out * 1.6) * 0.95
def beep(f=1000):
    t = T(0.13); s = (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(4 * np.pi * f * t)) * adsr(len(t), 0.004, 0.02)
    return s * 0.26
def flat(d=1.6):
    t = T(d); s = (np.sin(2 * np.pi * 1000 * t) + 0.18 * np.sin(4 * np.pi * 1000 * t)) * adsr(len(t), 0.004, 0.3)
    return s * 0.2
def drone(d=2.6):
    t = T(d); s = sum(np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * 0.3 * t) * 0.4) * g for f, g in ((55, 1), (82.4, .5), (110, .3)))
    air = lpf(noise(d), 500) * 0.25
    return (s * 0.25 + air) * adsr(len(t), 1.2, 0.4) * 0.6
def boom():
    d = 2.6; sub = sine_glide(d, 120, 32, 4) * env(int(d * SR), 0.002, 0.9)
    crack = hpf(noise(d), 900) * env(int(d * SR), 0.0005, 0.03) * 0.7
    body = lpf(noise(d), 300) * env(int(d * SR), 0.002, 0.25) * 0.9
    return np.tanh((sub * 1.2 + crack + body) * 1.4) * 0.9
def braam():
    d = 2.4; t = T(d); s = np.zeros(len(t))
    for f in (55, 55.4, 54.6, 110, 110.6, 82.4, 164.8):
        s += saw(f, t + rng.uniform(0, 1))
    s = lpf(s, 700)
    grow = 0.8 + 0.2 * np.sin(2 * np.pi * 7 * t)
    return np.tanh(s * 0.25 * grow) * adsr(len(t), 0.05, 1.2) * 0.75
def glitch():
    d = 0.42; out = np.zeros(int(d * SR)); pos = 0
    while pos < len(out):
        L = int(rng.uniform(0.015, 0.05) * SR); kind = rng.integers(0, 3); t = np.arange(L) / SR
        if kind == 0: seg = np.sign(np.sin(2 * np.pi * rng.uniform(200, 2400) * t)) * 0.4
        elif kind == 1: seg = np.round(rng.standard_normal(L) * 3) / 3 * 0.35
        else: seg = np.sin(2 * np.pi * rng.uniform(60, 180) * t) * 0.6
        seg *= adsr(L, 0.001, 0.002); out[pos:pos + L] += seg[: len(out) - pos]; pos += L + int(rng.uniform(0, 0.02) * SR)
    return out * 0.7
def key():
    d = 0.06; clk = hpf(noise(d), 2500) * env(int(d * SR), 0.0003, 0.004) * 0.6
    body = np.sin(2 * np.pi * rng.uniform(170, 230) * T(d)) * env(int(d * SR), 0.0005, 0.012) * 0.5
    return (clk + body) * rng.uniform(0.55, 0.85)
def click():
    d = 0.08; return (hpf(noise(d), 1800) * env(int(d * SR), 0.0002, 0.005) * 0.8 + np.sin(2 * np.pi * 1600 * T(d)) * env(int(d * SR), 0.0005, 0.01) * 0.3)
def zip_():
    d = 0.55; t = T(d); u = t / d
    tone = np.sin(2 * np.pi * np.cumsum(1500 * (1 - u) ** 2 + 260) / SR) * 0.25
    air = sweep(noise(d), 600, 6000, "bp", 2.0) * 0.8
    s = (tone + air) * np.sin(np.pi * u) ** 1.5
    return np.stack([s * (1 - u) ** 0.5, s * u ** 0.5]) * 1.1
def slam():
    d = 1.8; n = int(d * SR)
    sub = sine_glide(d, 160, 40, 9) * env(n, 0.001, 0.35)
    snap = hpf(noise(d), 1200) * env(n, 0.0003, 0.02) * 0.9
    t = T(d); metal = sum(np.sin(2 * np.pi * f * t) * g * np.exp(-t * dcy) for f, g, dcy in ((327, 1, 5), (509, .7, 7), (811, .5, 9), (1243, .3, 12)))
    return np.tanh((sub * 1.1 + snap + metal * 0.18) * 1.5) * 0.9
def drop():
    d = 1.6; return np.tanh(sine_glide(d, 95, 26, 2.2) * env(int(d * SR), 0.003, 0.7) * 1.6) * 0.9
def reverse(d=0.6):
    t = T(d); s = sum(np.sin(2 * np.pi * f * t) for f in (220, 277.2, 329.6, 440)) * 0.15 + lpf(noise(d), 3000) * 0.5
    return s * (t / d) ** 3
def data():
    out = np.zeros(int(0.5 * SR))
    for i, semi in enumerate((0, 3, 7, 10, 12, 15, 19, 24)):
        f = 880 * 2 ** (semi / 12); t = T(0.04)
        s = np.sign(np.sin(2 * np.pi * f * t)) * 0.3 * env(len(t), 0.001, 0.015)
        put(out, s, i * 0.035)
    return out * 0.45
def datarun(d=1.8):
    out = np.zeros(int(d * SR)); tt = 0.0; i = 0
    while tt < d:
        f = 1200 + 900 * hashf(i); t = T(0.02); s = np.sin(2 * np.pi * f * t) * env(len(t), 0.0005, 0.006) * 0.25
        put(out, s, tt); tt += 0.03 + 0.09 * (tt / d) ** 2; i += 1
    return out * 0.7
def hashf(i): x = np.sin(i * 12.9898) * 43758.5453; return x - np.floor(x)
def pass_():
    d = 0.5; t = T(d); u = t / d
    s = sweep(noise(d), 900, 3500, "bp", 1.2) * np.exp(-((u - 0.45) ** 2) / 0.03)
    return s * 0.55
def stone():
    d = 1.2; n = int(d * SR)
    thud = sine_glide(d, 110, 38, 14) * env(n, 0.001, 0.16)
    body = lpf(noise(d), 350) * env(n, 0.001, 0.08) * 1.1
    crumble = np.zeros(n)
    for j in range(26):
        tj = 0.03 + rng.uniform(0, 0.45) * (j / 26) ** 0.7; L = int(0.012 * SR)
        g = hpf(rng.standard_normal(L), 1500) * env(L, 0.0003, 0.004) * rng.uniform(0.1, 0.35) * (1 - tj / 0.6)
        put(crumble, g, tj)
    return np.tanh((thud * 1.2 + body + crumble) * 1.4) * 0.85
def hit():
    d = 1.0; n = int(d * SR); return np.tanh((sine_glide(d, 140, 50, 10) * env(n, 0.001, 0.2) + lpf(noise(d), 1200) * env(n, 0.001, 0.04)) * 1.3) * 0.7
def whip():
    d = 0.32; t = T(d); u = t / d; s = sweep(noise(d), 7000, 600, "bp", 1.4) * np.sin(np.pi * u) ** 2
    return np.stack([s * (1 - u), s * u]) * 1.6
def swoosh(up=0):
    d = 0.5; t = T(d); u = t / d
    s = sweep(noise(d), 400 if up else 3000, 3000 if up else 400, "bp", 1.0) * np.sin(np.pi * u) ** 2
    return s * 0.85
def swipe():
    d = 0.35; t = T(d); u = t / d; return sweep(noise(d), 500, 5000, "bp", 2.0) * np.sin(np.pi * u) ** 1.5 * 0.5
def pop():
    t = T(0.14); f = 500 + 900 * (t / 0.14)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.05) * 0.4
def riser(d=1.5):
    t = T(d); u = t / d
    air = sweep(noise(d), 300, 9000, "bp", 1.2) * u ** 2
    tone = sum(np.sin(2 * np.pi * np.cumsum(f0 * 2 ** (2 * u)) / SR) for f0 in (220, 330)) * 0.12 * u ** 2
    return (air * 0.9 + tone)
def lock():
    d = 2.2; t = T(d)
    ring = sum(np.sin(2 * np.pi * f * t) * g * np.exp(-t * dcy) for f, g, dcy in ((1046.5, 1, 2.5), (1568, .6, 3), (2093, .4, 4), (3136, .2, 6)))
    snap = hpf(noise(d), 3000) * env(len(t), 0.0003, 0.01)
    h = np.zeros(len(t)); hh = hit(); h[: len(hh)] = hh
    return ring * 0.22 + snap * 0.5 + h * 0.6
def flip():
    d = 0.18; s = bpf(noise(d), 3200, 1.0) * (env(int(d * SR), 0.0005, 0.01) + np.roll(env(int(d * SR), 0.0005, 0.012), int(0.05 * SR)) * 0.7)
    return s * 0.6
def stamp():
    d = 0.5; n = int(d * SR)
    return np.tanh((sine_glide(d, 220, 90, 25) * env(n, 0.001, 0.05) + bpf(noise(d), 900, 0.8) * env(n, 0.0005, 0.02)) * 1.6) * 0.8
def zap():
    d = 0.28; t = T(d); f = 300 + 200 * np.sin(2 * np.pi * 37 * t) + rng.uniform(-60, 60)
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * env(len(t), 0.001, 0.08)
    return hpf(s, 400) * 0.18
def ding():
    out = np.zeros(int(1.4 * SR))
    for k, f in enumerate((1318.5, 1760)):
        t = T(1.2); put(out, np.sin(2 * np.pi * f * t) * np.exp(-t * 4) * np.minimum(1, t / 0.003) * 0.18, k * 0.07)
    return out
def sparkle():
    out = np.zeros(int(2.5 * SR))
    for i, semi in enumerate((0, 4, 7, 12, 16, 19, 24, 28)):
        f = 1046.5 * 2 ** (semi / 12); t = T(1.4)
        put(out, np.sin(2 * np.pi * f * t) * np.exp(-t * 3.5) * np.minimum(1, t / 0.002) * 0.12, i * 0.045)
    return out
def chime():
    t = T(3.4); s = np.zeros(len(t))
    for f, g in ((523.25, 1), (659.25, .7), (783.99, .6), (1046.5, .45), (1568, .2)):
        s += np.sin(2 * np.pi * f * t) * g * np.exp(-t * (1.1 + f / 2500))
    return s * np.minimum(1, t / 0.004) * 0.2
def shine():
    d = 1.0; t = T(d); u = t / d
    s = sweep(noise(d), 5000, 11000, "bp", 3.0) * np.sin(np.pi * u) ** 2 * 0.35
    return s + np.sin(2 * np.pi * 2637 * t) * np.exp(-t * 3) * 0.05

FX = {"heart": heart, "beep": beep, "flat": flat, "drone": drone, "boom": boom, "braam": braam, "glitch": glitch, "key": key,
      "click": click, "zip": zip_, "slam": slam, "drop": drop, "reverse": reverse, "data": data, "datarun": datarun, "pass": pass_,
      "stone": stone, "hit": hit, "whip": whip, "swoosh": swoosh, "swipe": swipe, "pop": pop, "riser": riser, "lock": lock,
      "flip": flip, "stamp": stamp, "zap": zap, "ding": ding, "sparkle": sparkle, "chime": chime, "shine": shine}
GAIN = {"heart": 1.0, "beep": 0.8, "flat": 0.8, "drone": 0.9, "boom": 1.0, "braam": 0.8, "glitch": 0.55, "key": 0.45, "click": 0.6,
        "zip": 0.8, "slam": 1.0, "drop": 0.9, "reverse": 0.7, "data": 0.5, "datarun": 0.5, "pass": 0.5, "stone": 0.85, "hit": 0.8,
        "whip": 0.8, "swoosh": 0.6, "swipe": 0.45, "pop": 0.5, "riser": 0.6, "lock": 0.8, "flip": 0.6, "stamp": 0.8, "zap": 0.45,
        "ding": 0.6, "sparkle": 0.7, "chime": 0.9, "shine": 0.6}
SEND = {"boom": 0.5, "braam": 0.45, "slam": 0.45, "chime": 0.6, "sparkle": 0.6, "ding": 0.5, "lock": 0.5, "stone": 0.3, "heart": 0.15, "beep": 0.35, "flat": 0.3, "hit": 0.35, "drop": 0.2}

for c in spec["cues"]:
    s, t = c["s"], c["t"]
    f = FX.get(s)
    if not f: continue
    if s in ("flat", "drone", "riser", "reverse", "datarun") and "len" in c: sig = f(c["len"])
    elif s == "beep" and "f" in c: sig = f(c["f"])
    elif s == "swoosh": sig = f(c.get("up", 0))
    else: sig = f()
    start = t - (c.get("len", 0.6) if s == "reverse" else 0)
    pan = c.get("pan", {"key": rng.uniform(-0.25, 0.25), "stone": rng.uniform(-0.35, 0.35), "zap": rng.uniform(-0.4, 0.4), "ding": rng.uniform(-0.3, 0.3), "flip": rng.uniform(-0.3, 0.3)}.get(s, 0.0))
    fx(sig, start, GAIN.get(s, 0.7), pan, SEND.get(s, 0.2))

# ---------- music ----------
ROOT = 55.0                                     # A1
CHORDS = {"min": [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],      # Am F C G
          "dark": [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-5, -1, 2]],     # Am Am F E
          "maj": [[-4, 0, 3], [3, 7, 10], [-2, 2, 5], [3, 7, 10]]}     # F C G C
def section(t):
    for m in MUSIC:
        if m["a"] <= t < m["b"]: return m["kind"]
    return None
def kick():
    d = 0.4; n = int(d * SR); return np.tanh(sine_glide(d, 150, 45, 30) * env(n, 0.001, 0.16) * 1.8 + hpf(noise(d), 3000) * env(n, 0.0003, 0.003) * 0.3)
def snare():
    d = 0.35; n = int(d * SR); t = T(d)
    return (bpf(noise(d), 2200, 0.7) * env(n, 0.001, 0.07) * 0.9 + np.sin(2 * np.pi * 190 * t) * env(n, 0.001, 0.05) * 0.5) * 0.8
def hat(open_=False):
    d = 0.25 if open_ else 0.06; n = int(d * SR); return hpf(noise(d), 7000) * env(n, 0.0005, 0.06 if open_ else 0.012) * 0.35
def bass_note(f, d, bright=600):
    t = T(d); s = saw(f, t) * 0.6 + np.sin(2 * np.pi * f * t) * 0.6
    return np.tanh(lpf(s, bright) * 1.5) * adsr(len(t), 0.005, 0.05) * 0.5
def pluck(f, d=0.25, bright=3000):
    t = T(d); s = saw(f, t) * 0.5 + np.sign(np.sin(2 * np.pi * f * 1.003 * t)) * 0.25
    return lpf(s, bright) * env(len(t), 0.002, 0.09) * 0.3
def pad(freqs, d, bright=1400):
    t = T(d); s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.4, 0.4): s += saw(f + det, t + rng.uniform(0, 1))
    return lpf(s, bright) * adsr(len(t), min(0.4, d / 3), min(0.5, d / 3)) * 0.05

nbeats = int(spec["duration"] / BEAT) + 1
k_, s_ = kick(), snare()
for b in range(nbeats):
    tb = b * BEAT; kind = section(tb + 0.001)
    if kind is None: continue
    bar = b // 4; pos = b % 4
    prog = CHORDS["dark" if kind == "dark" else "maj" if kind == "outro" else "min"][bar % 4]
    root = ROOT * 2 ** (prog[0] / 12)
    secA = next(m for m in MUSIC if m["kind"] == kind and m["a"] <= tb < m["b"])
    u = (tb - secA["a"]) / max(0.01, secA["b"] - secA["a"])            # progress through the section
    if kind == "intro":
        continue
    if kind == "tension":
        for h in (0, 0.5): put(mus, bass_note(root, BEAT * 0.45, 300), tb + h * BEAT, 0.8)
        put(mus, hat() * 0.6, tb + 0.5 * BEAT)
    if kind == "build":
        bright = 500 + 5000 * u ** 2
        for q in range(4):
            semi = prog[q % 3] + (12 if q == 3 else 0)
            put(mus, pluck(ROOT * 4 * 2 ** (semi / 12), 0.2, bright), tb + q * BEAT / 4, 0.9)
            put(mus, hat() * (0.4 + 0.6 * u), tb + q * BEAT / 4)
        put(mus, bass_note(root, BEAT * 0.9, 400), tb, 0.8)
        if u > 0.6:                                                    # snare roll into the drop
            n = 2 if u < 0.8 else 4
            for q in range(n): put(mus, s_ * (0.3 + 0.7 * u), tb + q * BEAT / n, 0.8)
    if kind in ("groove", "dark", "outro"):
        dark = kind == "dark"; out = kind == "outro"
        if pos in (0,) or (pos == 2 and not dark) or (pos == 1 and not dark and not out and b % 2): put(mus, k_, tb, 0.95 if not out else 0.6)
        if pos == 2 and not dark: put(mus, s_, tb, 0.9 if not out else 0.5)
        if dark and pos == 2: put(mus, k_, tb + BEAT * 0.5, 0.7)
        for q in range(2 if dark else 4): put(mus, hat(q == 2 and not dark) * (0.5 if q % 2 else 0.8), tb + q * BEAT / (2 if dark else 4), 0.8 if not out else 0.5)
        put(mus, bass_note(root, BEAT * 0.48, 300 if dark else 700), tb + BEAT * 0.5, 0.9)
        put(mus, bass_note(root, BEAT * 0.45, 300 if dark else 700), tb, 0.7)
        if pos == 0:
            freqs = [ROOT * 4 * 2 ** (s / 12) for s in prog] + [ROOT * 8 * 2 ** (prog[0] / 12)]
            put(mus, pad(freqs, BEAT * 4, 700 if dark else 1800 if out else 1300), tb, 1.4 if out else 1.0)
            put(musRev, pad(freqs, BEAT * 4, 900), tb, 0.6)
        if not dark:
            for q in range(4):
                semi = prog[(q + pos) % 3] + 12 * ((q + b) % 2)
                put(mus, pluck(ROOT * 4 * 2 ** (semi / 12), 0.18, 2500 if not out else 4000), tb + q * BEAT / 4, 0.45 if not out else 0.6)
                if out: put(musRev, pluck(ROOT * 4 * 2 ** (semi / 12), 0.18, 4000), tb + q * BEAT / 4, 0.4)
    if kind == "lift":
        put(mus, bass_note(root, BEAT * 0.9, 900), tb, 0.6)
        for q in range(4): put(mus, s_ * (0.4 + 0.15 * q), tb + q * BEAT / 4, 0.7)
    # "stop": silence — only the slogan hits

# intro drone under the opening (the "drone" cue adds the rest)
t_all = np.arange(N) / SR
# side-chain the music under big hits
duck = np.ones(N)
for c in spec["cues"]:
    if c["s"] in ("boom", "slam", "drop", "stone", "braam", "hit", "stamp"):
        i = int(c["t"] * SR); n = int(0.4 * SR); seg = duck[i:i + n]
        duck[i:i + n] = np.minimum(seg, 0.35 + 0.65 * np.linspace(0, 1, len(seg)) ** 1.5)
fade_out = np.clip((spec["duration"] + 0.6 - t_all) / 2.8, 0, 1)
mus *= duck * fade_out; musRev *= duck * fade_out

# ---------- reverb (convolution with a synthetic hall) ----------
def ir(seed, rt=2.0):
    r = np.random.default_rng(seed); n = int(rt * SR); t = np.arange(n) / SR
    x = r.standard_normal(n) * np.exp(-t * 6.9 / rt)
    x = lpf(x, 5000); x[: int(0.012 * SR)] = 0
    return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]
hL, hR = ir(1), ir(2)
wetL = conv(revL + musRev * 0.5, hL) * 0.55; wetR = conv(revR + musRev * 0.5, hR) * 0.55

L = dryL + mus * 0.68 + wetL
R = dryR + mus * 0.68 + wetR
mix = np.stack([L, R], 1)
mix = hpf(mix[:, 0], 28)[:, None] * np.array([1, 0]) + hpf(mix[:, 1], 28)[:, None] * np.array([0, 1])
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
mix /= max(1e-6, np.abs(mix).max()) / 0.9
pcm = (mix * 32767).astype(np.int16)
with wave.open(f"audio{v}.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", f"audio{v}.wav", round(DUR, 1), "s")
