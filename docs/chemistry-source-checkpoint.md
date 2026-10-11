# Chemistry BS source checkpoint - 2025-2026

Captured October 11, 2026 through the visible official catalog in Chrome.
`data/sources/2025-2026/chemistry-bs-capture.json` holds 40 distinct course
panels, the standard BS degree page, and integrated communication/ethics rules.
Each text record has a SHA-256 fingerprint and its official source URL.
This is source intake, not a published Chemistry plan or reviewed prerequisite graph.

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

1. Add handling for the corequisite-only CHEM 4164 panel (coid 70427).
   It has one credit and concurrent CHEM 4364. CHEM 4364 also states this lab
   as a corequisite. Concurrent links must not become impossible before-cycles.
2. Reuse existing TCOM 3302 and PHYS 2401/2101/2402/2102 identities;
   compare captured text before merging. Math and computing/statistics records
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

Validation at this checkpoint: 39 panels parse with the existing offline parser;
the remaining corequisite-only panel is retained verbatim and deliberately rejected
by that parser. Integrity tests guard edition, unique records, source hashes,
physics credits and recommended-versus-required lab wording. No app data changed.
