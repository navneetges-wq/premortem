// api — the quick function the website talks to (must answer within 30 seconds).
//   POST /search   {"idea": "..."}  → sorts the idea; starts research if needed; returns a search id
//   GET  /status?id=...             → how the research is going ("Reading 24 articles…")
//   GET  /results?niche=...         → saved companies, score and "How your idea could fail"

const { zcAuth } = require("@zcatalyst/auth");
const { JobScheduling } = require("@zcatalyst/job-scheduling");
const { Cache } = require("@zcatalyst/cache");
const crypto = require("crypto");
const find = require("./find");
const store = require("./store");

const FRESH_DAYS = 30; // a business type researched in the last 30 days is shown from saved results
const MIN_CLOSE = 5;   // fewer close matches than this → research the visitor's exact idea too

// ---------- limits, so nobody can use up the free credits ----------
const VISITOR_JOBS_PER_DAY = 5;  // new research jobs one visitor can start per day
const SITE_JOBS_PER_DAY = 15;    // new research jobs the whole site can start per day
const VISITOR_RESERVE = 30;      // stop new research when fewer Tavily credits than this are left

// A visitor is told apart by a scrambled version of their internet address (nothing personal is stored).
const visitorId = (req) => {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  return crypto.createHash("sha256").update(ip + (process.env.ADMIN_KEY || "")).digest("hex").slice(0, 16);
};

async function readCount(key) {
  try { return Number(await new Cache().segment().getValue(key)) || 0; } catch { return 0; }
}
async function addOne(key, current) {
  const seg = new Cache().segment();
  try {
    if (current) await seg.update(key, String(current + 1), 24);
    else await seg.put(key, "1", 24);
  } catch (err) { console.error("cache", err.message); }
}

// Returns "" if a new research job may start, otherwise the reason it can't.
async function researchBlocked(req) {
  const day = new Date().toISOString().slice(0, 10);
  const vKey = `v${visitorId(req)}${day}`, sKey = `site${day}`;
  const [mine, site, credits] = await Promise.all([readCount(vKey), readCount(sKey), find.tavilyCreditsLeft()]);
  if (credits < VISITOR_RESERVE) return "We’ve used this month’s research budget. Saved results still work — new research resumes next month.";
  if (site >= SITE_JOBS_PER_DAY) return "We’ve reached today’s limit for new research. Please try again tomorrow — saved results still work.";
  if (mine >= VISITOR_JOBS_PER_DAY) return `You’ve started ${VISITOR_JOBS_PER_DAY} new searches today. Please try again tomorrow — saved results still work.`;
  await Promise.all([addOne(vKey, mine), addOne(sKey, site)]);
  return "";
}

// Start the background research job for an idea; returns the search id to follow its progress.
async function startResearch(idea, niche, searches) {
  const id = await store.newSearch(idea, niche, "waiting", "Starting research…");
  await new JobScheduling().JOB.submitJob({
    job_name: `r${String(id).slice(-12)}`, // max 20 characters
    jobpool_name: "researchpool",
    target_type: "Function",
    target_name: "researcher",
    params: { search_id: String(id), idea, niche, searches: JSON.stringify(searches) },
  });
  return id;
}

const send = (res, code, data) => {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
};

const readBody = (req) =>
  new Promise((done) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try { done(JSON.parse(body || "{}")); } catch { done({}); }
    });
  });

module.exports = async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" });
      return res.end();
    }
    await zcAuth.init(req);
    const url = new URL(req.url, "http://x");

    if (req.method === "POST" && url.pathname === "/search") {
      const body = await readBody(req);
      const idea = String(body.idea || "").trim().slice(0, 200); // only the one-line idea
      const refresh = body.refresh === true; // research again even if saved results are fresh (for testing / pre-fill)
      if (!idea) return send(res, 400, { error: "Please type your idea." });

      const { niche, searches } = await find.sortIdea(idea);
      const saved = await store.nicheRow(niche);
      const ageDays = saved ? (Date.now() - new Date(saved.last_run)) / 86400000 : Infinity;

      // Already researched recently → answer straight away from saved results.
      if (ageDays <= FRESH_DAYS && !refresh) {
        const id = await store.newSearch(idea, niche, "done", "Ready (saved results)");
        return send(res, 200, { id, niche, state: "done" });
      }

      // Otherwise start the background research job (if today's limits allow).
      const blocked = await researchBlocked(req);
      if (blocked) {
        if (saved) { // older saved results exist → show those
          const id = await store.newSearch(idea, niche, "done", "Saved results (limit reached)");
          return send(res, 200, { id, niche, state: "done", note: blocked });
        }
        return send(res, 429, { error: blocked });
      }
      const id = await startResearch(idea, niche, searches);
      return send(res, 200, { id, niche, state: "waiting" });
    }

    // Landing page: "get notified" sign-up. Needs a clear yes to the consent box. Max 3 a day per visitor.
    if (req.method === "POST" && url.pathname === "/subscribe") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { error: "Please enter a valid email address." });
      if (body.consent !== true) return send(res, 400, { error: "Please tick the box to agree to receive emails." });
      const key = `s${visitorId(req)}${new Date().toISOString().slice(0, 10)}`;
      const count = await readCount(key);
      if (count >= 3) return send(res, 429, { error: "Too many sign-ups from here today. Please try again tomorrow." });
      await addOne(key, count);
      const added = await store.addSubscriber(email, String(body.source || "landing"));
      return send(res, 200, { ok: true, already: !added });
    }

    // A visitor reports a wrong fact about a company (max 10 reports a day per visitor).
    if (req.method === "POST" && url.pathname === "/mistake") {
      const body = await readBody(req);
      const message = String(body.message || "").trim();
      if (message.length < 5) return send(res, 400, { error: "Please say what’s wrong in a few words." });
      const key = `m${visitorId(req)}${new Date().toISOString().slice(0, 10)}`;
      const count = await readCount(key);
      if (count >= 10) return send(res, 429, { error: "Thanks — you’ve sent a lot of reports today. Please try again tomorrow." });
      await store.saveMistake(String(body.niche || ""), String(body.company || ""), message);
      await addOne(key, count);
      return send(res, 200, { ok: true });
    }

    // Live graveyard numbers for the home page (cached for 1 hour).
    if (req.method === "GET" && url.pathname === "/stats") {
      let cached = null;
      try { cached = JSON.parse(await new Cache().segment().getValue("homestats")); } catch { /* not cached yet */ }
      if (cached) return send(res, 200, cached);
      const all = await store.allCompanies();
      const stats = {
        companies: all.length,
        shut_down: all.filter((c) => c.status === "shut down").length,
        business_types: new Set(all.map((c) => c._niche)).size,
        sources: new Set(all.flatMap((c) => c.sources || [])).size,
      };
      try { await new Cache().segment().put("homestats", JSON.stringify(stats), 1); } catch { /* fine */ }
      return send(res, 200, stats);
    }

    // Graveyard-wide insights for the landing page (risk score of every business type, causes, lifespans). Cached 1 hour.
    if (req.method === "GET" && url.pathname === "/insights") {
      let cached = null;
      try { cached = JSON.parse(await new Cache().segment().getValue("insights")); } catch { /* not cached yet */ }
      if (cached) return send(res, 200, cached);
      const all = await store.allCompanies(), byNiche = new Map();
      for (const c of all) { if (!byNiche.has(c._niche)) byNiche.set(c._niche, []); byNiche.get(c._niche).push(c); }
      const types = [];
      for (const [niche, cs] of byNiche) {
        const sc = find.score(cs), skip = new Set([...sc.acquired, ...sc.tooEarly, ...sc.unclear, ...sc.established]);
        const r = find.riskScore(cs.filter((c) => !skip.has(c) && (c.status === "shut down" || c.status === "running")));
        if (r.score !== null && r.score !== undefined) types.push({ niche, score: r.score, label: r.label });
      }
      const dead = all.filter((c) => c.status === "shut down" && c.in_niche !== false);
      const tally = new Map();
      for (const c of dead) { const k = ((c.causes || []).find((x) => !/not reported/i.test(x.cause)) || {}).cause; if (k) tally.set(k, (tally.get(k) || 0) + 1); }
      const yr = (y) => (Number(y) > 1900 ? Number(y) : 0);
      const lifespans = dead.map((c) => (yr(c.founded_year) && yr(c.closed_year) >= yr(c.founded_year) ? yr(c.closed_year) - yr(c.founded_year) : null)).filter((x) => x !== null);
      const out = { types: types.sort((a, b) => a.score - b.score), causes: [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), shutDowns: dead.length, lifespans };
      try { await new Cache().segment().put("insights", JSON.stringify(out), 1); } catch { /* fine */ }
      return send(res, 200, out);
    }

    // Every shut-down company we have (name, years, cause) for the 3D graveyard. Cached for 1 hour.
    if (req.method === "GET" && url.pathname === "/graveyard") {
      let cached = null;
      try { cached = JSON.parse(await new Cache().segment().getValue("graveyard")); } catch { /* not cached yet */ }
      if (cached) return send(res, 200, cached);
      const year = (y) => (Number(y) > 1900 ? Number(y) : 0);
      const dead = (await store.allCompanies())
        .filter((c) => c.status === "shut down" && c.in_niche !== false && c.name)
        .map((c) => ({
          name: String(c.name).slice(0, 40),
          niche: c._niche,
          started: year(c.founded_year),
          closed: year(c.closed_year),
          cause: ((c.causes || []).find((x) => !/not reported/i.test(x.cause)) || {}).cause || "reason not reported",
          line: /not reported/i.test(c.one_line || "") ? "" : String(c.one_line || "").slice(0, 140),
          country: c.country || "",
        }));
      const out = { count: dead.length, companies: dead };
      try { await new Cache().segment().put("graveyard", JSON.stringify(out), 1); } catch { /* too big to cache: fine */ }
      return send(res, 200, out);
    }

    if (req.method === "GET" && url.pathname === "/status") {
      const row = await store.getSearch(url.searchParams.get("id"));
      let feed = null; // real headlines and company names so far (for the live loading screen)
      try { feed = JSON.parse(await new Cache().segment().getValue(`f${row.ROWID}`)); } catch { /* none yet */ }
      return send(res, 200, { id: row.ROWID, niche: row.niche, state: row.state, progress: row.progress, feed });
    }

    if (req.method === "GET" && url.pathname === "/results") {
      const niche = url.searchParams.get("niche");
      const idea = String(url.searchParams.get("idea") || "").trim().slice(0, 200);
      const companies = (await store.companiesFor(niche)).map(({ _rowid, ...c }) => c);
      const saved = await store.nicheRow(niche);

      // "Closest to your idea": re-tag companies against THIS visitor's sentence.
      let deepening = null;
      if (idea && companies.length) {
        try {
          // Which companies are closest to this exact sentence — remembered for 24h (asking the AI takes ~1.3s).
          const ckey = "m2" + crypto.createHash("sha1").update(`${niche}|${companies.length}|${idea.toLowerCase()}`).digest("hex").slice(0, 24);
          let names = null;
          try { names = JSON.parse(await new Cache().segment().getValue(ckey)); } catch { /* not remembered yet */ }
          if (!Array.isArray(names)) {
            const same = await find.closestToIdea(idea, companies);
            names = [...same].map((i) => companies[i] && companies[i].name).filter(Boolean);
            try { await new Cache().segment().put(ckey, JSON.stringify(names), 24); } catch { /* fine */ }
          }
          const close = new Set(names);
          companies.forEach((c) => (c.match = close.has(c.name) ? "same idea" : "similar idea"));
          // Few close matches → research this exact idea in the background (at most once a week per idea).
          if (close.size < MIN_CLOSE && !(await store.recentSearchFor(idea, 7)) && !(await researchBlocked(req))) {
            const { searches } = await find.sortIdea(idea);
            deepening = await startResearch(idea, niche, searches);
          }
        } catch (err) {
          console.error("closest/deepening failed", err);
        }
      }
      const s = find.score(companies);
      // Which list each company belongs on (only "shut down" and "running" are in the main grid).
      const groupOf = new Map();
      for (const [group, list] of [["acquired", s.acquired], ["too early", s.tooEarly], ["not confirmed", s.unclear], ["older", s.established]]) {
        for (const c of list) groupOf.set(c, group);
      }
      for (const c of companies) c.group = groupOf.get(c) || c.status;
      const risk = find.riskScore(companies.filter((c) => c.group === "shut down" || c.group === "running"));
      return send(res, 200, {
        niche,
        last_run: saved && saved.last_run,
        score: { counted: s.counted, running: s.running, shutDown: s.shutDown, percent: s.percent, notEnough: s.notEnough, closestWarning: s.closestWarning },
        premortem: saved ? JSON.parse(saved.pre_mortem || "{}") : null,
        risk,
        deepening,
        companies,
      });
    }

    // ---------- admin (needs the private ADMIN_KEY) ----------
    if (url.pathname.startsWith("/admin/")) {
      if (!process.env.ADMIN_KEY || req.headers["x-admin-key"] !== process.env.ADMIN_KEY) return send(res, 403, { error: "Not allowed" });
      const jobs = new JobScheduling();
      const jobFor = (task) => ({ job_name: task, jobpool_name: "researchpool", target_type: "Function", target_name: "researcher", params: { task } });

      // Progress report: every business type, how often researched, how many companies saved.
      if (url.pathname === "/admin/summary") {
        const counts = {};
        for (const c of await store.allCompanies()) {
          const n = (counts[c._niche] = counts[c._niche] || { saved: 0, shut_down: 0 });
          n.saved++;
          if (c.status === "shut down") n.shut_down++;
        }
        const niches = (await store.allNiches()).map((r) => ({ niche: r.niche, runs: r.runs, last_run: r.last_run, ...counts[r.niche] }));
        const missing = Object.keys(counts).filter((n) => !niches.some((r) => r.niche === n)).map((n) => ({ niche: n, ...counts[n] }));
        const day = new Date().toISOString().slice(0, 10);
        return send(res, 200, {
          researched: niches.length, of: find.NICHES.length - 1,
          today: { new_research_jobs: await readCount(`site${day}`), limit: SITE_JOBS_PER_DAY },
          tavily_credits_left: await find.tavilyCreditsLeft(),
          niches: [...niches, ...missing],
        });
      }

      // Email sign-ups, newest first.
      if (url.pathname === "/admin/subscribers") {
        const rows = (await store.allSubscribers()).map((r) => ({ when: r.CREATEDTIME, email: r.email, source: r.source }));
        return send(res, 200, rows.sort((a, b) => String(b.when).localeCompare(String(a.when))));
      }

      // Mistakes visitors reported, newest first.
      if (url.pathname === "/admin/mistakes") {
        const rows = (await store.allMistakes()).map((r) => ({ when: r.CREATEDTIME, niche: r.niche, company: r.company, message: r.message }));
        return send(res, 200, rows.sort((a, b) => String(b.when).localeCompare(String(a.when))));
      }

      // How did a job go?
      if (url.pathname === "/admin/job") return send(res, 200, await jobs.JOB.getJob(url.searchParams.get("id")));

      // Run one night task right now (for testing).
      // The last log of a background task (kept 24h).
      if (url.pathname === "/admin/joblog") {
        try { return send(res, 200, JSON.parse(await new Cache().segment().getValue(`log${url.searchParams.get("task")}`))); } catch { return send(res, 200, { log: [] }); }
      }

      if (url.pathname === "/admin/run") {
        const task = url.searchParams.get("task");
        if (!["prefill", "news", "recheck", "premortems", "acquisitions", "fix"].includes(task)) return send(res, 400, { error: "task must be prefill, news, recheck, premortems, acquisitions or fix" });
        const job = jobFor(task);
        for (const k of ["niche", "name", "status", "count", "reserve"]) if (url.searchParams.get(k)) job.params[k] = url.searchParams.get(k);
        return send(res, 200, await jobs.JOB.submitJob(job));
      }

      // Create the 3 schedules (India time).
      if (url.pathname === "/admin/setup-crons") {
        const existing = (await jobs.CRON.getAllCron()).map((c) => c.cron_name);
        const daily = (hour) => ({ hour, minute: 0, second: 0, timezone: "Asia/Kolkata", repetition_type: "daily" });
        const plans = [
          { cron_name: "nightlyprefill", description: "Research up to 8 business types", cron_type: "Calendar", cron_detail: daily(1), task: "prefill" },
          { cron_name: "morningnews", description: "Add shut-downs from Inc42 and YourStory", cron_type: "Calendar", cron_detail: daily(7), task: "news" },
          { cron_name: "monthlyrecheck", description: "Re-check 25 running companies", cron_type: "Calendar",
            cron_detail: { repetition_type: "monthly", days: [1], hour: 3, minute: 0, second: 0, timezone: "Asia/Kolkata" }, task: "recheck" },
        ];
        const made = [];
        for (const { task, ...plan } of plans) {
          if (existing.includes(plan.cron_name)) { made.push(`${plan.cron_name}: already exists`); continue; }
          await jobs.CRON.createCron({ ...plan, cron_status: true, job_meta: jobFor(task) });
          made.push(`${plan.cron_name}: created`);
        }
        return send(res, 200, { made });
      }
    }

    send(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "Something went wrong. Please try again." }); // details stay in the server logs
  }
};
