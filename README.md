# UHD Course Planner

An independent visual planner for the University of Houston-Downtown's
**2025-2026 Computer Science BS**, with Mathematics and Data Science minor areas.
Built with React, TypeScript, Vite, and React Flow.

**Live website: https://uhd-course-planner.pages.dev**

## Run locally

Install Node.js 22.23.3 or newer (Node 22 LTS recommended), then:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No account, database, API key, or paid service
is needed. Keep using the same browser and address to return to your saved plan.

## Features

- Required CS courses and prerequisites, including ALL/ANY and concurrent conditions.
- Red corner button marks a course Taken. Hide completed courses to bridge the
  visible branch; reveal them or undo to restore the original view.
- Course information with catalog sources, credits, prerequisites, and review notes.
- Drag a course to move its downstream branch. Undo/redo supports graph edits.
- Double-click a course, then click another to add a personal planning connection.
- Disconnected elective choices and Mathematics/Data Science minor areas.
- Light/dark mode, selected credit totals, completed and remaining planned hours.
- Whole-plan PNG preview and save/download, including areas outside the viewport.
- Browser-local persistence. No sign-in or server-side student records.

## Checks

```sh
npm test
npm run typecheck:tools
npm run lint
npm run build
npm run preview
```

The suite covers prerequisite semantics, branch dragging, completion projection,
credits, history/persistence, personal connections, export limits, and catalog
validation. The initial public release passed 94 tests.

## Data and limitations

The app uses a bundled, reviewed **2025-2026** public UHD catalog snapshot,
not a live scrape on every visit. It includes 129 course records, all 47 indexed
MATH courses at 2000+, and all nine DATA courses in this edition. Course records
retain official source links. Raw public captures and import reports are in data/.
Newer catalog research is separate and must not be merged into the active edition.

Eleven prerequisite statements remain unresolved and generate no inferred edges.
Ninety-two core choices have names only and cannot yet be selected. Captured science
choices cover the physics pathway. Grade, transfer, residency, minor overlap, and
requirement-slot fulfillment need manual review. Selecting 120 hours does not
certify graduation eligibility. This is not an official UHD degree audit.

Plans save only in the visitor's browser. Clearing site data removes that save;
different browsers, devices, and website addresses have separate plans. A PNG
is an image, not an editable backup. Private degree reports and saved plans are
excluded from this repository. The optional reconcile:report tool reads only a
local .local/degree-report.json file supplied by its user; it is not required to
run the app or tests.

## Project structure

- src/: interface, graph algorithms, catalog schema, and public snapshot.
- scripts/: offline catalog imports, reviews, publishing, and report reconciliation.
- tests/: Node test-runner suite with synthetic report fixtures.
- data/sources/: public catalog captures with source URLs.
- data/drafts/: reproducible catalog drafts and review reports.

## Deploy your own copy

Build with npm run build, then upload the contents of dist/ to a Cloudflare Pages
Direct Upload project. Other static hosts can serve the same output directory.
The existing public site is a Pages project, not the older workers.dev deployment.

For CLI deployment, sign in to your own Cloudflare account with Pages write access,
choose your own project name in wrangler.jsonc and the deploy script, and run
npm run deploy. Do not add credentials or student records to the repository.
The deploy:check script validates the build without publishing. No cloud
credentials are needed for local development or tests.

## Credits

Inspired by [UofT Course Map](https://www.uoftcoursemap.ca/) and its
[reference repository](https://github.com/tsids/uoft-course-map). This application
was implemented independently; reference source and assets are not bundled.
UHD course text and university names remain attributable to their original
sources; dependency licenses remain with their respective packages. This project
is not affiliated with or endorsed by UHD or the University of Toronto.
