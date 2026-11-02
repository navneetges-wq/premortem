// VIDEO 3 — "3 questions" (vertical 9:16 for Reels/Shorts, ~21s, fast). Real data: quick commerce.
var W = 1080, H = 1920, BPM = 110, DURATION = 21.3, MOOD = "bright";
const D = DATA.qc, B = 60 / BPM;
const IDEA = "10-minute grocery delivery";
var CUES = [];
const cue = (t, s, o = {}) => CUES.push({ t, s, ...o });
const deck = []; // alternate still-running and shut-down companies (real names)
for (let i = 0; i < 4; i++) { if (D.aliveCos[i]) deck.push({ name: D.aliveCos[i], dead: false }); if (D.deadCos[i]) deck.push({ name: D.deadCos[i].name, dead: true, year: D.deadCos[i].closed }); }
const q = (n, text, lt) => `<div style="display:flex;align-items:center;gap:28px;justify-content:center">
  <div style="width:110px;height:110px;border-radius:50%;background:${C.ink};color:#fff;display:grid;place-items:center;font:800 64px Manrope;transform:scale(${E.back(P(lt, 0, 0.3))})">${n}</div></div>
  <div style="margin-top:30px">${words(text, lt, 0.12, { size: 110 })}</div>`;
const slam = (txt, lt, col = C.ink, size = 170) => center(`<div style="font:800 ${size}px/1 Manrope;letter-spacing:-.05em;color:${col};text-align:center;transform:scale(${lerp(1.25, 1, E.out5(P(lt, 0, 0.2)))})">${txt}</div>`);

var SCENES = [
  { a: 0, b: 3 * B, draw: (lt) => center(words("_Before_ _you_ / _quit_ _your_ / job,", lt, 0.05, { size: 150, stagger: 0.09 })) +
      at(0, 1380, ecg({ w: W, h: 260, beats: [140, 560], bw: 240, amp: 90, head: W * clamp(lt / (3 * B)) })) },
  { a: 3 * B, b: 6 * B, draw: (lt) => center(`${words("ask", lt, 0, { size: 150 })}<div style="font:800 260px/1 Manrope;letter-spacing:-.06em;color:${C.signal};transform:scale(${E.back(P(lt, 0.25, 0.3))})">3</div>${words("questions.", lt, 0.45, { size: 150 })}`) },
  // Q1 — who tried it? (a deck of real companies)
  { a: 6 * B, b: 12 * B, draw: (lt) => {
      const cards = deck.map((c, i) => {
        const k = E.out5(P(lt, 0.45 + i * 0.16, 0.3)), rot = (i % 2 ? 1 : -1) * 2.2, y = 545 + i * 154;
        return `<div style="position:absolute;left:${110 + (1 - k) * 900}px;top:${y}px;width:860px;padding:22px 36px;border-radius:24px;background:#fff;border:1px solid #e6e1d6;
          box-shadow:0 20px 50px rgba(90,50,30,.14);transform:rotate(${rot * (1 - P(lt, 2.4, 0.5))}deg);opacity:${k > 0 ? 1 : 0};border-left:10px solid ${c.dead ? C.signal : C.green}">
          <div style="font:600 24px 'JetBrains Mono';letter-spacing:.12em;color:${c.dead ? C.red : C.green}">${c.dead ? `✕ SHUT DOWN${c.year ? " " + c.year : ""}` : "● STILL RUNNING"}</div>
          <div style="font:800 50px/1.15 Manrope;letter-spacing:-.02em;margin-top:4px;white-space:nowrap">${esc(c.name)}</div></div>`;
      }).join("");
      return at(0, 230, `<div style="width:${W}px">${q(1, "Who _tried_ _it?_", lt)}</div>`) + cards +
        at(0, 1800, `<div style="width:${W}px;text-align:center;font:700 46px Manrope;opacity:${E.out(P(lt, 2.2, 0.4))}"><span style="color:${C.signal}">${D.total}</span> companies found · <span style="color:${C.signal}">${D.dead}</span> shut down</div>`);
    } },
  // Q2 — how did they die?
  { a: 12 * B, b: 18 * B, bg: bgNight, draw: (lt) => at(0, 230, `<div style="width:${W}px">${q(2, "How _did_ _they_ *die?*", lt).replace(/color:#161616/g, "color:#F4F1EA").replace(`background:${C.ink}`, `background:${C.signal}`)}</div>`) +
      at(110, 820, causeBars(D.causes, P(lt, 0.5, 1.4), { w: 860, of: D.basedOn, dark: true })) +
      at(110, 1520, `<div style="font:500 30px 'JetBrains Mono';color:rgba(244,241,234,.6);opacity:${E.out(P(lt, 2.0, 0.4))}">Every cause linked to the news it came from.</div>`) },
  // Q3 — will yours?
  { a: 18 * B, b: 24 * B, draw: (lt) => at(0, 200, `<div style="width:${W}px">${q(3, "Will *yours?*", lt)}</div>`) +
      at((W - 560) / 2, 640, ring(D.risk, D.label, P(lt, 0.4, 1.4), 560)) +
      at(0, 1260, `<div style="width:${W}px;display:flex;flex-direction:column;align-items:center">${D.checklist.slice(0, 2).map((x, i) => flagRow(x.length > 64 ? x.slice(0, 62).replace(/\s\S*$/, "") + "…?" : x, "No", P(lt, 1.4 + i * 0.3, 0.35), 920)).join("")}</div>`) },
  // the answer
  { a: 24 * B, b: 28 * B, cam: (lt) => ({ s: 1 + lt * 0.03 }), draw: (lt) => center(words("*premortem* / _answers_ / all three.", lt, 0, { size: 150, stagger: 0.12 }) +
      `<div style="margin-top:50px;font:600 40px 'JetBrains Mono';color:${C.grey};opacity:${E.out(P(lt, 1.2, 0.4))}">in a minute or two.</div>`) },
  { a: 28 * B, b: 30 * B, bg: `background:${C.night}`, draw: (lt) => slam("Every<br>answer<br><span style='color:#E4502F'>sourced.</span>", lt, C.cream, 160) },
  { a: 30 * B, b: 32 * B, bg: bgOrange, draw: (lt) => slam("Free.", lt, "#fff", 260) },
  { a: 32 * B, b: DURATION, draw: (lt) => {
      const k = P(lt, 0.1, 1.1), wm = E.out(P(lt, 0.8, 0.6));
      return center(`${icon(190, k)}<div style="margin-top:40px;opacity:${wm};transform:translateY(${(1 - wm) * 20}px)">${wordmark(150)}</div>
        <div style="margin-top:40px;font:600 50px/1.25 Manrope;color:#4f4e4b;text-align:center;opacity:${E.out(P(lt, 1.3, 0.5))}">See how your idea<br>could fail — <b style="color:${C.ink}">before<br>you build.</b></div>
        <div style="margin-top:50px;padding:24px 46px;border-radius:999px;background:${C.ink};color:#fff;font:700 40px Manrope;opacity:${E.out(P(lt, 1.9, 0.5))}">Run a free premortem →</div>`) +
        at(0, 1700, ecg({ w: W, h: 160, beats: [W * 0.55], bw: 200, amp: 50, head: W * E.inOut(P(lt, 0.2, 3)), color: "#1f9a5c", width: 4 }));
    } },
];

// ---- sound ----
[140, 560].forEach((x) => cue(((x + 0.24 * 240) / W) * 3 * B, "beep"));
cue(3 * B, "impact", { shake: 8 }); cue(3 * B + 0.25, "pop");
cue(6 * B, "whoosh"); cue(6 * B + 0.02, "stamp");
deck.forEach((c, i) => cue(6 * B + 0.45 + i * 0.16, "swish"));
cue(12 * B, "drop", { shake: 8 }); [0, 1, 2].forEach((i) => cue(12 * B + 0.55 + i * 0.17, "pop"));
cue(18 * B, "impact", { shake: 6 }); cue(18 * B + 0.4, "riser", { len: 1.3 }); [0, 1].forEach((i) => cue(18 * B + 1.75 + i * 0.3, "stamp"));
cue(24 * B, "whoosh"); cue(24 * B + 0.05, "pop");
cue(28 * B, "impact", { shake: 8 }); cue(30 * B, "impact", { shake: 12 });
cue(32 * B, "chime");
