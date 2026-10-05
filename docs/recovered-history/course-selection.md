# Course selection and planned credit progress

Unit 10b completed October 4, 2026.

## Interaction

Each course card has a + button to add it to the plan and a checked button to
remove it. Course information provides the same action with a text label. The
red Taken control remains independent. Required courses can be removed from the
personal plan without changing their official requirement listing.

Selection is keyed by course identity, so all major, elective and minor copies
share the checked state and planned styling. Selecting a course changes neither
its position nor the prerequisite/personal connections. The prerequisite tree
remains a stable reference. All fully imported courses are selectable from the
course lookup, including records that have no dedicated card in the current
regions. The selected-course list in Credit details provides access to them.
Names-only catalog choices cannot be selected until full records are imported.

## Credit meanings

- Total: unique selected catalog credit hours.
- Completed: selected hours marked Taken.
- Remaining: selected hours not marked Taken.

Taken courses outside the selection contribute to none of these totals. Credit
details reports how many such courses exist. Remaining is not an estimate of
hours left to graduate. Grade, residency, transfer, requirement assignments and
major/minor overlap approval remain separate, unassessed constraints.

Credit ranges are partitioned by course rather than subtracting unrelated range
endpoints. Catalog-hour totals retain selected developmental or mutually
exclusive courses, with visible credit-restriction notices. Existing degree
credit exclusions/conflict checks remain intact; no authoritative degree total
is invented when a conflict exists.

## Save compatibility and verification

No save-schema or dataset-version change. The existing selection action and
bounded undo/redo history persist selections alongside independent Taken state,
positions, links and preferences. No imported personal report is automatically
applied. Hiding courses changes only presentation.

77 tests pass, including duplicate identities, unselected Taken courses, empty
and fully completed plans, variable ranges, policy conflicts/exclusions, undo,
redo, reload and hide invariance. Tool typecheck, lint and production build pass.
The pre-existing bundle warning (~657 KB minified) remains for Unit 12.

Browser verification covered both STAT 3311 copies, exact three-hour increment,
completed/remaining repartition, hiding, undo/redo, reload persistence, selection
through course information and the MATH 1300 degree-credit exclusion notice.
All temporary edits were removed; a final reload matched baseline positions,
selection, Taken states and edges exactly. No browser warnings or errors.

Next is Unit 10c: reconcile/import remaining eligible minor choices. Existing
Math and additional-DATA pools remain visibly partial; Unit 10 is still open.
Image export remains Unit 11.
