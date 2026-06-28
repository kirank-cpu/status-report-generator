# MSR Generator — Monthly Status Report

A React app for preparing Monthly Status Reports across multiple squads and exporting them as a PowerPoint (`.pptx`) deck.

## Features

- **Multiple squads** in a single project — add or remove squads as required.
- **Per-squad mandatory slides**:
  - *Status slide* — manual execution table (per feature, with **Test** and optional **Preprod** Pass/Fail/Blocked groups) and defects table (by severity), each with auto-generated pie charts, plus free-text notes (e.g. JIRA counts).
  - *Deliverables slide* — key deliverables for the current month, plan for next month, and pending dependencies/challenges (shows "NA" when empty).
- **Optional per-squad sections** (toggle on only when relevant):
  - *Preprod execution* — adds a Preprod Pass/Fail/Blocked column group and pie alongside Test.
  - *Automation Metrics slide* — automation execution table (Total, Designed, Executed, Rework / In Progress / Completed, Pass, Fail, computed Completion %, Blocked/Hold), a 9-slice automation pie, and free-text highlights.
- **Custom slides** — any squad can add extra slides (title + bullet content; indent a line with two spaces for a sub-bullet).
- **Collective summary** — an "Overall Summary" slide with a cross-squad table and overall execution/defect pie charts.
- **Branded deck** — magenta title and thank-you slides, footer with company name and page numbers.
- **Real-time collaboration** — see who currently has each report open (on the
  home page and as initials in the report header), who last saved it, and edit
  alongside others: each section (execution, automation, defects, deliverables,
  etc.) auto-locks to one editor at a time so two people can work different
  sections of the same squad without overwriting each other. Presence/locks poll
  every ~3s; saves are section-scoped (see `server/presenceStore.js`).
- **Autosave** — work is saved to the backend automatically as you type.
- **Save/Load JSON** — export the report data as JSON to share or archive, and reload it later.

## Getting started

```bash
npm install
npm run dev      # start the editor at http://localhost:5173
npm run build    # production build
```

## Deployment

The app deploys as a single Render web service that builds the React frontend and
serves it together with the API on one port. Report/user/org data is stored in
[Turso](https://turso.tech) (free, persistent libSQL) so the free, ephemeral host
never loses data. Locally, with no Turso env set, the server falls back to Node's
built-in SQLite (`node:sqlite`) — no setup needed for dev.

**One-time setup**

1. **Turso** — create a free database, then grab its URL and a **database** token:
   ```bash
   turso db show <db-name> --url        # -> TURSO_DATABASE_URL (libsql://...)
   turso db tokens create <db-name>     # -> TURSO_AUTH_TOKEN
   ```
2. **Render** — New + → **Blueprint** → pick this repo. Render reads
   [`render.yaml`](render.yaml) and prompts for the two secrets above. Apply.

The deploy is driven by [`render.yaml`](render.yaml):

| Setting | Value |
| --- | --- |
| Build | `npm install && npm --prefix server install && npm run build` |
| Start | `npm --prefix server start` |
| Health check | `/api/health` |
| Secrets | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (set in Render → Environment) |

**Password-reset email (optional but recommended)**

The "Forgot password" flow emails a reset link via the **Brevo HTTP API**. (We use
an HTTP API, not SMTP, because hosts like Render's free plan block outbound SMTP
ports.) Create a Brevo API key and verify a single sender address — no domain
required — then set these in Render → Environment (see
[`server/.env.example`](server/.env.example)):

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public base URL for links, e.g. `https://status-report-generator.onrender.com` |
| `BREVO_API_KEY` | Brevo API key (`xkeysib-…`) |
| `MAIL_FROM_EMAIL` | The verified Brevo sender address |
| `MAIL_FROM_NAME` | Optional display name, e.g. `MSR Generator` |

If these are unset, reset links are logged to the server console instead of
emailed (handy for local dev). Users set their recovery email under **Account &
password** in the profile menu, or admins set it in **Manage Roles**.

**Shipping updates:** push to the default branch — Render rebuilds and redeploys
automatically. Data persists in Turso across deploys.

**Notes**

- The free Render instance sleeps after ~15 min idle; the next request cold-starts
  in ~50s, then runs normally. Data is unaffected.
- Default seed logins (`admin`/`asha`/`test1`) exist for first run — change their
  passwords immediately after deploying, since the URL is public.
- Server env vars are documented in [`server/.env.example`](server/.env.example).

## Export

Click **Export PPTX** in the top bar. The deck is generated client-side with [pptxgenjs](https://gitbrent.github.io/PptxGenJS/) and downloaded as `MSR_<Title>_<Month>.pptx`.

A Node smoke test for the export logic is available:

```bash
node scripts/test-export.mjs
```

## Slide order in the exported deck

1. Title slide (project title, subtitle, month, company/client)
2. Overall Summary (collective table + overall pie charts)
3. Per squad: status slide → deliverables slide → custom slides (if any)
4. Thank You
