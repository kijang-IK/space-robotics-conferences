# Weekly update procedure

Instructions for the automated weekly run (every Monday 05:00 KST). The goal is to keep
`data/conferences/*.json` current: newly announced editions, dates, venues, deadlines,
deadline extensions and changed official URLs. Every change must be backed by a source.

## 1. Find what can have changed

```bash
node scripts/build.js            # refresh README/CSV with today's date first
cat data/upcoming.csv
```

Check, for **every** conference in `data/conferences/`:

- the next edition (`next_edition` and any edition whose `end_date` is today or later),
- editions whose `abstract_deadline` is null or whose dates are null,
- whether a new edition / host city / call for papers has been announced,
- whether an announced deadline was **extended** (IAC, ICRA, IROS, EUCASS, APISAT and others
  often extend by 1–3 weeks — the final extended date is the one we store),
- whether `official_url` or the edition `source` URL now redirects or 404s and has a new home.

Prioritise conferences whose deadline is within the next 60 days or still unannounced.

## 2. Rules for editing data

- Only change a value when you have opened a **primary source** yourself: the official
  conference site, the call-for-papers PDF, the organiser's news page (IEEE RAS, IAF, AIAA,
  IAA, ESA, …) or an archived copy of one of those. Aggregators (WikiCFP, conference-index
  sites) may be used only when nothing else exists, and the note must say `(aggregator-only)`.
- `abstract_deadline` = the main regular abstract/paper submission deadline, including official
  extensions. Exclude late-breaking, poster-only, workshop and grace-period dates.
- Dates are `YYYY-MM-DD`. Keep the existing schema, 2-space indentation and a trailing newline.
  Keep `editions` sorted by year. New editions use the same fields as existing ones
  (`year, city, region, country, venue, start_date, end_date, abstract_deadline, source,
  continent, notes`); `continent` is one of Europe, Asia, North America, South America,
  Oceania, Africa.
- For every changed edition, set `source` to the URL that proves the new value and append to
  `notes`: `Weekly update YYYY-MM-DD: <old → new and why>`.
- Never delete editions or sources. Never invent values; leave `null` when unconfirmed.
- Do not edit `data/keywords/` unless a new conference is added (then follow the schema of an
  existing keyword file and `data/keywords/taxonomy.json`).
- Validate every edited file: `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"`.

## 3. Rebuild, log, publish

```bash
node scripts/build.js
```

Write `data/verification/updates/YYYY-MM-DD.md` (the run date) listing every change as a table
(conference, year, field, old, new, source) plus "checked, no change" for conferences you
verified, and anything you could not confirm. If nothing changed, still write the file and say so.

Then commit and push to `main`:

```bash
git add -A
git commit -m "Weekly update YYYY-MM-DD: <n> changes"
git push origin main
```

GitHub Pages redeploys `docs/index.html` automatically after the push.
