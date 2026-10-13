# Adding standard BS majors

Started October 11, 2026. Catalog: 2025-2026. User confirmed standard BS plans
for Mathematics, Chemistry and Biology; concentrations and BA variants are outside
this initial expansion. Work in the following bounded phases, recording each checkpoint.

## 1. Program foundation - implemented locally

- ProgramDefinition owns title, initial course, starter requirement groups, supporting
  and elective groups, official degree link, coverage notes and picture identity.
- Major selection remounts the planner and React Flow provider, resetting transient
  dialog/connection/undo state while loading that major's saved plan.
- Separate save key per major and catalog year. CS 2025-2026 keeps its exact original
  key, snapshot version, course/node IDs, selected defaults and coordinates.
- Save conflict detection operates within each major. Switching is disabled when
  saving fails so unsaved edits cannot be discarded through the selector.
- Only reviewed, available programs appear in the dropdown. No empty placeholder
  plans are advertised as working majors.
- The existing 17-course, 54-hour CS starter is covered by a regression test.
- Source leads and uncertainties: ../data/drafts/major-intake-2025-2026.json.

## 2. Mathematics BS - implemented and locally verified

1. Capture the 2025-2026 official degree page (catalog 37), requirements and policies.
2. Reuse existing reviewed MATH/DATA course records. Keep major requirements distinct
   from minor requirements; do not substitute the math minor for the major.
3. Verify fixed mathematics courses, choices, upper-level elective restrictions,
   writing/general requirements and the approved CST minor requirement.
4. Build a separately validated catalog snapshot and program definition. Generalize
   the current CS-only snapshot scope before registering another major.
5. Give the Math program appropriate minor options (not a Mathematics minor of itself).
   The current placeholder minor headings/layout still need to become program-specific.
6. Keep electives and minor cards disconnected; create edges only from reviewed
   prerequisite expressions, never from recommended semester order.
7. Test the major graph and credits; browser-check CS -> Math -> CS save restoration,
   positions, completions, per-major undo, details and exported title/filename.

Math checkpoint: catalog 37 program 7118 verified in Chrome; normalized source
capture is in data/sources/2025-2026/math-bs-requirements.json. The app now offers
Math with 11 fixed courses (38 actual credits, including 3 shared core hours),
computing and elective choices, and one available CST minor option (Data Science).
Other approved minors/concentrations and unimported common-core choices remain
explicitly incomplete. MATH 3408's ambiguous prerequisites stay unconnected.

109 tests, tools typecheck, lint and build pass. Isolated browser checks confirmed
independent CS/Math completions and positions, undo/redo, reload/reopen persistence,
correct minor area and a 67-card/75-connection full-plan PNG. Test edits restored.
No production deployment yet. Chemistry's next catalog page is program 7063.

## 3. Chemistry BS - next

1. Capture the standard Chemistry BS catalog page and complete course descriptions.
2. Import shared CHEM/BIOL/PHYS prerequisites once, preserving course identities.
3. Verify lecture/lab individual credits and prerequisite/concurrent relationships.
   The sequence's combined four-hour lab pair is not evidence of each course's hours.
4. Encode major requirements, choices and elective restrictions with official sources.
5. Add Chemistry to the selector after catalog/schema/graph tests and browser checks.

## 4. Biology BS

1. Resolve the source edition discrepancy: the map under the 2025 directory has a
   July 2025 filename but prints 2024-25 inside. Do not silently relabel it 2025-2026.
2. Capture catalog 37 standard Biology BS requirements, excluding concentrations.
3. Import BIOL/MBIO plus shared chemistry, physics and statistics requirements.
4. Represent the upper-level content-area options, high-impact laboratory and seminar
   choices accurately; retain conditions and approval restrictions.
5. Add Biology after independent data validation and cross-major persistence checks.

## 5. Release

- Full tests, tools typecheck, lint and production build.
- Browser validation at laptop/mobile sizes; switch all four majors, reload each,
  and confirm original CS saves survive unchanged. Check export, dragging, compact
  badges, completion and personal connections for the added majors.
- Commit the verified work; publish only complete, reviewed plans to GitHub/Pages.
- Use ZIP forward-slash paths and verify all deployed assets against local dist.

## Source leads (checked October 11, 2026)

- [Mathematics BS sequence](https://www.uhd.edu/documents/academics/2025-course-sequencing-sb25-26-maps/course-sequence-map-bs-math-8-4-25.pdf)
- [Chemistry BS sequence](https://www.uhd.edu/documents/academics/2025-course-sequencing-sb25-26-maps/course-sequence-map-bs-chemistry-7-24-25.pdf)
- [Biology BS sequence - edition discrepancy](https://www.uhd.edu/documents/academics/2025-course-sequencing-sb25-26-maps/course-sequence-map-bs-biology-7-24-25.pdf)

Sequence maps are discovery references, not complete catalogs or prerequisite rules.
Initial direct fetch returned HTTP 403, but connected Chrome now reads catalog 37.
Mathematics verification and browser QA are complete locally. Chemistry program
7063 and Biology program 7092 were discovered in the official index; capture their
requirements next. No publication of the multi-major expansion yet.
Validation: all 103 tests pass (including six new program/save-isolation tests),
tools typecheck, lint, production build and diff checks passed for the initial
foundation. The subsequent Mathematics checkpoint above includes browser QA.

### Chemistry source intake checkpoint (October 11, 2026)

Saved 40 distinct course panels plus the Chemistry BS and integrated
communication/ethics pages in `data/sources/2025-2026/chemistry-bs-capture.json`.
Two focused integrity tests pass. See `docs/chemistry-source-checkpoint.md` for
requirements, five-credit calculus-physics pairs, corequisite-only CHEM 4164,
and exact next import/review steps. Chemistry remains unavailable in the selector
until prerequisite reviews, departmental rules, catalog construction and QA pass.
Next bounded phase: Chemistry course import and prerequisite review; capture
CHEM 1305/1105 and departmental graduation rules. Biology follows Chemistry.

### Chemistry import checkpoint (October 12, 2026)

The offline importer now builds `data/drafts/chemistry-intake-2025-2026.json`:
40 courses, 35 new and five reused, with 32 prerequisite reviews and eight
unresolved cases. Corequisite-only panels are supported without losing timing.
Shared course conflicts, source changes and mandatory-before cycles stop import.
Production snapshots and the major selector are unchanged. Next: supplementary
CHEM 1305/1105 and departmental source capture, then Chemistry requirements and UI.
