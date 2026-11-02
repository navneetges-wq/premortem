// engine.js — a tiny frame-by-frame animation engine for premortem promo videos.
// Each video defines SCENES (start, end, draw(localTime, globalTime) → HTML) and CUES (sound effects).
// renderAt(t) rebuilds the whole frame from scratch, so every frame is exact and repeatable.

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const P = (t, a, d) => clamp((t - a) / d);                      // progress of something that starts at a and lasts d
const E = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  out5: (t) => 1 - Math.pow(1 - t, 5),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  expo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  in: (t) => t * t * t,
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "");
const C = { cream: "#F4F1EA", ink: "#161616", grey: "#a19c92", signal: "#E4502F", red: "#BF3F1C", green: "#1E7A4C", night: "#0d0b0e" };

// ---------- words that blur-rise in, one by one. *word* = orange, _word_ = grey ----------
function words(text, t, start, o = {}) {
  const { stagger = 0.07, dur = 0.42, size = 120, weight = 800, color = C.ink, align = "center", lh = 1.02, ls = -0.045, out = null } = o;
  const parts = text.split(" ");
  const html = parts.map((w, i) => {
    let col = color, word = w;
    if (/^\*.*\*[.,?!]*$/.test(w)) { col = C.signal; word = w.replace(/\*/g, ""); }
    else if (/^_.*_[.,?!]*$/.test(w)) { col = C.grey; word = w.replace(/_/g, ""); }
    else if (/^\+.*\+[.,?!]*$/.test(w)) { col = "#1f9a5c"; word = w.replace(/\+/g, ""); }
    if (w === "/") return "<br>";
    const k = E.out(P(t, start + i * stagger, dur));
    const ko = out === null ? 0 : E.in(P(t, out + i * stagger * 0.5, 0.3));
    const op = k * (1 - ko), y = (1 - k) * 0.55 - ko * 0.4, bl = (1 - k) * 14 + ko * 10;
    return `<span style="display:inline-block;opacity:${op.toFixed(3)};transform:translateY(${y.toFixed(3)}em);filter:blur(${bl.toFixed(1)}px);color:${col};margin-right:.24em">${esc(word)}</span>`;
  }).join("");
  return `<div style="font:${weight} ${size}px/${lh} Manrope;letter-spacing:${ls}em;text-align:${align}">${html}</div>`;
}

// ---------- the heartbeat line (premortem's "character") ----------
const gs = (x, m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s));
const wave = (f) => gs(f, .12, .025, .12) + gs(f, .215, .008, -.16) + gs(f, .24, .011, 1) + gs(f, .268, .011, -.34) + gs(f, .47, .045, .24);
// beats: x positions (px) where each beat starts; bw: beat width; head: how far the pen has drawn (px)
function ecg({ w, h = 300, beats = [], bw = 260, head = w, amp = 110, color = C.signal, width = 5, green = null, glow = true, tip = true }) {
  const y0 = h / 2, pts = [];
  for (let x = 0; x <= Math.min(head, w); x += 3) {
    let v = 0;
    for (const b of beats) if (x >= b && x < b + bw) v += wave((x - b) / bw);
    pts.push([x, y0 - v * amp]);
  }
  const path = (arr) => arr.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  let main = pts, gpts = [];
  if (green !== null) { main = pts.filter((p) => p[0] <= green); gpts = pts.filter((p) => p[0] >= green - 3); }
  const last = pts[pts.length - 1] || [0, y0];
  const f = glow ? `filter:drop-shadow(0 0 10px ${color}aa)` : "";
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible;display:block">
    <path d="${path(main)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" style="${f}"/>
    ${gpts.length ? `<path d="${path(gpts)}" fill="none" stroke="#1f9a5c" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 10px #1f9a5caa)"/>` : ""}
    ${tip && head < w ? `<circle cx="${last[0]}" cy="${last[1]}" r="${width * 2.4}" fill="#fff" style="filter:drop-shadow(0 0 14px ${gpts.length ? "#1f9a5c" : color}) drop-shadow(0 0 4px ${gpts.length ? "#1f9a5c" : color})"/>` : ""}
  </svg>`;
}

// ---------- premortem logo icon (tombstone with 3 bars); k = 0..1 build-in ----------
function icon(size, k = 1, dark = false) {
  const b = (i, h) => { const kk = E.back(P(k, 0.35 + i * 0.12, 0.35)); return `<rect x="${[46, 94, 142][i]}" y="${232 - h * kk}" width="34" height="${h * kk}" fill="${i === 2 ? C.signal : dark ? C.ink : C.cream}"/>`; };
  const s = E.back(P(k, 0, 0.45));
  return `<svg width="${size}" height="${size * 1.45}" viewBox="0 0 240 348" style="display:block;transform:scale(${s});transform-origin:50% 100%">
    <path d="M0 348 V120 A120 120 0 0 1 240 120 V348 Z" fill="${dark ? C.cream : C.ink}"/>
    <g transform="translate(14,90)">${b(0, 67)}${b(1, 113)}${b(2, 181)}</g></svg>`;
}
function wordmark(size, color = C.ink) {
  return `<div style="font:500 ${size}px Manrope;letter-spacing:-0.035em;color:${color}"><b style="font-weight:800">pre</b>mortem</div>`;
}

// ---------- a tombstone for a real company ----------
function stone(c, o = {}) {
  const { w = 360, glow = 0, tag = "✕ SHUT DOWN" } = o;
  const yrs = c.started && c.closed ? `${c.started} – ${c.closed}` : c.closed ? `Closed ${c.closed}` : "";
  const fs = Math.min(w * 0.13, (w * 1.55) / Math.max(6, c.name.length));
  return `<div style="position:relative;width:${w}px;height:${w * 1.25}px;border-radius:${w}px ${w}px 22px 22px;
    background:linear-gradient(160deg,#6d675f,#4a4642 60%,#3b3835);box-shadow:inset 0 2px 0 rgba(255,255,255,.18),inset 0 -20px 40px rgba(0,0,0,.35),0 30px 60px rgba(0,0,0,.5)${glow ? `,0 0 ${80 * glow}px rgba(228,80,47,${0.55 * glow})` : ""};
    display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${w * 0.22}px ${w * 0.1}px ${w * 0.08}px;color:#ebe4d8">
    <div style="font:600 ${w * 0.045}px 'JetBrains Mono';letter-spacing:.14em;color:#ff9a76">${tag}</div>
    <div style="font:800 ${fs}px/1.05 Manrope;letter-spacing:-.02em;margin:${w * 0.04}px 0;text-shadow:0 -1px 0 rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.15)">${esc(c.name.toUpperCase())}</div>
    <div style="font:500 ${w * 0.05}px 'JetBrains Mono';opacity:.8">${esc(yrs)}</div>
    <div style="width:${w * 0.16}px;height:2px;background:rgba(235,228,216,.45);margin:${w * 0.05}px 0"></div>
    <div style="font:600 ${w * 0.058}px/1.25 Manrope;color:#ffb39a">${esc(cap(c.cause))}</div></div>`;
}

// ---------- the search box (like the app) ----------
function searchBox(text, cursorOn, pressed, w = 1100) {
  return `<div style="width:${w}px;padding:14px;border-radius:26px;background:rgba(255,255,255,.9);border:1px solid #fff;box-shadow:0 30px 80px rgba(90,50,30,.14);display:flex;gap:14px;align-items:center">
    <div style="flex:1;font:500 40px Manrope;color:${text ? C.ink : "#a8a296"};padding:14px 18px;white-space:nowrap;overflow:hidden">${esc(text || "Describe your idea in one line")}<span style="display:inline-block;width:3px;height:44px;background:${C.signal};margin-left:3px;vertical-align:-8px;opacity:${cursorOn ? 1 : 0}"></span></div>
    <div style="padding:22px 34px;border-radius:18px;font:800 32px Manrope;color:#fff;background:linear-gradient(135deg,#F7A86E,#E4502F 60%,#C9451F);
      transform:scale(${pressed ? 0.93 : 1});box-shadow:${pressed ? "0 4px 10px rgba(228,80,47,.4)" : "0 14px 34px rgba(228,80,47,.45)"}">Run premortem →</div></div>`;
}

// ---------- risk ring ----------
function ring(score, label, k, size = 520, dark = false) {
  const r = size * 0.42, L = 2 * Math.PI * r, v = Math.round(score * E.out(k));
  const col = label === "Low" ? "#2bb673" : label === "Medium" ? "#E8A23A" : C.signal;
  return `<div style="position:relative;width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg)"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${dark ? "rgba(255,255,255,.1)" : "#e6e0d4"}" stroke-width="${size * 0.06}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${size * 0.06}" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - (score / 100) * E.out(k))}" style="filter:drop-shadow(0 0 18px ${col}88)"/></svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:${dark ? C.cream : C.ink}">
      <div style="font:800 ${size * 0.3}px/1 Manrope;letter-spacing:-.05em">${v}</div>
      <div style="font:600 ${size * 0.05}px 'JetBrains Mono';letter-spacing:.16em;color:${col};opacity:${clamp(k * 2 - 0.8)}">${label.toUpperCase()} RISK</div></div></div>`;
}

// ---------- cause-of-death bars ----------
function causeBars(rows, k, o = {}) {
  const { w = 1200, of = null, dark = false } = o, max = Math.max(...rows.map((r) => r[1]));
  return rows.map(([cause, n], i) => {
    const kk = E.out(P(k, i * 0.12, 0.6));
    return `<div style="margin:0 0 34px;opacity:${clamp(kk * 3)};transform:translateX(${(1 - kk) * -40}px)">
      <div style="display:flex;justify-content:space-between;font:700 40px Manrope;color:${dark ? C.cream : C.ink};margin-bottom:12px"><span>${esc(cap(cause))}</span>
        <span style="font:600 34px 'JetBrains Mono';color:${C.signal}">${Math.round(n * kk)}${of ? ` of ${of}` : ""}</span></div>
      <div style="height:22px;border-radius:12px;background:${dark ? "rgba(255,255,255,.1)" : "#e6e0d4"};width:${w}px;overflow:hidden">
        <div style="height:100%;width:${(100 * n / max) * kk}%;border-radius:12px;background:linear-gradient(90deg,#8E2A12,#E4502F 70%,#F7A86E);box-shadow:0 0 18px rgba(228,80,47,.5)"></div></div></div>`;
  }).join("");
}

// ---------- a red-flag row ----------
function flagRow(q, answer, k, w = 1300) {
  const kk = E.out(k), no = answer === "No";
  return `<div style="width:${w}px;display:flex;gap:30px;align-items:center;justify-content:space-between;padding:26px 30px;margin-bottom:18px;border-radius:22px;
    background:rgba(255,255,255,.85);border:1px solid ${no && kk > 0.9 ? "rgba(228,80,47,.5)" : "#e6e1d6"};box-shadow:0 14px 34px rgba(90,50,30,.08);opacity:${clamp(kk * 2)};transform:translateY(${(1 - kk) * 30}px)">
    <div style="font:600 32px/1.3 Manrope;color:${C.ink}">${esc(q)}</div>
    <div style="flex:none;padding:12px 26px;border-radius:999px;font:800 28px Manrope;${kk > 0.9 ? (no ? `background:${C.signal};color:#fff;box-shadow:0 0 24px rgba(228,80,47,.5)` : `background:#e3f2e8;color:${C.green}`) : "background:#eee8dd;color:#999"}">${kk > 0.9 ? (no ? "✕ No" : "✓ Yes") : "…"}</div></div>`;
}

// ---------- background helpers ----------
const bgCream = `background:radial-gradient(900px 700px at 8% 6%, rgba(228,80,47,.16), transparent 70%),radial-gradient(800px 600px at 95% 15%, rgba(242,153,74,.14), transparent 70%),${C.cream}`;
const bgNight = `background:radial-gradient(1200px 700px at 50% 120%, rgba(228,80,47,.22), transparent 70%),radial-gradient(900px 600px at 10% -10%, rgba(80,90,150,.18), transparent 70%),${C.night}`;
const bgOrange = `background:linear-gradient(135deg,#F7A86E,#E4502F 55%,#B93A1A)`;
function grain(o = 0.06) { return `<div style="position:absolute;inset:0;pointer-events:none;opacity:${o};background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E&quot;)"></div>`; }
const at = (x, y, html, o = "") => `<div style="position:absolute;left:${x}px;top:${y}px;${o}">${html}</div>`;
const center = (html, o = "") => `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;${o}">${html}</div>`;
// little impact lines around a point (like a comic "pow")
function burst(x, y, k, color = C.ink, n = 8, r0 = 60, len = 40) {
  if (k <= 0 || k >= 1) return "";
  const e = E.out(k);
  return `<svg style="position:absolute;left:0;top:0;overflow:visible" width="1" height="1">${Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, r1 = r0 + e * 50, r2 = r1 + len * (1 - e);
    return `<line x1="${x + Math.cos(a) * r1}" y1="${y + Math.sin(a) * r1}" x2="${x + Math.cos(a) * r2}" y2="${y + Math.sin(a) * r2}" stroke="${color}" stroke-width="6" stroke-linecap="round" opacity="${1 - e}"/>`;
  }).join("")}</svg>`;
}

// ---------- the frame renderer ----------
// scene: { a: start, b: end, bg, draw(lt, t) → html, cam(lt) → {s, x, y, r, blur} }
function renderAt(t) {
  const stage = document.getElementById("stage");
  let html = "";
  for (const sc of SCENES) {
    if (t < sc.a || t >= sc.b) continue;
    const lt = t - sc.a, cam = sc.cam ? sc.cam(lt, t) : {};
    const s = cam.s ?? 1, x = cam.x ?? 0, y = cam.y ?? 0, r = cam.r ?? 0, bl = cam.blur ?? 0;
    html += `<div style="position:absolute;inset:0;${sc.bg || bgCream}">
      <div style="position:absolute;inset:0;transform:translate(${x}px,${y}px) scale(${s}) rotate(${r}deg);${bl ? `filter:blur(${bl}px);` : ""}">${sc.draw(lt, t)}</div>${grain(sc.grain ?? 0.05)}</div>`;
  }
  // shake on impacts
  let sh = 0; for (const c of CUES) if (c.shake && t >= c.t && t < c.t + 0.25) sh = Math.max(sh, c.shake * (1 - (t - c.t) / 0.25));
  stage.style.transform = sh ? `translate(${(Math.sin(t * 190) * sh).toFixed(1)}px,${(Math.cos(t * 230) * sh).toFixed(1)}px)` : "";
  stage.innerHTML = html;
}
window.renderAt = renderAt;
