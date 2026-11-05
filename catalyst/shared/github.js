// github.js — premortem's storage: JSON files in the "data" branch of the GitHub repo.
// Why: Catalyst's free plan allows only 10,000 Data Store reads a month; GitHub's API allows 5,000 requests an HOUR
// with a token, and keeping the data in git means every change is versioned. Files:
//   data/niches/<slug>.json  — one business type: { niche, pre_mortem, runs, last_run, researched, companies }
//   data/live/<id>.json      — progress of one running search (for the loading screen)
// Needs GITHUB_TOKEN (a fine-grained token with Contents: read & write on this one repo) in keys.txt.

const OWNER = "navneetges-wq", REPO = "premortem", BRANCH = "data";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

const enabled = () => !!process.env.GITHUB_TOKEN;

async function gh(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "premortem",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 404) return null;
  const text = await res.text();
  if (!res.ok) { const err = new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`); err.status = res.status; throw err; }
  return text ? JSON.parse(text) : {};
}

// Make sure the "data" branch exists (created once from main).
let branchReady = false;
async function ensureBranch() {
  if (branchReady) return;
  if (!(await gh("GET", `/git/ref/heads/${BRANCH}`))) {
    const main = await gh("GET", "/git/ref/heads/main");
    await gh("POST", "/git/refs", { ref: `refs/heads/${BRANCH}`, sha: main.object.sha }).catch((e) => { if (e.status !== 422) throw e; });
  }
  branchReady = true;
}

// Read a JSON file → { json, sha } or null if it doesn't exist.
async function readJson(path) {
  const meta = await gh("GET", `/contents/${encodeURI(path)}?ref=${BRANCH}`);
  if (!meta) return null;
  let text;
  if (meta.encoding === "base64" && meta.content) text = Buffer.from(meta.content, "base64").toString("utf8");
  else { // files over 1 MB come without content: fetch the raw file
    const raw = await fetch(meta.download_url, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }, signal: AbortSignal.timeout(20000) });
    text = await raw.text();
  }
  return { json: JSON.parse(text), sha: meta.sha };
}

// Write a JSON file. `change(old)` returns the new content; on a clash with another writer it re-reads and retries.
async function updateJson(path, change, message) {
  await ensureBranch();
  for (let attempt = 1; attempt <= 4; attempt++) {
    const cur = await readJson(path);
    const next = await change(cur ? cur.json : null);
    try {
      const out = await gh("PUT", `/contents/${encodeURI(path)}`, {
        message, branch: BRANCH, sha: cur ? cur.sha : undefined,
        content: Buffer.from(JSON.stringify(next)).toString("base64"),
      });
      return { json: next, sha: out.content && out.content.sha };
    } catch (err) {
      if ((err.status === 409 || err.status === 422) && attempt < 4) continue; // someone else wrote first → try again
      throw err;
    }
  }
}

// File names in a folder → [{ name, sha }] (empty if the folder doesn't exist yet).
async function list(path) {
  const out = await gh("GET", `/contents/${encodeURI(path)}?ref=${BRANCH}`);
  return Array.isArray(out) ? out.map((f) => ({ name: f.name, sha: f.sha })) : [];
}

module.exports = { enabled, readJson, updateJson, list, ensureBranch };
