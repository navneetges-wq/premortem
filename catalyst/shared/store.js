// store.js — reading and writing our 3 Catalyst tables.
// COMPANIES: one row per company (niche, name_key, status, details = everything else as JSON)
// niches:    one row per business type (pre_mortem, runs, last_run)
// searches:  one row per search someone makes (idea, niche, state, progress)

const { Datastore } = require("@zcatalyst/datastore");
const fs = require("fs");
const path = require("path");

// ---------- read-only snapshot mode ----------
// Catalyst's free plan allows only 10,000 Data Store reads a month. When snapshot.json ships with the code (an export
// made with Catalyst "bulk read"), every READ below comes from that file instead — unlimited and instant — and new
// research is paused (it would need to read the Data Store). Delete snapshot.json to go back to live reads.
let SNAP;
function snap() {
  if (SNAP === undefined) {
    try { SNAP = JSON.parse(fs.readFileSync(path.join(__dirname, "snapshot.json"), "utf8")); } catch { SNAP = null; }
  }
  return SNAP;
}
const readOnly = () => !!snap();

const MAX_TEXT = 9900; // Catalyst "Text" columns hold up to 10,000 characters

const tables = () => {
  const ds = new Datastore();
  return { companies: ds.table("COMPANIES"), niches: ds.table("niches"), searches: ds.table("searches"), mistakes: ds.table("mistakes"), subscribers: ds.table("subscribers") };
};

// Read every row of a table, page by page.
async function allRows(table) {
  const rows = [];
  for await (const row of table.getIterableRows()) rows.push(row);
  return rows;
}

// Keep JSON under the size limit by shortening the longest text parts first.
function fitText(obj) {
  let text = JSON.stringify(obj);
  if (text.length <= MAX_TEXT) return text;
  const slim = { ...obj, story: (obj.story || "").slice(0, 300), sources: (obj.sources || []).slice(0, 5) };
  text = JSON.stringify(slim);
  return text.length <= MAX_TEXT ? text : JSON.stringify({ ...slim, reasons: [], risks_handled: [] }).slice(0, MAX_TEXT);
}

// ---------- companies ----------
async function companiesFor(niche) {
  if (snap()) return snap().companies.filter((r) => r.niche === niche).map((r) => ({ ...r.details, _rowid: r.ROWID }));
  const rows = await allRows(tables().companies);
  return rows.filter((r) => r.niche === niche).map((r) => ({ ...JSON.parse(r.details || "{}"), _rowid: r.ROWID }));
}

// Every saved company across all business types (used by the monthly re-check).
async function allCompanies() {
  if (snap()) return snap().companies.map((r) => ({ ...r.details, _rowid: r.ROWID, _niche: r.niche }));
  return (await allRows(tables().companies)).map((r) => ({ ...JSON.parse(r.details || "{}"), _rowid: r.ROWID, _niche: r.niche }));
}

// Add new companies to the niche's graveyard; update ones we already have.
async function mergeCompanies(niche, found, simpleName) {
  const table = tables().companies;
  const saved = new Map((await companiesFor(niche)).map((c) => [simpleName(c.name), c]));
  let added = 0, updated = 0;

  for (const c of found) {
    const key = simpleName(c.name);
    const old = saved.get(key);
    if (!old) {
      await table.insertRow({ niche, name_key: key, status: c.status, details: fitText(c) });
      added++;
      continue;
    }
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
    delete merged._rowid;
    await table.updateRow({ ROWID: old._rowid, status: merged.status, details: fitText(merged) });
    updated++;
  }
  return { added, updated };
}

// Correct one company's status by hand (e.g. a wrong "acquired"). Returns true if it was found.
async function setStatus(niche, name, status, simpleName) {
  const c = (await companiesFor(niche)).find((x) => simpleName(x.name) === simpleName(name));
  if (!c) return false;
  const fixed = { ...c, status };
  delete fixed._rowid;
  await tables().companies.updateRow({ ROWID: c._rowid, status, details: fitText(fixed) });
  return true;
}

const pickStatus = (c) => ({ status: c.status, status_year: c.status_year, causes: c.causes, risks_handled: c.risks_handled, one_line: c.one_line, reasons: c.reasons });

// ---------- niches ----------
const allNiches = async () => (snap() ? snap().niches.map((r) => ({ ...r })) : allRows(tables().niches));

async function nicheRow(niche) {
  if (snap()) return snap().niches.find((r) => r.niche === niche) || null;
  return (await allRows(tables().niches)).find((r) => r.niche === niche) || null;
}

// The pre-mortem must stay valid JSON under the size limit: shorten quotes first, then drop extras.
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
  const table = tables().niches;
  const row = await nicheRow(niche);
  const fields = { niche, pre_mortem: fitPremortem(premortem), last_run: new Date().toISOString().slice(0, 10) };
  if (row) await table.updateRow({ ROWID: row.ROWID, ...fields, runs: (Number(row.runs) || 0) + 1 });
  else await table.insertRow({ ...fields, runs: 1 });
}

// ---------- mistakes reported by visitors ----------
const saveMistake = (niche, company, message) =>
  tables().mistakes.insertRow({ niche: niche.slice(0, 250), company: company.slice(0, 250), message: message.slice(0, 2000) });
const allMistakes = () => allRows(tables().mistakes);

// ---------- email sign-ups (landing page) ----------
async function addSubscriber(email, source) {
  const exists = (await allRows(tables().subscribers)).some((r) => String(r.email).toLowerCase() === email);
  if (!exists) await tables().subscribers.insertRow({ email, source: source.slice(0, 90) });
  return !exists;
}
const allSubscribers = () => allRows(tables().subscribers);

// ---------- searches ----------
const newSearch = async (idea, niche, state, progress) =>
  (await tables().searches.insertRow({ idea: idea.slice(0, 250), niche, state, progress })).ROWID;
const updateSearch = (id, state, progress) => tables().searches.updateRow({ ROWID: id, state, progress: progress.slice(0, 250) });
const getSearch = (id) => tables().searches.getRow(id);

// Was this exact idea researched in the last few days? (so we don't search for it again and again)
async function recentSearchFor(idea, days) {
  if (snap()) return true; // no research while reading from the snapshot
  const key = idea.trim().toLowerCase();
  return (await allRows(tables().searches)).some((r) => {
    if (String(r.idea || "").trim().toLowerCase() !== key || r.state === "failed") return false;
    // Only real research counts. A search answered from saved results ("Ready (saved results)") is created the moment
    // someone searches — counting it meant the exact-idea research never ran for any business type already researched.
    if (/^(Ready \(saved|Saved results)/.test(String(r.progress || ""))) return false;
    const when = new Date(String(r.CREATEDTIME || "").replace(" ", "T").replace(/:(\d{3})$/, ".$1"));
    return isNaN(when) || (Date.now() - when) / 86400000 < days;
  });
}

module.exports = { readOnly, setStatus, companiesFor, allCompanies, mergeCompanies, allNiches, nicheRow, saveNiche, newSearch, updateSearch, getSearch, recentSearchFor, saveMistake, allMistakes, addSubscriber, allSubscribers };
