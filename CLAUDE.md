# premortem — notes for Claude

premortem is a free web app for Indian idea-stage founders: type a one-line idea → see companies that already tried it
(shut down / running / acquired, each with news sources), a risk score, how they died, red flags and a summary report.
Owner: Navneet (non-technical). Read README.md for the product and code layout.

## ⚠️ Current state (since 2026-11-04): READ-ONLY SNAPSHOT MODE
Catalyst's free plan allows only 10,000 Data Store reads/month (also 1,000 Cache GETs, 1,000 row UPDATEs, 5,000 INSERTs);
they were used up on 2026-11-04. All reads now come from `catalyst/shared/snapshot.json` (bulk-read export: 3,482
companies, 87 business types). While that file exists: new research, deepening and night jobs are paused with a friendly
message. Do NOT delete snapshot.json or deploy older code — results would break again. Rebuild it with
`/admin/export?table=COMPANIES` (bulk read: 5 exports/month allowed) when the data changes.
Pending owner decision for bringing research back: A) GitHub as storage (recommended), B) wait for the monthly reset,
C) Catalyst pay-as-you-go. Before deploying from a Conductor workspace, make sure it is up to date with origin/main.

## Live links
- App: https://whotriedit-60093906253.development.catalystserverless.in/app/index.html
- Landing: …/app/landing.html · 3D graveyard: …/app/graveyard.html · Privacy/Terms: …/app/privacy.html, terms.html
- API base: https://whotriedit-60093906253.development.catalystserverless.in/server/api
- GitHub: https://github.com/navneetges-wq/premortem · short link (GitHub Pages, `docs/`): https://navneetges-wq.github.io/premortem/
- Visitor stats: GoatCounter https://premortem.goatcounter.com · Zoho PageSense (crmplus.zoho.in, project "premortem1": heatmap "Landing page", session recording "All premortem pages")

## How to talk to the owner
- Simple English, short, no jargon. Show results, not process. When they say "don't ask me anything", just do it.
- Budget is ₹0: stay inside free tiers (Tavily 1,000 searches/month, Gemini free, Catalyst dev env).
- Look and feel: cream #F4F1EA, ink #161616, signal orange #E4502F, fonts Manrope + JetBrains Mono, still glass cards.
  Minimal copy, visual over text. They dislike lag, AI-looking effects (rolling numbers, glitch/decode text) and clutter.

## Hard rules
- Keys live only in `keys.txt` (GEMINI_API_KEY, TAVILY_API_KEY, ADMIN_KEY) — gitignored, injected as env vars by deploy.js.
  Never print, paste or commit them. Before every `git push`, scan the staged diff for each key value.
- No source, no company. Nothing made up. Only the one-line idea is ever sent to Gemini.
- Never sign in, type passwords or create accounts for the owner — give them the steps.

## Deploy
- Everything: `cd catalyst && node deploy.js` (copies ../find.js, ../niches.js and shared/*.js into both functions,
  injects keys, deploys api + researcher + client). "socket hang up" → just retry.
- Website only (safe while a background job runs): `cd catalyst && ~/.catalyst-tool/node_modules/.bin/catalyst deploy --only client`
- Bump `?v=` on landing.css/landing.js/app.js in the HTML after changing them (browsers cache hard). Tell the owner Cmd+Shift+R.

## Architecture in one breath
Catalyst: `api` function (Advanced I/O, 30 s limit) + `researcher` job function (15 min, pool `researchpool`), Data Store
tables COMPANIES / niches / searches / mistakes / subscribers, Cache (max 48 h). Research = Tavily search → Gemini reads
articles → our code fact-checks (find.js). Ideas sort into one of 116 business types (niches.js); `/results` tags each
company "same idea" vs "similar idea" for the visitor's exact sentence (closestToIdea, cached 24 h under key "m2…") and,
when fewer than 5 close matches, starts research on the exact idea in the background ("deepening").
Companies that did the same thing as the idea are kept even if they belong to another business type.

## Admin (header `x-admin-key: <ADMIN_KEY from keys.txt>`)
- `/admin/summary` — business types, credits left, today's research count
- `/admin/run?task=prefill|news|recheck|premortems|acquisitions[&niche=]` — background jobs; `/admin/joblog?task=` reads the last log
- `/admin/run?task=fix&niche=&name=&status=running|shut down|acquired` — correct one company by hand
- `/admin/job?id=`, `/admin/subscribers`, `/admin/mistakes`
Nightly crons: prefill 2 new business types (keeps 450 Tavily credits in reserve), Indian startup news, monthly re-check.

## Gotchas learned the hard way
- Catalyst web hosting serves files as application/octet-stream with no byte ranges → videos can't be seeked and Safari
  won't stream them. The landing film fetches our copy whole (blob URL) and uses the GitHub Pages copy for Safari.
- Every Gemini/Tavily fetch needs a timeout (90 s / 45 s) or one stuck call hangs a 15-min job.
- Avoid live backdrop-filter on many cards and full-screen blended overlays above video — they cause scroll/playback lag.
- Headless Chrome WebGL needs `--use-angle=swiftshader --enable-unsafe-swiftshader` (slow). Graveyard test hooks: `?at=0.x`.
- The promo video pipeline lives in promo/ (see promo/VIDEO-GUIDE.md): `python3 -m http.server 8766` in promo/,
  `node render.cjs 5` → `python3 sound_cine.py 5` → afconvert → `./encode` (compile from encode.swift if missing) →
  `swift webify.swift` for the 9 MB web copy (catalyst/client/assets + docs/).

## Conductor
Each workspace gets the private files via `.conductor/settings.toml` (Files to copy) and `scripts/conductor-setup.sh`,
which falls back to the private backup in `~/.premortem-secrets/`.
