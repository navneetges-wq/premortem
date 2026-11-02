# premortem

**See how your startup idea could fail — before you build it.**

Type a business idea in one line. premortem finds the companies that already tried it, shows which ones shut down and exactly why, and gives you a risk score, your red flags and a one-page summary report. Every company links to the news it came from. Nothing is made up.

- **App:** https://whotriedit-60093906253.development.catalystserverless.in/app/index.html
- **Landing page:** https://whotriedit-60093906253.development.catalystserverless.in/app/landing.html
- **3D graveyard:** https://whotriedit-60093906253.development.catalystserverless.in/app/graveyard.html
- **Short link:** https://navneetges-wq.github.io/premortem/

---

## What you get

| | |
|---|---|
| **Your odds** | A risk score out of 100, from what happened to companies like yours (the maths is shown) |
| **How they died** | The top causes of death, with real quotes and an early warning sign for each |
| **Your red flags** | A 30-second yes/no checklist built from those failures |
| **Who tried it** | Every company found — shut down or still running — each linked to its sources |
| **Summary report** | One page you can download and share |

## Our rules

1. **No source, no company.** Every company must appear in the articles it's linked to.
2. **Real quotes only.** A quote is shown only if it appears word for word in an article.
3. **No guessing.** If a reason isn't reported, it says *"reason not reported"*.
4. **Best case, not worst.** Failures are often unreported, so real odds are usually tougher.
5. **Your idea stays short.** Only the one-line idea is ever sent to the AI.

## How it works

```
Browser ──► Website (catalyst/client) ──► "api" function ──► Data Store
                                              │
                                              └─► "researcher" job ──► Tavily (web search) + Gemini (reads articles)
```

1. The idea is sorted into one of 116 business types (`niches.js`).
2. Already researched → results come back instantly from the Data Store.
3. New → a background job runs 6 searches (Tavily), Gemini reads ~90 articles and lists the companies, and **our own code fact-checks** every company, source and quote (`find.js`).
4. Results are merged into that business type's "graveyard", and the risk score and premortem are rebuilt.
5. Every night the graveyard grows by itself: new business types (1 AM), fresh shut-downs from Indian startup news (7 AM) and a monthly re-check of companies marked "still running".

## Tech stack (all free tiers)

| Part | Used for |
|---|---|
| **Zoho Catalyst** | Web hosting, functions (`api`, `researcher`), Data Store, Cache, job scheduling |
| **Tavily** | Web search for news articles |
| **Google Gemini** (`gemini-3.5-flash-lite`) | Reading articles and extracting companies |
| **Plain HTML / CSS / JavaScript** | The app and landing page — no framework |
| **Three.js** | The 3D graveyard |

## Project layout

```
find.js                 the research engine: search, read, fact-check, score, premortem
niches.js               the 116 business types
catalyst/
  client/               the website (index.html = app, landing.html, graveyard.html)
  functions/api/        quick answers: /search, /status, /results, /stats, /graveyard, /insights, /subscribe, /mistake, /admin/*
  functions/researcher/ long research jobs + the nightly tasks
  shared/               code shared by both functions (Data Store, research, nightly jobs)
  deploy.js             copies shared code into both functions, attaches the keys, deploys
promo/                  the four promo videos and the code that rendered them (see promo/VIDEO-GUIDE.md)
```

## Running it yourself

1. Create a file called `keys.txt` in the project root (it is git-ignored — never commit it):
   ```
   GEMINI_API_KEY=...
   TAVILY_API_KEY=...
   ADMIN_KEY=any-long-random-string
   ```
2. Test the research engine on its own: `node find.js "10-minute grocery delivery"`
3. Deploy to Zoho Catalyst (needs the Catalyst CLI and a project): `cd catalyst && node deploy.js`
4. In the Catalyst Data Store, create the tables `COMPANIES`, `niches`, `searches`, `mistakes` and `subscribers`.

## Free-tier limits

- Tavily: 1,000 searches a month (about 160 new business types)
- New research is limited to 5 jobs per person per day and 15 per day overall; already-researched business types are unlimited.
