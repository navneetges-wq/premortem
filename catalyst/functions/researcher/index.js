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
      // Progress + real headlines for the loading screen go to data/live/<id>.json (GitHub), at most one write per
      // stage (or every 8 s inside a long stage), one at a time so writes never clash.
      let queue = Promise.resolve(), lastKey = "", lastAt = 0;
      const live = (patch) => (queue = queue.then(() => store.liveUpdate(searchId, patch)));
      const progress = (text) => {
        const key = text.replace(/[\d]+/g, "#");
        if (key === lastKey && Date.now() - lastAt < 8000) return;
        lastKey = key; lastAt = Date.now();
        live({ state: "running", progress: text });
      };
      const feedData = {};
      const feed = async (part) => { Object.assign(feedData, part); live({ feed: { ...feedData } }); };
      const summary = await researchNiche(idea, niche, JSON.parse(params.searches), progress, feed);
      await queue;
      await store.liveUpdate(searchId, { state: summary.startsWith("Paused") ? "failed" : "done", progress: summary });
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
    if (params.search_id) await store.liveUpdate(params.search_id, { state: "failed", progress: `Something went wrong: ${err.message}` });
    context.closeWithFailure();
  }
};
