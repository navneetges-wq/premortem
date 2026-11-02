// research.js — research one business type and add the results to its saved graveyard.
// Used by a visitor's search and by the nightly pre-fill.

const find = require("./find");
const store = require("./store");

// Short headline for the live loading screen (drops " - Site Name" endings).
const headline = (t) => String(t || "").split(/\s[|–-]\s/)[0].trim().slice(0, 90);

// feed(): optional — passes real headlines and company names to the loading screen as we go.
async function researchNiche(idea, niche, searches, progress = async () => {}, feed = async () => {}) {
  await progress(`Searching the web (${searches.length} searches)…`);
  const articles = await find.collectArticles(searches);

  await feed({ titles: articles.map((a) => headline(a.title)).filter((t) => t.length > 12).slice(0, 24) });
  await progress(`Reading ${articles.length} articles…`);
  const names = await find.findCompanies(idea, niche, articles, undefined, (i, n) => progress(`Reading ${articles.length} articles (part ${i + 1} of ${n})…`));
  await feed({ names: names.slice(0, 40).map((n) => String(n.name || n).slice(0, 40)) });
  await progress(`Found ${names.length} companies. Checking each one…`);
  const described = await find.describeCompanies(idea, niche, articles, names, (done, total) => progress(`Checking companies ${done} of ${total}…`));
  const companies = find.cleanUp(described, articles);

  await feed({
    dead: companies.filter((c) => c.status === "shut down").map((c) => c.name).slice(0, 40),
    alive: companies.filter((c) => c.status === "running").map((c) => c.name).slice(0, 40),
  });
  await progress(`Saving ${companies.length} companies…`);
  const { added, updated } = await store.mergeCompanies(niche, companies, find.simpleName);

  // Rebuild "How your idea could fail" from ALL saved companies (not just this run).
  await progress("Working out how ideas like this fail…");
  await refreshPremortem(idea, niche);
  const total = (await store.companiesFor(niche)).length;
  return `Done: ${articles.length} articles, ${names.length} names, ${companies.length} kept; ${added} new, ${updated} updated; ${total} saved in total`;
}

async function refreshPremortem(idea, niche) {
  const all = await store.companiesFor(niche);
  await store.saveNiche(niche, await find.buildPremortem(idea, niche, all));
}

module.exports = { researchNiche, refreshPremortem };
