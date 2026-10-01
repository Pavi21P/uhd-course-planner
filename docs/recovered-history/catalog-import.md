# Catalog import: Unit 3A checkpoint

## Offline publication (September 30)

`publish:catalog` validates current cached sources and writes the scoped planning
snapshot atomically to `src/data/catalog-2025-2026.json`. The app validates and
imports this file locally. Missing/unreviewed required records, changed budgets or
cycles block publication before the existing artifact is touched. The complete
COMM 1304 panel's absent prerequisite statement is an explicit reviewed publication
exception: keep it unknown, flagged and ineligible for automatic graph edges.

The raw draft report still says incomplete/unpublishable as a **complete catalog**.
The separate publication gate permits the **scoped planning catalog** with coverage
metadata, seven unresolved prerequisite notices and 92 unavailable optional choices.
It never claims complete science coverage, minor fulfillment or automatic eligibility.
The snapshot has 14 policies, including physics credit exclusions and lab pairing.
No .local/ student report is loaded or published. All 36 tests and build checks pass.

## Active edition update

The default import now targets **2025–2026**, catalog **37**, from
`data/sources/2025-2026/manifest.json`. It writes `cs-2025-2026.json` and
`import-report-2025-2026.json` under `data/drafts/`. There are now 83 captured courses,
76 reviewed prerequisite expressions, seven unresolved reviews, and two unresolved EET
references. Exact prerequisite-text changes invalidate their review.
The manifest also registers `browser-capture.json`: 60 additional panels with
individual course URLs, edition checks, count checks, and source fingerprints.
Only explicitly listed panels may omit a prerequisite line; those remain unknown.
The report also includes ten reviewed course policies, reasons for the seven
unresolved prerequisite statements, and a scoped mandatory-before cycle audit.
Policy source changes or a detected mandatory cycle stop draft replacement.
`requirement-pages.json` adds 19 reviewed requirement groups, core choice metadata,
and four physics course panels. The report includes the 116-hour minimum budget
and 118-hour captured-physics budget before free electives, plus 92 unimported
core-choice descriptions. See the active source notes for coverage limitations.
See [active source notes](catalog-2025-2026.md) for the next checkpoint.

To explicitly rebuild the separate newer research draft, run
`.\scripts\npm.ps1 run import:catalog -- 2026-2027`. Its report now also has a
year-qualified filename. Unsupported years and mismatched source editions fail.

The remaining original Unit 3A notes below describe the catalog 39 research work.

September 27, 2026. Unit 3 is in progress, not complete.
Follow-up: the current draft has 23 descriptions (the original 19 plus four in
`cs-followup.txt`). Its report now lists eight missing references and 23 reviews.
The historical 3A counts below describe the initial checkpoint only.

## Run without network access

From the workspace root:

```powershell
.\scripts\npm.ps1 run import:catalog
.\scripts\npm.ps1 run test
```

The command reads `uhd-course-planner/data/sources/manifest.json` and the cached
`required-courses.txt`. It validates the capture count, schema, identity uniqueness,
source references, coverage of named required/supporting courses, and required-CS
credit total before writing deterministic artifacts to `data/drafts/`.

Current output: 19 course descriptions, including the 12 required CS courses
totaling 37 credits. The other seven are required supporting courses or alternatives;
both statistics alternatives must not be counted as required simultaneously.
This is not a complete 120-hour degree dataset.

Draft JSON and `import-report.json` are review artifacts outside `src/` and `public/`.
The command has no production publication path. Parse failures leave existing
draft artifacts untouched. Temporary files are renamed only after validation.
Source SHA-256 fingerprints are recorded in the report for change detection.

## Refresh the captured source

The direct downloader returned an empty body and the text-fetch tool could not
access the catalog on this run. Connected Chrome read it successfully. This is a
browser-assisted source capture plus repeatable offline conversion, not a working
unattended scraper. Do not retry an empty response as usable course data.

1. Open the official program URL recorded in the manifest. Confirm catalog 39,
   2026-2027 Undergraduate, is still selected.
2. Expand each required course and supporting-course link in the program page.
3. Capture each course panel's heading, Credits/Class/Lab line, prerequisite line,
   and entire description. Course panel text comes from the parent of its heading.
4. Normalize nonbreaking spaces and excess whitespace only; retain conditions,
   grade thresholds, equivalence statements, and restrictions.
5. Save blocks separated by `---COURSE---`, update the manifest retrieval date,
   expected count, and any newly included source references.
6. Run the import command and inspect the report. Changed formats fail closed;
   extend the parser only after reviewing the new source format.

Never infer credits from the course number. Never infer graph edges from the
course-code scan: that scan only discovers missing source candidates. All current
prerequisites remain explicit unreviewed condition text. No blank/missing
prerequisite line is interpreted as “no prerequisites.”

## Next checkpoint: Unit 3B

- Capture COMM 1304, ENG 1301, MATH 1306, MATH 1404, MATH 1505, MATH 2409,
  MATH 2411, and MATH 2421; recursively resolve further references. CS 1408
  is now captured; ENG 1301 appears as a placement condition in its prerequisite text.
- Enumerate all eligible CS electives from the catalog course index, accounting
  for pagination. The program page's example clusters are not an exhaustive list.
- Add core, laboratory-science and elective requirement groups with source links.
- Review complex prerequisites into structured all/any/course/condition expressions;
  preserve original text and bind reviewed overrides to source fingerprints.
- Check for unexpected prerequisite cycles separately from valid corequisites.
- Reconcile the degree: catalog's 55 CS hours includes 37 required + 18 elective;
  count mathematics/science core overlaps once; validate remaining free hours.
- Publish a production snapshot only when all required coverage and semantic
  reviews pass. Missing or malformed refreshes must preserve the last valid snapshot.
- Load the resulting snapshot without a runtime network request. Stop before Unit 4.

Minor selections remain Mathematics and Data Science; full minor population and
cross-program fulfillment calculations are still scheduled for Unit 10.
