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

## October 14, 2026: source-preserving Biology intake adapter

Added `scripts/import-biology.ts` and generated the separate unpublished draft
`data/drafts/biology-intake-2025-2026.json`. Reproduce from the project root with:

```powershell
node --experimental-strip-types scripts/import-biology.ts
```

The importer validates the catalog/program URL, all source fingerprints, inventory
coverage and course identities before writing a temporary file and replacing the
draft. It does not modify the captured source text or the active app catalog.

- 82 course records imported: 31 source-identical shared courses and 51 new ones.
- BIOL 3390, 4390 and 4399 remain explicit blocked options with no credit value
  and no Course record. Their original panels and fingerprints are retained.
- Empty presentation lines are normalized; BIOL 4302's multiline prerequisite is
  joined. Six cross-list notices remain in both descriptions and panel metadata.
- MBIO 3390's absent prerequisite statement remains unknown. CHEM 4344's inline
  descriptive sentence stays in the original prerequisite text for later review.
- All 82 records remain `needs-review`; no prerequisite graph edges are enabled.
  Existing reviewed records are compared but not overwritten or automatically
  copied. Shared review reuse is part of the next prerequisite-review phase.
- Five missing prerequisite code mentions remain explicit: BIOL 3103, ENG 1302,
  MBIO 4310, PSY 1303 and SOC 1303. They are not silently mapped to other codes.

Next bounded phase: review the Biology prerequisite statements against the saved
panels, reuse exact-match shared reviews with their dependencies, and investigate
missing references/credits using same-edition sources where necessary. Keep
ambiguous expressions unresolved. Degree requirement modeling, selector
registration and browser QA remain later gates. No website deployment performed.

Validation: all 138 tests passed, including six new importer tests. Tools typecheck, lint and staged diff checks passed. No UI/runtime files changed, so a new browser pass was not required for this intake-only checkpoint.

## October 14, 2026: Biology prerequisite interpretation checkpoint

Reviewed the saved catalog-37 prerequisite statements and regenerated the intake:
50 of 82 courses now have reviewed expressions, comprising 29 exact-match shared
reviews and 21 new Biology/MBIO/CHEM/SUST interpretations. The other 32 records
have explicit reasons and no prerequisite graph expressions. Three missing-credit
options remain blocked outside the Course records.

`scripts/biology-prerequisite-reviews.ts` binds every new interpretation or
unresolved reason to its expected source text. A changed statement fails import
and requires another review. Shared reviews are reused only after the importer
compares titles, credits, descriptions and prerequisite text; their expressions
are cloned without overwriting existing data or Biology source identities.

The interpretations preserve before-or-concurrent lab timing, grade thresholds,
standing, major, permission and credit-hour conditions. BIOL 3308 explicitly
requires General Genetics AND its lab. BIOL 4320's recommended CHEM 2301 is not a
required edge. CHEM 4344 retains its inline descriptive sentence in the source
text, with CHEM 4340 as its prerequisite.

Unresolved statements include slash-pair grouping, unclear AND/OR scope, missing
code references, absent prerequisite text and topic-dependent prerequisites.
These retain the entire original statement rather than creating partial edges.
The five missing references and three missing credit values remain unresolved;
no new external source retrieval was performed during this interpretation phase.
Cross-list credit exclusions are preserved as metadata, pending degree modeling.

The importer validates the merged same-edition records and source identities and
checks mandatory-before cycles. No such cycle was found. This audit covers only
mandatory before-enrollment edges in reviewed expressions; it does not establish
registration eligibility or feasibility for unresolved alternatives. The draft
reports nine external prerequisite records needed recursively by reviewed rules:
MATH 1300, 1301, 1302, 1305, 1306, 1324, 1404, 1505 and 2402. These are existing
shared records; no invented aliases or new source data were added.

Next bounded phase: investigate same-edition sources for the five missing
prerequisite references and three missing credit values. Preserve unresolved
results explicitly. Then model Biology degree requirements, including
high-impact/CURE choices and overlapping upper-level options, before selector
integration and browser QA. Publication remains disabled.

Validation: all 144 tests passed, including six new prerequisite semantic/review-guard tests. Tools typecheck, lint and staged diff checks passed. No application UI or active catalog changed.

## October 15, 2026: supplemental sources and credit-policy audit

Saved live same-edition evidence to
`data/sources/2025-2026/biology-supplemental-capture.json`, with fingerprints and
incremental disk persistence. The previous interrupted browser's in-memory work
was re-collected as needed; no unsaved content is presented as a saved capture.

Four formerly missing prerequisite references are present in catalog 37:

- ENG 1302, Composition II: coid 68976; 3 credits; C or better in ENG 1301 or
  placement by examination.
- PSY 1303, Introduction to Psychology: coid 69610; 3 credits; credit or enrollment
  in ENG 1301 (or 010 core complete).
- SOC 1303, Introduction to Sociology: coid 69732; 3 credits. Its panel has no
  prerequisite statement, which remains unknown rather than automatically none.
- MBIO 4310, Microbial Biotechnology: coid 69449; 3 credits. Its grade-qualified
  slash pairs and eight additional upper-level science hours need explicit review.

The exact BIOL 3103 filter returned no courses. Saved the URL, query and rendered
result. This is limited search evidence, not proof of a typo or equivalency;
BIOL 3103 must not silently become BIOL 2103.

The three original BIOL 3390/4390/4399 panels have no credit line. Catalog 37's
Course Credit and Numbering System page (navoid 2421) explicitly says the second
digit gives semester credit hours. Applying that same-edition policy supports
three credits for each. This is an explicit policy-based resolution with both
policy and course-panel fingerprints, not a fabricated credit line. No class or
lab hours are inferred. Preserve this distinction when importing or displaying
provenance. The earlier missing-credit blocks remain in the main intake until
this evidence is integrated in the next phase.

Added `scripts/biology-supplement-audit.ts` and the reproducible separate artifact
`data/drafts/biology-supplement-review-2025-2026.json`. Run:

```powershell
node --experimental-strip-types scripts/biology-supplement-audit.ts
```

The audit checks edition, source identities, fingerprints, exact missing-course
query, and the policy statement. It parses four supplemental records as unreviewed
and records three policy-based credit resolutions. It does not change the primary
Biology intake, existing course catalogs, selector, or public site.

Next bounded phase: integrate these four records and three credit resolutions
with provenance; review the new prerequisites and affected BIOL 4331/4350 rules.
Keep BIOL 3103 and unresolved slash groups explicit. Then model degree choices,
allocation and cross-list restrictions before local UI integration and browser QA.

Validation: all four focused supplemental-audit tests, tools typecheck and lint passed. Staged diff checks passed. The temporary loopback save server was stopped. Main intake and runtime files were unchanged; no new build/browser UI pass was needed.

## October 15, 2026: supplemental integration checkpoint

The primary Biology intake now includes all 85 listed degree options plus four
supplementary courses: 89 records total, with 55 reviewed prerequisite expressions
and 34 explicit unresolved interpretations. All 31 shared source records still
match; 29 shared reviews are reused. The only missing referenced course code is
BIOL 3103. No alias or replacement was inferred.

Applied three source-validated credit resolutions to BIOL 3390/4390/4399. Each
Course retains the original panel source AND the catalog-37 numbering-policy
source. The draft also stores the full credit-resolution evidence, fingerprints,
and `directCreditLinePublished: false`. Raw panels are unchanged; no class/lab
hours or synthetic credit line were added. Standalone panel parsing still blocks
missing credits; only the importer with verified supplemental policy evidence
resolves them. Changed credit lines or prerequisite statements require re-review.

New reviewed expressions preserve ENG 1302's grade/exam alternatives, PSY 1303's
credit-or-enrollment/core alternatives, and BIOL 4399's senior-standing and Honors
Program enrollment conditions. BIOL 4331 now has its complete four-course OR
choice. BIOL 4350 requires ENG 1302, PSY 1303 OR SOC 1303, eight biology hours and
junior standing. SOC 1303's absent prerequisite statement, MBIO 4310's slash groups
and BIOL 3390/4390's topic-dependent prerequisites remain explicitly unresolved.
BIOL 4340 still needs slash-group clarification despite ENG 1302 now being present.

Merged source/reference validation and mandatory-before cycle auditing pass.
The reviewed expressions need ten external shared records: the nine previously
listed math courses plus ENG 1301. This is a dependency list, not additional
degree-credit requirements. The 89 records are a catalog pool, not 89 required
courses or a completed degree plan.

Next bounded phase: model the standard Biology BS requirements from the saved
degree page, including high-impact/CURE alternatives, four upper-level content
areas, overlap limits and cross-list credit exclusions. Biology remains absent
from the selector; degree allocation, local browser QA and deployment are later
steps. Reproduce with `node --experimental-strip-types scripts/import-biology.ts`.

Validation: all 152 tests passed, including new policy-integration and prerequisite semantic/source-guard cases. Tools typecheck, lint and staged diff checks passed. Existing raw captures and active application catalogs were unchanged; no new UI build or browser pass was required.

### Biology degree model checkpoint (October 15, 2026)

Added a reproducible unpublished Biology BS requirement draft with 21 groups,
16 fixed foundation/major courses totaling 34 credits, and no preselected choices.
The core groups total 42 hours. Physics alternatives retain complete lecture/lab
pairs and their actual 4- or 5-credit totals. High-impact experience supports six
single-course alternatives and all six distinct two-course CURE combinations.
The shared schema now permits explicit alternatives of unequal sizes; existing
fixed-count course-set validation remains intact.

The upper-level option pool contains 43 distinct courses and requires 23 unique
hours. Four content-area conditions and integrated writing (two courses)/ethics
(one course) conditions are recorded separately, without adding credit blocks.
Cross-listed pharmacology cannot produce a doubled degree-credit total. Research
limits, topic approval and the explicit BIOL 4302 overlap restriction are retained.

BIOL 3107's captured panel explicitly lists 3 credits, conflicting with the
numbering policy's implied 1. The direct published value is preserved and flagged
for UHD clarification: CURE pairs containing it currently total 4 credits; other
pairs total 2. No silent policy-based override was applied.

Next bounded phase: enforce Biology requirement allocation and overlap checks.
Lecture/lab grouping, the MBIO 3320 OR MBIO 4340 with MBIO 4140 sequence, topic
approval, research limits and overlapping conditions require further review.
The intake still has 34 unresolved prerequisite interpretations and missing
BIOL 3103. Scoped catalog assembly and browser QA precede selector integration.
No push or deployment is part of this checkpoint.

Reproduce: `node --experimental-strip-types scripts/biology-degree-plan.ts`.

Validation: all 159 tests passed, including seven new degree-model cases. Tools typecheck, lint and the production build passed. Browser QA is deferred until scoped catalog integration; no active Biology UI was enabled.

### Biology allocation audit checkpoint (October 15, 2026)

Added `src/data/biology-allocation.ts`, a pure planning audit consuming the reviewed
degree model, selected courses, requirement assignments and explicit area claims.
It blocks BIOL 4302's prohibited high-impact/upper-level overlap, flags other CURE
reuse and cross-area reuse for review, and requires confirmed area-specific
Special Topics approvals. Invalid/unselected/out-of-pool assignments cannot add
pool hours. Cross-listed pharmacology keeps conflicting credit totals unavailable.
Repeated selections and assignments count once; integrated writing/ethics candidates
add no separate credits. Meeting 23 hours does not imply area coverage.

Research reporting distinguishes known selected research from a caller-reported
total that includes repeats and research outside the imported pool. Totals above
six hours flag the degree-credit cap; missing totals require review, and invalid
or understated totals are rejected. A reported total is not verified enrollment
evidence. This audit never certifies degree completion or registration eligibility.

Lecture/lab grouping and the MBIO 3320 OR MBIO 4340 with MBIO 4140 sequence remain
unresolved. Area results say candidates identified, missing or review required;
no area is labeled satisfied. The BIOL 3107 credit discrepancy remains visible.
No UI calls this audit yet. Next bounded phase: assemble the scoped Biology
catalog, retain unresolved notices, and prepare integration validation before
adding the major to the selector. Browser QA and publication remain later gates.

Validation: all 168 tests passed, including nine new allocation cases. Tools typecheck, lint and production build passed. No browser QA was needed for this unconnected data audit; Biology remains absent from the selector.

### Biology scoped catalog checkpoint (October 15, 2026)

Added `buildBiologyCatalog` in `src/data/biology-bs-catalog.ts` and a validated
`biology-bs-planning-catalog` snapshot scope. Assembly combines the base catalog,
reviewed Biology intake and shared Chemistry course records, then retains Biology
requirements, optional Mathematics/Data Science minors, their dependencies and
relevant credit exclusions. It does not carry over Chemistry degree requirements.
The Biology starter remains exactly 16 fixed courses and 34 credits, with all
choices unselected and a distinct per-major storage key.

Shared records must agree on content, credits and reviewed prerequisites; source
provenance is merged. Missing references, duplicate records, conflicting policies
or sources, wrong editions, incomplete unresolved notices, foreign requirements,
invalid conditions and broken allocation restrictions fail validation. The
assembled model retains all six integrated/content-area conditions and the
structured allocation model for the previous checkpoint's audit.

MATH 1310, STAT 1312 and CHEM 1305 core options use the shared Chemistry intake.
Dependency closure also exposes MATH 0300. Its explicit course-description
exclusion is now source-guarded in the Biology degree builder: three enrollment
credits contribute zero degree hours. The BIOL 3107 direct credit value and all
policy-derived credit provenance remain intact. BIOL 3103 remains missing; no
alias or graph edge was invented. Mandatory-before cycle and graph-closure checks
pass. Ambiguous prerequisite expressions remain unconnected.

Next bounded phase: integrate Biology into the local major selector and perform
browser QA, including major switching, storage isolation, starter credits,
choice areas and unresolved-rule notices. The allocation audit still needs a UI
consumer; it must not be presented as an automatic degree audit. No selector
registration, GitHub push or deployment occurred in this assembly checkpoint.

Validation: all 175 tests passed, including seven new catalog-assembly cases. Tools typecheck, lint and production build passed. The source and graph audits passed; browser QA remains pending because Biology is not yet registered in the selector.

### Biology local selector and browser QA (October 15, 2026)

Registered Biology BS beside CS, Mathematics and Chemistry in the local app.
Requirements with complete course-set alternatives now label their hours as a
minimum that varies by choice, including Biology's high-impact/CURE alternatives
and physics pairs. The coverage disclosure explicitly shows the missing BIOL
3103 reference, BIOL 3107 credit discrepancy and unresolved lecture/lab grouping.
These notices do not imply graduation or registration eligibility.

Browser QA used a fresh isolated localhost origin at port 5184, preserving
existing site saves. Verified CS 54, Math 38, Chemistry 70 and Biology 34 starting
hours. Adding BIOL 3107 produced 37; Undo restored 34 and Redo restored 37.
Marking it Taken produced 3 completed and 34 remaining planned hours. Other majors
retained their own totals, and Biology retained its changes after switching and
reload. Removed the test selection/completion afterward, restoring Biology 34/0/34.
Verified course information, high-impact/physics minimum labels, unresolved notices,
Supporting/Electives/Minors sections, collapsed controls and light/dark rendering.
Visual inspection at the browser's approximately 1034px laptop viewport passed;
no browser warnings or errors were reported during these checks.

Validation: all 175 tests, tools typecheck, lint and production build passed.
The degree-draft reproducibility tests were rerun after updating checkpoint text.
No deployment or GitHub push occurred. Next bounded phase: release verification
and publication. The standalone allocation audit remains without an assignment
editor; selecting a course never asserts completion of requirement slots.

### Biology published (October 15, 2026)

The four-major planner is now deployed at https://uhd-course-planner.pages.dev
and source is public on GitHub. Production deployment is
`7d7cf655-e5ef-40bf-942e-9c91b9ab5f4f`, built from application commit `05cc948`
with documentation through `cdf7d95`. All ten deployed assets matched local hashes;
live Biology selection/reload showed its 34-hour starter without browser errors.
See the multi-major release checkpoint for repository coverage and release QA.
Academic draft/review flags remain: publication does not resolve the documented
prerequisite, credit or allocation questions or certify graduation eligibility.
