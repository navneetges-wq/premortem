// store.js — where premortem keeps its data.
//
//   Business types + companies → JSON files in the GitHub repo's "data" branch (github.js), on top of a base snapshot
//                                (snapshot.json, a one-off export of the old Catalyst tables). Reading is effectively
//                                unlimited; every change is a commit.
//   Live search progress       → data/live/<id>.json in the same branch (for the loading screen).
//   Email sign-ups, mistakes   → Catalyst Data Store (writes only; personal data never goes to GitHub).
//
// Without GITHUB_TOKEN the app still serves everything from the snapshot, read-only (research paused).

const { Datastore } = require("@zcatalyst/datastore");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const gh = require("./github");

const MAX_TEXT = 9900; // pre-mortems were stored in 10,000-character columns; keep them that size

const tables = () => {
  const ds = new Datastore();
  return { searches: ds.table("searches"), mistakes: ds.table("mistakes"), subscribers: ds.table("subscribers") };
};
async function allRows(table) {
  const rows = [];
  for await (const row of table.getIterableRows()) rows.push(row);
  return rows;
}

// ---------- the base snapshot ----------
let SNAP;
function snap() {
  if (SNAP === undefined) {
    try { SNAP = JSON.parse(fs.readFileSync(path.join(__dirname, "snapshot.json"), "utf8")); } catch { SNAP = null; }
  }
  return SNAP;
}
const readOnly = () => !gh.enabled();

const slug = (niche) => String(niche).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const nicheFile = (niche) => `data/niches/${slug(niche)}.json`;
const today = () => new Date().toISOString().slice(0, 10);

function fromSnapshot(niche) {
  const s = snap();
  if (!s) return null;
  const row = s.niches.find((r) => r.niche === niche);
  const companies = s.companies.filter((c) => c.niche === niche).map((c) => ({ ...c.details }));
  if (!row && !companies.length) return null;
  return { niche, pre_mortem: row ? row.pre_mortem : "", runs: row ? Number(row.runs) || 0 : 0, last_run: row ? row.last_run : "", researched: [], companies };
}

// ---------- reading (remembered briefly in memory) ----------
const MEM = new Map();
const remember = async (key, seconds, load) => {
  const hit = MEM.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await load();
  if (value !== null && value !== undefined) MEM.set(key, { value, until: Date.now() + seconds * 1000 }); // never remember "nothing yet"
  return value;
};
const forget = (key) => MEM.delete(key);

// Business types that have their own file in GitHub (newer than the snapshot).
const savedFiles = () => (gh.enabled() ? remember("files", 20, async () => new Set((await gh.list("data/niches")).map((f) => f.name))) : Promise.resolve(new Set()));

// One business type → { niche, pre_mortem, runs, last_run, researched, companies } or null.
async function loadNiche(niche, fresh = false) {
  const key = `n:${niche}`;
  if (fresh) forget(key);
  return remember(key, 20, async () => {
    if ((await savedFiles()).has(`${slug(niche)}.json`)) {
      const f = await gh.readJson(nicheFile(niche));
      if (f) return f.json;
    }
    const base = fromSnapshot(niche);
    if (base || !gh.enabled()) return base;
    // Not in the snapshot and not in the (briefly remembered) file list: a search may have just saved it — look directly.
    const f = await gh.readJson(nicheFile(niche)).catch(() => null);
    return f ? f.json : null;
  });
}

// Every business type we have data for (snapshot + GitHub files).
async function nicheNames() {
  const names = new Set((snap() ? snap().niches.map((r) => r.niche) : []));
  const files = await savedFiles();
  if (files.size) {
    const { NICHES } = require("./niches");
    for (const n of NICHES) if (files.has(`${slug(n.name)}.json`)) names.add(n.name);
  }
  return [...names];
}

async function companiesFor(niche) {
  const n = await loadNiche(niche);
  return n ? n.companies.map((c) => ({ ...c })) : [];
}
// Load many business types, 10 at a time.
async function loadAll() {
  const names = await nicheNames(), out = [];
  for (let i = 0; i < names.length; i += 10) out.push(...(await Promise.all(names.slice(i, i + 10).map(loadNiche))));
  return out.filter(Boolean);
}
async function allCompanies() {
  return (await loadAll()).flatMap((n) => n.companies.map((c) => ({ ...c, _niche: n.niche })));
}
async function allNiches() {
  return (await loadAll()).filter((n) => n.last_run).map((n) => ({ niche: n.niche, pre_mortem: n.pre_mortem, runs: n.runs, last_run: n.last_run }));
}
async function nicheRow(niche) {
  const n = await loadNiche(niche);
  return n && n.last_run ? { niche, pre_mortem: n.pre_mortem, runs: n.runs, last_run: n.last_run } : null;
}

// ---------- writing a business type (one commit) ----------
async function changeNiche(niche, message, change) {
  if (readOnly()) throw new Error("Research is paused (no GITHUB_TOKEN).");
  let result;
  await gh.updateJson(nicheFile(niche), async (cur) => {
    const base = cur || fromSnapshot(niche) || { niche, pre_mortem: "", runs: 0, last_run: "", researched: [], companies: [] };
    const doc = { ...base, researched: base.researched || [], companies: base.companies.map((c) => ({ ...c })) };
    result = await change(doc);
    return doc;
  }, message);
  forget(`n:${niche}`); forget("files");
  return result;
}

const pickStatus = (c) => ({ status: c.status, status_year: c.status_year, causes: c.causes, risks_handled: c.risks_handled, one_line: c.one_line, reasons: c.reasons });
const ideaHash = (idea) => crypto.createHash("sha1").update(String(idea).trim().toLowerCase()).digest("hex").slice(0, 16);

// Add new companies to the business type; update ones we already have. `idea` (optional) is remembered as a hash
// (never the words — the data branch is public) so the same idea isn't researched again within a week.
async function mergeCompanies(niche, found, simpleName, idea) {
  return changeNiche(niche, `Research: ${niche} (${found.length} companies)`, (doc) => {
    const saved = new Map(doc.companies.map((c, i) => [simpleName(c.name), i]));
    let added = 0, updated = 0;
    for (const c of found) {
      const i = saved.get(simpleName(c.name));
      if (i === undefined) { doc.companies.push({ ...c }); saved.set(simpleName(c.name), doc.companies.length - 1); added++; continue; }
      const old = doc.companies[i];
      // Which status wins? If one run says "shut down"/"acquired" and the other says "running", the
      // shut-down wins: list pages keep naming dead companies long after they close.
      // Otherwise keep the newest (by the year the articles confirm it). Missing details get filled in.
      const oldAlive = old.status === "running", newAlive = c.status === "running";
      const newer = oldAlive !== newAlive ? (oldAlive ? c : old) : (c.status_year || 0) >= (old.status_year || 0) ? c : old;
      const merged = { ...old, ...c, ...pickStatus(newer), sources: [...new Set([...(old.sources || []), ...(c.sources || [])])] };
      for (const field of ["founded_year", "closed_year", "website", "founder_words", "founder_writeup_url"]) {
        if (!c[field] && old[field]) merged[field] = old[field];
      }
      if (c.money_raised === "Not reported" && old.money_raised) merged.money_raised = old.money_raised;
      doc.companies[i] = merged;
      updated++;
    }
    if (idea) doc.researched = [...doc.researched.filter((r) => Date.now() - new Date(r.at) < 30 * 86400000), { h: ideaHash(idea), at: new Date().toISOString() }];
    return { added, updated };
  });
}

// Correct one company's status by hand (e.g. a wrong "acquired"). Returns true if it was found.
async function setStatus(niche, name, status, simpleName) {
  return changeNiche(niche, `Fix: ${name} → ${status}`, (doc) => {
    const c = doc.companies.find((x) => simpleName(x.name) === simpleName(name));
    if (c) c.status = status;
    return !!c;
  });
}

// The pre-mortem stays valid JSON under the size limit: shorten quotes first, then drop extras.
function fitPremortem(p) {
  let text = JSON.stringify(p);
  if (text.length <= MAX_TEXT || !p.risks) return text;
  const slim = {
    ...p,
    risks: p.risks.map((r) => ({ ...r, examples: r.examples.map((e) => ({ ...e, proof: String(e.proof || "").slice(0, 160) })), survivors: r.survivors.slice(0, 1) })),
    checklist: (p.checklist || []).map((q) => ({ ...q, examples: q.examples.slice(0, 2) })),
  };
  text = JSON.stringify(slim);
  if (text.length <= MAX_TEXT) return text;
  return JSON.stringify({ ...slim, risks: slim.risks.map((r) => ({ ...r, survivors: [], examples: r.examples.slice(0, 2) })) });
}

async function saveNiche(niche, premortem) {
  return changeNiche(niche, `Premortem: ${niche}`, (doc) => {
    doc.pre_mortem = fitPremortem(premortem);
    doc.last_run = today();
    doc.runs = (Number(doc.runs) || 0) + 1;
  });
}

// Was this exact idea researched in this business type in the last few days?
async function recentSearchFor(idea, days, niche) {
  if (readOnly()) return true; // no research without storage
  const n = niche ? await loadNiche(niche) : null;
  const h = ideaHash(idea);
  return !!(n && (n.researched || []).some((r) => r.h === h && Date.now() - new Date(r.at) < days * 86400000));
}

// ---------- live progress of a search (loading screen) ----------
const liveFile = (id) => `data/live/${String(id).replace(/[^a-z0-9]/gi, "").slice(0, 40)}.json`;
async function liveUpdate(id, patch) {
  if (readOnly()) return;
  try {
    await gh.updateJson(liveFile(id), (cur) => ({ ...(cur || {}), ...patch, at: new Date().toISOString() }), `Live: ${patch.state || "progress"}`);
    forget(`l:${id}`);
  } catch (err) { console.error("live", err.message); }
}
const liveGet = (id) => remember(`l:${id}`, 2, async () => { const f = await gh.readJson(liveFile(id)); return f ? f.json : null; });

// ---------- mistakes reported by visitors (Data Store, insert only) ----------
const saveMistake = (niche, company, message) =>
  tables().mistakes.insertRow({ niche: niche.slice(0, 250), company: company.slice(0, 250), message: message.slice(0, 2000) });
const allMistakes = () => allRows(tables().mistakes);

// ---------- email sign-ups (Data Store; checking for a duplicate needs a read, so it's best-effort) ----------
async function addSubscriber(email, source) {
  let exists = false;
  try { exists = (await allRows(tables().subscribers)).some((r) => String(r.email).toLowerCase() === email); } catch { /* reads used up this month: just add */ }
  if (!exists) await tables().subscribers.insertRow({ email, source: source.slice(0, 90) });
  return !exists;
}
const allSubscribers = () => allRows(tables().subscribers);

// A search that was answered from saved results (kept for counting; never fails the visitor's search).
async function newSearch(idea, niche, state, progress) {
  try { return (await tables().searches.insertRow({ idea: idea.slice(0, 250), niche, state, progress })).ROWID; } catch { return `s${Date.now()}`; }
}

module.exports = { readOnly, slug, companiesFor, allCompanies, allNiches, nicheRow, mergeCompanies, setStatus, saveNiche, recentSearchFor,
  liveUpdate, liveGet, newSearch, saveMistake, allMistakes, addSubscriber, allSubscribers };
