// researcher — the background job (can run up to 15 minutes). Its "task" param says what to do:
//   research (default): research one idea a visitor searched; progress shown on the website
//   prefill / news / recheck: the scheduled night-time tasks (see nightly.js)

const { zcAuth } = require("@zcatalyst/auth");
const { Cache } = require("@zcatalyst/cache");
const store = require("./store");
const { researchNiche } = require("./research");
const nightly = require("./nightly");

module.exports = async (jobRequest, context) => {
  await zcAuth.init(context);
  const params = jobRequest.getAllJobParams();
  const task = params.task || "research";

  try {
    if (task === "research") {
      const { search_id: searchId, idea, niche } = params;
      const progress = (text) => store.updateSearch(searchId, "running", text);
      // Live headlines + company names for the loading screen, kept for 1 hour in the cache.
      const live = {};
      const feed = async (part) => {
        Object.assign(live, part);
        const seg = new Cache().segment(), key = `f${searchId}`, value = JSON.stringify(live);
        try { await seg.put(key, value, 1); } catch { try { await seg.update(key, value, 1); } catch (err) { console.error("feed", err.message); } }
      };
      const summary = await researchNiche(idea, niche, JSON.parse(params.searches), progress, feed);
      await store.updateSearch(searchId, "done", summary);
      console.log(summary);
    } else {
      const log = await nightly[task](params);
      console.log(`${task}:\n${log.join("\n")}`);
      // keep the last log for 24h so it can be read from /admin/joblog?task=...
      try { const seg = new Cache().segment(), v = JSON.stringify({ at: new Date().toISOString(), log }).slice(0, 9000); try { await seg.put(`log${task}`, v, 24); } catch { await seg.update(`log${task}`, v, 24); } } catch (err) { console.error("joblog", err.message); }
    }
    context.closeWithSuccess();
  } catch (err) {
    console.error(err);
    if (params.search_id) await store.updateSearch(params.search_id, "failed", `Something went wrong: ${err.message}`).catch(() => {});
    context.closeWithFailure();
  }
};
