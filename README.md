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
- **Autosave** — work is saved to browser localStorage automatically.
- **Save/Load JSON** — export the report data as JSON to share or archive, and reload it later.

## Getting started

```bash
npm install
npm run dev      # start the editor at http://localhost:5173
npm run build    # production build
```

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
