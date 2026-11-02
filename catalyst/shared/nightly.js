// nightly.js — the 3 scheduled tasks.
//   prefill: research business types nobody has researched yet (then refresh the oldest)
//   news:    read new Inc42 / YourStory articles, add any startup shut-downs they report
//   recheck: monthly check of "running" companies whose status is oldest

const find = require("./find");
const store = require("./store");
const { researchNiche, refreshPremortem } = require("./research");

// Free-plan budget: Tavily gives 1,000 searches a month; one business type uses 6.
const PREFILL_PER_NIGHT = 8;       // 48 searches a night → all 80 types in about 10 nights
const REFRESH_AFTER_DAYS = 30;     // once all are done, re-research types older than this
const RECHECK_PER_MONTH = 25;      // 25 searches a month
const TIME_BUDGET_MS = 12 * 60000; // jobs may run 15 minutes; stop starting new work after 12
const PREFILL_RESERVE = 300;       // keep at least this many Tavily credits for real visitors

const FEEDS = ["https://inc42.com/feed/", "https://yourstory.com/feed"];
const SMALL_MODEL = "gemma-4-31b-it"; // small free model for sorting headlines (falls back to Flash-Lite)

// ---------- prefill ----------
async function prefill() {
  const start = Date.now();
  const done = new Map((await store.allNiches()).map((r) => [r.niche, r.last_run]));
  const never = find.NICHES.map((n) => n.name).filter((n) => n !== "other" && !done.has(n));
  const old = [...done.entries()]
    .filter(([, last]) => (Date.now() - new Date(last)) / 86400000 > REFRESH_AFTER_DAYS)
    .sort((a, b) => new Date(a[1]) - new Date(b[1]))
    .map(([n]) => n);
  const todo = [...never, ...old].slice(0, PREFILL_PER_NIGHT);

  const log = [];
  for (const niche of todo) {
    if (Date.now() - start > TIME_BUDGET_MS) break;
    if ((await find.tavilyCreditsLeft()) < PREFILL_RESERVE + 6) {
      log.push(`Stopped: fewer than ${PREFILL_RESERVE} search credits left this month (kept for visitors).`);
      break;
    }
    try {
      const { searches } = await find.sortIdea(niche); // the type's name works as the "idea"
      log.push(`${niche}: ${await researchNiche(niche, niche, searches)}`);
    } catch (err) {
      log.push(`${niche}: failed (${err.message})`);
    }
  }
  return log;
}

// ---------- news ----------
const tag = (item, name) => {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").trim() : "";
};
const pageText = (html) =>
  html.replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

async function news() {
  // 1. Collect headlines from the last 2 days.
  const items = [];
  for (const feed of FEEDS) {
    try {
      const xml = await (await fetch(feed, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
      for (const raw of xml.split(/<item[\s>]/i).slice(1)) {
        const date = new Date(tag(raw, "pubDate"));
        if (Date.now() - date > 2 * 86400000) continue;
        items.push({ title: tag(raw, "title"), url: tag(raw, "link"), summary: tag(raw, "description").slice(0, 300), date: date.toISOString().slice(0, 10) });
      }
    } catch (err) {
      console.error(`Feed failed: ${feed}`, err.message);
    }
  }
  if (!items.length) return ["No new articles in the feeds."];

  // 2. Small model picks out headlines about a startup shutting down (short input, so it's cheap).
  const prompt = `Below are news headlines. For each one that reports a startup (or a company's business line)
SHUTTING DOWN, closing, or ending operations, give its number, the company name, and the best niche from this list:
${find.NICHES.map((n) => n.name).join("; ")}.
Ignore everything else (funding, launches, layoffs without closing).

${items.map((it, i) => `[${i + 1}] ${it.title} — ${it.summary}`).join("\n")}`;
  const schema = {
    type: "OBJECT",
    properties: {
      shutdowns: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { number: { type: "INTEGER" }, company: { type: "STRING" }, niche: { type: "STRING" } },
          required: ["number", "company", "niche"],
        },
      },
    },
    required: ["shutdowns"],
  };
  let picked;
  try {
    picked = await find.askGemini(prompt, schema, 0, SMALL_MODEL);
  } catch {
    picked = await find.askGemini(prompt, schema, 0); // Gemma busy → use Flash-Lite
  }

  // 3. Read each shut-down article and add the company to its niche.
  const log = [];
  const touched = new Set();
  for (const s of picked.shutdowns || []) {
    const item = items[s.number - 1];
    s.niche = find.matchNiche(s.niche); // must be one of our niche names
    if (!item || s.niche === "other") continue;
    try {
      const html = await (await fetch(item.url, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
      const article = { url: item.url, title: item.title, date: item.date, text: `${item.summary}\n${pageText(html)}`.slice(0, 6000) };
      const described = await find.describeCompanies(s.niche, s.niche, [article], [{ name: s.company, numbers: [1] }]);
      const companies = find.cleanUp(described, [article]);
      const r = await store.mergeCompanies(s.niche, companies, find.simpleName);
      if (r.added || r.updated) touched.add(s.niche);
      log.push(`${s.company} (${s.niche}): ${r.added} new, ${r.updated} updated`);
    } catch (err) {
      log.push(`${s.company}: failed (${err.message})`);
    }
  }
  for (const niche of touched) await refreshPremortem(niche, niche);
  return log.length ? log : [`Read ${items.length} headlines, no shut-downs reported.`];
}

// ---------- recheck ----------
async function recheck() {
  const start = Date.now();
  const running = (await store.allCompanies())
    .filter((c) => c.status === "running")
    .sort((a, b) => (a.status_year || 0) - (b.status_year || 0))
    .slice(0, RECHECK_PER_MONTH);

  const log = [];
  const touched = new Set();
  for (const c of running) {
    if (Date.now() - start > TIME_BUDGET_MS) break;
    try {
      const results = await find.searchWeb({ query: `${c.name} ${c._niche} shut down OR closed OR still operating`, news: false, failure: false });
      const articles = results.slice(0, 5).map((r) => ({ url: r.url, title: r.title || "", date: (r.published_date || "").slice(0, 10), text: `${r.content || ""}\n${r.raw_content || ""}`.slice(0, 6000) }));
      const numbers = articles.map((_, i) => i + 1);
      const described = await find.describeCompanies(c._niche, c._niche, articles, [{ name: c.name, numbers }]);
      const r = await store.mergeCompanies(c._niche, find.cleanUp(described, articles), find.simpleName);
      touched.add(c._niche);
      log.push(`${c.name}: checked (${r.updated} updated)`);
    } catch (err) {
      log.push(`${c.name}: failed (${err.message})`);
    }
  }
  for (const niche of touched) await refreshPremortem(niche, niche);
  return log;
}

// ---------- premortems: rebuild every saved "How your idea could fail" (after we change how it's made) ----------
async function premortems() {
  const log = [];
  for (const r of await store.allNiches()) {
    try {
      await refreshPremortem(r.niche, r.niche);
      log.push(`${r.niche}: rebuilt`);
    } catch (err) {
      log.push(`${r.niche}: failed (${err.message})`);
    }
  }
  return log;
}

module.exports = { prefill, news, recheck, premortems };
