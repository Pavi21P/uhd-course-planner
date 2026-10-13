# Chemistry BS source checkpoint - 2025-2026

Captured October 11, 2026 through the visible official catalog in Chrome.
`data/sources/2025-2026/chemistry-bs-capture.json` holds 40 distinct course
panels, the standard BS degree page, and integrated communication/ethics rules.
Each text record has a SHA-256 fingerprint and its official source URL.
This checkpoint includes an offline course import and partial prerequisite review.
It is not a published Chemistry program or complete degree requirement model.

## Verified requirements

- Standard BS: program 7063, catalog 37, minimum 120 total hours.
- Fixed supporting courses: BIOL 1301/1101 and 1302/1102; CHEM 1307/1107,
  1308/1108, 2301/2101 and 2302/2102; MATH 2401, 2402 and 2403.
- Writing: choose one TCOM 3302, 3325, 3326, 3329 or 4306.
- Physics I: PHYS 1307 + 1107 OR PHYS 2401 + 2101.
- Physics II: PHYS 1308 + 1108 OR PHYS 2402 + 2102.
  Preserve complete lecture/lab alternatives, not arbitrary two-course choices.
  The calculus physics pairs are FIVE actual credits each; the algebra physics
  pairs are FOUR. Do not use the sample sequence to override individual credits.
- Computing/statistics: CS 1408 OR CS 1411 OR STAT 3311 (4/4/3 credits).
- Fixed major courses: CHEM 3300, 3310/3110, 3320, 3330/3130, 3332/3132,
  4410, 4340/4140, 4362/4162 and 4364/4164.
- Free electives balance the complete unique-credit plan to at least 120.
- Department integrated requirements: two writing courses and one ethics course.
  Program 7019 lists CHEM 3320 for ethics and CHEM 4140, 4362 and 4364
  for writing, alongside the eligible TCOM choices. These are overlapping
  conditions, not extra credit blocks added to the fixed major courses.

## Import and review next

1. DONE: Added handling for the corequisite-only CHEM 4164 panel (coid 70427).
   It has one credit and concurrent CHEM 4364. CHEM 4364 also states this lab
   as a corequisite. Concurrent links must not become impossible before-cycles.
2. DONE: Compared and reused existing TCOM 3302 and PHYS 2401/2101/2402/2102
   identities, descriptions, credits and reviewed prerequisites. Math and computing/statistics records
   already exist in the shared catalog; do not duplicate them.
3. Capture prerequisite alternatives CHEM 1305 and CHEM 1105; these are the
   only referenced codes missing from the existing catalog plus this intake.
4. Review timing, grades, AND/OR scope and conditions against exact panel text.
   CHEM 2301/2302 describe lab enrollment as recommended, not required.
   CHEM 3330/3332 use 'one year of general physics'; retain the condition
   unless course equivalence is supported. Slashes need explicit review.
   CHEM 3300 requires department approval, instructor permission and GPA 2.0.
5. Capture general graduation requirements of Natural Sciences, which the
   degree page explicitly incorporates. Add common-core sharing/budget rules.
6. Build the Chemistry catalog/program definition, then validate prerequisite
   graph, credit choices, independent saves and UI before enabling the major.

## Import checkpoint - October 12, 2026

Run from the workspace root: `./scripts/npm.ps1 run import:chemistry`.
The reproducible draft is `data/drafts/chemistry-intake-2025-2026.json`;
production snapshots are never overwritten by this command.

- All 40 panels parse, including the corequisite-only Polymer laboratory.
- 35 new courses and five existing shared records; shared content conflicts stop import.
- 32 exact-text-bound prerequisite reviews, eight explicitly unresolved cases.
- Concurrent grade alternatives distinguish a prior C from current enrollment.
- Recommended Organic Chemistry labs stay in the source text without mandatory edges.
- CHEM 3300 retains GPA, department approval and instructor permission conditions.
- Full reference validation against the shared course pool and no mandatory-before cycles.
- CHEM 1305/1105 remain missing raw references, never fabricated course records.

The next phase is supplementary source capture (preparatory chemistry and department
rules), then degree groups/physics alternatives/credit exclusions and Chemistry UI.
The eight unresolved prerequisite reasons are in the draft report and in
`scripts/chemistry-prerequisite-reviews.ts`. Preserve these as notices if the
catalog does not provide enough evidence to resolve them; never infer slash grouping.

Validation: all 115 tests, tools typecheck, lint and diff checks passed. No
production build or browser QA was needed for this offline-only import phase;
Chemistry program/UI integration has not yet started.
