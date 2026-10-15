# Biology BS source checkpoint - 2025-2026

## October 14, 2026: partial recovery

Source: https://catalog.uhd.edu/preview_program.php?catoid=37&poid=7092&returnto=2409

The browser showed the official standard Biology BS in catalog 37 on October 13,
with the selected edition explicitly 2025-2026. The older sequence PDF's printed
2024-2025 edition is not relabeled or used as this degree's authority.

An interrupted session collected 45 panels in browser memory without submitting
the local save form. That memory is now unavailable and no full Biology capture
exists on disk. On October 14, browser initialization failed twice while loading
its request-header policy; direct web access returned 403. Do not report the 45
panels as saved or retry an import expecting biology-bs-capture.json to exist.

Recovered prior visible tool output into
`data/sources/2025-2026/biology-bs-intake-checkpoint.json`:

- 85 unique linked course codes, grouped by the original degree-page headings.
- Selected literal requirement excerpts, rather than a complete page transcript.
- One complete whitespace-normalized Genetics (BIOL 2303) panel. Its slash-grouped
  prerequisite text remains unreviewed and creates no inferred graph edges.
- Observed alternatives and restrictions recorded separately as research notes,
  not executable requirement or prerequisite definitions.
- Observed date October 13 and recovery date October 14, with fingerprints of the
  local recovered text. These hashes do not certify a fresh live retrieval.

31 inventory courses already occur in the combined CS/minor/Chemistry records;
54 do not, including the recovered Genetics panel. Verify shared content before
reuse. Of the new records, 53 still need complete descriptions captured.

## Rules to preserve during the next phases

- 120-hour minimum; 23 hours of upper-level options with at least one course in
  each of Cell/Molecular, Plant/Fungal, Environmental and Organismal areas.
- One listed high-impact lab OR any two listed CURE courses. Existing courseSets
  require equal set sizes, so do not encode this as the ordinary two-course
  physics selector without extending and validating its model.
- Honors enrollment for BIOL 4399; approval qualifications on specified Special
  Topics choices; BIOL 4302 cannot fill the Organismal slot if used above.
- At most six hours of undergraduate research toward the degree.
- Calculus I: MATH 2411 or MATH 2401. The other math/computing choice lists
  MATH 2412, CS 1408 or CS 1411; MATH 2402 is not a listed replacement.
- Two complete physics lecture/lab alternatives per level; use actual individual
  credits, including the five-hour calculus-physics pairs.
- Seminar: BIOL 4311, MBIO 4311 or SUST 4301. Writing: one of the five TCOM options.
- Integrated writing/ethics and Natural Sciences/CST rules can reuse previously
  verified same-edition source pages after checking relevant Biology options.
- Cross-listing (BIOL/CHEM 4344), lecture/lab choice grouping and requirement
  overlap need explicit review; option-list membership alone settles none of them.

## Next bounded phase

Restore browser access, capture missing BIOL/MBIO/SUST/CHEM panels and compare
shared records, saving to disk after each small batch. Re-capture original degree
layout before encoding choices. Keep this recovery file as provenance rather than
overwriting it with purported raw captures. Then review dependencies, model the
requirements, build the Biology catalog and complete tests/browser QA before
registering Biology. Existing CS, Math and Chemistry behavior remains unchanged.

Validation: both focused recovery tests, tools typecheck and diff checks passed. No application code or active catalogs changed.

## October 14, 2026: complete degree-page and listed-panel capture

This checkpoint supersedes the earlier browser-access and missing-file status.
Browser access recovered; the selected catalog was visibly verified as the
2025-2026 undergraduate archived catalog (37). The complete standard Biology BS
page and all 85 distinct linked course panels are now saved in
`data/sources/2025-2026/biology-bs-capture.json`. Small batches were persisted to
disk with SHA-256 fingerprints. The earlier recovery file remains unchanged as
historical provenance. No academic records were imported into the active app.

Audit results:

- All 85 inventory codes have one matching panel, an official same-edition URL
  and a verified text fingerprint; the full degree page is also fingerprinted.
- The existing strict parser accepts 72 panels as unreviewed courses. All 31
  shared records match existing CS/minor/Chemistry titles, credits, descriptions
  and prerequisite text after whitespace normalization.
- Thirteen panels require explicit import handling: BIOL 4302, 4399, 4344,
  CHEM 4344, MBIO 3390, BIOL 3340, 3140, 3390, 4390, 3302, 3307, 4313 and 4113.
  Issues include blank lines, a multiline prerequisite (4302), cross-list notices
  before prerequisites, and no prerequisite statement (MBIO 3390).
- BIOL 3390, 4390 and 4399 publish no credit line in these captured panels.
  Do not infer credit hours from course numbers or the degree's option listing.
- Among the 72 parsed prerequisite statements, five referenced codes are absent
  from the combined records: BIOL 3103 (BIOL 4332), MBIO 4310 (BIOL 4331),
  ENG 1302 (BIOL 4340/4350), and PSY 1303/SOC 1303 (BIOL 4350).
  These are discovery candidates; legacy names and equivalencies need evidence.
- A scan of all raw text also finds cross-list counterparts MBIO 3350, 3150,
  4313 and 4113, plus description/equivalency references BIOL 1106, 1107, 1305,
  2321, 2121; CHEM 1111, 1112; MATH 2413; PHYS 1101, 2125, 2126.
  Raw mentions are not prerequisite edges or proof these courses must be taken.

Next bounded phase: build a source-preserving Biology intake adapter, resolve or
explicitly block missing-credit records, and review prerequisite statements and
supplementary references. Then model degree choices (including unequal-size
high-impact/CURE alternatives), check allocation and complete browser QA before
registering Biology. Source capture completeness is not catalog readiness.

Validation: all five focused Biology tests and the tools typecheck passed; staged diff checks passed. The temporary loopback capture server was stopped. No runtime changes required a new build or browser UI test.
