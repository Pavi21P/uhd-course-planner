import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDraft } from '../scripts/catalog-import.ts'
import { prepareSnapshot, writeCatalogSnapshot } from '../scripts/publish-catalog.ts'
import { graphPrerequisites, loadCatalogSnapshot } from '../src/data/catalog-snapshot.ts'
import { auditRequirementAssignments, calculatePlanCredits } from '../src/data/credit-allocation.ts'

const input = await buildDraft(fileURLToPath(new URL('../', import.meta.url)))
const snapshot = prepareSnapshot(input)
test('offline artifact round trips with all coverage notes and no student state', () => {
  const loaded = loadCatalogSnapshot(JSON.parse(JSON.stringify(snapshot)))
  assert.ok(loaded.ok)
  assert.equal(loaded.snapshot.catalog.courses.length, 83)
  assert.equal(loaded.snapshot.coverage.unresolvedPrerequisites.length, 7)
  assert.equal(loaded.snapshot.coverage.unimportedOptionCodes.length, 92)
  assert.equal(loaded.snapshot.coverage.automaticEligibilityAssessment, false)
  assert.equal(loadCatalogSnapshot({ ...snapshot, studentReport: {} }).ok, false)
  assert.equal(loadCatalogSnapshot({ ...snapshot, coverage: { ...snapshot.coverage, unresolvedPrerequisites: [] } }).ok, false)
  assert.equal(loadCatalogSnapshot(null).ok, false)
})
test('publication rejects missing or newly unresolved required records', () => {
  const changed = structuredClone(input)
  changed.draft.courses = changed.draft.courses.filter(c => c.code !== 'MATH 2307')
  assert.throws(() => prepareSnapshot(changed), /Unresolved required course/)
  const unresolved = structuredClone(input)
  unresolved.draft.courses.find(c => c.code === 'CS 3304')!.review = 'needs-review'
  assert.throws(() => prepareSnapshot(unresolved), /Unresolved required course/)
})
test('unresolved raw references never become automatic graph dependencies', () => {
  for (const code of ['COMM 1304', 'CS 3331', 'CS 3308'])
    assert.equal(graphPrerequisites(snapshot.catalog.courses.find(c => c.code === code)!), null)
  assert.equal(graphPrerequisites(snapshot.catalog.courses.find(c => c.code === 'CS 3304')!)?.kind, 'all')
})
test('failed refresh preserves previous offline artifact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'uhd-snapshot-'))
  const target = join(dir, 'catalog.json')
  try {
    await writeCatalogSnapshot(target, input)
    const previous = await readFile(target, 'utf8')
    const invalid = structuredClone(input)
    invalid.report.requiredCsCredits = 0
    await assert.rejects(writeCatalogSnapshot(target, invalid), /reconciliation changed/)
    assert.equal(await readFile(target, 'utf8'), previous)
  } finally { await unlink(target); await rmdir(dir) }
})
test('physics allocation requires complete lab pairs and retains duplicate-credit restrictions', () => {
  const one = auditRequirementAssignments(snapshot.catalog.requirements,
    [{ courseId: '2025-2026:PHYS 2401', requirementId: 'support-science' }], snapshot.coursePolicies)
  assert.ok(one.some(i => i.reason.includes('not a complete pair')))
  assert.deepEqual(auditRequirementAssignments(snapshot.catalog.requirements, ['PHYS 2401', 'PHYS 2101'].map(code =>
    ({ courseId: `2025-2026:${code}`, requirementId: 'support-science' })), snapshot.coursePolicies), [])
  assert.ok(snapshot.coursePolicies.some(p => p.kind === 'mutually-exclusive-credit' && p.courseIds.includes('2025-2026:PHYS 1307')))
  assert.throws(() => calculatePlanCredits(snapshot.catalog.courses, ['2025-2026:PHYS 1307'], snapshot.coursePolicies), /Unknown selected/)
})
