// landing.js — fills the landing page with real data and handles the email sign-up.

const API = location.hostname.endsWith("catalystserverless.in")
  ? "/server/api"
  : "https://whotriedit-60093906253.development.catalystserverless.in/server/api";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const riskClass = (label) => ({ Low: "low", Medium: "medium", High: "high", "Very high": "very-high" }[label] || "");
const nice = (t) => (t && !/not reported/i.test(t) ? t : "");
const real = (y) => (Number(y) > 1900 ? Number(y) : 0);

async function api(path, options) {
  const res = await fetch(API + path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

const STILL = matchMedia("(prefers-reduced-motion: reduce)").matches;
let examplesReady = false, examplesSeen = false;

// The four example reports (a real business type + the idea we show it for).
// Four real examples whose real scores span Low → Very high (scores are never adjusted — we just picked a spread).
const EXAMPLES = [
  { niche: "footwear and sneaker brands", idea: "Homegrown sneaker brand", title: "Sneaker brand" },
  { niche: "quick commerce", idea: "10-minute grocery delivery", title: "10-minute delivery" },
  { niche: "food delivery", idea: "Food delivery app for small towns", title: "Food delivery app" },
  { niche: "alcohol brands", idea: "Craft beer brand", title: "Craft beer brand" },
];
const HERO = 2; // the example shown in the hero preview
const reportLink = (e) => `index.html#/results/${encodeURIComponent(e.niche)}?idea=${encodeURIComponent(e.idea)}`;

// Load each example once (the hero preview and the examples section share the bike-taxi data).
const loaded = EXAMPLES.map((e) => api(`/results?niche=${encodeURIComponent(e.niche)}&idea=${encodeURIComponent(e.idea)}`).catch(() => null));

// ---------- hero: live preview of a real report ----------
// Returning visitors see it instantly (saved from their last visit); then it refreshes with live numbers.
const HERO_KEY = "lp-hero-v1";
const slim = (d) => d && d.risk && {                          // keep only what the card needs
  risk: d.risk, premortem: d.premortem && { available: d.premortem.available, basedOn: d.premortem.basedOn, risks: (d.premortem.risks || []).slice(0, 3).map((r) => ({ cause: r.cause, count: r.count })) },
  companies: d.companies.filter((c) => c.group === "shut down" || c.group === "running").map((c) => ({ group: c.group, name: c.name, one_line: c.one_line, closed_year: c.closed_year })),
};
let heroShown = false;
function paintHero(d) {
  document.getElementById("lp-title").textContent = `“${EXAMPLES[HERO].title}”`;
  const r = d && d.risk;
  if (!r || r.score === null || r.score === undefined) { if (!heroShown) document.getElementById("lp-line").textContent = "Open the app to see a live report."; return; }
  const main = d.companies.filter((c) => c.group === "shut down" || c.group === "running");
  const dead = main.filter((c) => c.group === "shut down");
  const alive = main.filter((c) => c.group === "running");
  document.getElementById("lp-line").textContent = `${r.label} risk · ${dead.length} of ${main.length} shut down`;
  if (!heroShown) countTo(document.getElementById("lp-score"), r.score); else document.getElementById("lp-score").textContent = r.score;
  setTimeout(() => { document.getElementById("lp-fill").style.strokeDashoffset = String(238.8 * (1 - r.score / 100)); }, heroShown ? 0 : 150);
  // top 3 causes of death as small bars
  const p = d.premortem || {};
  if (p.available && p.risks && p.risks.length) {
    document.getElementById("lp-causes").innerHTML = p.risks.slice(0, 3).map((x) => `
      <div class="lp-cause"><div><span>${esc(x.cause[0].toUpperCase() + x.cause.slice(1))}</span><i>${x.count} of ${p.basedOn}</i></div>
      <div class="lp-bar"><span data-w="${Math.round((100 * x.count) / p.basedOn)}" style="${heroShown ? `width:${Math.round((100 * x.count) / p.basedOn)}%` : ""}"></span></div></div>`).join("");
    if (!heroShown) setTimeout(() => document.querySelectorAll(".lp-bar span").forEach((s) => (s.style.width = s.dataset.w + "%")), 250);
  }
  // one shut-down and one still-running company, as little floating cards
  const d0 = dead.find((c) => nice(c.one_line)), a0 = alive.find((c) => nice(c.one_line));
  if (d0) document.getElementById("lp-dead").innerHTML = `<span class="tag">✕ Shut down${real(d0.closed_year) ? " · " + real(d0.closed_year) : ""}</span><b>${esc(d0.name)}</b><p>${esc(clip(d0.one_line, 70))}</p>`;
  if (a0) document.getElementById("lp-alive").innerHTML = `<span class="tag">● Still running</span><b>${esc(a0.name)}</b><p>${esc(clip(a0.one_line, 70))}</p>`;
  heroShown = true;
  document.querySelector(".lp-main")?.classList.remove("loading");
}
try { const saved = JSON.parse(localStorage.getItem(HERO_KEY)); if (saved) paintHero(saved); } catch { /* no saved copy */ }
loaded[HERO].then((d) => {
  const s = slim(d);
  if (s) { paintHero(s); try { localStorage.setItem(HERO_KEY, JSON.stringify(s)); } catch { /* private mode */ } }
  else if (!heroShown) paintHero(null);
});

function clip(t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n - 1).trim() + "…" : t; }

// Count a number up quickly, then slow down at the end.
function countTo(el, to) {
  const start = performance.now(), ms = 1200;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- example reports (live risk scores) ----------
const exBox = document.getElementById("l-examples");
exBox.innerHTML = EXAMPLES.map(() => `<div class="feature l-ex loading"></div>`).join("");
Promise.all(loaded).then((all) => {
  const cards = all.map((d, i) => {
    const e = EXAMPLES[i], r = d && d.risk;
    if (!r || r.score === null || r.score === undefined) return "";
    const main = d.companies.filter((c) => c.group === "shut down" || c.group === "running");
    const dead = main.filter((c) => c.group === "shut down").length;
    const top = d.premortem && d.premortem.available && d.premortem.risks[0];
    return `<a class="feature l-ex" href="${reportLink(e)}">
      <div class="ex-top"><span class="ex-score"><span data-n="${r.score}">${STILL ? r.score : 0}</span><small>/100</small></span><span class="ex-label ${riskClass(r.label)}">${esc(r.label)} risk</span></div>
      <h3>${esc(e.title)}</h3>
      <p>${dead} of ${main.length} companies shut down</p>
      <div class="ex-split" title="Shut down vs still running"><span style="flex:${STILL ? dead : 0} 0 0" data-f="${dead}"></span><i style="flex:${STILL ? main.length - dead : 1} 0 0" data-f="${main.length - dead}"></i></div>
      <span class="ex-go">Open report →</span>
    </a>`;
  }).join("");
  if (cards) { exBox.innerHTML = cards; examplesReady = true; if (examplesSeen) revealExamples(); }
  else exBox.closest("section").remove(); // no data right now: hide the section rather than show empty boxes
});

// ---------- email sign-up ----------
const form = document.getElementById("signup");
const msg = document.getElementById("signup-msg");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const consent = document.getElementById("consent").checked;
  const say = (text, ok) => { msg.textContent = text; msg.className = "l-msg " + (ok ? "ok" : "err"); };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return say("Please enter a valid email address.");
  if (!consent) return say("Please tick the box to agree to receive emails.");
  const btn = form.querySelector("button");
  btn.disabled = true; btn.textContent = "Signing up…";
  try {
    const r = await api("/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent: true, source: "landing" }) });
    say(r.already ? "You're already on the list — thanks!" : "You're in! We'll be in touch when there's something new.", true);
    form.reset();
  } catch (err) {
    say(err.message);
  } finally {
    btn.disabled = false; btn.textContent = "Notify me";
  }
});

// ---------- sections rise in gently as you scroll ----------
const sections = document.querySelectorAll(".shell > section:not(.l-hero), .footer");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((list) => list.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: 0.08 });
  sections.forEach((s) => { s.classList.add("l-rise"); io.observe(s); });
}


// ======================= scroll effects =======================
// Smooth scrolling, a reading-progress line, word-by-word headlines, cards that tilt into place,
// a ticker of real shut-downs, a pinned "how it works", depth, and a final call to action that grows.
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// split headings into words (keeps inner spans like the orange accent and the marker highlight)
function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else { const w = document.createElement("span"); w.className = "w"; w.style.setProperty("--i", i++); w.textContent = part; frag.appendChild(w); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el); el.classList.add("split");
}

// children of a grid tilt up into place one after another; the classes are removed afterwards so hover effects still work
function revealChildren(box) {
  const kids = [...box.children];
  kids.forEach((k, i) => { k.classList.add("st"); k.style.setProperty("--i", i); });
  requestAnimationFrame(() => requestAnimationFrame(() => kids.forEach((k) => k.classList.add("st-in"))));
  setTimeout(() => kids.forEach((k) => k.classList.remove("st", "st-in")), 1000 + kids.length * 90);
}
function revealExamples() {
  revealChildren(exBox);
  exBox.querySelectorAll("[data-n]").forEach((el) => {
    const n = +el.dataset.n, t0 = performance.now();
    const tick = (now) => { const k = clamp01((now - t0) / 1300); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
    setTimeout(() => requestAnimationFrame(tick), 250);
  });
  setTimeout(() => exBox.querySelectorAll("[data-f]").forEach((el) => (el.style.flex = `${el.dataset.f} 0 0`)), 120);
}

if (!STILL && "IntersectionObserver" in window) {
  const heads = [...document.querySelectorAll(".l-hero h1, .h-section, .l-final h2")];
  heads.forEach(splitWords);
  const grids = [...document.querySelectorAll(".features, .l-gets, .l-who, .l-rules, .l-faq")];
  grids.forEach((g) => [...g.children].forEach((k) => k.classList.add("st")));
  const seen = new IntersectionObserver((list) => list.forEach((x) => {
    if (!x.isIntersecting) return;
    const el = x.target; seen.unobserve(el);
    if (el.classList.contains("split")) el.classList.add("in");
    else if (el === exBox) { examplesSeen = true; if (examplesReady) revealExamples(); }
    else revealChildren(el);
  }), { threshold: 0.18 });
  heads.concat(grids, [exBox]).forEach((el) => seen.observe(el));
} else {
  examplesSeen = true;
}

// ticker of real shut-down companies (speeds up and follows your scroll direction)
(async () => {
  const track = document.getElementById("l-ticker");
  if (!track) return;
  let list = [];
  try { list = (await (await fetch(API + "/graveyard")).json()).companies.filter((c) => c.closed && !/not reported/i.test(c.cause)); } catch { /* ticker stays empty */ }
  if (!list.length) { track.parentElement.remove(); return; }
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const items = list.slice(0, 40).map((c) => `<span><i>✕</i><b>${esc(c.name)}</b><em>${c.closed} · ${esc(c.cause)}</em></span>`).join("");
  track.innerHTML = items + items;              // twice, so it loops seamlessly
  tickerReady = true;
})();
let tickerReady = false, tickerX = 0, tickerDir = -1;

// one light loop: work happens only when you've scrolled (the ticker runs only while it's on screen)
const bar = document.querySelector(".l-progress span");
const pin = document.getElementById("how-pin"), steps = [...document.querySelectorAll(".l-steps li")], fill = document.getElementById("l-steps-fill");
const finalSec = document.querySelector(".l-final"), finalTitle = document.getElementById("l-final-title");
const panes = [...document.querySelectorAll(".l-pane")], miniRing = document.getElementById("l-mini-ring");
let miniScore = null;
// the demo's last step shows the real 10-minute-delivery premortem
loaded[1].then((d) => {
  const r = d && d.risk; if (!r || r.score == null) return;
  miniScore = r.score;
  document.getElementById("l-mini-score").textContent = r.score;
  document.getElementById("l-mini-label").textContent = `${r.label} risk`;
  const p = d.premortem || {}, main = d.companies.filter((c) => c.group === "shut down" || c.group === "running"), dead = main.filter((c) => c.group === "shut down").length;
  if (p.available && p.risks[0]) document.getElementById("l-mini-cause").textContent = p.risks[0].cause[0].toUpperCase() + p.risks[0].cause.slice(1);
  document.getElementById("l-mini-dead").textContent = `${dead} of ${main.length} companies shut down`;
});
let tickerOnScreen = true;
const tickerEl = document.querySelector(".l-ticker");
if (tickerEl && "IntersectionObserver" in window) new IntersectionObserver((e) => (tickerOnScreen = e[0].isIntersecting)).observe(tickerEl);
let lastY = -1, lastT = performance.now(), vel = 0, stepIdx = -1, lastFinal = -1;
function onScroll() {
  const y = scrollY, max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  if (bar) bar.style.transform = `scaleX(${(y / max).toFixed(4)})`;
  if (STILL) return;
  if (pin && innerWidth > 760) {
    const r = pin.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) {
      const k = clamp01(-r.top / Math.max(1, r.height - innerHeight + 92));
      const idx = Math.min(steps.length - 1, Math.floor(k * steps.length * 1.05));
      if (idx !== stepIdx) {
        stepIdx = idx;
        steps.forEach((s, i) => { s.classList.toggle("on", i <= idx); s.classList.toggle("now", i === idx); });
        panes.forEach((pn, i) => pn.classList.toggle("on", i === idx));
        if (idx === 3 && miniRing && miniScore !== null) miniRing.style.strokeDashoffset = String(314.2 * (1 - miniScore / 100));
      }
      if (fill) fill.style.width = `${Math.min(100, ((idx + 1) / steps.length) * 100)}%`;
    }
  }
  if (finalSec && finalTitle) {
    const r = finalSec.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) {
      const k = Math.round(clamp01((innerHeight - r.top) / (innerHeight * 0.75)) * 50) / 50;
      if (k !== lastFinal) { lastFinal = k; finalTitle.style.transform = `scale(${(0.9 + 0.1 * k).toFixed(3)})`; finalTitle.style.opacity = (0.45 + 0.55 * k).toFixed(3); }
    }
  }
}
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
onScroll();
if (STILL) steps.forEach((s) => s.classList.add("on"));
// the ticker: always drifting while visible; faster (and following your direction) while you scroll
function tickerLoop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const y = scrollY;
  if (lastY >= 0) { const v = (y - lastY) / Math.max(dt, 0.001); vel += (v - vel) * 0.25; }
  lastY = y;
  if (tickerReady && tickerOnScreen && !STILL) {
    const track = document.getElementById("l-ticker");
    if (Math.abs(vel) > 30) tickerDir = vel > 0 ? -1 : 1;
    tickerX += tickerDir * (45 + Math.min(700, Math.abs(vel) * 0.5)) * dt;
    const half = track.scrollWidth / 2;
    if (tickerX <= -half) tickerX += half; if (tickerX > 0) tickerX -= half;
    track.style.transform = `translate3d(${tickerX.toFixed(1)}px, 0, 0)`;
  }
  requestAnimationFrame(tickerLoop);
}
requestAnimationFrame(tickerLoop);
// (menu links use the browser's own smooth scrolling)


// ---------- "What you get": one real number + one simple graphic per card ----------
(async () => {
  let d;
  try { d = await api("/insights"); } catch { return; }       // keep the simple drawings if this fails
  const set = (id, html) => { const el = document.getElementById(id); if (el) { el.classList.add("ins"); el.innerHTML = html; } return el; };
  // 1. your odds: every business type we've scored, as dots on a low → high line
  if (d.types.length >= 3) set("ins-risk", `<div class="ins-big">${d.types[0].score}–${d.types[d.types.length - 1].score}</div><div class="ins-cap">${d.types.length} business types</div>
    <div class="ins-spec"><div class="track"></div>${d.types.map((t, i) => `<i style="left:${t.score}%;transition-delay:${(i * 0.04).toFixed(2)}s"></i>`).join("")}</div>`);
  // 2. how they died: the #1 cause, and the top three as bars
  if (d.causes.length) {
    const max = d.causes[0][1];
    set("ins-causes", `<div class="ins-big">${d.causes[0][1]}</div><div class="ins-cap">ran out of money</div>
      <div class="ins-bars">${d.causes.slice(0, 3).map(([, n]) => `<span><em data-w="${Math.round((100 * n) / max)}"></em></span>`).join("")}</div>`);
    if (!/money/.test(d.causes[0][0])) document.querySelector("#ins-causes .ins-cap").textContent = d.causes[0][0];
  }
  // 3. red flags: a simple yes / yes / no
  set("ins-flag", `<div class="ins-big">30<small>s</small></div><div class="ins-cap">yes / no questions</div>
    <div class="ins-flags"><i class="y">✓</i><i class="y">✓</i><i class="n">✕</i><i class="y">✓</i></div>`);
  // 4. who tried it: how long the shut-downs lasted
  if (d.lifespans.length >= 10) {
    const s = [...d.lifespans].sort((x, y) => x - y), med = s[Math.floor(s.length / 2)];
    const bins = [[0, 1], [1, 2], [2, 3], [3, 5], [5, 10], [10, 99]];
    const counts = bins.map(([x, y]) => s.filter((v) => v >= x && v < y).length), max = Math.max(...counts);
    set("ins-life", `<div class="ins-big">${med}<small> yrs</small></div><div class="ins-cap">median life of a shut-down</div>
      <div class="ins-hist">${bins.map(([x, y], i) => `<em class="${med >= x && med < y ? "med" : ""}" data-h="${Math.max(6, Math.round((100 * counts[i]) / max))}"></em>`).join("")}</div>`);
  }
  const play = () => document.querySelectorAll(".l-viz.ins").forEach((v) => {
    v.classList.add("on");
    v.querySelectorAll("[data-w]").forEach((e) => (e.style.width = e.dataset.w + "%"));
    v.querySelectorAll("[data-h]").forEach((e) => (e.style.height = e.dataset.h + "%"));
  });
  const box = document.querySelector(".l-gets");
  if (STILL || !("IntersectionObserver" in window) || !box) return play();
  const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); setTimeout(play, 350); } }, { threshold: 0.3 });
  io.observe(box);
})();

// ---------- the 30-second film: nothing downloads until someone presses play ----------
(() => {
  const v = document.getElementById("l-film"), btn = document.getElementById("l-film-play"), box = document.getElementById("film");
  if (!v || !btn) return;
  btn.addEventListener("click", () => {
    box.classList.add("playing"); v.controls = true; v.muted = false;
    const p = v.play(); if (p && p.catch) p.catch(() => { box.classList.remove("playing"); });
  });
  v.addEventListener("ended", () => { box.classList.remove("playing"); v.controls = false; v.currentTime = 0; v.load(); });
  // pause if it scrolls well out of view
  if ("IntersectionObserver" in window) new IntersectionObserver((e) => { if (!e[0].isIntersecting && !v.paused) v.pause(); }, { threshold: 0.15 }).observe(v);
})();
