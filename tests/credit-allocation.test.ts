import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { buildDraft } from '../scripts/catalog-import.ts'
import { parseRequirementCapture } from '../scripts/degree-requirements.ts'
import { calculatePlanCredits, auditRequirementAssignments, reconcileDegreeBudget } from '../src/data/credit-allocation.ts'
import { datasetSchema } from '../src/data/catalog-schema.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const { draft, report } = await buildDraft(root)
const id = (code: string) => `2025-2026:${code}`

test('all ten core groups total 42 and unimported choices do not become course records', () => {
  assert.equal(draft.requirements.length, 19)
  const core = draft.requirements.filter(r => r.area === 'core')
  assert.equal(core.length, 10)
  assert.equal(core.reduce((sum, r) => sum + r.minimumCredits!, 0), 42)
  assert.ok(core.find(r => r.id === 'core-020')?.courseIds.includes(id('MATH 2305')))
  assert.ok(core.find(r => r.id === 'core-050')?.unimportedOptions?.some(o => o.code === 'ART 1310'))
  assert.throws(() => calculatePlanCredits(draft.courses, [id('ART 1310')], report.coursePolicies), /Unknown selected/)
  const invalid = structuredClone(draft)
  invalid.requirements[0].unimportedOptions = [{ code: 'ENG 1301', title: 'Composition I' }]
  assert.equal(datasetSchema.safeParse(invalid).success, false)
})

test('degree budget subtracts each documented overlap once and adjusts science overage', () => {
  assert.equal(report.degreeBudget?.sectionHours, 125)
  assert.deepEqual(report.degreeBudget?.overlaps, { mathematicsCore: 3, scienceCore: 6 })
  assert.equal(report.degreeBudget?.uniqueRequirementHours, 116)
  assert.equal(report.degreeBudget?.freeElectiveBalance, 4)
  assert.equal(report.physicsPathBudget?.sections.laboratoryScience, 10)
  assert.equal(report.physicsPathBudget?.uniqueRequirementHours, 118)
  assert.equal(report.physicsPathBudget?.freeElectiveBalance, 2)
  assert.throws(() => reconcileDegreeBudget(draft.requirements, 6), /below/)
})

test('planned unique credits are counted once and developmental hours are excluded', () => {
  const summary = calculatePlanCredits(draft.courses, ['MATH 2305', 'MATH 2305', 'MATH 1300', 'CS 3310'].map(id), report.coursePolicies)
  assert.equal(summary.uniqueCourseCount, 3)
  assert.deepEqual(summary.catalogCredits, { min: 9, max: 9 })
  assert.deepEqual(summary.degreeCredits, { min: 6, max: 6 })
  assert.deepEqual(summary.excludedCourseIds, [id('MATH 1300')])
  assert.deepEqual(summary.hoursToDegreeMinimum, { min: 114, max: 114 })
})

test('mutually exclusive credit prevents an authoritative total instead of choosing a course silently', () => {
  const summary = calculatePlanCredits(draft.courses, ['MATH 3302', 'STAT 3309'].map(id), report.coursePolicies)
  assert.deepEqual(summary.catalogCredits, { min: 6, max: 6 })
  assert.equal(summary.degreeCredits, null)
  assert.equal(summary.hoursToDegreeMinimum, null)
  assert.equal(summary.conflicts[0].policyId, 'statistics-exclusive-credit')
})

test('variable credits stay ranges and empty selections never inherit requirement-budget hours', () => {
  const variable = { ...draft.courses[0], credits: { min: 1, max: 3 } }
  assert.deepEqual(calculatePlanCredits([variable], [variable.id], []).degreeCredits, { min: 1, max: 3 })
  assert.deepEqual(calculatePlanCredits(draft.courses, [], report.coursePolicies).degreeCredits, { min: 0, max: 0 })
})

test('distinct CS allocations, elective exclusion and conditional writing approval are enforced as review issues', () => {
  const assignments = [
    { courseId: id('CS 3394'), requirementId: 'cs-elective-upper' },
    { courseId: id('CS 4340'), requirementId: 'cs-writing-project' },
    { courseId: id('CS 4340'), requirementId: 'cs-elective-upper' },
  ]
  const issues = auditRequirementAssignments(draft.requirements, assignments, report.coursePolicies)
  assert.ok(issues.some(i => i.courseId === id('CS 3394') && i.reason.includes('cannot fulfill')))
  assert.ok(issues.some(i => i.reason.includes('Approved W-course')))
  assert.ok(issues.some(i => i.reason.includes('multiple distinct CS')))
  assert.deepEqual(auditRequirementAssignments(draft.requirements, [
    { courseId: id('MATH 2305'), requirementId: 'core-020' },
    { courseId: id('MATH 2305'), requirementId: 'support-math' },
  ], report.coursePolicies), [])
})

test('captured requirement changes invalidate reviewed interpretation', async () => {
  const raw = await readFile(new URL('../data/sources/2025-2026/requirement-pages.json', import.meta.url), 'utf8')
  assert.throws(() => parseRequirementCapture(raw.replace('42 hours', '45 hours') + ' '), /source changed/)
})
