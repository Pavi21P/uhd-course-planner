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

## Degree requirement model - October 12, 2026

Run `./scripts/npm.ps1 run import:chemistry-degree` from the workspace root to
reproduce `data/drafts/chemistry-degree-2025-2026.json`. The two reviewed degree
source fingerprints are pinned; source changes require another interpretation.

- 30 fixed courses total 70 actual credits (36 science/math + 34 major).
- 17 requirement groups include the 42-hour common core, fixed courses, five
  technical-writing choices, two paired-physics choices, computing/statistics
  and a variable free-elective balance. No choice courses are preselected.
- `courseSets` extends the requirement schema to retain complete alternatives.
  Assignment auditing rejects incomplete/mixed physics pairs and both pairs
  assigned together. Legacy requirements without sets continue to work.
- Integrated writing/ethics are overlapping conditions, not extra credit groups.
- Six newly captured science courses become imported core options in the draft.
  CS-specific MATH 2305/core and laboratory-science overlap text is removed.
- Physics mutual-credit exclusions are retained. No overall remaining-hours
  claim is derived from a simple sum of overlapping requirement groups.

Browser source verification was unavailable in this continuation: the browser
connection failed to initialize even after reset; direct catalog search returned
no usable results. CHEM 1305/1105 and Natural Sciences department graduation rules
remain uncaptured. Do not enable Chemistry in the selector until remaining source
coverage and catalog/UI validation are completed. The draft stays unpublished.

Validation: 120 tests, tools typecheck, lint, production build and diff checks passed. Browser QA remains pending; no deployment.

## Scoped Chemistry catalog - October 12, 2026

`src/data/chemistry-bs-catalog.ts` now assembles the two reviewed draft artifacts
into a validated program definition and catalog model. It is not registered in
`App.tsx` and returns `publishable: false` with the remaining source/QA items.

- Program starter: 30 fixed courses, 70 actual credits, no option courses selected.
- Preserves shared course identities and rejects conflicting shared content.
- Carries forward Chemistry/core groups and optional Mathematics/Data Science
  minor groups without CS major requirements or CS-only writing/elective policies.
- Retains prerequisite dependencies and relevant credit-exclusion counterparts.
- Preserves complete physics choices and integrated writing/ethics policy notes.
- Validates missing references, review notices, source IDs and starter consistency.
- Graph checks cover finite layout, valid endpoints, lab concurrency, unresolved
  rules without inferred edges, and absence of mandatory-before cycles.
- Uses an independent Chemistry save key; original CS and Math keys remain intact.

Catalog browser access still fails during initialization. No remaining external
sources were verified in this continuation. Next: restore browser access and
capture CHEM 1305/1105 plus Natural Sciences graduation rules, then update the
catalog and conduct isolated browser QA before selector registration/release.

Validation: all 124 tests, tools typecheck, lint and production build passed. Chemistry is not selectable or deployed; browser QA remains pending.

## Supplemental sources and graduation rules - October 13, 2026

Browser access recovered. Captured five additional course panels and two policy
excerpts from the official 2025-2026 catalog in
`data/sources/2025-2026/chemistry-supplemental-capture.json`, with source URLs,
retrieval date and SHA-256 fingerprints. The original 40-course capture is intact.

- Added CHEM 1305/1105, MATH 1310/0300 and STAT 1312. The intake now contains
  45 courses (40 new, five shared), 36 reviewed prerequisite expressions and nine
  explicitly unresolved cases. No referenced prerequisite course is missing.
- CHEM 1305 joins the unresolved list because its lab/math AND/OR scope is
  ambiguous. It has no inferred incoming edges. CHEM 1105's credit-or-enrollment
  dependency and MATH 0300's concurrent alternatives are explicit.
- Placement-score thresholds are not invented. MATH 0300's successful-completion
  statement describes a TSI outcome, not an additional enrollment prerequisite.
- MATH 0300 adds three enrollment hours and zero degree hours. Department-specific
  restrictions in MATH 1310/STAT 1312 descriptions do not exclude them from Chemistry.
- Newly captured approved options are promoted into the Chemistry core choices.
  Supplemental reference records remain available without being preselected.
- Natural Sciences entity 974 verifies science GPA 2.0, C-or-better upper-level
  science grades, 18 upper-level science credits at UHD with GPA 2.0, satisfactory
  corequisite completion, the degree's upper-level requirement and the exit survey.
- CST entity 966 preserves general education, linked prerequisite/corequisite
  drop rules and transfer reevaluation. Both policy excerpts are fingerprint-bound
  to their reviewed interpretations. These are advising conditions, not automatic
  completion, GPA, residency or graduation assessments.

Next bounded phase: integrate Chemistry into the local selector and complete
isolated browser checks for graph layout, concurrent lab links, requirement
choices, optional minors, independent saves and exports. Retain explicit notices
for the nine ambiguous intake prerequisites; do not invent graph edges. Biology
follows Chemistry. This checkpoint is local only and does not deploy the major.

Validation: all 127 tests, tools typecheck, lint, production build and diff checks passed. Chemistry remains unregistered and unpublished; UI/browser QA is next.
