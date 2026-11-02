// obituary.js — "Your idea's obituary" as a FLATLINE: the first thing you see on a fresh premortem.
// Cream glass covers the report. The orange heartbeat beats twice and goes flat; the cause of death
// types itself under the flat line; then one green beat brings it back to life and the glass lifts away.
// Built ONLY from real numbers for this business type (median lifespan of companies that closed,
// #1 reported cause) and labelled "what could happen — not a prediction".
// Shown once per idea per session; skipped for reduced motion or when there isn't enough data.
(() => {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const year = (y) => (Number(y) > 1900 ? Number(y) : 0);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- the real numbers ----------
  function facts(data) {
    const p = data.premortem || {};
    const lives = data.companies
      .filter((c) => c.group === "shut down" && year(c.founded_year) && year(c.closed_year) >= year(c.founded_year))
      .map((c) => year(c.closed_year) - year(c.founded_year)).sort((a, b) => a - b);
    const median = lives.length >= 3 ? (lives.length % 2 ? lives[(lives.length - 1) / 2] : (lives[lives.length / 2 - 1] + lives[lives.length / 2]) / 2) : null;
    if (p.available && p.risks && p.risks.length) return { top: p.risks[0], others: p.risks.slice(1, 3), basedOn: p.basedOn, median, lifeCount: lives.length };
    // Too few shut-downs for a full premortem: still tell the truth, and say how thin it is.
    const main = (data.companies || []).filter((c) => c.group === "shut down" || c.group === "running");
    const dead = main.filter((c) => c.group === "shut down");
    if (!main.length) return null;
    const tally = new Map();
    for (const c of dead) for (const x of c.causes || []) if (!/not reported/i.test(x.cause)) tally.set(x.cause, (tally.get(x.cause) || 0) + 1);
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    return { thin: true, dead: dead.length, total: main.length, cause: best ? best[0] : null, count: best ? best[1] : 0, median, lifeCount: lives.length };
  }

  // ---------- the heartbeat shape ----------
  const g = (x, m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s));
  const wave = (f) => g(f, .12, .025, .12) + g(f, .215, .008, -.16) + g(f, .24, .011, 1) + g(f, .268, .011, -.34) + g(f, .47, .045, .24);

  window.playObituary = function (data, idea, onDone = () => {}) {
    idea = String(idea || "").replace(/^[•·▪◦*\-–—>\s]+/, "").trim(); // drop pasted bullet marks
    const f = facts(data);
    const seenKey = `obit:${data.niche}:${idea}`;
    let seen = false; try { seen = sessionStorage.getItem(seenKey); } catch { /* private mode */ }
    if (!f || !idea || seen || matchMedia("(prefers-reduced-motion: reduce)").matches) return onDone();
    try { sessionStorage.setItem(seenKey, "1"); } catch { /* fine */ }

    // what the flat line says, and how the hopeful ending reads
    const noDeaths = f.thin && f.dead === 0;
    const lead = noDeaths ? "" : "Cause of death: ";
    const causeText = !f.thin ? cap(f.top.cause) : noDeaths ? "No shut-downs found yet" : f.cause ? cap(f.cause) : "Not reported";
    const note = !f.thin
      ? `the #1 reported cause · ${f.top.count} of ${f.basedOn} shut-downs like it${f.others.length ? ` · also: ${esc(f.others.map((o) => o.cause).join(", "))}` : ""}<br>Based on real shut-downs, each with sources — not a prediction.`
      : noDeaths
        ? `${f.total} ${f.total === 1 ? "company has" : "companies have"} tried this — none have shut down so far.<br>Failures are often unreported, so stay careful.`
        : `from only ${f.dead} shut-down${f.dead === 1 ? "" : "s"} out of ${f.total} — too few to be sure.<br>${f.cause ? "Treat it as an early warning, not a pattern." : "None of them said why."} Based on real sources — not a prediction.`;
    const ending = noDeaths
      ? `<span>Let’s keep it</span> <span><em>that way.</em></span>`
      : `<span>It doesn’t</span> <span>have to</span> <span>end <em>this way.</em></span>`;

    const el = document.createElement("div");
    el.className = "flat";
    el.innerHTML = `
      <canvas class="flat-line"></canvas>
      <div class="flat-top">
        <span class="flat-label">What could happen</span>
        <h2>“${esc(idea)}”</h2>
        ${f.median !== null ? `<p>Ideas like this that shut down lasted a median of <b>${f.median} ${f.median === 1 ? "year" : "years"}</b> <span>(${f.lifeCount} closed companies with known dates)</span></p>` : ""}
      </div>
      <div class="flat-cause">
        <p class="flat-typed"></p>
        <p class="flat-note">${note}</p>
      </div>
      <div class="flat-alive">
        <h2>${ending}</h2>
        <p>Here’s how to see it coming <i>↓</i></p>
      </div>
      <button type="button" class="flat-skip">Skip</button>`;
    document.body.appendChild(el);

    const cv = el.querySelector(".flat-line"), x = cv.getContext("2d");
    let W = 0, H = 0;
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener("resize", size);

    // Timeline (seconds): two beats → flat (cause types in) → one green beat at 76% across → lift away.
    const CROSS = 5.2, BEAT = Math.min(300, innerWidth * 0.2), ALIVE_AT = 0.76;
    let t0 = performance.now(), finished = false;
    const pts = []; // { v, green } every 2px
    function draw(now) {
      if (finished) return;
      const t = (now - t0) / 1000, headX = W * clamp(t / CROSS);
      while (pts.length * 2 < headX) {
        const px = pts.length * 2, aliveX = W * ALIVE_AT;
        let v = 0; const green = px >= aliveX;
        if (px < BEAT * 2) v = wave((px % BEAT) / BEAT);                              // two beats
        else if (green && px < aliveX + BEAT) v = wave((px - aliveX) / BEAT) * 1.15;   // back to life
        pts.push({ v, green });
      }
      const y0 = H * 0.5, amp = Math.min(110, H * 0.13);
      x.clearRect(0, 0, W, H); x.lineWidth = 3; x.lineJoin = "round"; x.lineCap = "round";
      for (const pass of ["orange", "green"]) {
        x.strokeStyle = pass === "orange" ? "#E4502F" : "#1E7A4C";
        x.shadowColor = pass === "orange" ? "rgba(228,80,47,.45)" : "rgba(30,122,76,.45)"; x.shadowBlur = 12;
        x.beginPath(); let open = false;
        pts.forEach((p, i) => {
          if ((pass === "green") !== p.green) { open = false; return; }
          const px = i * 2, py = y0 - p.v * amp;
          if (!open) { x.moveTo(px, py); open = true; } else x.lineTo(px, py);
        });
        x.stroke();
      }
      // the pen tip
      const last = pts[pts.length - 1];
      if (last && headX < W) {
        const hx = (pts.length - 1) * 2, hy = y0 - last.v * amp, gr = x.createRadialGradient(hx, hy, 0, hx, hy, 16);
        gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, last.green ? "rgba(30,122,76,.6)" : "rgba(228,80,47,.6)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        x.shadowBlur = 0; x.fillStyle = gr; x.beginPath(); x.arc(hx, hy, 16, 0, Math.PI * 2); x.fill();
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(() => { el.classList.add("in"); t0 = performance.now(); requestAnimationFrame(draw); });

    function end() {
      if (finished) return; finished = true;
      el.classList.add("out");
      setTimeout(() => { removeEventListener("resize", size); el.remove(); onDone(); }, 1000);
    }
    el.querySelector(".flat-skip").addEventListener("click", (e) => { e.stopPropagation(); end(); });
    el.addEventListener("click", end);

    // the words, in time with the line
    (async () => {
      const typed = el.querySelector(".flat-typed"), cause = causeText;
      await wait(((CROSS * BEAT * 2.15) / W) * 1000 + 250);            // just after the line goes flat
      for (let i = 1; i <= lead.length && !finished; i++) { typed.textContent = lead.slice(0, i); await wait(24); }
      for (let i = 1; i <= cause.length && !finished; i++) { typed.innerHTML = `${lead}<b>${esc(cause.slice(0, i))}</b>`; await wait(34); }
      el.classList.add("noted");
      await wait(Math.max(300, CROSS * ALIVE_AT * 1000 - (performance.now() - t0)));
      if (finished) return;
      el.classList.add("alive");
      await wait(2600);
      end();
    })();
  };
})();
