// VIDEO 2 — "The Graveyard" (16:9, ~29s, dark & cinematic). Real data: the graveyard + food delivery.
var W = 1920, H = 1080, BPM = 80, DURATION = 29.25, MOOD = "dark";
const F = DATA.fd, B = 60 / BPM;
const pick = (name, extra) => DATA.montage.find((c) => c.name === name && (!extra || extra(c)));
const MONTAGE = [pick("Pets.com"), pick("Juicero"), pick("Solyndra"), pick("Sprig"), pick("Byju's"), pick("Fisker"), pick("TinyOwl"), pick("Jokr"), pick("Dunzo", (c) => c.started)].filter(Boolean);
const IDEA = "Food delivery app for small towns";
const top3 = DATA.gyCauses.filter(([c]) => c !== "reason not reported").slice(0, 3);
const unknown = (DATA.gyCauses.find(([c]) => c === "reason not reported") || [0, 0])[1];

var CUES = [];
const cue = (t, s, o = {}) => CUES.push({ t, s, ...o });
const vignette = `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.65) 100%)"></div>`;
const lantern = (x, y, r, o) => `<div style="position:absolute;left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:radial-gradient(circle, rgba(255,150,80,${o}) 0%, rgba(228,80,47,${o * 0.35}) 35%, transparent 70%)"></div>`;
const embers = (t, n = 26) => Array.from({ length: n }, (_, i) => {
  const x = (i * 197) % W, sp = 40 + (i * 37) % 60, y = H - ((t * sp + i * 83) % (H + 100)), s = 2 + (i % 3);
  return `<div style="position:absolute;left:${x + Math.sin(t + i) * 20}px;top:${y}px;width:${s}px;height:${s}px;border-radius:50%;background:#ffb070;box-shadow:0 0 8px #ff8a50;opacity:${0.35 + (i % 4) * 0.15}"></div>`;
}).join("");

var SCENES = [
  // S1: one heartbeat in the dark, then the count
  { a: 0, b: 3.0, bg: `background:#050405`, grain: 0.08, draw: (lt) => {
      const n = Math.round(DATA.gyCount * E.out5(P(lt, 1.2, 1.4)));
      return at(0, 380, ecg({ w: W, h: 320, beats: [700], bw: 300, amp: 120, head: W * clamp(lt / 1.6), width: 4 })) +
        (lt > 1.15 ? center(`<div style="font:800 260px/1 Manrope;letter-spacing:-.06em;color:${C.signal};text-shadow:0 0 60px rgba(228,80,47,.5)">${n}</div>
          <div style="font:700 64px Manrope;color:${C.cream};opacity:${E.out(P(lt, 1.6, 0.5))}">businesses. <span style="color:#8a847a">All shut down.</span></div>`, `background:rgba(5,4,5,${clamp((lt - 1.15) * 4) * 0.85})`) : "") + vignette;
    } },
  // S2: montage of real tombstones, one per beat
  ...MONTAGE.map((c, i) => ({ a: 3.0 + i * B, b: 3.0 + (i + 1) * B, bg: bgNight, grain: 0.08,
    cam: (lt) => ({ s: 1.0 + lt * 0.12, r: (i % 2 ? 1 : -1) * 1.2 }),
    draw: (lt) => lantern(W / 2, 560, 520, 0.55 + 0.1 * Math.sin(lt * 20)) + embers(lt + i) +
      center(`<div style="transform:translateY(${(1 - E.out5(P(lt, 0, 0.18))) * 60}px)">${stone(c, { w: 470, glow: 0.7 })}</div>`, "padding-top:60px") +
      at(70, 70, `<div style="font:600 28px 'JetBrains Mono';letter-spacing:.14em;color:#ff9a76">${String(i + 1).padStart(2, "0")} / ${DATA.gyCount}</div>`) +
      at(70, 960, `<div style="font:500 24px 'JetBrains Mono';color:rgba(244,241,234,.5)">${esc(cap(c.niche))}</div>`) + vignette })),
  // S3: they all had a plan
  { a: 3.0 + MONTAGE.length * B, b: 12.0, bg: `background:#050405`, draw: (lt) => center(words("Every _one_ _of_ _them_ / had a *plan.*", lt, 0.05, { size: 130, color: C.cream, stagger: 0.1 })) + vignette },
  // S4: what killed them
  { a: 12.0, b: 15.0, bg: bgNight, draw: (lt) => at(300, 130, words("What *killed* them?", lt, 0, { size: 104, color: C.cream, align: "left" })) +
      at(300, 380, causeBars(top3, P(lt, 0.45, 1.5), { w: 1320, dark: true })) +
      at(300, 880, `<div style="font:500 30px 'JetBrains Mono';color:rgba(244,241,234,.6);opacity:${E.out(P(lt, 1.9, 0.4))}">+ ${unknown} never said why. Failures are often unreported.</div>`) + vignette },
  // S5: what will kill yours? (type the idea)
  { a: 15.0, b: 17.25, draw: (lt) => {
      const typed = IDEA.slice(0, Math.floor(clamp((lt - 0.7) / 1.1) * IDEA.length));
      return at(0, 230, `<div style="width:${W}px">${words("What will kill *yours?*", lt, 0, { size: 120 })}</div>`) +
        at(0, 520, `<div style="width:${W}px;display:flex;justify-content:center">${searchBox(typed, Math.floor(lt * 3) % 2 === 0, lt > 2.0, 1400)}</div>`);
    } },
  // S6: the flatline obituary
  { a: 17.25, b: 21.0, draw: (lt) => {
      const head = W * clamp(lt / 3.2), cause = "Cause of death: ", c2 = cap(F.causes[0][0]);
      const tt = clamp((lt - 1.7) / 1.1), full = cause + c2, n = Math.floor(tt * full.length);
      const shown = n <= cause.length ? esc(full.slice(0, n)) : `${cause}<b style="color:${C.signal}">${esc(c2.slice(0, n - cause.length))}</b>`;
      return at(0, 130, `<div style="width:${W}px;text-align:center"><div style="font:600 26px 'JetBrains Mono';letter-spacing:.18em;color:${C.red}">WHAT COULD HAPPEN</div><div style="font:800 86px Manrope;letter-spacing:-.04em;margin-top:16px">“${IDEA}”</div></div>`) +
        at(0, 400, ecg({ w: W, h: 300, beats: [120, 470], bw: 300, amp: 120, head })) +
        at(0, 740, `<div style="width:${W}px;text-align:center;font:600 64px Manrope;letter-spacing:-.02em">${shown}</div>
          <div style="width:${W}px;text-align:center;margin-top:18px;font:500 26px 'JetBrains Mono';color:${C.grey};opacity:${E.out(P(lt, 3.0, 0.4))}">the #1 reported cause · ${F.causes[0][1]} of ${F.basedOn} shut-downs like it · not a prediction</div>`);
    } },
  // S7: back to life
  { a: 21.0, b: 23.25, draw: (lt) => at(0, 280, ecg({ w: W, h: 300, beats: [W * 0.18], bw: 320, amp: 130, head: W * clamp(0.1 + lt / 1.6), color: "#1f9a5c" })) +
      at(0, 640, `<div style="width:${W}px">${words("It _doesn’t_ have to / end +this+ +way.+", lt, 0.35, { size: 128, stagger: 0.08 })}</div>`) },
  // S8: what you get — risk + red flags
  { a: 23.25, b: 25.5, draw: (lt) => at(180, 240, ring(F.risk, F.label, P(lt, 0.1, 1.3), 560)) +
      at(840, 250, F.checklist.slice(0, 3).map((q, i) => flagRow(q, i === 2 ? "Yes" : "No", P(lt, 0.4 + i * 0.25, 0.35), 900)).join("")) },
  // S9: logo
  { a: 25.5, b: DURATION, bg: `background:#050405`, draw: (lt) => {
      const k = P(lt, 0.1, 1.1), wm = E.out(P(lt, 0.8, 0.6));
      return lantern(W / 2, 470, 600, 0.3) + center(`<div style="display:flex;align-items:flex-end;gap:40px">${icon(140, k, true)}<div style="opacity:${wm};transform:translateX(${(1 - wm) * -30}px);padding-bottom:6px">${wordmark(140, C.cream)}</div></div>
        <div style="margin-top:46px;font:600 46px Manrope;color:rgba(244,241,234,.7);opacity:${E.out(P(lt, 1.3, 0.5))}">Don’t become the <b style="color:${C.signal}">next stone.</b></div>
        <div style="margin-top:34px;font:500 28px 'JetBrains Mono';color:rgba(244,241,234,.5);opacity:${E.out(P(lt, 1.9, 0.5))}">${DATA.stats.companies.toLocaleString("en-IN")} companies · ${DATA.stats.sources} news sources · 0 made up</div>`) + vignette;
    } },
];

// ---- sound ----
cue(((700 + 0.24 * 300) / W) * 1.6, "beep"); cue(((700 + 0.24 * 300) / W) * 1.6, "thump");
cue(1.15, "impact", { shake: 6 });
for (let i = 0; i < 18; i++) cue(1.2 + i * 0.075, "tick");
MONTAGE.forEach((c, i) => { cue(3.0 + i * B, "thud", { shake: 5 }); cue(3.0 + i * B + 0.02, "swish"); });
cue(12.0, "whoosh"); [0, 1, 2].forEach((i) => cue(12.45 + i * 0.18, "pop"));
cue(15.0, "impact", { shake: 4 }); for (let i = 0; i < IDEA.length; i++) cue(15.7 + (i / IDEA.length) * 1.1, "type"); cue(17.0, "click");
const bt = (x) => ((x + 0.24 * 300) / W) * 3.2;
cue(17.25 + bt(120), "beep"); cue(17.25 + bt(470), "beep"); cue(17.25 + bt(470) + 0.12, "flat", { len: 2.4 });
for (let i = 0; i < 30; i++) cue(17.25 + 1.7 + i * 0.037, "type");
cue(21.0 + ((W * 0.18 + 0.24 * 320) / W - 0.1) * 1.6, "beep"); cue(21.0 + ((W * 0.18 + 0.24 * 320) / W - 0.1) * 1.6, "thump");
cue(21.4, "riser", { len: 1.8 });
cue(23.25, "drop", { shake: 6 }); [0, 1, 2].forEach((i) => cue(23.65 + i * 0.25 + 0.3, i === 2 ? "pop" : "stamp"));
cue(25.5, "chime");
