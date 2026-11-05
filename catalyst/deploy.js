// deploy.js — uploads our code to Catalyst.  Run:  node deploy.js
// 1. copies the shared search code into both functions
// 2. puts the keys from ../keys.txt into each function's private settings (never into the code)
// 3. installs add-ons and deploys

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const keys = Object.fromEntries(
  fs.readFileSync(path.join(root, "keys.txt"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

for (const fn of ["api", "researcher"]) {
  const dir = path.join(__dirname, "functions", fn);
  fs.copyFileSync(path.join(root, "find.js"), path.join(dir, "find.js"));
  fs.copyFileSync(path.join(root, "niches.js"), path.join(dir, "niches.js"));
  for (const file of fs.readdirSync(path.join(__dirname, "shared"))) {
    fs.copyFileSync(path.join(__dirname, "shared", file), path.join(dir, file));
  }

  const configFile = path.join(dir, "catalyst-config.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  config.deployment.env_variables = { GEMINI_API_KEY: keys.GEMINI_API_KEY, TAVILY_API_KEY: keys.TAVILY_API_KEY, ADMIN_KEY: keys.ADMIN_KEY };
  if (keys.GITHUB_TOKEN) config.deployment.env_variables.GITHUB_TOKEN = keys.GITHUB_TOKEN; // storage (data branch); without it research pauses
  fs.writeFileSync(configFile, JSON.stringify(config, null, "\t"));

  console.log(`Installing add-ons for ${fn}…`);
  execSync("npm install --silent @zcatalyst/auth @zcatalyst/datastore @zcatalyst/job-scheduling @zcatalyst/cache", { cwd: dir, stdio: "inherit" });
}

console.log("Deploying to Catalyst…");
execSync(`"${path.join(process.env.HOME, ".catalyst-tool/node_modules/.bin/catalyst")}" deploy`, { cwd: __dirname, stdio: "inherit" });
