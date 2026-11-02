// render.cjs — capture every frame of video.html?v=N with headless Chrome. Usage: node render.cjs N [fps] [onlyTimes]
const { chromium } = require(process.env.HOME + "/.claude/skills/gstack/node_modules/playwright");
const fs = require("fs");
(async () => {
  const v = process.argv[2] || "1", fps = +(process.argv[3] || 30), only = process.argv[4];
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const pg = await b.newPage();
  pg.on("pageerror", (e) => console.log("PAGEERR", e.message));
  await pg.goto(isNaN(+v) ? `http://localhost:8766/${v}.html` : `http://localhost:8766/video.html?v=${v}`);
  await pg.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  const { W, H, DURATION, CUES, BPM, MOOD } = await pg.evaluate(() => ({ W, H, DURATION, CUES, BPM, MOOD }));
  await pg.setViewportSize({ width: W, height: H });
  const out = `frames${v}`; fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(`cues${v}.json`, JSON.stringify({ duration: DURATION, bpm: BPM, mood: MOOD, cues: CUES }));
  const times = only ? only.split(",").map(Number) : Array.from({ length: Math.round(DURATION * fps) }, (_, i) => i / fps);
  let n = 0;
  for (const t of times) {
    await pg.evaluate((t) => renderAt(t), t);
    await pg.screenshot({ path: only ? `test${v}_${t}.jpg` : `${out}/${String(n).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92, clip: { x: 0, y: 0, width: W, height: H } });
    n++;
    if (!only && n % 150 === 0) console.log(`v${v}: ${n}/${times.length}`);
  }
  await b.close();
  console.log("done", n);
})();
