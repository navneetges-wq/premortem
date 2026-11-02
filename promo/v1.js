// VIDEO 1 — "Before you build" (16:9, ~29s). Real data: quick commerce / "10-minute grocery delivery".
var W = 1920, H = 1080, BPM = 100, DURATION = 29.4, MOOD = "bright";
const D = DATA.qc, B = 60 / BPM;
const IDEA = "10-minute grocery delivery";
const dead = D.deadCos.filter((c) => c.closed).slice(0, 7);
const blip = D.deadCos.find((c) => c.name === "Blip");

var CUES = [];
const cue = (t, s, o = {}) => CUES.push({ t, s, ...o });

// ---- S1: the heartbeat + "Every startup has a plan." ----
const s1beats = [180, 760, 1340];
const PEN1 = 2.4;            // seconds for the pen to cross
s1beats.forEach((b) => cue(((b + 0.24 * 260) / W) * PEN1, "beep"));
s1beats.forEach((b) => cue(((b + 0.24 * 260) / W) * PEN1, "thump"));
cue(PEN1, "flat", { len: 1.5 });

// ---- timeline ----
var SCENES = [
  { a: 0, b: 2.4, draw: (lt) => center(words("_Every_ _startup_ / has a plan.", lt, 0.25, { size: 132, stagger: 0.12 }), "padding-bottom:360px") +
      at(0, 600, ecg({ w: W, h: 300, beats: s1beats, head: (lt / PEN1) * W })) },
  { a: 2.4, b: 4.2, cam: (lt) => ({ s: 1 + E.out(P(lt, 0, 1.8)) * 0.06 }),
    draw: (lt) => center(words("_Most_ _never_ _run_ _a_ / *premortem.*", lt, 0.05, { size: 150, stagger: 0.09 }), "padding-bottom:340px") +
      at(0, 600, ecg({ w: W, h: 300, beats: [], head: W, tip: false })) +
      at(0, 0, `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:rgba(228,80,47,${0.18 * (1 - P(lt, 0, 0.5))})"></div>`) },
  // ---- S3: type the idea, the pen-tip zips in and presses ----
  { a: 4.2, b: 6.6, draw: (lt) => {
      const typed = IDEA.slice(0, Math.floor(clamp((lt - 0.25) / 1.1) * IDEA.length));
      const zip = E.inOut(P(lt, 1.45, 0.45)), pressed = lt > 1.9 && lt < 2.15;
      const dotX = lerp(-100, 1452, zip), dotY = 518 - Math.sin(zip * Math.PI) * 60 + (lt > 1.9 ? 30 * Math.sin(P(lt, 1.9, 0.25) * Math.PI) : 0);
      const speed = zip > 0 && zip < 1 ? `<div style="position:absolute;left:${dotX - 260}px;top:${dotY + 10}px;width:220px;height:4px;background:linear-gradient(90deg,transparent,${C.ink});border-radius:4px"></div><div style="position:absolute;left:${dotX - 200}px;top:${dotY + 30}px;width:150px;height:4px;background:linear-gradient(90deg,transparent,${C.ink});border-radius:4px"></div>` : "";
      return at(0, 260, `<div style="width:${W}px;text-align:center;font:600 30px 'JetBrains Mono';letter-spacing:.16em;color:${C.signal}">DESCRIBE THE BUSINESS YOU WANT TO BUILD</div>`) +
        center(searchBox(typed, Math.floor(lt * 3) % 2 === 0 || lt < 1.4, pressed, 1340)) + speed +
        (zip > 0 ? `<div style="position:absolute;left:${dotX}px;top:${dotY}px;width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:0 0 0 6px ${C.signal},0 0 40px ${C.signal}"></div>` : "") +
        burst(1474, 540, P(lt, 1.9, 0.4), C.ink, 10, 120) +
        (lt > 1.95 ? at(1250, 650, `<div style="font:800 130px Manrope;letter-spacing:-.05em;transform:scale(${lerp(1.6, 1, E.out5(P(lt, 1.95, 0.25)))});transform-origin:left top">Run.</div>`) : "");
    } },
  // ---- S4: we read the news (dark, tilted, fast) ----
  { a: 6.6, b: 9.0, bg: bgNight, cam: (lt) => ({ s: 1.12, r: -6, y: -40 }), draw: (lt) => {
      const rows = D.deadCos.concat(D.deadCos).map((c, i) => `${c.name} — ${cap(c.cause === "reason not reported" ? "shut down" : c.cause)}`);
      const shift = E.inOut(P(lt, 0, 2.4)) * 2600, blur = Math.sin(P(lt, 0, 2.4) * Math.PI) * 5;
      const wall = rows.concat(D.aliveCos.map((n) => `${n} — still running`)).map((r, i) =>
        `<div style="display:flex;gap:26px;align-items:center;margin:0 0 26px ${(i % 3) * 90}px;padding:26px 34px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);width:1180px">
          <span style="font:600 22px 'JetBrains Mono';color:#ff9a76;letter-spacing:.12em">IN THE NEWS</span><span style="font:700 40px Manrope;color:${C.cream}">${esc(r)}</span></div>`).join("");
      const n = Math.round(DATA.stats.sources * E.out(P(lt, 0.1, 2)));
      return at(300, 140 - shift, `<div style="filter:blur(${blur.toFixed(1)}px)">${wall}</div>`) +
        at(120, 760, `<div style="font:800 190px/1 'JetBrains Mono';color:${C.cream};letter-spacing:-.04em;text-shadow:0 0 40px rgba(228,80,47,.5)">${n.toLocaleString("en-IN")}</div><div style="font:600 30px 'JetBrains Mono';color:#ff9a76;letter-spacing:.14em;margin-top:6px">NEWS ARTICLES CITED</div>`) +
        at(1320, 120, words("We _read_ / _the_ *news.*", lt, 0.2, { size: 110, color: C.cream, align: "right" }));
    } },
  // ---- S5: who tried it → stones drop in ----
  { a: 9.0, b: 11.4, bg: bgNight, draw: (lt) => {
      const row = dead.map((c, i) => {
        const k = E.out5(P(lt, 0.2 + i * 0.22, 0.28)), land = P(lt, 0.2 + i * 0.22 + 0.28, 0.2);
        return `<div style="transform:translateY(${(1 - k) * -900}px) scaleY(${1 - Math.sin(land * Math.PI) * 0.06});transform-origin:bottom;opacity:${k > 0 ? 1 : 0}">${stone(c, { w: 230, glow: 0.4 })}</div>`;
      }).join("");
      return at(0, 120, `<div style="width:${W}px;text-align:center">${words("Who _tried_ _it?_", lt, 0, { size: 96, color: C.cream })}</div>`) +
        at(0, 430, `<div style="width:${W}px;display:flex;justify-content:center;gap:26px;align-items:flex-end">${row}</div>`) +
        at(0, 900, `<div style="width:${W}px;text-align:center;font:700 46px Manrope;color:${C.cream};opacity:${E.out(P(lt, 1.85, 0.3))}"><span style="color:${C.signal}">${D.dead} of ${D.total}</span> companies shut down.</div>`);
    } },
  // ---- S6: how they died ----
  { a: 11.4, b: 13.8, draw: (lt) => at(300, 170, words("How _they_ *died.*", lt, 0, { size: 120, align: "left" })) +
      at(300, 430, causeBars(D.causes, P(lt, 0.4, 1.4), { w: 1320, of: D.basedOn })) },
  // ---- S7: the risk score ----
  { a: 13.8, b: 16.2, cam: (lt) => ({ s: 1 + E.out(P(lt, 0, 2.4)) * 0.05 }), draw: (lt) =>
      at(220, 300, words("Your _risk,_ / *scored.*", lt, 0, { size: 128, align: "left" })) +
      at(220, 640, `<div style="font:600 34px 'JetBrains Mono';color:${C.grey};opacity:${E.out(P(lt, 0.5, 0.4))}">“${IDEA}”</div>`) +
      at(1160, 230, ring(D.risk, D.label, P(lt, 0.3, 1.6), 600)) },
  // ---- S8: red flags ----
  { a: 16.2, b: 18.6, draw: (lt) => at(310, 150, words("Your _red_ *flags.*", lt, 0, { size: 112, align: "left" })) +
      at(310, 400, D.checklist.slice(0, 3).map((q, i) => flagRow(q.length > 74 ? q.slice(0, 72).replace(/\s\S*$/, "") + "…?" : q, i === 1 ? "Yes" : "No", P(lt, 0.35 + i * 0.32, 0.4))).join("")) },
  // ---- S9: every company sourced (red threads) ----
  { a: 18.6, b: 21.0, draw: (lt) => {
      const srcs = blip.src, nx = 560, ny = 600, cardX = 1100;
      const threads = srcs.map((s, i) => {
        const y = 330 + i * 150, k = E.out(P(lt, 0.35 + i * 0.2, 0.5)), L = 900;
        return `<path d="M${nx} ${ny} C ${(nx + cardX) / 2} ${ny}, ${(nx + cardX) / 2} ${y + 50}, ${cardX} ${y + 50}" fill="none" stroke="${C.signal}" stroke-width="4" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - k)}" style="filter:drop-shadow(0 0 6px rgba(228,80,47,.6))"/>`;
      }).join("");
      const cards = srcs.map((s, i) => { const k = E.out(P(lt, 0.25 + i * 0.2, 0.4)); return at(cardX, 330 + i * 150, `<div style="width:640px;white-space:nowrap;padding:22px 28px;border-radius:20px;background:#fff;border:1px solid #e6e1d6;box-shadow:0 14px 34px rgba(90,50,30,.1);opacity:${k};transform:translateX(${(1 - k) * 40}px);font:600 27px 'JetBrains Mono';color:${C.red}">● ${esc(s)}</div>`); }).join("");
      return at(0, 90, `<div style="width:${W}px;text-align:center">${words("Every _company._ *Sourced.*", lt, 0, { size: 100 })}</div>`) +
        `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0">${threads}</svg>` +
        at(250, 520, `<div style="width:330px;padding:34px;border-radius:26px;background:${C.ink};color:#fff;box-shadow:0 30px 60px rgba(0,0,0,.25)"><div style="font:600 22px 'JetBrains Mono';color:#ff9a76;letter-spacing:.12em">✕ SHUT DOWN ${blip.closed}</div><div style="font:800 64px Manrope;margin-top:10px">${blip.name}</div><div style="font:500 24px 'JetBrains Mono';color:#F0B9A6">${srcs.length} articles</div></div>`) + cards;
    } },
  // ---- S10: rapid slogans ----
  { a: 21.0, b: 21.6, bg: `background:${C.night}`, draw: (lt) => center(`<div style="font:800 170px Manrope;letter-spacing:-.05em;color:${C.cream};transform:scale(${lerp(1.15, 1, E.out5(P(lt, 0, 0.2)))})">No source,</div>`) },
  { a: 21.6, b: 22.2, bg: `background:${C.night}`, draw: (lt) => center(`<div style="font:800 170px Manrope;letter-spacing:-.05em;color:${C.signal};transform:scale(${lerp(1.15, 1, E.out5(P(lt, 0, 0.2)))})">no company.</div>`) },
  { a: 22.2, b: 22.8, draw: (lt) => center(`<div style="font:800 170px Manrope;letter-spacing:-.05em;transform:scale(${lerp(1.15, 1, E.out5(P(lt, 0, 0.2)))})">Nothing made up.</div>`) },
  { a: 22.8, b: 23.4, bg: bgOrange, draw: (lt) => center(`<div style="font:800 230px Manrope;letter-spacing:-.06em;color:#fff;transform:scale(${lerp(1.2, 1, E.out5(P(lt, 0, 0.2)))})">Free.</div>`) },
  // ---- S11: logo ----
  { a: 23.4, b: DURATION, draw: (lt) => {
      const k = P(lt, 0.1, 1.1), wm = E.out(P(lt, 0.9, 0.6));
      return center(`<div style="display:flex;align-items:flex-end;gap:40px">${icon(150, k)}<div style="opacity:${wm};transform:translateX(${(1 - wm) * -30}px);padding-bottom:6px">${wordmark(150)}</div></div>
        <div style="margin-top:46px;font:600 46px Manrope;color:#4f4e4b;opacity:${E.out(P(lt, 1.5, 0.5))}">See how your idea could fail — <b style="color:${C.ink}">before you build.</b></div>
        <div style="margin-top:40px;padding:20px 40px;border-radius:999px;background:${C.ink};color:#fff;font:700 34px Manrope;opacity:${E.out(P(lt, 2.1, 0.5))};transform:translateY(${(1 - E.out(P(lt, 2.1, 0.5))) * 20}px)">Run a free premortem →</div>`) +
        at(0, 940, ecg({ w: W, h: 160, beats: [W * 0.62], bw: 220, amp: 50, head: W * E.inOut(P(lt, 0.2, 3.2)), color: "#1f9a5c", width: 4 }));
    } },
];

// ---- sound cues for the rest ----
cue(2.4, "impact", { shake: 8 });
for (let i = 0; i < IDEA.length; i++) cue(4.2 + 0.25 + (i / IDEA.length) * 1.1, "type");
cue(4.2 + 1.45, "whoosh"); cue(4.2 + 1.9, "click"); cue(4.2 + 1.95, "impact", { shake: 10 });
cue(6.6, "drop"); cue(6.6, "riserEnd");
for (let i = 0; i < 16; i++) cue(6.7 + i * 0.12, "tick");
dead.forEach((c, i) => cue(9.0 + 0.2 + i * 0.22 + 0.28, "thud", { shake: 4 }));
cue(11.4, "whoosh"); [0, 1, 2].forEach((i) => cue(11.8 + i * 0.17, "pop"));
cue(13.8, "whoosh"); cue(14.1, "riser", { len: 1.6 }); cue(15.7, "pop");
cue(16.2, "whoosh"); [0, 1, 2].forEach((i) => cue(16.6 + i * 0.32 + 0.37, i === 1 ? "pop" : "stamp"));
cue(18.6, "whoosh"); [0, 1, 2, 3].forEach((i) => cue(18.95 + i * 0.2, "swish"));
[21.0, 21.6, 22.2, 22.8].forEach((t, i) => cue(t, "impact", { shake: i === 3 ? 12 : 6 }));
cue(23.4, "chime"); cue(24.0, "beep"); cue(25.8, "beep");
