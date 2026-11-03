// VIDEO 1 REMASTERED — "Before you build" (16:9, 29.4s). Same story and real data as v1.js, with cinematic effects:
// dark heart-monitor open, glitch + RGB-split hits, shockwaves, iris wipes, a 3D news tunnel, slamming tombstones with dust,
// whip pans, a ticked risk dial, 3D card flips with stamps, glowing evidence threads, confetti, light rays, shine sweeps.
// Has its own renderAt (post effects: chromatic aberration, flashes, shockwaves, handheld float, moving grain, vignette).
var W = 1920, H = 1080, BPM = 100, DURATION = 29.4, MOOD = "cine";
const D = DATA.qc, B = 60 / BPM;
const IDEA = "10-minute grocery delivery";
const dead = D.deadCos.filter((c) => c.closed).slice(0, 7);
const blip = D.deadCos.find((c) => c.name === "Blip");

var CUES = [];
const cue = (t, s, o = {}) => CUES.push({ t: +t.toFixed(3), s, ...o });
// music sections for the soundtrack (read by sound_cine.py)
var MUSIC = [
  { a: 0, b: 2.4, kind: "intro" }, { a: 2.4, b: 4.2, kind: "tension" }, { a: 4.2, b: 6.6, kind: "build" },
  { a: 6.6, b: 9.0, kind: "groove" }, { a: 9.0, b: 11.4, kind: "dark" }, { a: 11.4, b: 20.4, kind: "groove" },
  { a: 20.4, b: 21.0, kind: "lift" }, { a: 21.0, b: 22.8, kind: "stop" }, { a: 22.8, b: 23.4, kind: "groove" }, { a: 23.4, b: DURATION, kind: "outro" },
];

// ---------- small helpers ----------
const hash = (x) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const GL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>";
function scramble(text, k, seed = 1) {
  const n = text.length, shown = Math.floor(clamp(k) * n);
  let out = "";
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (ch === " ") { out += " "; continue; }
    if (i < shown) out += ch;
    else if (k > 0 && i < shown + 8) out += GL[Math.floor(hash(seed * 131 + i * 17 + Math.floor(k * 90)) * GL.length)];
    else out += "&nbsp;";
  }
  return out;
}
// glowing ECG: a wide blurred copy under the sharp one
const ecgGlow = (o) => `<div style="position:relative">${`<div style="position:absolute;inset:0;filter:blur(10px);opacity:.75">${ecg({ ...o, width: (o.width || 5) * 3, glow: false, tip: false })}</div>`}${ecg(o)}</div>`;
// big text with a light sweep across it (k: 0..1 sweep progress)
function shineText(text, size, k, col = C.signal, hi = "#ffe2cf", extra = "") {
  const pos = lerp(130, -30, k);
  return `<div style="font:800 ${size}px/1 Manrope;letter-spacing:-.05em;white-space:nowrap;background:linear-gradient(100deg,${col} 0%,${col} 40%,${hi} 50%,${col} 60%,${col} 100%);background-size:300% 100%;background-position:${pos}% 0;-webkit-background-clip:text;background-clip:text;color:transparent;${extra}">${esc(text)}</div>`;
}
// glitch: the same html in a few horizontal slices, each pushed sideways; amt 0 = clean
function glitch(html, amt, seed = 1) {
  if (amt <= 0.02) return html;
  let s = `<div style="position:relative"><div style="opacity:${1 - amt * 0.5}">${html}</div>`;
  for (let i = 0; i < 5; i++) {
    const y1 = hash(seed + i * 3.1) * 90, h = 4 + hash(seed + i * 7.7) * 16, dx = (hash(seed + i * 5.3) - 0.5) * 90 * amt;
    const tint = i % 3 === 0 ? "filter:brightness(1.5)" : "";
    s += `<div style="position:absolute;inset:0;clip-path:inset(${y1.toFixed(1)}% 0 ${(100 - y1 - h).toFixed(1)}% 0);transform:translateX(${dx.toFixed(1)}px);${tint}">${html}</div>`;
  }
  return s + "</div>";
}
// rolling slot-machine counter
function roller(value, rate, size, color = C.cream, glowCol = "rgba(228,80,47,.55)") {
  const digits = String(Math.max(1, Math.floor(value))).length;
  let cols = "";
  for (let p = digits - 1; p >= 0; p--) {
    const x = value / 10 ** p, d = Math.floor(x) % 10, fr = x - Math.floor(x), sp = rate / 10 ** p;
    const bl = p === 0 ? Math.min(6, sp * 0.05) : 0, off = p === 0 && sp > 2 ? fr : 0;
    cols += `<div style="height:${size}px;overflow:hidden;display:inline-block"><div style="transform:translateY(${(-off * size).toFixed(1)}px);filter:blur(${bl.toFixed(1)}px)"><div style="height:${size}px">${d}</div><div style="height:${size}px">${(d + 1) % 10}</div></div></div>`;
  }
  return `<div style="font:800 ${size}px/1 'JetBrains Mono';letter-spacing:-.04em;color:${color};text-shadow:0 0 40px ${glowCol};display:flex">${cols}</div>`;
}
// floating embers / dust
const EMB = Array.from({ length: 70 }, (_, i) => ({ x: hash(i * 1.7) * W, y0: hash(i * 2.9), sp: 40 + hash(i * 4.1) * 90, r: 1.5 + hash(i * 6.3) * 3.5, ph: hash(i * 8.8) * 6.28 }));
function embers(t, col = "255,140,80", n = 70, op = 1) {
  return EMB.slice(0, n).map((e) => {
    const y = H + 40 - ((e.y0 * (H + 80) + t * e.sp) % (H + 80)), x = e.x + Math.sin(t * 1.3 + e.ph) * 26;
    const a = op * (0.35 + 0.65 * Math.abs(Math.sin(t * 2 + e.ph)));
    return `<div style="position:absolute;left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${(e.r * 2).toFixed(1)}px;height:${(e.r * 2).toFixed(1)}px;border-radius:50%;background:rgba(${col},${a.toFixed(2)});box-shadow:0 0 ${(e.r * 4).toFixed(0)}px rgba(${col},${(a * 0.8).toFixed(2)})"></div>`;
  }).join("");
}
// drifting warm light leaks (cream scenes)
function leaks(t, o = 1) {
  const x1 = 300 + Math.sin(t * 0.7) * 260, y1 = 120 + Math.cos(t * 0.5) * 90, x2 = 1600 + Math.cos(t * 0.6) * 220, y2 = 900 + Math.sin(t * 0.8) * 80;
  return `<div style="position:absolute;inset:0;pointer-events:none;opacity:${o};background:radial-gradient(700px 520px at ${x1}px ${y1}px, rgba(255,150,90,.28), transparent 70%),radial-gradient(640px 480px at ${x2}px ${y2}px, rgba(255,190,120,.22), transparent 70%)"></div>`;
}
const vignette = (dark) => `<div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%, transparent 55%, ${dark ? "rgba(0,0,0,.6)" : "rgba(90,45,20,.14)"} 100%)"></div>`;
const scanlines = (o = 0.08) => `<div style="position:absolute;inset:0;pointer-events:none;opacity:${o};background:repeating-linear-gradient(0deg, rgba(255,255,255,.5) 0 1px, transparent 1px 4px)"></div>`;
const darkBg = (extra = "") => `background:${extra ? extra + "," : ""}radial-gradient(1200px 700px at 50% 120%, rgba(228,80,47,.2), transparent 70%),radial-gradient(900px 600px at 10% -10%, rgba(80,90,150,.16), transparent 70%),#0b0a0d`;
// rotating light rays (conic), masked to a soft circle
function rays(t, x, y, size, col = "rgba(228,80,47,.16)", speed = 8) {
  return `<div style="position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;
    background:repeating-conic-gradient(from ${(t * speed).toFixed(1)}deg, ${col} 0deg 6deg, transparent 6deg 18deg);
    -webkit-mask:radial-gradient(circle, #000 0%, transparent 68%);mask:radial-gradient(circle, #000 0%, transparent 68%)"></div>`;
}
function confetti(lt, cx, cy, n = 60) {
  if (lt <= 0) return "";
  const cols = ["#fff", C.cream, C.ink, "#ffd2b8", "#2b2b2b"];
  return Array.from({ length: n }, (_, i) => {
    const a = hash(i * 3.3) * Math.PI * 2, v = 700 + hash(i * 5.1) * 1300, g = 1500;
    const x = cx + Math.cos(a) * v * lt, y = cy + Math.sin(a) * v * lt + 0.5 * g * lt * lt, r = (hash(i * 9.2) * 720 + lt * 900) % 360;
    const w = 10 + hash(i * 2.2) * 18, h = i % 3 ? w * 0.45 : w;
    return `<div style="position:absolute;left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px;background:${cols[i % cols.length]};border-radius:${i % 3 ? 2 : 50}%;transform:rotate(${r.toFixed(0)}deg);opacity:${clamp(1.6 - lt)}"></div>`;
  }).join("");
}

// ---------- S1: the heartbeat on a dark monitor ----------
const s1beats = [180, 760, 1340], PEN1 = 2.4;
const beatT = s1beats.map((b) => ((b + 0.24 * 260) / W) * PEN1);
beatT.forEach((tb) => { cue(tb - 0.05, "heart"); cue(tb, "beep"); });
cue(0, "drone", { len: 2.6 });
cue(PEN1, "flat", { len: 1.7 });
cue(PEN1, "boom", { shake: 9, flash: "#E4502F", wave: [960, 640, "#E4502F"] });

// ---------- timeline ----------
var SCENES = [
  { a: 0, b: 2.4, dark: true, bg: darkBg(), cam: (lt) => ({ s: 1 + lt * 0.025 }), draw: (lt) => {
      const pulse = beatT.reduce((s, tb) => s + (lt >= tb ? Math.exp(-(lt - tb) * 5) : 0), 0);
      return `<div style="position:absolute;inset:0;background:radial-gradient(1100px 420px at 50% 70%, rgba(228,80,47,${(0.06 + pulse * 0.22).toFixed(3)}), transparent 70%)"></div>` +
        `<div style="position:absolute;inset:0;opacity:.07;background-image:linear-gradient(rgba(228,80,47,.9) 1px, transparent 1px),linear-gradient(90deg, rgba(228,80,47,.9) 1px, transparent 1px);background-size:80px 80px"></div>` +
        center(words("_Every_ _startup_ / has a plan.", lt, 0.25, { size: 136, stagger: 0.12, color: C.cream }), "padding-bottom:380px") +
        at(0, 600, ecgGlow({ w: W, h: 300, beats: s1beats, head: (lt / PEN1) * W })) + embers(lt, "255,120,80", 30, 0.5) +
        at(1560, 80, `<div style="font:600 24px 'JetBrains Mono';letter-spacing:.14em;color:rgba(255,154,118,.85)">● ${Math.round(72 - lt * 6)} BPM</div>`) + scanlines(0.05);
    } },
  // ---- S2: flatline → "Most never run a premortem." (glitch, then shine) ----
  { a: 2.4, b: 4.6, dark: true, bg: darkBg(), cam: (lt) => ({ s: 1.07 - 0.07 * E.out5(P(lt, 0, 0.45)) + lt * 0.015 }), draw: (lt) => {
      const red = 0.5 * (1 - E.out(P(lt, 0, 0.7))), land = P(lt, 0.42, 0.25), g = lt > 0.42 ? Math.max(0, 1 - (lt - 0.42) / 0.45) : 0;
      const pm = shineText("premortem.", 220, P(lt, 1.0, 0.7), C.signal, "#ffe2cf", `transform:scale(${lerp(1.5, 1, E.out5(land))});filter:blur(${((1 - E.out(land)) * 18).toFixed(1)}px);opacity:${clamp(land * 3)}`);
      return `<div style="position:absolute;inset:0;background:rgba(228,80,47,${red.toFixed(3)})"></div>` +
        center(words("_Most_ _never_ _run_ _a_", lt, 0.02, { size: 112, stagger: 0.07, color: C.cream }) + `<div style="height:14px"></div>` + pm, "padding-bottom:360px") +
        at(0, 600, ecgGlow({ w: W, h: 300, beats: [], head: W, tip: false })) + embers(lt + 2.4, "255,120,80", 30, 0.45) + scanlines(0.05);
    } },
  // ---- S3: iris opens onto cream; the idea is typed; the pen-tip zips in and presses ----
  { a: 4.2, b: 6.95, clip: (lt) => (lt < 0.45 ? `circle(${(E.inOut(P(lt, 0, 0.45)) * 1250).toFixed(0)}px at 960px 750px)` : ""),
    cam: (lt) => { const z = E.in(P(lt, 2.4, 0.35)); return { s: 1 + z * 5, blur: z * 14, ox: 1474, oy: 540 }; },
    draw: (lt) => {
      const typed = IDEA.slice(0, Math.floor(clamp((lt - 0.35) / 1.0) * IDEA.length));
      const lastKey = 0.35 + (Math.max(0, typed.length - 1) / IDEA.length) * 1.0, bump = typed.length && lt < 1.4 ? Math.exp(-(lt - lastKey) * 30) * 0.008 : 0;
      const zip = E.inOut(P(lt, 1.45, 0.45)), pressed = lt > 1.9 && lt < 2.15, k = E.out(P(lt, 0.1, 0.6));
      const dot = (tt) => { const z = E.inOut(P(tt, 1.45, 0.45)); return [lerp(-100, 1452, z), 518 - Math.sin(z * Math.PI) * 70 + (tt > 1.9 ? 30 * Math.sin(P(tt, 1.9, 0.25) * Math.PI) : 0)]; };
      let trail = "";
      if (zip > 0 && zip < 1) for (let j = 12; j >= 1; j--) { const [x, y] = dot(lt - j * 0.012); trail += `<div style="position:absolute;left:${x + 22 - (22 - j)}px;top:${y + 22 - (22 - j)}px;width:${44 - j * 2.6}px;height:${44 - j * 2.6}px;border-radius:50%;background:rgba(228,80,47,${(0.5 - j * 0.035).toFixed(2)})"></div>`; }
      const [dx, dy] = dot(lt);
      const runK = E.out5(P(lt, 1.95, 0.25)), rg = lt > 1.95 ? Math.max(0, 1 - (lt - 1.95) / 0.3) : 0;
      return leaks(lt) + at(0, 250, `<div style="width:${W}px;text-align:center;font:600 30px 'JetBrains Mono';letter-spacing:.16em;color:${C.signal}"><span style="opacity:${E.out(P(lt, 0.15, 0.5))}">DESCRIBE THE BUSINESS YOU WANT TO BUILD</span></div>`) +
        center(`<div style="transform:perspective(1400px) rotateX(${((1 - k) * 32).toFixed(1)}deg) translateY(${((1 - k) * 90).toFixed(0)}px) scale(${(0.9 + 0.1 * k + bump).toFixed(4)});opacity:${clamp(k * 2)}">${searchBox(typed, Math.floor(lt * 3) % 2 === 0 || lt < 1.4, pressed, 1340)}</div>`) +
        trail + (zip > 0 ? `<div style="position:absolute;left:${dx}px;top:${dy}px;width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:0 0 0 6px ${C.signal},0 0 50px ${C.signal},0 0 120px rgba(228,80,47,.6)"></div>` : "") +
        burst(1474, 540, P(lt, 1.9, 0.4), C.signal, 14, 120, 60) +
        (lt > 1.95 ? at(1250, 640, `<div style="font:800 150px Manrope;letter-spacing:-.05em;color:${C.ink};transform:scale(${lerp(1.8, 1, runK).toFixed(3)}) rotate(${((1 - runK) * -8).toFixed(1)}deg);transform-origin:left top">Run.</div>`) : "");
    } },
  // ---- S4: a 3D fly-through tunnel of real headlines + rolling counter ----
  { a: 6.6, b: 9.0, dark: true, bg: darkBg(), op: (lt) => E.out(P(lt, 0, 0.3)), draw: (lt) => {
      const rows = D.deadCos.map((c) => `${c.name} — ${cap(c.cause === "reason not reported" ? "shut down" : c.cause)}`).concat(D.aliveCos.map((n) => `${n} — still running`));
      const cards = rows.concat(rows).slice(0, 30).map((r, i) => {
        const side = i % 2 ? 1 : -1, X = side * (330 + hash(i * 3.7) * 420), Y = (hash(i * 5.9) - 0.5) * 760, d = 500 + i * 230 - lt * 2700;
        return { r, X, Y, d, i };
      }).filter((c) => c.d > 70 && c.d < 4200).sort((a, b) => b.d - a.d);
      const tunnel = cards.map((c) => {
        const s = 900 / c.d, x = 960 + c.X * s, y = 520 + c.Y * s, op = clamp((4200 - c.d) / 1400) * clamp((c.d - 70) / 220), bl = c.d < 650 ? (650 - c.d) / 55 : c.d > 3000 ? (c.d - 3000) / 400 : 0;
        return `<div style="position:absolute;left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;transform:translate(-50%,-50%) scale(${s.toFixed(3)});opacity:${op.toFixed(2)};filter:blur(${bl.toFixed(1)}px)">
          <div style="display:flex;gap:26px;align-items:center;padding:26px 36px;border-radius:24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);box-shadow:0 0 40px rgba(228,80,47,.18);white-space:nowrap">
          <span style="font:600 22px 'JetBrains Mono';color:#ff9a76;letter-spacing:.12em">IN THE NEWS</span><span style="font:700 40px Manrope;color:${C.cream}">${esc(c.r)}</span></div></div>`;
      }).join("");
      const streaks = Array.from({ length: 40 }, (_, i) => {
        const a = hash(i * 2.1) * Math.PI * 2, r = ((hash(i * 4.4) * 900 + lt * 1500) % 1100) + 80, len = 60 + r * 0.35;
        return `<div style="position:absolute;left:960px;top:520px;width:${len.toFixed(0)}px;height:2px;transform-origin:0 50%;transform:rotate(${(a * 57.3).toFixed(1)}deg) translateX(${r.toFixed(0)}px);background:linear-gradient(90deg,transparent,rgba(255,200,170,${(0.15 + hash(i) * 0.3).toFixed(2)}))"></div>`;
      }).join("");
            return streaks + tunnel + `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(11,10,13,.85) 100%)"></div>` +
        at(80, 720, `<div style="padding:30px 44px 30px;border-radius:30px;background:rgba(14,12,16,.9);border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 60px rgba(228,80,47,.18);opacity:${E.out(P(lt, 0.2, 0.35))};transform:translateY(${((1 - E.out(P(lt, 0.2, 0.35))) * 30).toFixed(0)}px)"><div style="font:800 170px/1 'JetBrains Mono';letter-spacing:-.04em;color:${C.cream};text-shadow:0 0 40px rgba(228,80,47,.55)">${DATA.stats.sources}</div>` + `<div style="font:600 28px 'JetBrains Mono';color:#ff9a76;letter-spacing:.14em;margin-top:10px">NEWS ARTICLES CITED</div></div>`) +
        at(1290, 110, words("We _read_ / _the_ *news.*", lt, 0.2, { size: 112, color: C.cream, align: "right" })) + scanlines(0.06);
    } },
  // ---- S5: tombstones slam down — dust, debris, fog, embers, letterbox ----
  { a: 9.0, b: 12.85, dark: true, bg: darkBg("radial-gradient(900px 500px at 50% -10%, rgba(170,180,220,.18), transparent 70%)"),
    cam: (lt) => { const w = E.inOut(P(lt, 3.6, 0.25)); return { s: 1.02 + lt * 0.012, x: -w * 1900, blur: w * 16 }; }, draw: (lt) => {
      const row = dead.map((c, i) => {
        const t0 = 0.15 + i * 0.22, fall = E.in(P(lt, t0, 0.3)), land = P(lt, t0 + 0.3, 0.22);
        const sq = Math.sin(land * Math.PI) * 0.07;
        return `<div style="position:relative;transform:translateY(${((1 - fall) * -1000).toFixed(0)}px) scale(${(1 + sq).toFixed(3)},${(1 - sq).toFixed(3)});transform-origin:bottom;opacity:${lt > t0 ? 1 : 0}">${stone(c, { w: 222, glow: 0.35 + 0.4 * Math.exp(-Math.max(0, lt - t0 - 0.3) * 4) })}</div>`;
      }).join("");
      // dust + debris at each landing
      let fx = "";
      dead.forEach((c, i) => {
        const tl = 0.15 + i * 0.22 + 0.3, k = P(lt, tl, 0.7);
        if (k <= 0 || k >= 1) return;
        const cx = 960 + (i - 3) * 248, cy = 742;
        const e = E.out(k);
        fx += `<div style="position:absolute;left:${cx - 60 - e * 220}px;top:${cy - 40 - e * 40}px;width:${120 + e * 440}px;height:${80 + e * 70}px;border-radius:50%;background:radial-gradient(ellipse, rgba(225,215,195,${(0.45 * (1 - k)).toFixed(2)}), transparent 70%);filter:blur(6px)"></div>`;
        for (let j = 0; j < 9; j++) {
          const a = Math.PI + hash(i * 10 + j) * Math.PI, v = 300 + hash(i * 20 + j) * 500, tt = k * 0.7;
          const x = cx + Math.cos(a) * v * tt, y = cy + Math.sin(a) * v * tt + 900 * tt * tt;
          fx += `<div style="position:absolute;left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:6px;height:6px;border-radius:2px;background:#9d958a;opacity:${(1 - k).toFixed(2)}"></div>`;
        }
      });
      const fog = `<div style="position:absolute;left:${(-400 + lt * 120).toFixed(0)}px;top:700px;width:1600px;height:420px;border-radius:50%;background:radial-gradient(ellipse, rgba(200,205,225,.16), transparent 70%);filter:blur(20px)"></div>
        <div style="position:absolute;left:${(800 - lt * 90).toFixed(0)}px;top:760px;width:1500px;height:380px;border-radius:50%;background:radial-gradient(ellipse, rgba(200,205,225,.13), transparent 70%);filter:blur(20px)"></div>`;
      const n = D.dead;
      const box = E.out(P(lt, 0, 0.4)) * 92;
      return embers(lt + 9, "255,130,80", 50, 0.7) +
        at(0, 120, `<div style="width:${W}px;text-align:center">${words("Who _tried_ _it?_", lt, 0, { size: 100, color: C.cream })}</div>`) +
        at(0, 420, `<div style="width:${W}px;display:flex;justify-content:center;gap:26px;align-items:flex-end">${row}</div>`) + fx + fog +
        at(0, 880, `<div style="width:${W}px;text-align:center;font:700 50px Manrope;color:${C.cream};opacity:${E.out(P(lt, 1.85, 0.3))}"><span style="color:${C.signal};text-shadow:0 0 30px rgba(228,80,47,.7)">${n} of ${D.total}</span> companies shut down.</div>`) +
        `<div style="position:absolute;left:0;top:0;width:${W}px;height:${box}px;background:#000"></div><div style="position:absolute;left:0;bottom:0;width:${W}px;height:${box}px;background:#000"></div>`;
    } },
  // ---- S6: whip in → how they died (striped glowing bars) ----
  { a: 11.4, b: 13.8, clip: (lt) => (lt < 0.3 ? `inset(0 0 0 ${((1 - E.out(P(lt, 0, 0.3))) * 100).toFixed(1)}%)` : ""), cam: (lt) => { const w = 1 - E.out(P(lt, 0, 0.3)); return { x: w * 1900, blur: w * 16 }; }, draw: (lt) => {
      const max = Math.max(...D.causes.map((c) => c[1]));
      const bars = D.causes.map(([cause, n], i) => {
        const kk = E.out(P(lt, 0.35 + i * 0.17, 0.7)), pop = E.back(P(lt, 0.85 + i * 0.17, 0.35));
        return `<div style="margin:0 0 44px;opacity:${clamp(kk * 3)};transform:translateX(${((1 - kk) * -60).toFixed(0)}px)">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;font:700 44px Manrope;color:${C.ink};margin-bottom:14px;width:1320px"><span>${esc(cap(cause))}</span>
            <span style="display:inline-block;transform:scale(${pop.toFixed(3)});font:700 36px 'JetBrains Mono';color:#fff;background:${C.signal};padding:6px 18px;border-radius:999px;box-shadow:0 8px 24px rgba(228,80,47,.4)">${n} of ${D.basedOn}</span></div>
          <div style="height:30px;border-radius:16px;background:#e6e0d4;width:1320px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,.08)">
            <div style="position:relative;height:100%;width:${((100 * n / max) * kk).toFixed(1)}%;border-radius:16px;background:linear-gradient(90deg,#8E2A12,#E4502F 70%,#F7A86E);box-shadow:0 0 22px rgba(228,80,47,.55);overflow:hidden">
              <div style="position:absolute;inset:0;background:repeating-linear-gradient(120deg, rgba(255,255,255,.18) 0 14px, transparent 14px 30px);background-position:${(lt * 90).toFixed(0)}px 0"></div>
              <div style="position:absolute;left:0;right:0;top:0;height:40%;background:linear-gradient(rgba(255,255,255,.35),transparent)"></div></div></div></div>`;
      }).join("");
      return leaks(lt + 11) + at(300, 160, words("How _they_ *died.*", lt, 0, { size: 130, align: "left", stagger: 0.05 })) + at(300, 440, bars);
    } },
  // ---- S7: the risk dial — ticks, rays, converging sparks ----
  { a: 13.8, b: 16.2, cam: (lt) => ({ s: 1 + E.out(P(lt, 0, 2.4)) * 0.06 }), draw: (lt) => {
      const k = P(lt, 0.3, 1.5), cx = 1460, cy = 530, R = 360;
      const ticks = Array.from({ length: 72 }, (_, i) => {
        const f = i / 72, on = f <= (D.risk / 100) * E.out(k), a = f * 360 - 90;
        return `<div style="position:absolute;left:${cx}px;top:${cy}px;width:${on ? 34 : 24}px;height:5px;border-radius:3px;transform-origin:0 50%;transform:rotate(${a}deg) translateX(${R}px);background:${on ? "#E8A23A" : "rgba(22,22,22,.12)"};${on ? "box-shadow:0 0 12px rgba(232,162,58,.9)" : ""}"></div>`;
      }).join("");
      const sparks = Array.from({ length: 36 }, (_, i) => {
        const a = hash(i * 7.1) * Math.PI * 2, r0 = 700 + hash(i * 3.3) * 500, kk = E.in(P(lt, 0.2 + hash(i) * 0.6, 0.9));
        if (kk <= 0 || kk >= 1) return "";
        const r = r0 * (1 - kk), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        return `<div style="position:absolute;left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:8px;height:8px;border-radius:50%;background:#E8A23A;box-shadow:0 0 16px #E8A23A;opacity:${(0.3 + kk * 0.7).toFixed(2)}"></div>`;
      }).join("");
      const lock = lt > 1.8 ? Math.exp(-(lt - 1.8) * 4) : 0;
      return leaks(lt + 13, 0.8) + rays(lt, cx, cy, 1500, "rgba(232,162,58,.13)", 10) + ticks + sparks +
        at(cx - 300, cy - 300, `<div style="transform:scale(${(1 + lock * 0.05).toFixed(3)});filter:drop-shadow(0 0 ${(lock * 40).toFixed(0)}px rgba(232,162,58,.8))">${ring(D.risk, D.label, k, 600).replace(/>\d+<\/div>/, `>${D.risk}</div>`)}</div>`) +
        at(200, 300, words("Your _risk,_ / *scored.*", lt, 0, { size: 132, align: "left" })) +
        at(200, 650, `<div style="font:600 36px 'JetBrains Mono';color:${C.grey}">“${esc(IDEA.slice(0, Math.floor(clamp((lt - 0.5) / 0.7) * IDEA.length)))}${lt < 1.3 && Math.floor(lt * 6) % 2 ? "▍" : ""}”</div>`);
    } },
  // ---- S8: red flags — 3D flips + stamps ----
  { a: 16.2, b: 18.6, draw: (lt) => {
      const rows = D.checklist.slice(0, 3).map((q, i) => {
        const qq = q.length > 74 ? q.slice(0, 72).replace(/\s\S*$/, "") + "…?" : q, ans = i === 1 ? "Yes" : "No", no = ans === "No";
        const f = E.out(P(lt, 0.3 + i * 0.32, 0.45)), st = P(lt, 0.62 + i * 0.32, 0.22), sk = E.out5(st);
        return `<div style="transform:perspective(1600px) rotateX(${((1 - f) * -95).toFixed(1)}deg);transform-origin:50% 0;opacity:${clamp(f * 3)};width:1340px;display:flex;gap:30px;align-items:center;justify-content:space-between;padding:28px 32px;margin-bottom:20px;border-radius:24px;
          background:rgba(255,255,255,.9);border:1px solid ${no && st > 0 ? "rgba(228,80,47,.5)" : "#e6e1d6"};box-shadow:0 18px 40px rgba(90,50,30,.1)${no && st > 0 ? `,0 0 ${(40 * Math.exp(-(lt - 0.62 - i * 0.32) * 3)).toFixed(0)}px rgba(228,80,47,.5)` : ""}">
          <div style="font:600 33px/1.3 Manrope;color:${C.ink}">${esc(qq)}</div>
          <div style="flex:none;padding:12px 28px;border-radius:14px;font:800 30px Manrope;letter-spacing:.02em;opacity:${st > 0 ? 1 : 0};transform:scale(${lerp(2.4, 1, sk).toFixed(3)}) rotate(${lerp(-18, -5, sk).toFixed(1)}deg);
            ${no ? `background:${C.signal};color:#fff;box-shadow:0 0 26px rgba(228,80,47,.55)` : `background:#e3f2e8;color:${C.green};border:3px solid ${C.green}`}">${no ? "✕ NO" : "✓ YES"}</div></div>`;
      }).join("");
      return leaks(lt + 16) + at(290, 140, words("Your _red_ *flags.*", lt, 0, { size: 118, align: "left" })) + at(290, 400, rows);
    } },
  // ---- S9: the evidence board — glowing threads with travelling pulses ----
  { a: 18.6, b: 21.0, bg: `background-color:${C.cream};background-image:radial-gradient(rgba(22,22,22,.09) 1.6px, transparent 1.6px);background-size:34px 34px`, draw: (lt) => {
      const srcs = blip.src, nx = 590, ny = 610, cardX = 1060;
      const bez = (y, u) => { const p0 = [nx, ny], p1 = [(nx + cardX) / 2, ny], p2 = [(nx + cardX) / 2, y + 50], p3 = [cardX, y + 50]; const m = 1 - u; return [0, 1].map((j) => m * m * m * p0[j] + 3 * m * m * u * p1[j] + 3 * m * u * u * p2[j] + u * u * u * p3[j]); };
      let threads = "", pulses = "";
      srcs.forEach((s, i) => {
        const y = 330 + i * 150, k = E.out(P(lt, 0.35 + i * 0.2, 0.5)), L = 900;
        threads += `<path d="M${nx} ${ny} C ${(nx + cardX) / 2} ${ny}, ${(nx + cardX) / 2} ${y + 50}, ${cardX} ${y + 50}" fill="none" stroke="${C.signal}" stroke-width="4" stroke-dasharray="${L}" stroke-dashoffset="${(L * (1 - k)).toFixed(0)}" style="filter:drop-shadow(0 0 7px rgba(228,80,47,.7))"/>`;
        if (k >= 1) for (let j = 0; j < 2; j++) { const u = ((lt - 0.85 - i * 0.2) * 0.9 + j * 0.5) % 1; if (u < 0) continue; const [x, yy] = bez(y, u); pulses += `<div style="position:absolute;left:${x - 9}px;top:${yy - 9}px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px ${C.signal},0 0 26px ${C.signal}"></div>`; }
      });
      const cards = srcs.map((s, i) => {
        const k = E.out(P(lt, 0.25 + i * 0.2, 0.4)), v = E.out5(P(lt, 0.85 + i * 0.2, 0.22));
        return at(cardX, 330 + i * 150, `<div style="position:relative;width:770px;white-space:nowrap;padding:24px 30px;border-radius:20px;background:#fff;border:1px solid #e6e1d6;box-shadow:0 14px 34px rgba(90,50,30,.12);opacity:${k};transform:translateX(${((1 - k) * 50).toFixed(0)}px);font:600 26px 'JetBrains Mono';color:${C.red}">● ${esc(s)}
          <span style="position:absolute;right:22px;top:50%;font:800 22px Manrope;letter-spacing:.06em;color:${C.green};border:3px solid ${C.green};border-radius:10px;padding:4px 12px;opacity:${v > 0 ? 1 : 0};transform:translateY(-50%) scale(${lerp(2.2, 1, v).toFixed(3)}) rotate(-6deg)">✓ VERIFIED</span></div>`);
      }).join("");
      const pin = `<div style="position:absolute;left:50%;top:-14px;width:26px;height:26px;margin-left:-13px;border-radius:50%;background:radial-gradient(circle at 35% 35%, #ff8a66, ${C.red});box-shadow:0 6px 10px rgba(0,0,0,.3)"></div>`;
      return at(0, 90, `<div style="width:${W}px;text-align:center">${words("Every _company._ *Sourced.*", lt, 0, { size: 104 })}</div>`) +
        `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0">${threads}</svg>` + pulses +
        at(250, 520, `<div style="position:relative;width:340px;padding:36px;border-radius:26px;background:${C.ink};color:#fff;box-shadow:0 30px 60px rgba(0,0,0,.3),0 0 60px rgba(228,80,47,.25);transform:rotate(-2deg)">${pin}<div style="font:600 22px 'JetBrains Mono';color:#ff9a76;letter-spacing:.12em">✕ SHUT DOWN ${blip.closed}</div><div style="font:800 66px Manrope;margin-top:10px">${blip.name}</div><div style="font:500 24px 'JetBrains Mono';color:#F0B9A6">${srcs.length} articles</div></div>`) + cards;
    } },
  // ---- S10: rapid slogans, one per beat ----
  { a: 21.0, b: 21.6, dark: true, bg: `background:#0b0a0d`, draw: (lt) => { const k = E.out5(P(lt, 0, 0.22)); return rays(lt, 960, 540, 1800, "rgba(255,255,255,.05)", 30) + center(`<div style="font:800 180px Manrope;letter-spacing:-.05em;color:${C.cream};transform:scale(${lerp(1.9, 1, k).toFixed(3)});filter:blur(${((1 - k) * 20).toFixed(1)}px)">No source,</div>`); } },
  { a: 21.6, b: 22.2, dark: true, bg: `background:#0b0a0d`, draw: (lt) => { const k = E.out5(P(lt, 0, 0.2)), g = Math.max(0, 1 - lt / 0.3) * 0.8; return center(`<div style="font:800 180px Manrope;letter-spacing:-.05em;color:${C.signal};text-shadow:0 0 50px rgba(228,80,47,.6);transform:scale(${lerp(1.5, 1, k).toFixed(3)})">no company.</div>`); } },
  { a: 22.2, b: 22.8, draw: (lt) => center(`<div style="font:800 180px Manrope;letter-spacing:-.05em;white-space:nowrap">${[..."Nothing made up."].map((ch, i) => { const k = E.back(P(lt, i * 0.016, 0.22)); return `<span style="display:inline-block;transform:translateY(${((1 - k) * -160).toFixed(0)}px);opacity:${clamp(k * 3)}">${ch === " " ? "&nbsp;" : esc(ch)}</span>`; }).join("")}</div>`) },
  { a: 22.8, b: 23.55, bg: bgOrange, draw: (lt) => { const k = E.back(P(lt, 0, 0.3)); return rays(lt, 960, 540, 2200, "rgba(255,255,255,.14)", 40) + center(`<div style="font:800 260px Manrope;letter-spacing:-.06em;color:#fff;transform:scale(${lerp(0.4, 1, k).toFixed(3)});text-shadow:0 20px 60px rgba(120,30,10,.35)">Free.</div>`) + confetti(lt - 0.05, 960, 540, 80); } },
  // ---- S11: the end card — rays, logo build, shine sweep, cursor click, green heartbeat ----
  { a: 23.4, b: DURATION, clip: (lt) => (lt < 0.4 ? `circle(${(E.inOut(P(lt, 0, 0.4)) * 1250).toFixed(0)}px at 960px 540px)` : ""), draw: (lt) => {
      const k = P(lt, 0.15, 1.1), wm = E.out(P(lt, 0.9, 0.6)), sh = P(lt, 1.7, 0.9);
      const btnK = E.out(P(lt, 2.1, 0.5)), cur = E.inOut(P(lt, 2.9, 0.7)), press = lt > 3.6 && lt < 3.8, ripple = P(lt, 3.6, 0.6);
      const cx = lerp(1500, 1050, cur), cy = lerp(1000, 690, cur);
      const url = "navneetges-wq.github.io/premortem", typedUrl = url.slice(0, Math.floor(clamp((lt - 3.9) / 0.9) * url.length));
      return leaks(lt + 23, 0.9) + rays(lt, 960, 430, 1700, "rgba(228,80,47,.09)", 6) +
        center(`<div style="display:flex;align-items:flex-end;gap:40px">${icon(150, k)}<div style="opacity:${wm};transform:translateX(${((1 - wm) * -30).toFixed(0)}px);padding-bottom:6px">
            <div style="font:500 150px Manrope;letter-spacing:-0.035em;white-space:nowrap;background:linear-gradient(100deg,${C.ink} 0%,${C.ink} 42%,#E4502F 50%,${C.ink} 58%,${C.ink} 100%);background-size:300% 100%;background-position:${lerp(130, -30, sh).toFixed(1)}% 0;-webkit-background-clip:text;background-clip:text;color:transparent"><b style="font-weight:800">pre</b>mortem</div></div></div>
          <div style="margin-top:46px">${words("See how your idea could fail — *before* *you* *build.*", lt, 1.4, { size: 48, weight: 600, color: "#4f4e4b", stagger: 0.05 })}</div>
          <div style="position:relative;margin-top:40px;padding:22px 44px;border-radius:999px;background:${C.ink};color:#fff;font:700 36px Manrope;opacity:${btnK};transform:translateY(${((1 - btnK) * 20).toFixed(0)}px) scale(${press ? 0.94 : 1});box-shadow:0 0 0 ${(ripple > 0 && ripple < 1 ? E.out(ripple) * 26 : 0).toFixed(0)}px rgba(228,80,47,${(ripple > 0 && ripple < 1 ? 0.35 * (1 - ripple) : 0).toFixed(2)}),0 18px 40px rgba(22,22,22,.25)">Run a free premortem →</div>
          <div style="margin-top:28px;height:40px;font:600 30px 'JetBrains Mono';color:${C.signal}">${esc(typedUrl)}${lt > 3.9 && lt < 5.2 && Math.floor(lt * 4) % 2 ? "▍" : ""}</div>`) +
        (cur > 0 && lt < 5 ? `<svg style="position:absolute;left:${cx}px;top:${cy}px;opacity:${clamp((5 - lt) * 3)}" width="44" height="54" viewBox="0 0 22 27"><path d="M1 1 L1 21 L6 16 L10 25 L13 24 L9 15 L16 15 Z" fill="#fff" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/></svg>` : "") +
        at(0, 950, ecgGlow({ w: W, h: 150, beats: [W * 0.62], bw: 220, amp: 50, head: W * E.inOut(P(lt, 0.2, 3.2)), color: "#1f9a5c", width: 4 }));
    } },
];

// ---------- sound + post-effect cues ----------
cue(2.4 + 0.42, "braam", { wave: [960, 470, "#E4502F"] });
cue(2.4 + 1.0, "shine");
cue(4.15, "swoosh", { up: 1 }); 
for (let i = 0; i < IDEA.length; i++) cue(4.2 + 0.35 + (i / IDEA.length) * 1.0, "key");
cue(4.2 + 1.45, "zip"); cue(4.2 + 1.9, "click"); cue(4.2 + 1.95, "slam", { shake: 12, flash: "#ffffff", wave: [1474, 540, "#E4502F"] });
cue(6.6, "reverse", { len: 0.6 }); cue(6.6, "drop", { shake: 6, flash: "#E4502F" });

for (let i = 0; i < 9; i++) cue(6.75 + i * 0.25, "pass", { pan: i % 2 ? 0.6 : -0.6 });
dead.forEach((c, i) => cue(9.0 + 0.15 + i * 0.22 + 0.3, "stone", { shake: 7 }));
cue(9.0 + 1.85, "hit");
cue(11.35, "whip"); [0, 1, 2].forEach((i) => { cue(11.4 + 0.35 + i * 0.17, "swipe"); cue(11.4 + 0.85 + i * 0.17, "pop"); });
cue(13.8, "swoosh"); cue(14.1, "riser", { len: 1.5 }); cue(15.6, "lock", { wave: [1460, 530, "#E8A23A"] });
cue(16.2, "swoosh"); [0, 1, 2].forEach((i) => { cue(16.2 + 0.3 + i * 0.32, "flip"); cue(16.2 + 0.62 + i * 0.32, "stamp", { shake: 4 }); });
cue(18.6, "swoosh"); [0, 1, 2, 3].forEach((i) => { cue(18.6 + 0.35 + i * 0.2, "zap"); cue(18.6 + 0.85 + i * 0.2, "ding"); });
cue(21.0, "reverse", { len: 0.6 });
cue(21.0, "slam", { shake: 8, flash: "#ffffff", wave: [960, 540, "#ffffff"] });
cue(21.6, "slam", { shake: 8 });
cue(22.2, "slam", { shake: 7, flash: "#161616" });
cue(22.8, "boom", { shake: 14, flash: "#ffffff", wave: [960, 540, "#ffffff"] }); cue(22.85, "sparkle");
cue(23.4, "swoosh", { up: 1 }); cue(23.6, "chime"); cue(23.4 + 1.7, "shine"); cue(23.4 + 3.6, "click");
cue(23.4 + 0.2 + 3.2 * 0.66, "heart"); cue(23.4 + 0.2 + 3.2 * 0.68, "beep", { f: 1318 });

// ---------- hold "10 of 27 companies shut down." longer: everything from 11.4s on moves 1.2s (two beats) later ----------
const HOLD = 1.2, HOLD_AT = 11.3;
SCENES.forEach((sc) => { if (sc.a >= HOLD_AT) { sc.a += HOLD; sc.b += HOLD; } });
CUES.forEach((c) => { if (c.t >= HOLD_AT) c.t = +(c.t + HOLD).toFixed(3); });
MUSIC.forEach((m) => { if (m.a >= HOLD_AT) m.a += HOLD; if (m.b >= HOLD_AT) m.b += HOLD; });
DURATION += HOLD;

// ---------- post effects + frame renderer ----------
(function () {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  defs.setAttribute("width", "0"); defs.setAttribute("height", "0"); defs.style.position = "absolute";
  defs.innerHTML = `<filter id="chR"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>
    <filter id="chG"><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>
    <filter id="chB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/></filter>`;
  document.body.appendChild(defs);
})();
const decay = (t, t0, d) => (t >= t0 && t < t0 + d ? 1 - (t - t0) / d : 0);
renderAt = function (t) {
  const stage = document.getElementById("stage");
  let html = "";
  for (const sc of SCENES) {
    if (t < sc.a || t >= sc.b) continue;
    const lt = t - sc.a, cam = sc.cam ? sc.cam(lt, t) : {};
    const s = cam.s ?? 1, x = cam.x ?? 0, y = cam.y ?? 0, r = cam.r ?? 0, bl = cam.blur ?? 0;
    const clip = sc.clip ? sc.clip(lt) : "", op = sc.op ? sc.op(lt) : 1;
    html += `<div style="position:absolute;inset:0;overflow:hidden;${sc.bg || bgCream};${clip ? `clip-path:${clip};` : ""}opacity:${op.toFixed(3)}">
      <div style="position:absolute;inset:0;transform-origin:${cam.ox ?? 960}px ${cam.oy ?? 540}px;transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(4)}) rotate(${r}deg);${bl > 0.2 ? `filter:blur(${bl.toFixed(1)}px);` : ""}">${sc.draw(lt, t)}</div>${vignette(sc.dark)}</div>`;
  }
  // shockwaves
  let fx = "";
  for (const c of CUES) {
    if (c.wave && t >= c.t && t < c.t + 0.7) {
      const k = (t - c.t) / 0.7, e = E.out(k), [wx, wy, col] = c.wave, rr = 40 + e * 900;
      fx += `<div style="position:absolute;left:${(wx - rr).toFixed(0)}px;top:${(wy - rr).toFixed(0)}px;width:${(rr * 2).toFixed(0)}px;height:${(rr * 2).toFixed(0)}px;border-radius:50%;border:${(14 * (1 - k)).toFixed(1)}px solid ${col};opacity:${(0.7 * (1 - k)).toFixed(2)};filter:blur(${(2 + k * 6).toFixed(1)}px)"></div>`;
    }
    if (c.flash) { const f = decay(t, c.t, 0.16); if (f > 0) fx += `<div style="position:absolute;inset:0;background:${c.flash};opacity:${(0.55 * f * f).toFixed(3)}"></div>`; }
  }
  // chromatic aberration on big hits
  let ca = 0; for (const c of CUES) if (c.ca) ca = Math.max(ca, c.ca * decay(t, c.t, 0.28));
  if (ca > 0.05) {
    const d = (ca * 16).toFixed(1);
    html = `<div style="position:absolute;inset:0;background:#000;isolation:isolate">
      <div style="position:absolute;inset:0;filter:url(#chR);transform:translateX(${d}px)">${html}</div>
      <div style="position:absolute;inset:0;filter:url(#chG);mix-blend-mode:screen">${html}</div>
      <div style="position:absolute;inset:0;filter:url(#chB);mix-blend-mode:screen;transform:translateX(-${d}px)">${html}</div></div>`;
  }
  // moving film grain
  const gx = Math.floor(hash(Math.floor(t * 30)) * 160), gy = Math.floor(hash(Math.floor(t * 30) + 0.5) * 160);
  fx += `<div style="position:absolute;inset:0;pointer-events:none;opacity:.07;background-position:${gx}px ${gy}px;background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E&quot;)"></div>`;
  // fade from black at the very start and at the very end
  const fb = Math.max(1 - t / 0.35, clamp((t - (DURATION - 0.5)) / 0.5) * 0);
  if (fb > 0) fx += `<div style="position:absolute;inset:0;background:#000;opacity:${fb.toFixed(3)}"></div>`;
  // handheld float + impact shake
  let sh = 0; for (const c of CUES) if (c.shake && t >= c.t && t < c.t + 0.3) sh = Math.max(sh, c.shake * (1 - (t - c.t) / 0.3));
  const fxp = Math.sin(t * 0.9) * 3 + Math.sin(t * 190) * sh, fyp = Math.cos(t * 0.7) * 3 + Math.cos(t * 230) * sh, rot = Math.sin(t * 0.5) * 0.12 + Math.sin(t * 150) * sh * 0.04;
  stage.innerHTML = `<div style="position:absolute;inset:-20px;transform:translate(${fxp.toFixed(1)}px,${fyp.toFixed(1)}px) rotate(${rot.toFixed(3)}deg) scale(1.02)"><div style="position:absolute;left:20px;top:20px;width:${W}px;height:${H}px;overflow:hidden">${html}</div></div>${fx}`;
};
window.renderAt = renderAt;
