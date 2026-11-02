// find.js — Phase 1 search test.
// Takes a one-line business idea, finds companies that already tried it,
// and prints them (shut down / still running / acquired) with a survival score.
//
// How to run (in Terminal, inside this folder):
//   node find.js "quick delivery"

const fs = require("fs");
const path = require("path");
const NICHES = require("./niches");

// ---------- Settings you can change ----------
const SEARCHES_PER_IDEA = 6;      // web searches per idea (each one uses 1 free Tavily credit)
const ARTICLES_PER_SEARCH = 8;    // articles per "still running" search
const ARTICLES_PER_FAILURE_SEARCH = 20; // articles per shut-down search (20 is the max; still 1 credit)
const ARTICLES_PER_FIND_BATCH = 30;     // Gemini looks for company names in 30 articles at a time
const MAX_COMPANIES_PER_RUN = 48;       // describe at most this many per run (most-mentioned first); later runs add the rest
const DESCRIBE_AT_ONCE = 2;             // how many describe rounds run at the same time
const MAX_ARTICLE_LETTERS = 6000; // cut long articles short, to stay inside Gemini's free limits
const COMPANIES_PER_BATCH = 8;    // Gemini describes this many companies at a time
const MAX_ARTICLES_PER_BATCH = 15; // …reading at most this many articles about them
const MIN_AGE_YEARS = 2;          // running companies younger than this are "too early to tell"
const FRESH_STATUS_YEARS = 2;     // "running" must be confirmed by news from the last 2 years, else "status not confirmed"
const MIN_COMPANIES_FOR_SCORE = 5;
const MIN_SHUTDOWNS_FOR_SCORE = 3; // fewer failures found than this → "Not enough failure data"
const RECENT_YEARS = 15;           // only companies started in the last 15 years count in the score
const MIN_SHUTDOWNS_FOR_PREMORTEM = 3; // "How your idea could fail" needs at least 3 shut-down companies

// Fixed list of reasons a company can die. Every shut-down company gets 1–2 of these.
const CAUSES = [
  "ran out of money",
  "lost money on every order",
  "government rules or legal trouble",
  "beaten by bigger competitors",
  "not enough customers wanted it",
  "founder or team problems",
  "fraud or bad governance",
  "operations too hard or costly",
  "outside shock",
  "reason not reported",
];

// Indian + global startup news sites that report shut-downs.
const STARTUP_NEWS_SITES = ["inc42.com", "entrackr.com", "yourstory.com", "economictimes.indiatimes.com",
  "livemint.com", "moneycontrol.com", "techcrunch.com", "restofworld.org", "techinasia.com"];
const THIS_YEAR = new Date().getFullYear();

// ---------- Keys (kept in keys.txt, never inside the code) ----------
const keys = readKeys();
const GEMINI_MODEL = keys.GEMINI_MODEL || "gemini-3.5-flash-lite";          // cheap model: sorting + finding names
// Model for "shut down / running / bought + why". Free plan allows only 20 requests a day on the bigger
// "gemini-3.5-flash", so we use Flash-Lite. Put GEMINI_STATUS_MODEL=gemini-3.5-flash in keys.txt if you ever pay.
const GEMINI_STATUS_MODEL = keys.GEMINI_STATUS_MODEL || "gemini-3.5-flash-lite";

function readKeys() {
  const found = {};
  const file = path.join(__dirname, "keys.txt");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (line.trim().startsWith("#")) continue; // lines starting with # are just notes
      const at = line.indexOf("=");
      if (at > 0) found[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
  }
  // Later, on Catalyst, keys come from server settings instead of the file.
  for (const name of ["GEMINI_API_KEY", "TAVILY_API_KEY", "GEMINI_MODEL", "GEMINI_STATUS_MODEL"]) {
    if (process.env[name]) found[name] = process.env[name];
  }
  return found;
}

function checkKeys() {
  const missing = ["GEMINI_API_KEY", "TAVILY_API_KEY"].filter((k) => !keys[k] || keys[k].includes("paste"));
  if (missing.length) {
    console.log(`\nMissing key: ${missing.join(", ")}`);
    console.log("Open keys.txt in this folder, paste your keys, save it, and run again.\n");
    process.exit(1);
  }
}

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// ---------- Gemini: send a question, get back tidy data ----------
async function askGemini(prompt, schema, temperature, model = GEMINI_MODEL) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const generationConfig = { responseMimeType: "application/json", responseSchema: schema };
  if (temperature !== undefined) generationConfig.temperature = temperature;
  const body = JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig });

  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": keys.GEMINI_API_KEY },
        body,
        signal: AbortSignal.timeout(90000), // never wait more than 90 seconds for one answer
      });
    } catch (err) {
      if (attempt < 3) continue; // timed out or network hiccup: ask again
      throw new Error(`Gemini didn't answer (${err.name === "TimeoutError" ? "timed out" : err.message})`);
    }
    if (res.ok) {
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.filter((p) => !p.thought).map((p) => p.text || "").join("");
      try {
        return JSON.parse(text);
      } catch {
        if (attempt < 3) continue; // garbled answer, ask again
        throw new Error("Gemini sent back an answer we couldn't read.");
      }
    }
    // Busy, or over the free per-minute limit: wait and try again.
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      console.log(`  Gemini is busy, waiting ${30 * attempt} seconds…`);
      await wait(30000 * attempt);
      continue;
    }
    throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
}

// Make sure Gemini's answer is exactly one of our niche names (ignoring capitals and small typos).
function matchNiche(answer) {
  const clean = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (NICHES.find((n) => clean(n.name) === clean(answer)) || NICHES.find((n) => clean(answer).includes(clean(n.name))) || { name: "other" }).name;
}

// ---------- Step 1: sort the idea into a niche + write the web searches ----------
// Half the searches use the idea's own words (e.g. "Indian sneaker brand shut down"),
// half cover the whole business type (e.g. "footwear brand startup shut down India").
async function sortIdea(idea) {
  const list = NICHES.map((n) => `- ${n.name}: ${n.about}`).join("\n");
  const prompt = `Sort this one-line business idea into exactly one niche from the fixed list below (pick the
narrowest one that fits). Then write short web searches to find startups that already tried it.

idea_searches: exactly 3 searches using the idea's OWN key words (its product, customer or angle), e.g. for
"premium sneaker brand from Chennai": "Indian sneaker brand shut down", "D2C sneaker startup shuts down",
"homegrown Indian sneaker brands".
  1) startups like this idea that shut down, in India
  2) startups like this idea that shut down or failed, anywhere
  3) startups like this idea that are running in India (a list is fine)

niche_searches: exactly 3 searches for the whole niche:
  1) "<niche> startup shut down India"
  2) "<niche> founder why we shut down"
  3) "list of <niche> startups India"
Use plain search phrases, no quotes.

Niches:
${list}

Business idea: "${idea}"`;

  const schema = {
    type: "OBJECT",
    properties: {
      niche: { type: "STRING" }, // checked against the list below (the list is too long for Gemini's "enum")
      idea_searches: { type: "ARRAY", items: { type: "STRING" } },
      niche_searches: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["niche", "idea_searches", "niche_searches"],
  };
  // Temperature 0 = no creativity, so the same idea gets the same niche.
  const out = await askGemini(prompt, schema, 0);
  out.niche = matchNiche(out.niche);
  const [ideaDead, ideaDeadWorld, ideaAlive] = out.idea_searches;
  const [nicheDead, nicheWhy, nicheList] = out.niche_searches;
  // Shut-down searches get 20 articles; the first niche one looks only on Indian startup news sites.
  const searches = [
    { query: ideaDead, failure: true },
    { query: ideaDeadWorld, failure: true },
    { query: nicheDead, failure: true, sites: STARTUP_NEWS_SITES },
    { query: nicheWhy, failure: true },
    { query: ideaAlive },
    { query: nicheList },
  ].filter((x) => x.query).map((x) => ({ news: false, sites: null, failure: false, ...x }));
  return { niche: out.niche, searches };
}

// ---------- Step 2: run the searches on Tavily ----------
async function searchWeb({ query, news, sites, failure }) {
  const res = await fetch("https://api.tavily.com/search", {
    signal: AbortSignal.timeout(45000), // never wait more than 45 seconds for one search
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.TAVILY_API_KEY}` },
    body: JSON.stringify({
      query, topic: news ? "news" : "general", search_depth: "basic",
      max_results: failure ? ARTICLES_PER_FAILURE_SEARCH : ARTICLES_PER_SEARCH,
      include_raw_content: true, include_published_date: true,
      ...(sites ? { include_domains: sites } : {}), // only look on these sites
    }),
  });
  if (!res.ok) throw new Error(`Tavily error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).results || [];
}

// How many Tavily search credits are left this month? (Infinity if Tavily doesn't say)
async function tavilyCreditsLeft() {
  try {
    const res = await fetch("https://api.tavily.com/usage", { headers: { Authorization: `Bearer ${keys.TAVILY_API_KEY}` } });
    const acc = (await res.json()).account || {};
    return acc.plan_limit ? acc.plan_limit - (acc.plan_usage || 0) - (acc.paygo_usage || 0) : Infinity;
  } catch {
    return Infinity;
  }
}

// Remove tracking bits from links (like ?utm_source=…), so the same article isn't counted twice.
function cleanLink(url) {
  try {
    const u = new URL(url);
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|msockid$|fbclid$|gclid$|ref$)/i.test(p)) u.searchParams.delete(p);
    }
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

// Pages that never help: app stores, job sites, "how to build an app like X" guides.
const JUNK_SITES = /(play\.google\.com|apps\.apple\.com|indeed\.|glassdoor\.|naukri\.com|ambitionbox\.com|linkedin\.com\/jobs)/i;
const JUNK_TITLES = /(app development|develop an app|build an app|clone (app|script)|cost to (build|develop)|app like)/i;

async function collectArticles(searches) {
  const batches = await Promise.all(searches.map(searchWeb));
  const byLink = new Map(); // same article from two searches → keep once
  for (const r of batches.flat()) {
    const url = cleanLink(r.url);
    if (byLink.has(url) || JUNK_SITES.test(url) || JUNK_TITLES.test(r.title || "")) continue;
    // Short summary first, then the full page, trimmed.
    const text = `${r.content || ""}\n${r.raw_content || ""}`.slice(0, MAX_ARTICLE_LETTERS);
    byLink.set(url, { url, title: r.title || "", date: (r.published_date || "").slice(0, 10), text });
  }
  return [...byLink.values()];
}

// Articles are numbered [1], [2]… so Gemini can point to them instead of writing links (it can't invent a number we don't have).
const numbered = (articles, numbers) =>
  numbers.map((n) => `[${n}] ${articles[n - 1].title}\nLink: ${articles[n - 1].url}\nDate: ${articles[n - 1].date || "unknown"}\n${articles[n - 1].text}`).join("\n\n---\n\n");

const nicheText = (niche) => `${niche} (${(NICHES.find((n) => n.name === niche) || {}).about || ""})`;

// ---------- Step 3a: Gemini finds every company name in the articles ----------
async function findCompanies(idea, niche, articles, model = GEMINI_MODEL, onProgress = () => {}) {
  const found = new Map();
  const rounds = Math.ceil(articles.length / ARTICLES_PER_FIND_BATCH);
  for (let start = 0; start < articles.length; start += ARTICLES_PER_FIND_BATCH) {
    await onProgress(start / ARTICLES_PER_FIND_BATCH, rounds);
    const numbers = articles.slice(start, start + ARTICLES_PER_FIND_BATCH).map((_, i) => start + i + 1);
    for (const c of await findInBatch(idea, niche, articles, numbers, model)) {
      const key = simpleName(c.name);
      const before = found.get(key);
      found.set(key, { name: before ? before.name : c.name, numbers: [...new Set([...(before ? before.numbers : []), ...c.numbers])] });
    }
  }
  return [...found.values()];
}

async function findInBatch(idea, niche, articles, allNumbers, model) {
  const prompt = `Read every numbered article below, one by one, and list EVERY company (or a big company's
dedicated business line, like "Instamart (Swiggy)") whose main business is this niche, anywhere in the
world: ones that shut down, ones still running, and ones that were bought. Be thorough: articles that
list companies often mention 10–40 of them.

Business idea: "${idea}"
Niche: ${nicheText(niche)}

- If a company was renamed, list it once under its latest name, like "Blinkit (formerly Grofers)".
- Skip companies from a different niche that are only mentioned for comparison.
- Skip investors, suppliers, customers, software vendors, consultants, research firms and news sites.
For each company, give the numbers of ALL articles that mention it.

Articles:
${numbered(articles, allNumbers)}`;

  const schema = {
    type: "OBJECT",
    properties: {
      companies: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { name: { type: "STRING" }, source_numbers: { type: "ARRAY", items: { type: "INTEGER" } } },
          required: ["name", "source_numbers"],
        },
      },
    },
    required: ["companies"],
  };
  const out = await askGemini(prompt, schema, undefined, model);

  // Drop article numbers that aren't in this batch.
  return (out.companies || [])
    .map((c) => ({ name: c.name, numbers: (c.source_numbers || []).filter((n) => allNumbers.includes(n)) }))
    .filter((c) => c.name && c.numbers.length);
}

// ---------- Step 3b: Gemini describes them, a few at a time, reading only their articles ----------
async function describeCompanies(idea, niche, articles, found, onProgress = () => {}) {
  // Most-mentioned companies first; describe at most MAX_COMPANIES_PER_RUN this time.
  const todo = [...found].sort((a, b) => b.numbers.length - a.numbers.length).slice(0, MAX_COMPANIES_PER_RUN);
  const batches = [];
  for (let i = 0; i < todo.length; i += COMPANIES_PER_BATCH) batches.push(todo.slice(i, i + COMPANIES_PER_BATCH));
  const described = [];
  let done = 0;
  await onProgress(0, todo.length);
  const work = async (batch) => {
    described.push(...(await describeBatch(idea, niche, articles, batch)));
    done += batch.length;
    await onProgress(done, todo.length);
  };
  // run DESCRIBE_AT_ONCE rounds at the same time
  for (let i = 0; i < batches.length; i += DESCRIBE_AT_ONCE) await Promise.all(batches.slice(i, i + DESCRIBE_AT_ONCE).map(work));
  return described;
}

async function describeBatch(idea, niche, articles, batch) {
  {
    const numbers = [...new Set(batch.flatMap((c) => c.numbers))].sort((a, b) => a - b).slice(0, MAX_ARTICLES_PER_BATCH);
    console.log(`  Reading about: ${batch.map((c) => c.name).join(", ")}`);

    const prompt = `Describe ONLY these companies, one entry each: ${batch.map((c) => c.name).join("; ")}.
They all tried a business like this idea.

Business idea: "${idea}"
Niche: ${nicheText(niche)}

Strict rules:
- Use ONLY what the articles below say. Do not add facts from your own memory. Never guess.
- Not in the articles → founded_year 0, closed_year 0, money_raised "Not reported",
  reasons ["Reason not reported"], one_line "Reason not reported".
- status: "shut down" (the whole company, or the whole business line, closed), "running", or "acquired"
  (bought by or merged into another company). Leaving some countries or cities, closing some stores, or
  layoffs is NOT shut down: it is still "running" (mention the pull-back in reasons). If ANY article
  says the company was acquired, bought, taken over or merged into another company, its status is
  "acquired" — even if its app or brand still runs under the new owner. (Raising money from an
  investor is NOT being acquired.) If articles disagree, trust the newest one.
- match: "same idea" if it did basically the same thing as the idea above, otherwise "similar idea".
- what_they_did: 2 short lines in plain English.
- story: 2–3 sentences: how it started, how it grew, how it shut down or where it is now.
- reasons: shut down → 2–3 short points on why it failed. Running → 2–3 short points on what
  they did differently that kept them alive. Acquired → why it was bought.
- one_line: the single most important reason, in one short line.
- founder_words: exact words a founder, co-founder or CEO of this company said about it, quoted in the
  articles, only if the article clearly says who said it (max 25 words). "" if none.
- founder_writeup_url: link to a post written BY the founder themself (their blog, LinkedIn or Medium post),
  never an article about them. Only if that exact link is in the articles. "" if none.
- website: the company's own website (like "example.com"), never a news link. "" if not sure.
- founded_year: the year it started. For a business line of a bigger company (like "Amazon Now"), use the
  year THAT business line started, not the parent company.
- kind: "startup" if it is a startup, a young company, or a new business line of a bigger company (like
  "Amazon Now" or "Flipkart Minutes"). "established" only if it is itself an old chain, big corporation or
  long-running institution.
- causes: ONLY for shut-down companies: 1–2 reasons it died, each picked from this list:
  ${CAUSES.join("; ")}. With each, "proof": the exact sentence from the article that shows it
  (copy it word for word, max 30 words). If no reason is given, use "reason not reported" with proof "".
  Empty list for running or bought companies.
- risks_handled: ONLY for running companies: for any reason in the list above that this company faced
  and survived, how it handled it, in one short line, only if the articles say so. Empty list if none.
- in_niche: true only if its main business, or a dedicated business line, is the niche above. Otherwise false.
- status_year: the year of the newest information in the articles about its status (running, shut down or
  bought). Use article dates and the text. 0 if unclear.
- source_numbers: the numbers of the articles below that talk about this company. Never empty.

Articles:
${numbered(articles, numbers)}`;

    const schema = {
      type: "OBJECT",
      properties: {
        companies: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              website: { type: "STRING" },
              country: { type: "STRING" },
              founded_year: { type: "INTEGER" },
              closed_year: { type: "INTEGER" },
              money_raised: { type: "STRING" },
              status: { type: "STRING", enum: ["shut down", "running", "acquired"] },
              match: { type: "STRING", enum: ["same idea", "similar idea"] },
              what_they_did: { type: "STRING" },
              story: { type: "STRING" },
              reasons: { type: "ARRAY", items: { type: "STRING" } },
              one_line: { type: "STRING" },
              founder_words: { type: "STRING" },
              founder_writeup_url: { type: "STRING" },
              kind: { type: "STRING", enum: ["startup", "established"] },
              causes: {
                type: "ARRAY",
                items: { type: "OBJECT", properties: { cause: { type: "STRING", enum: CAUSES }, proof: { type: "STRING" } }, required: ["cause", "proof"] },
              },
              risks_handled: {
                type: "ARRAY",
                items: { type: "OBJECT", properties: { cause: { type: "STRING", enum: CAUSES }, how: { type: "STRING" } }, required: ["cause", "how"] },
              },
              in_niche: { type: "BOOLEAN" },
              status_year: { type: "INTEGER" },
              source_numbers: { type: "ARRAY", items: { type: "INTEGER" } },
            },
            required: ["name", "country", "founded_year", "closed_year", "money_raised", "status", "match",
              "what_they_did", "story", "reasons", "one_line", "kind", "causes", "risks_handled", "in_niche", "status_year", "source_numbers"],
          },
        },
      },
      required: ["companies"],
    };
    const out = await askGemini(prompt, schema, undefined, GEMINI_STATUS_MODEL);
    return out.companies || [];
  }
}

// ---------- Step 4: keep only companies with real sources, remove duplicates ----------
const simpleName = (name) =>
  name.toLowerCase().replace(/\(.*?\)/g, "").replace(/\b(pvt|private|ltd|limited|inc|technologies|labs)\b/g, "").replace(/[^a-z0-9]/g, "");
const lettersOnly = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

// Does this article really mention the company? (All words of its name must appear in the article.)
function mentions(article, name) {
  const text = `${article.title} ${article.text}`.toLowerCase();
  const core = name.toLowerCase().replace(/\(.*?\)/g, "").trim();
  return text.includes(core) || core.split(/\s+/).filter((w) => w.length >= 3).every((w) => text.includes(w));
}

// Did an article clearly say this company was bought / taken over / merged? (only exact phrasings,
// so "Toppr acquired 1 lakh users" never counts — "Toppr was acquired by Byju's" does)
function wasAcquired(name, articles) {
  const core = name.replace(/\(.*?\)/g, "").trim();
  if (core.length < 3) return false;
  const n = core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bought = new RegExp(`\\b${n}\\b(?:(?!acquir|buys|bought|merg)[^.]){0,40}?\\b(?:was|has been|had been|got|is being|being)?\\s*(?:acquired|bought|taken over|absorbed)\\s+by\\b`, "i");
  const buyer = new RegExp(`\\b(?:acquired|acquires|acquiring|bought|buys|took over|takes over|acquisition of|takeover of|merged with|merger with)\\s+(?:the\\s+)?(?:(?!by\\b)[a-z-]+\\s+){0,3}${n}\\b`, "i");
  return articles.some((a) => a.text.split(/(?<=[.!?])\s+/).some((sentence) => bought.test(sentence) || buyer.test(sentence)));
}

// Does a sentence name this company? (so a quote about another company is never shown as proof)
const namesIt = (sentence, name) => mentions({ title: "", text: sentence }, name);

function cleanUp(companies, articles) {
  const allText = articles.map((a) => `${a.url}\n${a.text}`).join("\n");
  const newsSites = new Set(articles.map((a) => hostOf(a.url)));
  const kept = new Map();

  for (const c of companies) {
    if (!c.name || c.in_niche === false) continue; // different kind of business
    // No source link, no company. Article numbers must point to articles we really fetched,
    // and those articles must really name the company.
    const sources = [...new Set(c.source_numbers || [])]
      .filter((n) => n >= 1 && n <= articles.length && mentions(articles[n - 1], c.name))
      .map((n) => articles[n - 1].url);
    if (!sources.length) continue;

    // Website must look like "example.com", and must not be one of the news sites.
    let website = (c.website || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(website) || newsSites.has(website)) website = "";

    const key = simpleName(c.name);
    if (kept.has(key)) {
      const first = kept.get(key);
      first.sources = [...new Set([...first.sources, ...sources])];
      continue;
    }

    // Founder link and quote must really be in the articles, otherwise drop them.
    const founderUrl = c.founder_writeup_url && allText.includes(c.founder_writeup_url) ? c.founder_writeup_url : "";
    const quote = c.founder_words || "";
    const founderWords = quote && lettersOnly(allText).includes(lettersOnly(quote)) ? quote : "";

    // Causes: keep the proof sentence only if it is really in the articles.
    let causes = (c.status === "shut down" ? c.causes || [] : []).map((x) => ({
      cause: x.cause,
      proof: x.proof && lettersOnly(allText).includes(lettersOnly(x.proof)) && namesIt(x.proof, c.name) ? x.proof : "",
    }));
    if (c.status === "shut down" && !causes.length) causes = [{ cause: "reason not reported", proof: "" }];
    const risksHandled = c.status === "running" ? (c.risks_handled || []).filter((r) => r.cause !== "reason not reported") : [];

    // The articles say it was bought → "acquired", even if the AI said "running".
    if (c.status === "running" && wasAcquired(c.name, sources.map((u) => articles.find((a) => a.url === u)).filter(Boolean))) c.status = "acquired";

    const { source_numbers, ...rest } = c;
    kept.set(key, { ...rest, causes, risks_handled: risksHandled, website, founder_writeup_url: founderUrl, founder_words: founderWords, sources });
  }
  return [...kept.values()];
}

// ---------- Step 5: the score ----------
function score(companies) {
  const tooYoung = (c) => c.status === "running" && c.founded_year > 0 && THIS_YEAR - c.founded_year < MIN_AGE_YEARS;
  // "Running" only counts if recent news (last 2 years) says so; older articles may be out of date.
  const notConfirmed = (c) => c.status === "running" && !tooYoung(c) && !(c.status_year >= THIS_YEAR - FRESH_STATUS_YEARS);
  // Compare like with like: only companies started in the last 15 years (or called a startup when the year is unknown).
  const older = (c) => (c.founded_year > 0 ? c.founded_year < THIS_YEAR - RECENT_YEARS : c.kind === "established");
  const acquired = companies.filter((c) => c.status === "acquired");
  const tooEarly = companies.filter(tooYoung);
  const unclear = companies.filter((c) => notConfirmed(c) && !older(c));
  const established = companies.filter((c) => c.status !== "acquired" && !tooYoung(c) && older(c));
  const counted = companies.filter((c) => c.status !== "acquired" && !tooYoung(c) && !notConfirmed(c) && !older(c));
  const running = counted.filter((c) => c.status === "running").length;

  const result = { counted: counted.length, running, shutDown: counted.length - running, acquired, tooEarly, unclear, established, percent: null, closestWarning: "", notEnough: "" };
  if (counted.length < MIN_COMPANIES_FOR_SCORE) {
    result.notEnough = `Not enough data (only ${counted.length} companies to judge; need ${MIN_COMPANIES_FOR_SCORE}).`;
    return result;
  }
  if (result.shutDown < MIN_SHUTDOWNS_FOR_SCORE) {
    result.notEnough = `Not enough failure data (only ${result.shutDown} shut-down companies found; need ${MIN_SHUTDOWNS_FOR_SCORE}).`;
    return result;
  }
  result.percent = Math.round((100 * running) / counted.length);

  // Did the companies closest to the idea do worse than the niche overall? (needs at least 3 to say)
  const same = counted.filter((c) => c.match === "same idea");
  if (same.length >= 3) {
    const sameRunning = same.filter((c) => c.status === "running").length;
    const samePercent = Math.round((100 * sameRunning) / same.length);
    if (samePercent < result.percent) {
      result.closestWarning = `Companies closest to your idea did worse: only ${sameRunning} of ${same.length} still running (${samePercent}%).`;
    }
  }
  return result;
}

// ---------- Risk score (0–100): plain maths on saved companies, no AI ----------
// "counted" = the companies in the score (started in the last 15 years, old enough, status confirmed).
// Each ingredient needs enough data; missing ones are left out and the rest re-weighted.

// Rough money in US dollars ("$450 million", "Rs 20 crore", "2.5B"…).
function moneyUsd(text) {
  const t = String(text || "").toLowerCase().replace(/,/g, "");
  const n = parseFloat((t.match(/[\d.]+/) || [0])[0]);
  if (!n || /not reported/.test(t)) return 0;
  const scale = /billion|bn|\d\s*b\b/.test(t) ? 1e9 : /million|mn|\d\s*m\b/.test(t) ? 1e6 : /crore|\bcr\b/.test(t) ? 1e7 : /lakh/.test(t) ? 1e5 : 1;
  return (n * scale) / (/rs|₹|inr|crore|lakh/.test(t) ? 85 : 1);
}
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? (a[a.length >> 1] + a[(a.length - 1) >> 1]) / 2 : 0; };
const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));

function riskScore(counted) {
  const dead = counted.filter((c) => c.status === "shut down");
  if (counted.length < MIN_COMPANIES_FOR_SCORE || dead.length < MIN_SHUTDOWNS_FOR_SCORE) {
    return { score: null, note: "Not enough data yet to give a risk score." };
  }
  const parts = [];

  // 1. How many in this business type shut down (40%)
  parts.push({ name: "Shut down in this business type", weight: 40, value: clamp((100 * dead.length) / counted.length),
    detail: `${dead.length} of ${counted.length} companies shut down` });

  // 2. How the closest companies did (25%) — needs at least 3 "same idea" companies
  const same = counted.filter((c) => c.match === "same idea");
  if (same.length >= 3) {
    const sameDead = same.filter((c) => c.status === "shut down").length;
    parts.push({ name: "Companies closest to your idea", weight: 25, value: clamp((100 * sameDead) / same.length),
      detail: `${sameDead} of ${same.length} closest companies shut down` });
  }

  // 3. How fast they died (15%) — 1 year or less = 100, 8+ years = 0
  const lives = dead.filter((c) => c.founded_year && c.closed_year >= c.founded_year).map((c) => c.closed_year - c.founded_year);
  if (lives.length >= 3) {
    const m = median(lives);
    parts.push({ name: "How fast they died", weight: 15, value: clamp(100 - ((m - 1) * 100) / 7),
      detail: `typically ${m <= 1 ? "within a year" : `after about ${m.toFixed(m % 1 ? 1 : 0)} years`} (${lives.length} with known dates)` });
  }

  // 4. Recent deaths (10%) — share of shut-downs in the last 3 years
  const closedYears = dead.filter((c) => c.closed_year).map((c) => c.closed_year);
  if (closedYears.length >= 3) {
    const recent = closedYears.filter((y) => y >= THIS_YEAR - 3).length;
    parts.push({ name: "Recent shut-downs", weight: 10, value: clamp((100 * recent) / closedYears.length),
      detail: `${recent} of ${closedYears.length} closed in the last 3 years` });
  }

  // 5. Cash needed (10%) — what the dead ones had raised: $0.5M or less = 0, $50M or more = 100 (log scale)
  const raised = dead.map((c) => moneyUsd(c.money_raised)).filter((x) => x > 0);
  if (raised.length >= 3) {
    const m = median(raised);
    const fmt = m >= 1e9 ? `$${(m / 1e9).toFixed(1)}B` : m >= 1e6 ? `$${Math.round(m / 1e6)}M` : `$${Math.round(m / 1e3)}K`;
    parts.push({ name: "Cash it took", weight: 10, value: clamp((100 * Math.log10(m / 5e5)) / 2),
      detail: `shut-down companies had raised about ${fmt} (middle value, ${raised.length} known)` });
  }

  const totalWeight = parts.reduce((t, p) => t + p.weight, 0);
  const value = clamp(parts.reduce((t, p) => t + p.value * p.weight, 0) / totalWeight);
  const label = value < 35 ? "Low" : value < 55 ? "Medium" : value < 75 ? "High" : "Very high";
  for (const p of parts) p.share = Math.round((100 * p.weight) / totalWeight); // weight after leaving out missing ones
  return { score: value, label, basedOn: counted.length, parts };
}

// ---------- Step 6: pre-mortem — "How your idea could fail" ----------
// Counting is plain code. Gemini only writes the "warning sign" lines (advice, based on these cases).
async function buildPremortem(idea, niche, companies) {
  const older = new Set(score(companies).established.map((c) => c.name));
  const dead = companies.filter((c) => c.status === "shut down" && !older.has(c.name));
  if (dead.length < MIN_SHUTDOWNS_FOR_PREMORTEM) {
    return { available: false, note: `Not enough shut-down companies found to predict how this could fail (found ${dead.length}, need ${MIN_SHUTDOWNS_FOR_PREMORTEM}).` };
  }

  // Count how many companies died of each cause (a company can have 2 causes).
  const tally = new Map();
  for (const c of dead) {
    for (const cause of new Set(c.causes.map((x) => x.cause))) tally.set(cause, [...(tally.get(cause) || []), c]);
  }
  const notReported = (tally.get("reason not reported") || []).length;
  const top = [...tally.entries()]
    .filter(([cause]) => cause !== "reason not reported")
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);
  if (!top.length) return { available: false, note: "The articles don't say why these companies shut down." };

  const closestFirst = (list) => [...list].sort((a, b) => (a.match === "same idea" ? 0 : 1) - (b.match === "same idea" ? 0 : 1));
  const running = companies.filter((c) => c.status === "running");
  const risks = top.map(([cause, list]) => ({
    cause,
    count: list.length,
    examples: closestFirst(list).slice(0, 3).map((c) => {
      const quote = [(c.causes.find((x) => x.cause === cause) || {}).proof].find((p) => p && namesIt(p, c.name));
      // quoted = a real sentence from the article; otherwise our one-line summary (shown without quote marks)
      return { name: c.name, proof: quote || c.one_line, quoted: Boolean(quote), source: c.sources[0] };
    }),
    // Did the survivors avoid it? Only what the articles say.
    survivors: running.flatMap((c) => c.risks_handled.filter((r) => r.cause === cause).map((r) => ({ name: c.name, how: r.how }))).slice(0, 2),
  }));

  // One warning sign per cause, written by Gemini from these real cases only.
  const cases = risks.map((r) => `Cause: ${r.cause}\n` + r.examples.map((e) => `- ${e.name}: ${e.proof}`).join("\n")).join("\n\n");
  const deadLines = dead.map((c) => `- ${c.name}: ${c.one_line}`).join("\n");
  const allCauses = [...tally.entries()].filter(([cause]) => cause !== "reason not reported").sort((a, b) => b[1].length - a[1].length)
    .map(([cause, list]) => `- ${cause} (${list.length}): ${list.slice(0, 3).map((c) => `${c.name}: ${c.one_line}`).join(" | ")}`).join("\n");
  const aliveLines = running.slice(0, 20).map((c) => `- ${c.name}: ${c.one_line}`).join("\n");
  const out = await askGemini(`A founder wants to start this business: "${idea}" (${niche}).
1) Below are the top ways similar companies died, with real examples. For each cause, write ONE early warning
sign the founder should watch for: something they could notice months BEFORE things go wrong (not the failure
itself, like "layoffs" or "shutting down"). One plain-English sentence, practical and specific, based only on these cases.

${cases}

2) The pattern, based only on the lines below: one sentence starting "The ones that shut down…" and one
sentence starting "The ones still running…". Plain English, max 25 words each.

3) A personal checklist: ALWAYS 3 to 5 yes/no questions for this founder (never fewer than 3). Each question checks
a DIFFERENT cause from "All causes" below (most common first). If there are fewer than 3 causes, ask about
different angles of them (e.g. cash runway, then fundraising plan, then cost control).
IMPORTANT: "Yes" must ALWAYS be the good, safe answer. Wrong: "Does your design rely on one trend?" (yes is bad).
Right: "Will your designs still sell if today's trend fades?" Rules: under 15 words; specific to this business; use a concrete number
where it helps (e.g. "Do you have 12+ months of money without new funding?"); "Yes" must be the safe answer and
"No" the red flag. For each, give "cause" (copied exactly from the list) and "flag": one short sentence
starting "If not," that says what happened to companies like this, e.g. "If not, you may be outspent like Dot and TuWheelz were."

All causes:
${allCauses}

Shut down:
${deadLines}

Still running:
${aliveLines || "(none found)"}`, {
    type: "OBJECT",
    properties: {
      warnings: { type: "ARRAY", items: { type: "OBJECT", properties: { cause: { type: "STRING" }, warning_sign: { type: "STRING" } }, required: ["cause", "warning_sign"] } },
      pattern_shut_down: { type: "STRING" },
      pattern_running: { type: "STRING" },
      checklist: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, cause: { type: "STRING" }, flag: { type: "STRING" } }, required: ["question", "cause", "flag"] } },
    },
    required: ["warnings", "pattern_shut_down", "pattern_running", "checklist"],
  });
  for (const r of risks) r.warning_sign = ((out.warnings || []).find((w) => w.cause === r.cause) || {}).warning_sign || "";
  const pattern = { shut_down: out.pattern_shut_down || "", running: running.length ? out.pattern_running || "" : "" };

  // Checklist: attach the real companies that died of each question's cause (plain code, not AI).
  const checklist = (out.checklist || []).slice(0, 5).map((q) => {
    const cause = CAUSES.find((x) => x === String(q.cause || "").toLowerCase().trim()) || "";
    const list = closestFirst(tally.get(cause) || []);
    return { question: q.question, cause, flag: q.flag, count: list.length, examples: list.slice(0, 3).map((c) => ({ name: c.name, source: c.sources[0] })) };
  }).filter((q) => q.question);

  return { available: true, basedOn: dead.length, notReported, risks, pattern, checklist };
}

function premortemText(p) {
  const out = ["", "HOW YOUR IDEA COULD FAIL"];
  if (!p.available) return [...out, p.note].join("\n");
  out.push(`(based on ${p.basedOn} companies like this that shut down${p.notReported ? `; ${p.notReported} gave no reason` : ""})`);
  p.risks.forEach((r, i) => {
    const weak = r.count < 2 ? "  (weak signal: only 1 company)" : "";
    out.push("", `${i + 1}. ${r.cause[0].toUpperCase() + r.cause.slice(1)}: ${r.count} of ${p.basedOn}${weak}`);
    r.examples.forEach((e) => out.push(`   - ${e.name}: "${e.proof}" (${e.source})`));
    out.push(r.survivors.length
      ? `   How survivors handled it: ${r.survivors.map((x) => `${x.name}: ${x.how}`).join(" / ")}`
      : "   How survivors handled it: no running company in these articles says how it handled this.");
    if (r.warning_sign) out.push(`   Warning sign (advice): ${r.warning_sign}`);
  });
  return out.join("\n");
}

// ---------- Closest to THIS visitor's idea ----------
// Saved companies were tagged "same idea" against whoever researched the niche first.
// This re-tags them against the visitor's own sentence. Returns the indexes that are "same idea".
async function closestToIdea(idea, companies) {
  if (!companies.length) return new Set();
  const list = companies.map((c, i) => `[${i + 1}] ${c.name}: ${String(c.what_they_did || "").replace(/\s+/g, " ").slice(0, 140)}`).join("\n");
  const out = await askGemini(`Business idea: "${idea}"
Below are companies. List the numbers of the ones that did basically the SAME thing as this idea (same kind of
product or service for the same kind of customer). Leave out ones that are only loosely related.

${list}`, {
    type: "OBJECT",
    properties: { same_idea: { type: "ARRAY", items: { type: "INTEGER" } } },
    required: ["same_idea"],
  }, 0);
  return new Set((out.same_idea || []).filter((n) => n >= 1 && n <= companies.length).map((n) => n - 1));
}

// ---------- Step 7: print it nicely ----------
function years(c) {
  const start = c.founded_year || "?";
  if (c.status === "running") return c.founded_year ? `${start}–now` : "start year not reported";
  return c.founded_year || c.closed_year ? `${start}–${c.closed_year || "?"}` : "years not reported";
}

function card(c) {
  const label = { "shut down": "SHUT DOWN", running: "STILL RUNNING", acquired: "ACQUIRED" }[c.status];
  const reasonTitle = { "shut down": "Why it failed", running: "What they did differently", acquired: "Why it was bought" }[c.status];
  const lines = [
    `  [${label}] ${c.name} — ${c.country || "country not reported"} · ${years(c)} · Raised: ${c.money_raised} · ${c.match === "same idea" ? "Same idea" : "Similar idea"}${c.status === "running" && c.status_year ? ` · status as of ${c.status_year}` : ""}`,
    `     What they did: ${c.what_they_did}`,
    `     ${reasonTitle}: ${c.one_line}`,
  ];
  for (const x of c.causes || []) lines.push(`     Cause: ${x.cause}${x.proof ? ` — "${x.proof}"` : ""}`);
  for (const r of c.risks_handled || []) lines.push(`     Handled "${r.cause}": ${r.how}`);
  if (c.website) lines.push(`     Website: ${c.website}`);
  if (c.founder_words) lines.push(`     Founder said: "${c.founder_words}"`);
  if (c.founder_writeup_url) lines.push(`     Founder's write-up: ${c.founder_writeup_url}`);
  c.sources.forEach((s) => lines.push(`     Source: ${s}`));
  return lines.join("\n");
}

function makeReport(idea, niche, companies, premortem) {
  const s = score(companies);
  const olderNames = new Set(s.established.map((c) => c.name));
  const shut = companies.filter((c) => c.status === "shut down" && !olderNames.has(c.name)).length;
  const run = companies.filter((c) => c.status === "running").length - s.tooEarly.length - s.unclear.length - s.established.filter((c) => c.status === "running").length;
  const closestFirst = (list) => [...list].sort((a, b) => (a.match === "same idea" ? 0 : 1) - (b.match === "same idea" ? 0 : 1));
  const group = (title, list) => (list.length ? `\n${title} (${list.length})\n\n${closestFirst(list).map(card).join("\n\n")}\n` : "");

  const out = [`Idea:  ${idea}`, `Niche: ${niche}`, ""];
  if (s.percent === null) {
    out.push(`SCORE: ${s.notEnough}`);
  } else {
    out.push(`SCORE: ${s.running} out of ${s.counted} ${niche} companies are still running (${s.percent}%)`);
    out.push(`Based on ${s.counted} companies. Failures are often unreported, so treat this as the best case.`);
    if (s.closestWarning) out.push(`Warning: ${s.closestWarning}`);
  }
  if (premortem) out.push(premortemText(premortem));
  out.push("", `${shut} shut down · ${run} still running · ${s.acquired.length} acquired · ${s.tooEarly.length} too early to tell · ${s.unclear.length} status not confirmed · ${s.established.length} older companies`);

  const tooEarlyNames = new Set([...s.tooEarly, ...s.unclear, ...s.established].map((c) => c.name));
  out.push(group("SHUT DOWN", companies.filter((c) => c.status === "shut down" && !olderNames.has(c.name))));
  out.push(group("STILL RUNNING", companies.filter((c) => c.status === "running" && !tooEarlyNames.has(c.name))));
  out.push(group("ACQUIRED", s.acquired));
  out.push(group(`TOO EARLY TO TELL (running, under ${MIN_AGE_YEARS} years old)`, s.tooEarly));
  out.push(group(`OLDER COMPANIES (started over ${RECENT_YEARS} years ago or long-established; shown for context, not in score)`, s.established));
  out.push(group(`STATUS NOT CONFIRMED (no news from the last ${FRESH_STATUS_YEARS} years saying it still runs; not in score)`, s.unclear));
  return out.join("\n");
}

// ---------- Run it ----------
async function main() {
  const idea = process.argv.slice(2).join(" ").trim();
  if (!idea) return console.log('Type an idea after the command, like:  node find.js "quick delivery"');
  checkKeys();

  console.log("\nSorting your idea…");
  const { niche, searches } = await sortIdea(idea);
  console.log(`  Niche: ${niche}`);
  console.log(`Searching the web (${searches.length} searches)…`);
  const articles = await collectArticles(searches);
  console.log(`Reading ${articles.length} articles to find company names…`);
  const names = await findCompanies(idea, niche, articles);
  console.log(`  Found ${names.length} companies. Reading about each one…`);
  const described = await describeCompanies(idea, niche, articles, names);
  const companies = cleanUp(described, articles);
  console.log(`  Kept ${companies.length} companies with real sources.\n`);

  console.log("Working out how ideas like this fail…");
  const premortem = await buildPremortem(idea, niche, companies);
  const report = makeReport(idea, niche, companies, premortem);
  console.log(report);

  // Save a readable copy (.txt) and the full data (.json) in the "results" folder.
  const dir = path.join(__dirname, "results");
  fs.mkdirSync(dir, { recursive: true });
  const fileName = idea.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "idea";
  fs.writeFileSync(path.join(dir, `${fileName}.txt`), report);
  const data = { idea, niche, date: new Date().toISOString().slice(0, 10), searches, articles: articles.map(({ url, title, date }) => ({ url, title, date })), premortem, companies };
  fs.writeFileSync(path.join(dir, `${fileName}.json`), JSON.stringify(data, null, 2));
  console.log(`\nSaved to results/${fileName}.txt`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\nSomething went wrong: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { wasAcquired, score, cleanUp, makeReport, premortemText, sortIdea, collectArticles, findCompanies, describeCompanies, buildPremortem, simpleName, checkKeys, askGemini, searchWeb, NICHES, matchNiche, closestToIdea, tavilyCreditsLeft, riskScore };
