// premortem — the website. Screens: home → loading → results (+ one-page report).
// Talks to our Catalyst "api" function.

const API = location.hostname.endsWith("catalystserverless.in")
  ? "/server/api"
  : "https://whotriedit-60093906253.development.catalystserverless.in/server/api";

const app = document.getElementById("app");
const panel = document.getElementById("panel");
const overlay = document.getElementById("overlay");

const EXAMPLES = ["10-minute grocery delivery", "Cloud kitchen for healthy meals", "Bike taxi app in Bangalore", "Home-cooked tiffin service", "Homegrown sneaker brand"];
const MIN_IDEA = 10; // characters

// ---------- small helpers ----------
// Everything from articles is shown as plain text, never as HTML.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
const siteUrl = (w) => (w ? (/^https?:/i.test(w) ? w : `https://${w}`) : "");
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "");
const nice = (v) => (v && !/not reported/i.test(v) ? v : "");
const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

async function api(path, options) {
  const res = await fetch(API + path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

// ---------- router: #/  ·  #/search/<id>?idea=…  ·  #/results/<niche>?idea=…  ·  #/report/<niche>?idea=… ----------
let pendingScroll = "";
function route() {
  closePanel();
  if (!location.hash.startsWith("#/search/")) stopNight();
  const [path, query] = location.hash.slice(1).split("?");
  const params = new URLSearchParams(query || "");
  const parts = (path || "/").split("/").filter(Boolean);
  if (!pendingScroll) window.scrollTo(0, 0);
  if (parts[0] === "search") return showLoading(parts[1], params.get("idea") || "");
  if (parts[0] === "results") return showResults(decodeURIComponent(parts[1] || ""), params.get("idea") || "");
  if (parts[0] === "report") return showReport(decodeURIComponent(parts[1] || ""), params.get("idea") || "", params.get("print") === "1");
  showHome();
}
window.addEventListener("hashchange", route);

// "How it works" / "Run a premortem" links: go home if needed, then scroll to that section.
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-scroll]");
  if (!link) return;
  e.preventDefault();
  const target = link.dataset.scroll;
  if (document.getElementById(target)) return scrollToSection(target);
  pendingScroll = target;
  location.hash = "#/";
});
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  if (id === "search") setTimeout(() => document.getElementById("idea")?.focus({ preventScroll: true }), 400);
}

// ======================= 1. HOME =======================
let stats = null;
async function loadStats() {
  try { stats = await api("/stats"); } catch { stats = null; }
  // Real numbers only, and only once they're big enough to be meaningful (rounded down, e.g. "2,000+").
  const tiles = document.getElementById("hero-tiles");
  if (!stats || !tiles) return;
  const round = (n) => fmt(Math.floor(n / 500) * 500) + "+";
  const show = [];
  if (stats.companies >= 2000) show.push([round(stats.companies), "Companies tracked"]);
  if (stats.shut_down >= 500) show.push([round(stats.shut_down), "Shut-downs studied"]);
  show.forEach(([n, label], i) => { tiles.children[i].innerHTML = `<strong>${n}</strong><span class="label">${label}</span>`; });
}

// Numbers count up fast at first and slow down at the end (ease-out), once they're on screen.
function countUp(root = document) {
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const run = (el) => {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    if (el.dataset.type) { // words type in letter by letter
      const word = el.dataset.type; let i = 0;
      const tick = () => { el.textContent = word.slice(0, ++i); if (i < word.length) setTimeout(tick, 70 + i * 12); };
      return tick();
    }
    const end = Number(el.dataset.count), suffix = el.dataset.suffix || "", start = performance.now(), ms = 1600;
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = fmt(Math.round(end * easeOut(t))) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const els = root.querySelectorAll("[data-count], [data-type]");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    els.forEach((el) => { el.textContent = el.dataset.type || fmt(el.dataset.count) + (el.dataset.suffix || ""); });
    return;
  }
  const seen = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { run(e.target); seen.unobserve(e.target); } }), { threshold: 0.6 });
  els.forEach((el) => seen.observe(el));
}

function showHome(error = "", idea = "") {
  document.title = "premortem — see who already tried your idea";
  app.innerHTML = `
    <section class="card hero">
      <div>
        <span class="pill">✦ Startup pre-mortem engine</span>
        <h1>See who already tried your idea — <span class="accent">and how they failed.</span></h1>
        <p class="lead">Describe your business idea in one line. premortem finds the companies that tried it, shows how the ones that shut down died, and gives you a risk score and warning signs — before you spend a rupee.</p>
        <div class="proof"><span class="dot"></span><span>Every company linked to its source · <b>new shut-downs added nightly</b></span></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a class="btn btn-signal" href="#/" data-scroll="search">Run a premortem →</a>
          <a class="btn btn-ghost" href="#/" data-scroll="how">How it works</a>
        </div>
        <div class="tiles" id="hero-tiles">
          <div class="tile"><strong data-count="116">0</strong><span class="label">Business types</span></div>
          <div class="tile"><strong data-count="6">0</strong><span class="label">Search angles</span></div>
          <div class="tile"><strong data-count="100" data-suffix="%">0%</strong><span class="label">Sourced</span></div>
          <div class="tile"><strong>Nightly</strong><span class="label">Updates</span></div>
        </div>
      </div>

      <aside class="engine" aria-label="How a premortem works">
        <div class="engine-glow" aria-hidden="true"></div>
        <div class="engine-head">
          <span class="engine-title">How a premortem works</span>
          <span class="live"><i></i>Updated nightly</span>
        </div>

        <div class="sample" id="sample">
          <svg class="ring" viewBox="0 0 88 88" aria-hidden="true">
            <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2994A"/><stop offset="1" stop-color="#E4502F"/></linearGradient></defs>
            <circle cx="44" cy="44" r="38" class="ring-track"/>
            <circle cx="44" cy="44" r="38" class="ring-fill" id="ring-fill" stroke-dasharray="238.8" stroke-dashoffset="238.8"/>
          </svg>
          <div class="ring-num"><b id="sample-score">–</b><span>/100</span></div>
          <div class="sample-text">
            <span class="eyebrow">Sample report · live data</span>
            <strong>“Bike taxi app”</strong>
            <span id="sample-line1">Loading…</span>
            <span id="sample-line2"></span>
          </div>
        </div>

        <div class="eyebrow eyebrow-gap">The process</div>
        <ol class="timeline">
          <li><span class="tl-dot">1</span><div><b>Sort your idea</b><small>Matched to one of 116 business types</small></div><time>~3s</time></li>
          <li><span class="tl-dot">2</span><div><b>Search six angles</b><small>Shut-downs, founder posts, survivors</small></div><time>~10s</time></li>
          <li><span class="tl-dot">3</span><div><b>Read &amp; fact-check</b><small>No source, no company</small></div><time>~60s</time></li>
          <li><span class="tl-dot">4</span><div><b>Build your premortem</b><small>Causes, risk score, red flags</small></div><time>~10s</time></li>
        </ol>

        <div class="byline">
          <span class="eyebrow">Read from</span>
          <p>${["Inc42", "YourStory", "Economic Times", "Mint", "TechCrunch", "founders’ own posts"].map((n) => `<span>${n}</span>`).join("")}</p>
        </div>
      </aside>
    </section>

    <section class="card search-card" id="search">
      <span class="pill">Start a premortem</span>
      <h2>Describe the business you want to build</h2>
      <p class="sub">One line is enough. Say what you sell, who it’s for and where — specific beats generic.</p>
      <div class="hint-chips" aria-label="Tips for a good idea line">
        <span>What you sell</span><span>Who it’s for</span><span>Where</span><span>Your angle</span>
      </div>
      <form class="idea-box" id="search-form">
        <textarea id="idea" maxlength="200" placeholder="e.g. A 10-minute pet food delivery app for busy pet parents in Pune" aria-label="Your business idea in one line">${esc(idea)}</textarea>
        <div class="idea-foot">
          <span class="faint">Minimum ${MIN_IDEA} characters. Only this line is sent to our AI. <span class="count" id="count">0 chars</span></span>
          <button class="btn btn-signal" type="submit" id="go">Run the premortem →</button>
        </div>
        ${error ? `<p class="error">${esc(error)}</p>` : ""}
      </form>
      <div class="examples">Or try: ${EXAMPLES.map((e) => `<button class="chip" type="button">${esc(e)}</button>`).join("")}</div>
    </section>

    <section class="card" id="how">
      <span class="pill">Why founders use premortem</span>
      <div class="why-head">
        <h2 class="h-section">Built for the question every founder skips.</h2>
        <p>Most tools show you the winners. premortem shows you the graveyard — the companies that tried your idea and didn’t make it, and exactly why — so you can avoid the same mistakes.</p>
      </div>
      <div class="features">
        <div class="feature"><div class="ico">%</div><h3>Risk score</h3><p>One number out of 100, built from what happened to companies like yours — with the maths shown.</p></div>
        <div class="feature"><div class="ico">!</div><h3>How it could fail</h3><p>The top causes of death, real examples with quotes, and an early warning sign for each.</p></div>
        <div class="feature"><div class="ico">⚑</div><h3>Your red flags</h3><p>A 30-second checklist built from those failures, so you see what applies to you.</p></div>
        <div class="feature"><div class="ico">✓</div><h3>Nothing made up</h3><p>Every company comes from a real article, linked on its card. If a reason isn’t reported, we say so.</p></div>
      </div>
    </section>`;

  const input = document.getElementById("idea");
  const count = document.getElementById("count");
  const go = document.getElementById("go");
  const update = () => { count.textContent = `${input.value.trim().length} chars`; go.disabled = input.value.trim().length < MIN_IDEA; };
  input.addEventListener("input", update);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!go.disabled) startSearch(input.value); } });
  document.getElementById("search-form").addEventListener("submit", (e) => { e.preventDefault(); startSearch(input.value); });
  app.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => { input.value = chip.textContent; update(); startSearch(chip.textContent); }));
  update();
  countUp(app);
  loadStats();
  loadSample();
  if (pendingScroll) { const t = pendingScroll; pendingScroll = ""; setTimeout(() => scrollToSection(t), 50); }
  if (error) setTimeout(() => scrollToSection("search"), 50);
}

// Real numbers for the sample card on the home page (bike taxi), so visitors see a live example.
async function loadSample() {
  try {
    const d = await api(`/results?niche=${encodeURIComponent("bike taxi")}`);
    const r = d.risk || {}, p = d.premortem || {};
    const main = d.companies.filter((c) => c.group === "shut down" || c.group === "running");
    const dead = main.filter((c) => c.group === "shut down").length;
    if (r.score === null || r.score === undefined) return;
    document.getElementById("sample-score").textContent = r.score;
    document.getElementById("ring-fill").style.strokeDashoffset = String(238.8 * (1 - r.score / 100));
    document.getElementById("sample-line1").textContent = `${r.label} risk · ${dead} of ${main.length} shut down`;
    if (p.available && p.risks[0]) document.getElementById("sample-line2").textContent = `#1 cause: ${p.risks[0].cause}`;
  } catch { document.getElementById("sample")?.remove(); }
}

async function startSearch(idea) {
  idea = idea.trim().replace(/^[•·▪◦*\-–—>\s]+/, "").trim(); // drop pasted bullet marks
  if (idea.length < MIN_IDEA) return showHome("Please describe your idea in a few more words.", idea);
  const go = document.getElementById("go");
  if (go) go.textContent = "Starting…";
  try {
    const r = await api("/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea }) });
    const q = `?idea=${encodeURIComponent(idea)}`;
    try { if (r.note) sessionStorage.setItem("premortem-note", r.note); } catch { /* private mode */ }
    location.hash = r.state === "done" ? `#/results/${encodeURIComponent(r.niche)}${q}` : `#/search/${r.id}${q}`;
  } catch (err) {
    showHome(err.message, idea);
  }
}

// ======================= 2. LOADING =======================
// Six steps; the server's progress messages tell us which one we're on.
const STEPS = [
  { name: "Understanding your idea", desc: "Sorting your idea into the right business type.", icon: "✦", secs: 4 },
  { name: "Searching 6 angles", desc: "Looking for shut-downs, founder stories and survivors.", icon: "⌕", secs: 10 },
  { name: "Reading articles", desc: "Reading every article we found.", icon: "≡", secs: 35 },
  { name: "Finding companies", desc: "Listing every company that tried this.", icon: "◎", secs: 20 },
  { name: "Checking facts", desc: "Checking each company against its sources.", icon: "✓", secs: 20 },
  { name: "Building your premortem", desc: "Working out how ideas like this fail.", icon: "⚑", secs: 10 },
];
const TOTAL_SECS = STEPS.reduce((t, s) => t + s.secs, 0);
const stepFromProgress = (p = "") =>
  /^Searching/.test(p) ? 1 : /^Reading/.test(p) ? 2 : /^Found/.test(p) ? 3 : /^Checking companies|^Saving/.test(p) ? 4 : /^Working out/.test(p) ? 5 : /^Done/.test(p) ? 6 : 0;
// Real progress inside a step, from messages like "Checking companies 24 of 48…" or "(part 2 of 3)".
const fractionFrom = (p = "") => { const m = p.match(/(\d+) of (\d+)/); return m && Number(m[2]) ? Number(m[1]) / Number(m[2]) : null; };

let pollTimer = null, tickTimer = null;
// The live 3D loading scene (newsroom.js). Loaded only when needed; the normal card still works without it.
let night = null;
function startNight(idea) {
  if (night || document.body.classList.contains("night-mode") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.body.classList.add("night-mode");
  import("./newsroom.js?v=3")
    .then((m) => {
      if (!document.body.classList.contains("night-mode")) return;
      night = m.startNewsroom({ idea });
      if (!night) document.body.classList.remove("night-mode");
    })
    .catch(() => document.body.classList.remove("night-mode"));
}
function stopNight() {
  if (night) night.stop();
  night = null;
  document.body.classList.remove("night-mode");
}

function showLoading(id, idea) {
  document.title = "Researching… — premortem";
  startNight(idea);
  app.innerHTML = `
    <section class="card progress-card" aria-live="polite">
      <span class="pill">● Premortem in progress</span>
      <div class="progress-top">
        <div>
          <h2>Researching ideas like yours</h2>
          <p class="sub">“${esc(idea)}” — the first search for this kind of business takes a minute or two.</p>
        </div>
        <span class="remaining" id="remaining">~1:40 remaining</span>
      </div>
      <div class="big-bar"><span id="overall"></span></div>
      <div class="current">
        <div class="ico" id="cur-ico">✦</div>
        <div><span class="label">Current step</span><b id="cur-name">${STEPS[0].name}</b><div class="desc" id="cur-desc">${STEPS[0].desc}</div></div>
        <div class="step-prog"><div class="row"><span>Step progress</span><span id="step-pct">0%</span></div><div class="bar"><span id="step-bar"></span></div></div>
      </div>
      <div class="steps">${STEPS.map((s, i) => `<div class="step" data-step="${i}"><span class="i">${s.icon}</span>${s.name}</div>`).join("")}</div>
      <p class="loading-hint" id="live-msg">Starting research…</p>
    </section>`;

  const started = Date.now();
  let step = 0, stepStarted = Date.now(), done = false;
  let realFraction = null;           // from the server, when it tells us "24 of 48"
  let lastMessage = "", lastChange = Date.now();
  let shown = 0;                      // what the step bar shows (smoothed, never goes backwards)

  const paint = () => {
    const s = STEPS[Math.min(step, 5)];
    const elapsedInStep = (Date.now() - stepStarted) / 1000;
    // Real fraction if we have it; otherwise creep forward slowly (never freezes, never quite reaches 100%).
    const target = done ? 1 : realFraction !== null ? Math.max(realFraction, 0.02) : 0.9 * (1 - Math.exp(-elapsedInStep / s.secs));
    shown = Math.max(shown, shown + (target - shown) * 0.25);
    const before = STEPS.slice(0, step).reduce((t, x) => t + x.secs, 0);
    const overall = done ? 1 : Math.min(0.99, (before + shown * s.secs) / TOTAL_SECS);
    // Time left from the real pace so far (after a few seconds), else from typical step times.
    const elapsed = (Date.now() - started) / 1000;
    const left = done ? 0 : Math.max(5, Math.round(overall > 0.15 ? (elapsed * (1 - overall)) / overall : TOTAL_SECS * (1 - overall)));
    const $ = (x) => document.getElementById(x);
    if (!$("overall")) return;
    $("overall").style.width = `${Math.round(overall * 100)}%`;
    $("step-bar").style.width = `${Math.round(shown * 100)}%`;
    $("step-pct").textContent = `${Math.round(shown * 100)}%`;
    $("remaining").textContent = done ? "Done ✓" : `~${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} remaining`;
    $("cur-ico").textContent = s.icon; $("cur-name").textContent = s.name; $("cur-desc").textContent = s.desc;
    document.querySelectorAll(".step").forEach((el) => {
      const i = Number(el.dataset.step);
      el.className = `step ${i < step || done ? "done" : i === step ? "now" : ""}`;
    });
    // Quiet for a while? Reassure instead of looking stuck.
    if (!done && Date.now() - lastChange > 20000) $("live-msg").textContent = `${lastMessage.replace(/…$/, "")} — still working, big business types take a little longer…`;
  };

  clearTimeout(pollTimer); clearInterval(tickTimer);
  tickTimer = setInterval(() => { if (!location.hash.startsWith(`#/search/${id}`)) return clearInterval(tickTimer); paint(); }, 400);
  const poll = async () => {
    if (!location.hash.startsWith(`#/search/${id}`)) return;
    try {
      const s = await api(`/status?id=${encodeURIComponent(id)}`);
      const next = s.state === "done" ? 6 : stepFromProgress(s.progress);
      if (night) night.feed(s.feed);
      if (next > step) { step = next; stepStarted = Date.now(); shown = 0; realFraction = null; }
      if (next === step) realFraction = fractionFrom(s.progress);
      if (s.progress && s.progress !== lastMessage) {
        lastMessage = s.progress; lastChange = Date.now();
        if (night) night.beat();
        const el = document.getElementById("live-msg");
        if (el) el.textContent = s.progress.startsWith("Done") ? "Finishing up…" : s.progress;
      }
      if (s.state === "done") {
        done = true; paint(); clearInterval(tickTimer);
        if (night) night.finish();
        return setTimeout(() => (location.hash = `#/results/${encodeURIComponent(s.niche)}?idea=${encodeURIComponent(idea)}`), night ? 1500 : 600);
      }
      if (s.state === "failed") { clearInterval(tickTimer); return showHome("The research didn’t finish. Please try again in a minute.", idea); }
    } catch { /* keep trying */ }
    pollTimer = setTimeout(poll, 2500);
  };
  paint();
  poll();
}

// ======================= 3. RESULTS =======================
let current = null; // { data, idea, filter, sort, showAll }
const FIRST_CARDS = 12;

async function showResults(niche, idea, keepView = false) {
  document.title = `${idea || niche} — premortem`;
  if (!keepView) app.innerHTML = `<section class="card"><div class="simple-loading"><span class="spinner"></span>Matching companies to your idea…</div></section>`;
  try {
    const data = await api(`/results?niche=${encodeURIComponent(niche)}&idea=${encodeURIComponent(idea)}`);
    const view = keepView && current ? { filter: current.filter, sort: current.sort, showAll: current.showAll } : { filter: "all", sort: "closest", showAll: false };
    current = { data, idea, ...view };
    renderResults();
    if (!keepView && window.playObituary) window.playObituary(data, idea); // first visit: the idea's obituary burns away
    if (data.deepening) followDeepening(data.deepening, niche, idea);
  } catch (err) {
    showHome(err.message, idea);
  }
}

// One-time message from the server (e.g. "today's research limit reached — showing saved results").
function takeNote() {
  let note = "";
  try { note = sessionStorage.getItem("premortem-note") || ""; sessionStorage.removeItem("premortem-note"); } catch { /* private mode */ }
  return note ? `<div class="notice">${esc(note)}</div>` : "";
}

const riskClass = (label) => ({ Low: "low", Medium: "medium", High: "high", "Very high": "very-high" }[label] || "");

function renderResults() {
  const { data, idea } = current;
  const main = data.companies.filter((c) => c.group === "shut down" || c.group === "running");
  const dead = main.filter((c) => c.group === "shut down").length;
  const p = data.premortem || {};
  const r = data.risk || {};
  const top = p.available && p.risks && p.risks[0];

  app.innerHTML = `
    <div class="ready">
      <span class="ready-text">✓ Your premortem is ready.</span>
      <span class="ready-actions">
        <a class="btn btn-signal btn-small" href="${reportLink(data.niche, idea, true)}">Summary report</a>
        <button type="button" class="btn btn-ghost btn-small" id="share">Share link</button>
        <a class="btn btn-ghost btn-small" href="#/" data-scroll="search">Try another idea</a>
      </span>
    </div>

    <section class="card report-head" id="overview">
      <span class="pill">Premortem report</span>
      <h1>“${esc(idea || data.niche)}”</h1>
      <p class="meta">Compared with <b>${data.companies.length}</b> companies in <b>${esc(data.niche)}</b>${data.last_run ? ` · last researched ${esc(data.last_run)}` : ""}</p>
      <div class="tiles result-tiles">
        <div class="tile tile-risk">${r.score === null || r.score === undefined
          ? `<strong>—</strong><span class="small">Not enough data yet</span>`
          : `<strong>${r.score}<span style="font-size:15px;color:var(--faint)">/100</span></strong><span class="small"><span class="risk-label ${riskClass(r.label)}">${esc(r.label)} risk</span></span>`}<span class="label">Risk score</span></div>
        <div class="tile"><strong>${dead} of ${main.length}</strong><span class="small">${main.length ? Math.round((100 * dead) / main.length) : 0}% shut down</span><span class="label">Shut down</span></div>
        <div class="tile"><strong style="font-size:18px">${top ? esc(cap(top.cause)) : "—"}</strong><span class="small">${top ? `${top.count} of ${p.basedOn} shut-downs` : "Not enough data yet"}</span><span class="label">#1 cause of death</span></div>
        <div class="tile" id="flags-tile"></div>
      </div>
      ${data.score && data.score.closestWarning ? `<div class="closest">${esc(data.score.closestWarning)}</div>` : ""}
      ${takeNote()}
    </section>

    <nav class="toc" aria-label="Sections">
      <a href="#overview">Overview</a>
      <a href="#fail">How it could fail</a>
      <a href="#flags">Your red flags</a>
      <a href="#who">Who tried it</a>
      <a href="#causes">Causes of death</a>
    </nav>

    ${failHtml(p)}
    <section class="card" id="flags"></section>

    <section class="card" id="who">
      <div class="section-head"><div><span class="pill">Who tried it</span><h2 class="h-section">Every company we found</h2>
        <p class="sub">Red = shut down, green = still running. Tap any card for its story and sources.</p></div></div>
      <div class="controls">
        <div class="filters" role="group" aria-label="Filter companies">
          ${[["all", "All", main.length], ["shut down", "Shut down", dead], ["running", "Still running", main.length - dead]]
            .map(([v, t, n]) => `<button type="button" data-filter="${v}" aria-pressed="${current.filter === v}">${t}<span class="n">${n}</span></button>`).join("")}
        </div>
        <select id="sort" aria-label="Sort companies">
          <option value="closest">Closest to your idea</option>
          <option value="newest">Newest</option>
          <option value="money">Most money raised</option>
        </select>
      </div>
      <div class="grid" id="grid"></div>
      ${moreGroupsHtml(data.companies)}
    </section>

    <div class="two-col" id="causes">
      ${causesHtml(main)}
      ${aboutHtml(data)}
    </div>`;

  // Clicks and controls
  document.getElementById("share").addEventListener("click", (e) => shareResults(data.niche, idea, e.target));
  app.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { current.filter = b.dataset.filter; current.showAll = false; renderResults(); document.getElementById("who").scrollIntoView(); }));
  const sort = document.getElementById("sort");
  sort.value = current.sort;
  sort.addEventListener("change", () => { current.sort = sort.value; renderGrid(main); });
  renderGrid(main);
  renderChecklist();
  revealOnView(app);
  app.querySelectorAll("details.more .card-co").forEach((el) => el.addEventListener("click", () => openPanel(data.companies[el.dataset.i])));
  highlightToc();
}

// Bars grow (fast, then easing in) and cards scan once, the first time they scroll into view.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function revealOnView(root = document) {
  const bars = root.querySelectorAll(".bar span[data-w]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    bars.forEach((b) => (b.style.width = b.dataset.w + "%"));
    return;
  }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    io.unobserve(el);
    el.style.width = el.dataset.w + "%";
  }), { threshold: 0.35 });
  bars.forEach((b) => io.observe(b));
}

// A card scans only after the mouse has rested on it for 1 second — one card at a time.
let scanTimer = null;
document.addEventListener("mouseover", (e) => {
  const card = e.target.closest(".card-co");
  if (!card || reduceMotion || card.contains(e.relatedTarget)) return;
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    document.querySelectorAll(".card-co.scanning").forEach((c) => c.classList.remove("scanning"));
    void card.offsetWidth; // restart the animation
    card.classList.add("scanning");
  }, 1000);
});
document.addEventListener("mouseout", (e) => {
  const card = e.target.closest(".card-co");
  if (!card || card.contains(e.relatedTarget)) return;
  clearTimeout(scanTimer);
  card.classList.remove("scanning");
});
document.addEventListener("animationend", (e) => { if (e.animationName === "scan") e.target.closest(".card-co")?.classList.remove("scanning"); });

// Section menu: highlight the section you're reading.
function highlightToc() {
  const links = [...document.querySelectorAll(".toc a")];
  const onScroll = () => {
    if (!document.querySelector(".toc")) return window.removeEventListener("scroll", onScroll);
    let active = links[0];
    for (const a of links) { const el = document.querySelector(a.getAttribute("href")); if (el && el.getBoundingClientRect().top < 180) active = a; }
    links.forEach((a) => a.classList.toggle("on", a === active));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  links.forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); document.querySelector(a.getAttribute("href")).scrollIntoView({ behavior: "smooth" }); }));
  onScroll();
}

// Few close matches → the server is researching this exact idea. Show a notice, then refresh.
function followDeepening(id, niche, idea) {
  document.getElementById("overview").insertAdjacentHTML("beforeend", `<div class="notice deepening"><span class="spinner"></span><span id="deep-progress">We found only a few companies very close to your idea, so we’re searching for more. This takes about a minute…</span></div>`);
  const here = location.hash;
  const poll = async () => {
    if (location.hash !== here) return;
    try {
      const s = await api(`/status?id=${encodeURIComponent(id)}`);
      if (s.state === "done") return showResults(niche, idea, true);
      if (s.state === "failed") return document.querySelector(".deepening")?.remove();
      const el = document.getElementById("deep-progress");
      if (el && s.progress && !s.progress.startsWith("Done")) el.textContent = `Searching for more companies like yours: ${s.progress}`;
    } catch { /* keep trying */ }
    setTimeout(poll, 4000);
  };
  setTimeout(poll, 4000);
}

// ---------- How your idea could fail (with the pattern inside) ----------
function failHtml(p) {
  const head = `<section class="card" id="fail"><div class="section-head"><div><span class="pill">How it could fail</span><h2 class="h-section">How ideas like yours died</h2>`;
  if (!p || !p.available) return `${head}</div></div><p class="note" style="margin-top:16px">${esc((p && p.note) || "We haven’t found enough companies that shut down to say how ideas like this fail yet.")}</p></section>`;
  return `${head}<p class="sub">Based on ${p.basedOn} companies like this that shut down${p.notReported ? ` (${p.notReported} didn’t say why)` : ""}.</p></div></div>
    ${p.risks.map((r, i) => `
      <div class="risk">
        <div class="risk-num">${i + 1}</div>
        <div>
          <h3>${esc(cap(r.cause))}</h3>
          <div class="risk-count"><div class="bar dark"><span data-w="${Math.round((100 * r.count) / p.basedOn)}"></span></div>${r.count} of ${p.basedOn} shut-downs ${r.count < 2 ? `<span class="weak">· only one case so far</span>` : ""}</div>
          <ul class="examples-list">
            ${r.examples.map((e) => `<li><strong>${esc(e.name)}</strong> — ${e.quoted ? `<q>${esc(e.proof)}</q>` : esc(e.proof)}${safeUrl(e.source) ? ` <a href="${esc(e.source)}" target="_blank" rel="noopener">${esc(host(e.source))} ↗</a>` : ""}</li>`).join("")}
          </ul>
          ${r.survivors && r.survivors.length ? `<p class="survivors"><strong>How survivors handled it:</strong> ${r.survivors.map((s) => `${esc(s.name)} — ${esc(s.how)}`).join("; ")}</p>` : ""}
          ${r.warning_sign ? `<div class="warning"><strong>Warning sign to watch for:</strong> ${esc(r.warning_sign)}</div>` : ""}
        </div>
      </div>`).join("")}
    ${p.pattern && (p.pattern.shut_down || p.pattern.running) ? `<div class="pattern">
      ${p.pattern.shut_down ? `<div class="dead"><span class="label">The pattern · shut down</span>${esc(p.pattern.shut_down)}</div>` : ""}
      ${p.pattern.running ? `<div class="alive"><span class="label">The pattern · still running</span>${esc(p.pattern.running)}</div>` : ""}
    </div>` : ""}
  </section>`;
}

// ---------- Your personal pre-mortem (answers stay in this browser) ----------
const answersKey = (niche, idea) => `pm-answers:${niche}:${idea.toLowerCase()}`;
function loadAnswers(niche, idea) { try { return JSON.parse(localStorage.getItem(answersKey(niche, idea)) || "{}"); } catch { return {}; } }
function saveAnswers(niche, idea, a) { try { localStorage.setItem(answersKey(niche, idea), JSON.stringify(a)); } catch { /* private mode */ } }

function renderChecklist() {
  const box = document.getElementById("flags");
  const tile = document.getElementById("flags-tile");
  const { data, idea } = current;
  const list = (data.premortem && data.premortem.checklist) || [];
  const answers = loadAnswers(data.niche, idea);
  const answered = list.filter((_, i) => answers[i]).length;
  const flags = list.filter((_, i) => answers[i] === "no").length;

  tile.innerHTML = !list.length
    ? `<strong>—</strong><span class="small">Not enough data yet</span><span class="label">Your red flags</span>`
    : answered
      ? `<strong style="color:${flags ? "var(--signal)" : "var(--green)"}">${flags} of ${list.length}</strong><span class="small">${answered < list.length ? `${answered} answered so far` : "all answered"}</span><span class="label">Your red flags</span>`
      : `<strong><button type="button" class="link-btn" id="go-flags">Check →</button></strong><span class="small">Answer ${list.length} quick questions</span><span class="label">Your red flags</span>`;

  document.getElementById("go-flags")?.addEventListener("click", () => box.scrollIntoView({ behavior: "smooth" }));
  if (!list.length) { box.remove(); document.querySelector('.toc a[href="#flags"]')?.remove(); return; }
  box.innerHTML = `
    <div class="section-head"><div><span class="pill">Your personal pre-mortem</span><h2 class="h-section">Check your red flags</h2>
      <p class="sub">${list.length} quick questions, each built from a way companies like yours actually died. Your answers stay on this device.</p></div></div>
    ${list.map((q, i) => `
      <div class="q">
        <div class="q-row">
          <span class="q-text">${i + 1}. ${esc(q.question)}</span>
          <span class="q-buttons" role="group" aria-label="Answer">
            <button type="button" data-q="${i}" data-a="yes" aria-pressed="${answers[i] === "yes"}">Yes</button>
            <button type="button" data-q="${i}" data-a="no" aria-pressed="${answers[i] === "no"}">No</button>
          </span>
        </div>
        ${answers[i] === "no" ? `<div class="flag">⚑ <strong>Red flag:</strong> ${esc(q.flag)}
          ${q.count ? `<div class="faint" style="margin-top:4px">${q.count} of ${data.premortem.basedOn} shut-downs here died this way — e.g. ${q.examples.map((e) => safeUrl(e.source) ? `<a href="${esc(e.source)}" target="_blank" rel="noopener">${esc(e.name)}</a>` : esc(e.name)).join(", ")}.</div>` : ""}
        </div>` : ""}
      </div>`).join("")}
    <p class="q-summary">${answered === 0 ? "" : flags === 0 ? `No red flags so far (${answered} of ${list.length} answered).` : `<span class="r">${flags} red flag${flags > 1 ? "s" : ""}</span> out of ${answered} answered.`}</p>`;

  box.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
    const a = loadAnswers(data.niche, idea);
    a[b.dataset.q] = a[b.dataset.q] === b.dataset.a ? undefined : b.dataset.a; // tap again to clear
    saveAnswers(data.niche, idea, a);
    renderChecklist();
  }));
}

// ---------- Company cards ----------
// Years without "?" marks: "2016–2020", "Closed 2020", "Started 2016", "2016–now", or nothing.
function years(c) {
  const from = c.founded_year, to = c.closed_year;
  if (c.status === "running") return from ? `${from}–now` : "";
  if (from && to) return `${from}–${to}`;
  if (to) return c.status === "acquired" ? `Bought ${to}` : `Closed ${to}`;
  if (from) return `Started ${from}`;
  return "";
}

// Rough money in US dollars, only for sorting ("$450 million", "Rs 20 crore", "2.5B"…).
function money(text) {
  const t = String(text || "").toLowerCase().replace(/,/g, "");
  const n = parseFloat((t.match(/[\d.]+/) || [0])[0]);
  if (!n) return 0;
  const scale = /billion|\bb\b|\d\s*b\b|bn/.test(t) ? 1e9 : /million|\bm\b|\d\s*m\b|mn/.test(t) ? 1e6 : /crore|cr\b/.test(t) ? 1e7 : /lakh/.test(t) ? 1e5 : 1;
  return (n * scale) / (/rs|₹|inr|crore|lakh/.test(t) ? 85 : 1);
}

const statusLabel = (c) => ({ "shut down": "Shut down", running: "Still running", acquired: "Acquired" }[c.status] || c.status);
const metaLine = (c) => [c.country && !/not reported/i.test(c.country) ? c.country : "", years(c), nice(c.money_raised) ? `Raised ${c.money_raised}` : ""].filter(Boolean).join(" · ");

function cardHtml(c, i, num, grey = false) {
  const alive = c.status === "running";
  const reasonTitle = alive ? "What they did differently:" : c.status === "acquired" ? "Why it was bought:" : "Why it failed:";
  const meta = metaLine(c);
  return `
    <button type="button" class="card-co ${alive ? "alive" : ""} ${grey ? "grey" : ""}" data-i="${i}">
      <span class="scan" aria-hidden="true"></span>
      <div class="co-top"><span class="status ${alive ? "alive" : ""} ${grey ? "grey" : ""}">${esc(statusLabel(c))}</span>${num ? `<span class="co-num">#${num}</span>` : ""}</div>
      <h3>${esc(c.name)}</h3>
      ${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
      <p class="what">${esc(c.what_they_did)}</p>
      ${/not reported/i.test(c.one_line || "") ? "" : `<p class="reason"><b>${reasonTitle}</b> ${esc(c.one_line)}</p>`}
      <div class="co-foot"><span class="match ${c.match === "same idea" ? "same" : ""}">${c.match === "same idea" ? "Same idea" : "Similar idea"}</span><span class="open-btn">Open →</span></div>
    </button>`;
}

function renderGrid(main) {
  const all = current.data.companies;
  let list = main.filter((c) => current.filter === "all" || c.group === current.filter);
  const sorters = {
    closest: (a, b) => (a.match === "same idea" ? 0 : 1) - (b.match === "same idea" ? 0 : 1) || (a.status === "shut down" ? 0 : 1) - (b.status === "shut down" ? 0 : 1),
    newest: (a, b) => (b.founded_year || 0) - (a.founded_year || 0),
    money: (a, b) => money(b.money_raised) - money(a.money_raised),
  };
  list = [...list].sort(sorters[current.sort]);
  const grid = document.getElementById("grid");
  const shown = current.showAll ? list : list.slice(0, FIRST_CARDS);
  grid.innerHTML = list.length ? shown.map((c, n) => cardHtml(c, all.indexOf(c), n + 1)).join("") : `<p class="empty">No companies in this view.</p>`;
  grid.querySelectorAll(".card-co").forEach((el) => el.addEventListener("click", () => openPanel(all[el.dataset.i])));
  revealOnView(grid);
  document.getElementById("show-all")?.remove();
  if (list.length > shown.length) {
    grid.insertAdjacentHTML("afterend", `<button type="button" id="show-all" class="btn btn-ghost show-all">Show all ${list.length} companies</button>`);
    document.getElementById("show-all").addEventListener("click", () => { current.showAll = true; renderGrid(main); });
  }
}

// Companies outside the main grid (not in the score)
function moreGroupsHtml(companies) {
  const groups = [
    ["acquired", "Acquired", "bought by another company — not in the score"],
    ["too early", "Too early to tell", "still running but under 2 years old"],
    ["not confirmed", "Status not confirmed", "no news from the last 2 years confirms they still run"],
    ["older", "Older companies", "started over 15 years ago — shown for context"],
  ];
  return groups.map(([key, title, why]) => {
    const list = companies.filter((c) => c.group === key);
    if (!list.length) return "";
    return `<details class="more"><summary>${title} (${list.length}) — ${why}</summary>
      <div class="grid">${list.map((c) => cardHtml(c, companies.indexOf(c), 0, true)).join("")}</div></details>`;
  }).join("");
}

// ---------- Causes of death (chart) + About this report ----------
function causesHtml(main) {
  const dead = main.filter((c) => c.group === "shut down");
  const tally = {};
  for (const c of dead) for (const cause of new Set((c.causes || []).map((x) => x.cause))) tally[cause] = (tally[cause] || 0) + 1;
  const rows = Object.entries(tally).sort((a, b) => (a[0] === "reason not reported") - (b[0] === "reason not reported") || b[1] - a[1]);
  return `<section class="card">
    <span class="pill">Causes of death</span>
    <h2 class="h-section" style="margin-top:14px">Why they shut down</h2>
    <p class="sub">${dead.length} shut-downs; a company can have up to two causes.</p>
    ${rows.length ? rows.map(([cause, n]) => `
      <div class="dist-row"><div class="row"><span>${esc(cap(cause))}</span><span>${n} (${Math.round((100 * n) / dead.length)}%)</span></div>
      <div class="bar dark"><span data-w="${Math.round((100 * n) / dead.length)}" ${cause === "reason not reported" ? 'style="background:#CFC9BC"' : ""}></span></div></div>`).join("")
      : `<p class="note" style="margin-top:14px">No shut-downs found yet.</p>`}
  </section>`;
}

function aboutHtml(data) {
  const r = data.risk || {};
  return `<section class="card about">
    <span class="pill">About this report</span>
    <h2 class="h-section" style="margin:14px 0 12px">How to read it</h2>
    <p>Built from public news articles and founders’ own posts about companies in <b>${esc(data.niche)}</b>. Every company links to its sources.</p>
    <p>Failures are often unreported, so the real picture is usually worse than what we show. Treat the numbers as a best case.</p>
    <p>“Same idea” is judged against your exact sentence. Spot a mistake? Open a company and tap <b>Report a mistake</b>.</p>
    ${r.parts ? `<details class="risk-parts"><summary>How the risk score is worked out</summary>
      ${r.parts.map((p) => `<div class="risk-part"><div class="risk-part-head"><span>${esc(p.name)}</span><span class="faint">${p.share}% of the score</span></div>
        <div class="bar dark"><span data-w="${p.value}"></span></div><div class="faint">${esc(p.detail)}</div></div>`).join("")}
      ${r.parts.length < 5 ? `<p class="faint" style="margin-top:8px">Some parts are left out because we don’t have enough data for them yet.</p>` : ""}
    </details>` : ""}
  </section>`;
}

// ======================= 4. SHARE & REPORT =======================
const resultsLink = (niche, idea) => `${location.origin}${location.pathname}#/results/${encodeURIComponent(niche)}?idea=${encodeURIComponent(idea)}`;
const reportLink = (niche, idea, print) => `#/report/${encodeURIComponent(niche)}?idea=${encodeURIComponent(idea)}${print ? "&print=1" : ""}`;

// Phone: open the share menu. Laptop: copy the link.
async function shareResults(niche, idea, button) {
  const url = resultsLink(niche, idea);
  const text = `premortem: who already tried “${idea}”, and how they failed`;
  const isPhone = matchMedia("(pointer: coarse)").matches && navigator.share;
  if (isPhone) {
    try { await navigator.share({ title: "premortem", text, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
  }
  const copied = await copyText(url);
  toast(copied ? "Link copied — paste it anywhere to share." : "Couldn’t copy automatically. Here’s the link:", copied ? "" : url);
}

// Copy text to the clipboard (with an older fallback for browsers that block the new way).
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* try the old way */ }
  try {
    const area = Object.assign(document.createElement("textarea"), { value: t });
    area.style.position = "fixed"; area.style.opacity = "0";
    document.body.appendChild(area); area.select();
    const ok = document.execCommand("copy"); area.remove(); return ok;
  } catch { return false; }
}

// Small message at the bottom of the screen.
function toast(message, link = "") {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${esc(message)}${link ? `<input readonly value="${esc(link)}" onclick="this.select()">` : ""}`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, link ? 9000 : 3500);
}

// The one-page summary report (A4). "Download summary" uses the browser's print box ("Save as PDF"), so text and links stay real.
async function showReport(niche, idea, autoPrint) {
  document.title = `premortem summary report — ${idea || niche}`;
  app.innerHTML = `<section class="card"><div class="simple-loading"><span class="spinner"></span>Preparing your report…</div></section>`;
  let data;
  try { data = await api(`/results?niche=${encodeURIComponent(niche)}&idea=${encodeURIComponent(idea)}`); } catch (err) { return showHome(err.message, idea); }

  const closest = (group) => data.companies
    .filter((c) => c.group === group)
    .sort((a, b) => (a.match === "same idea" ? 0 : 1) - (b.match === "same idea" ? 0 : 1) || (/not reported/i.test(a.one_line) ? 1 : 0) - (/not reported/i.test(b.one_line) ? 1 : 0))
    .slice(0, 2);
  const deadList = closest("shut down"), aliveList = closest("running");
  const main = data.companies.filter((c) => c.group === "shut down" || c.group === "running");
  const deadCount = main.filter((c) => c.group === "shut down").length;
  const p = data.premortem || {}, r = data.risk || {};
  const sources = [];
  const cite = (url) => { if (safeUrl(url) && !sources.includes(url)) sources.push(url); return ""; }; // sources listed at the bottom
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const list = p.checklist || [];
  const answers = loadAnswers(niche, idea);
  const answered = list.filter((_, i) => answers[i]);
  const flagged = list.filter((_, i) => answers[i] === "no");

  const companyRow = (c, alive) => `
    <div class="rc ${alive ? "alive" : ""}">
      <div class="rc-name">${esc(c.name)}<span>${esc([c.country && !/not reported/i.test(c.country) ? c.country : "", years(c)].filter(Boolean).join(" · "))}</span></div>
      <p>${esc(c.what_they_did)}</p>
      ${/not reported/i.test(c.one_line || "") ? "" : `<p class="rc-why"><b>${alive ? "Did differently" : "Why it died"}</b>${esc(c.one_line)}</p>`}
    </div>`;
  [...deadList, ...aliveList].forEach((c) => cite((c.sources || [])[0]));
  if (p.available) p.risks.forEach((x) => x.examples.forEach((e) => cite(e.source)));

  app.innerHTML = `
    <div class="ready no-print">
      <span class="ready-text">Your one-page summary report. To keep a copy, choose “Save as PDF” in the box that opens.</span>
      <span class="ready-actions">
        <button type="button" class="btn btn-signal btn-small" id="print">Download summary</button>
        <button type="button" class="btn btn-ghost btn-small" id="share">Share link</button>
        <a class="btn btn-ghost btn-small" href="#/results/${encodeURIComponent(niche)}?idea=${encodeURIComponent(idea)}">Back to full results</a>
      </span>
    </div>
    <article class="card report">
      <header class="r-head"><img class="r-logo" src="assets/logo-header.png" alt="premortem"><span class="r-date">${esc(date)}</span></header>

      <span class="r-eyebrow">Premortem summary report</span>
      <h1>“${esc(idea || niche)}”</h1>
      <p class="r-sub">Compared with ${data.companies.length} companies in ${esc(data.niche)} · failures are often unreported, so treat this as the best case.</p>

      <div class="r-tiles">
        <div class="r-tile accent"><strong>${r.score === null || r.score === undefined ? "—" : `${r.score}<small>/100</small>`}</strong><span>${r.label ? `Risk · ${esc(r.label)}` : "Risk score"}</span></div>
        <div class="r-tile"><strong>${deadCount}<small> of ${main.length}</small></strong><span>Shut down</span></div>
        <div class="r-tile"><strong class="r-cause">${p.available && p.risks[0] ? esc(cap(p.risks[0].cause)) : "—"}</strong><span>#1 cause of death</span></div>
        <div class="r-tile"><strong>${answered.length ? `${flagged.length}<small> of ${list.length}</small>` : "—"}</strong><span>Your red flags</span></div>
      </div>
      ${data.score && data.score.closestWarning ? `<p class="r-alert">${esc(data.score.closestWarning)}</p>` : ""}

      <span class="r-eyebrow">How your idea could fail</span>
      ${p.available ? `<div class="r-risks">${p.risks.map((x, i) => `
        <div class="r-risk">
          <span class="r-n">${i + 1}</span>
          <div>
            <div class="r-risk-top"><b>${esc(cap(x.cause))}</b><span>${x.count} of ${p.basedOn} shut-downs · e.g. ${x.examples.map((e) => esc(e.name)).join(", ")}</span></div>
            ${x.warning_sign ? `<p class="r-watch"><i>Watch for</i>${esc(x.warning_sign)}</p>` : ""}
          </div>
        </div>`).join("")}</div>`
        : `<p class="r-sub">${esc(p.note || "Not enough shut-downs found yet to predict how this could fail.")}</p>`}

      ${answered.length ? `<span class="r-eyebrow">Your red flags · ${flagged.length} of ${answered.length} answered</span>
        ${flagged.length ? `<div class="r-flags">${flagged.map((q) => `<div class="r-flag"><span class="r-no">No</span><div><b>${esc(q.question)}</b><p>${esc(q.flag)}</p></div></div>`).join("")}</div>`
          : `<p class="r-sub">No red flags from your answers.</p>`}` : ""}

      ${p.pattern && (p.pattern.shut_down || p.pattern.running) ? `<span class="r-eyebrow">The pattern</span>
        <div class="r-pattern">
          ${p.pattern.shut_down ? `<div><i class="dot dead"></i><span>Shut down</span><p>${esc(p.pattern.shut_down.replace(/^The ones that shut down\s*/i, ""))}</p></div>` : ""}
          ${p.pattern.running ? `<div><i class="dot alive"></i><span>Still running</span><p>${esc(p.pattern.running.replace(/^The ones still running\s*/i, ""))}</p></div>` : ""}
        </div>` : ""}

      <div class="r-cols">
        <div><span class="r-eyebrow">Closest that shut down</span>${deadList.map((c) => companyRow(c, false)).join("") || `<p class="r-sub">None found yet.</p>`}</div>
        <div><span class="r-eyebrow">Closest still running</span>${aliveList.map((c) => companyRow(c, true)).join("") || `<p class="r-sub">None found yet.</p>`}</div>
      </div>

      <footer class="r-foot">
        <span class="r-eyebrow">Sources</span>
        <ol class="r-sources">${sources.map((u) => `<li><a href="${esc(u)}">${esc(host(u))}</a></li>`).join("")}</ol>
        <p>Full results · ${esc(resultsLink(niche, idea))}</p>
      </footer>
    </article>`;

  document.getElementById("print").addEventListener("click", () => window.print());
  document.getElementById("share").addEventListener("click", (e) => shareResults(niche, idea, e.target));
  if (autoPrint) setTimeout(() => window.print(), 700);
}

// ======================= 5. SIDE PANEL =======================
// ---------- the evidence board: red threads from the company to every real news article it came from ----------
// A readable title from the link itself ("blip-shuts-down-after-one-year" → "Blip shuts down after one year").
function slugTitle(u) {
  try {
    const parts = new URL(u).pathname.split("/").filter((s) => /[a-z]-[a-z]/i.test(s));
    const s = (parts.pop() || "").replace(/\.[a-z]+$/i, "").replace(/-\d{4,}.*$/, "").replace(/[-_]+/g, " ").trim();
    return s ? cap(s).slice(0, 90) : "";
  } catch { return ""; }
}
function evidenceHtml(c) {
  const srcs = (c.sources || []).filter(safeUrl);
  if (!srcs.length) return "";
  const kind = c.status === "running" ? "alive" : c.status === "acquired" ? "bought" : "dead";
  return `<div class="p-section evidence">
    <h4>The proof</h4>
    <div class="ev-board">
      <svg class="ev-threads" aria-hidden="true"></svg>
      <div class="ev-node ${kind}"><b>${esc(c.name)}</b><span>${srcs.length} ${srcs.length === 1 ? "article" : "articles"}</span></div>
      <div class="ev-list">${srcs.map((s, i) => `<a class="ev-src" data-i="${i}" href="${esc(s)}" target="_blank" rel="noopener">
        <span class="ev-dom">${esc(host(s))}</span>${esc(slugTitle(s) || "Read the article")}<i>↗</i></a>`).join("")}</div>
    </div>
    <p class="ev-note">Every company on premortem links to the news it came from. No source, no company.</p>
  </div>`;
}
function playEvidence(root) {
  const board = root.querySelector(".ev-board");
  if (!board) return;
  const svg = board.querySelector(".ev-threads"), node = board.querySelector(".ev-node"), cards = [...board.querySelectorAll(".ev-src")];
  const NS = "http://www.w3.org/2000/svg";
  const draw = (animate) => {
    svg.innerHTML = "";
    const b = board.getBoundingClientRect(), n = node.getBoundingClientRect();
    const from = { x: n.right - b.left, y: n.top + n.height / 2 - b.top };
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect(), to = { x: r.left - b.left, y: r.top + r.height / 2 - b.top }, mx = (from.x + to.x) / 2;
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", `M${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`);
      p.dataset.i = i; svg.appendChild(p);
      if (animate) {
        const L = p.getTotalLength();
        p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect();
        p.style.transition = `stroke-dashoffset 0.7s ease ${0.25 + i * 0.22}s`; p.style.strokeDashoffset = 0;
        card.style.transitionDelay = `${0.15 + i * 0.22}s`;
      }
    });
  };
  // hover an article → its thread glows
  cards.forEach((card) => {
    card.addEventListener("mouseenter", () => svg.querySelector(`path[data-i="${card.dataset.i}"]`)?.classList.add("hot"));
    card.addEventListener("mouseleave", () => svg.querySelector(`path[data-i="${card.dataset.i}"]`)?.classList.remove("hot"));
  });
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const go = () => { board.classList.add("on"); draw(!still); };
  // play when the board scrolls into view inside the panel
  if (!("IntersectionObserver" in window)) return go();
  const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { io.disconnect(); setTimeout(go, 150); } }, { root: root, threshold: 0.35 });
  io.observe(board);
}

function openPanel(c) {
  if (!c) return;
  const alive = c.status === "running";
  const site = siteUrl(c.website);
  const meta = metaLine(c);
  const causes = (c.causes || []).filter((x) => x.cause !== "reason not reported");
  // Only show a proof quote if it names this company (articles often cover several companies).
  const core = c.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
  const namesIt = (p) => p && core.split(/\s+/).filter((w) => w.length >= 3).every((w) => p.toLowerCase().includes(w));

  const kind = alive ? "alive" : c.status === "acquired" ? "bought" : "dead";
  const whyTitle = alive ? "What they did differently" : c.status === "acquired" ? "Why it was bought" : "Why it failed";
  const metaChips = [c.country && !/not reported/i.test(c.country) ? c.country : "", years(c), nice(c.money_raised) ? `Raised ${c.money_raised}` : ""].filter(Boolean);
  const reasons = (c.reasons || []).filter((r) => !/not reported/i.test(r));

  panel.innerHTML = `
    <button class="close" type="button" aria-label="Close">×</button>
    <div class="p-head">
      <span class="status ${alive ? "alive" : ""}">${esc(statusLabel(c))}</span>
      <h2>${esc(c.name)}</h2>
      ${metaChips.length ? `<div class="p-meta">${metaChips.map((m) => `<span>${esc(m)}</span>`).join("")}</div>` : ""}
    </div>

    <div class="p-section">
      <h4>What they did</h4>
      <p>${esc(c.what_they_did)}</p>
    </div>

    ${c.story ? `<div class="p-section"><h4>Their story</h4><p class="story">${esc(c.story)}</p></div>` : ""}

    <div class="why-box ${kind}">
      <div class="why-title">${kind === "alive" ? "✓" : "✕"} ${whyTitle}</div>
      ${causes.length ? `<div class="why-causes">${causes.map((x) => `
        <div class="why-cause"><span class="cause-tag">${esc(cap(x.cause))}</span>${namesIt(x.proof) ? `<q>${esc(x.proof)}</q>` : ""}</div>`).join("")}</div>` : ""}
      ${reasons.length ? `<ul class="why-list">${reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : `<p class="faint" style="margin:0">The articles don’t say why.</p>`}
    </div>

    ${c.founder_words ? `<div class="p-section"><h4>In the founder’s words</h4><p class="quote">“${esc(c.founder_words)}”</p>
      ${safeUrl(c.founder_writeup_url) ? `<a class="text-link" href="${esc(c.founder_writeup_url)}" target="_blank" rel="noopener">Read the founder’s post ↗</a>` : ""}</div>` : ""}

    ${site ? `<div class="links">${alive
      ? `<a class="btn btn-small" href="${esc(site)}" target="_blank" rel="noopener">Visit website ↗</a>`
      : `<a class="btn btn-ghost btn-small" href="https://web.archive.org/web/2*/${esc(c.website)}" target="_blank" rel="noopener">See old website ↗</a>`}</div>` : ""}

    ${evidenceHtml(c)}

    <details class="mistake">
      <summary>Report a mistake</summary>
      <form id="mistake-form">
        <textarea id="mistake-text" maxlength="1000" rows="3" placeholder="What’s wrong? e.g. “This company is still running — see their website.”"></textarea>
        <button type="submit" class="btn btn-ghost btn-small">Send</button>
        <p id="mistake-msg" class="tip"></p>
      </form>
    </details>`;

  panel.querySelector("#mistake-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/mistake", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: current ? current.data.niche : "", company: c.name, message: panel.querySelector("#mistake-text").value }) });
      e.target.innerHTML = `<p class="tip">Thank you — we’ll check it.</p>`;
    } catch (err) {
      panel.querySelector("#mistake-msg").textContent = err.message;
    }
  });
  playEvidence(panel);
  panel.querySelector(".close").addEventListener("click", closePanel);
  overlay.hidden = false;
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  panel.querySelector(".close").focus();
}

function closePanel() {
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
}
overlay.addEventListener("click", closePanel);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

route();
