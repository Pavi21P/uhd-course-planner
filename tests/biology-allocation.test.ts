import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildBiologyDegreePlan } from '../scripts/biology-degree-plan.ts'
import { buildBiologyIntake } from '../scripts/import-biology.ts'
import { auditBiologyAllocation, type BiologyAllocationInput } from '../src/data/biology-allocation.ts'
const root = fileURLToPath(new URL('../', import.meta.url))
const model = await buildBiologyDegreePlan(root)
const { courses } = await buildBiologyIntake(root)
const id = (code: string) => '2025-2026:' + code
const pool = 'biology-upper-options'
const high = 'biology-high-impact'
const area = (name: string) => 'biology-area-' + name
const assignment = (code: string, requirementId = pool) => ({ courseId: id(code), requirementId })
const claim = (code: string, name: string) => ({ courseId: id(code), areaId: area(name) })
const audit = (patch: Partial<BiologyAllocationInput> = {}) => auditBiologyAllocation(model, courses,
  { selectedCourseIds: [], assignments: [], areaClaims: [], ...patch })

test('Empty Biology allocation retains missing coverage and does not infer research history', () => {
  const result = audit()
  assert.ok(result.areas.every(a => a.status === 'missing'))
  assert.ok(result.integrated.every(a => a.status === 'missing'))
  assert.deepEqual(result.upperLevelPool.provisionalCredits, { min: 0, max: 0 })
  assert.equal(result.upperLevelPool.reachesCreditMinimum, false)
  assert.equal(result.research.status, 'review-required')
  assert.equal(result.automaticEligibilityAssessment, false)
})

test('BIOL 4302 cannot fill high-impact and upper-level slots together', () => {
  const result = audit({ selectedCourseIds: [id('BIOL 4302')], assignments: [assignment('BIOL 4302'), assignment('BIOL 4302', high)], areaClaims: [claim('BIOL 4302','organismal')] })
  assert.equal(result.issues.filter(i => i.code === 'prohibited-overlap').length, 2)
  assert.equal(result.upperLevelPool.provisionalCredits, null)
  assert.equal(result.areas.find(a => a.id === area('organismal'))!.status, 'review-required')
  assert.equal(result.selectedCredits.catalogCredits.min, 3)
  assert.ok(!audit({ selectedCourseIds: [id('BIOL 4302')], assignments: [assignment('BIOL 4302')] }).issues.some(i => i.code === 'prohibited-overlap'))
})

test('CURE reuse remains review-required even with a complete high-impact pair', () => {
  const result = audit({ selectedCourseIds: ['BIOL 3102','BIOL 3104'].map(id), assignments: [assignment('BIOL 3102'), assignment('BIOL 3102',high), assignment('BIOL 3104',high)], areaClaims: [claim('BIOL 3102','environmental')] })
  assert.ok(result.issues.some(i => i.code === 'overlap-review'))
  assert.ok(!result.issues.some(i => i.code === 'invalid-assignment'))
  assert.equal(result.upperLevelPool.provisionalCredits, null)
})

test('Special Topics approval is area-specific and cannot approve an unassigned or unlisted course', () => {
  const input = { selectedCourseIds: [id('MBIO 3390')], assignments: [assignment('MBIO 3390')], areaClaims: [claim('MBIO 3390','environmental')] }
  const wrong = audit({ ...input, topicApprovals: [claim('MBIO 3390','cell-molecular')] })
  assert.ok(wrong.issues.some(i => i.code === 'topic-approval-required'))
  assert.equal(wrong.upperLevelPool.provisionalCredits, null)
  const approved = audit({ ...input, topicApprovals: input.areaClaims })
  assert.ok(!approved.issues.some(i => i.code === 'topic-approval-required'))
  assert.equal(approved.upperLevelPool.provisionalCredits!.min, 3)
  const invalid = audit({ ...input, areaClaims: [claim('MBIO 3390','organismal')], topicApprovals: [claim('MBIO 3390','organismal')] })
  assert.ok(invalid.issues.some(i => i.code === 'invalid-area-claim'))
  assert.equal(invalid.upperLevelPool.provisionalCredits, null)
})

test('Cross-area reuse and pharmacology cross-lists cannot silently satisfy coverage', () => {
  const result = audit({ selectedCourseIds: [id('BIOL 4344')], assignments: [assignment('BIOL 4344')], areaClaims: [claim('BIOL 4344','cell-molecular'), claim('BIOL 4344','organismal')] })
  assert.ok(result.issues.some(i => i.code === 'area-overlap-review'))
  assert.equal(result.upperLevelPool.provisionalCredits, null)
  const conflict = audit({ selectedCourseIds: ['BIOL 4344','CHEM 4344'].map(id), assignments: [assignment('BIOL 4344'), assignment('CHEM 4344')] })
  assert.equal(conflict.selectedCredits.degreeCredits, null)
  assert.equal(conflict.upperLevelPool.provisionalCredits, null)
  assert.equal(conflict.integrated.find(c => c.id === 'biology-integrated-ethics')!.status, 'review-required')
})

test('Distinct candidates and duplicate input count once without adding integrated credits', () => {
  const codes = ['BIOL 3308','BIOL 3330','BIOL 4360','BIOL 4303','TCOM 3302','BIOL 4310']
  const result = audit({ selectedCourseIds: [...codes, ...codes].map(id), assignments: [...codes.slice(0,4), 'BIOL 3308'].map(code => assignment(code)),
    areaClaims: [claim('BIOL 3308','cell-molecular'),claim('BIOL 3330','plant-fungal'),claim('BIOL 4360','environmental'),claim('BIOL 4303','organismal'),claim('BIOL 3308','cell-molecular')], reportedTotalResearchCredits: 0 })
  assert.equal(result.issues.length, 0)
  assert.ok(result.areas.every(a => a.status === 'candidates-identified' && a.candidateCourseIds.length === 1))
  assert.ok(result.integrated.every(c => c.status === 'candidates-identified'))
  assert.equal(result.upperLevelPool.provisionalCredits!.min, 12)
  assert.equal(result.selectedCredits.catalogCredits.min, 18)
  assert.equal(result.upperLevelPool.groupingReviewRequired, true)
})

test('Research cap includes caller-reported repeat hours and rejects invalid totals', () => {
  const selectedCourseIds = ['BIOL 3300','BIOL 4399'].map(id)
  assert.equal(audit({ selectedCourseIds }).research.status, 'review-required')
  assert.equal(audit({ selectedCourseIds, reportedTotalResearchCredits: 6 }).research.status, 'within-reported-limit')
  const over = audit({ selectedCourseIds, reportedTotalResearchCredits: 9 })
  assert.equal(over.research.status, 'over-limit')
  assert.ok(over.issues.some(i => i.code === 'research-over-limit'))
  for (const reportedTotalResearchCredits of [3, -1, NaN, Infinity])
    assert.throws(() => audit({ selectedCourseIds, reportedTotalResearchCredits }), /Reported research credits/)
  assert.equal(audit({ reportedTotalResearchCredits: 9 }).research.status, 'over-limit')
})

test('Unknown, unselected and wrong-pool assignments cannot contribute pool hours', () => {
  assert.throws(() => audit({ selectedCourseIds: ['unknown'] }), /Unknown selected/)
  assert.throws(() => auditBiologyAllocation({ ...model, programId: 'chemistry-bs' }, courses, { selectedCourseIds: [], assignments: [], areaClaims: [] }), /Biology model/)
  for (const input of [
    { assignments: [assignment('unknown')] },
    { assignments: [assignment('BIOL 3308')], areaClaims: [claim('BIOL 3308','cell-molecular')] },
    { selectedCourseIds: [id('BIOL 1301')], assignments: [assignment('BIOL 1301')] },
  ]) {
    const result = audit(input)
    assert.ok(result.issues.length)
    assert.equal(result.upperLevelPool.provisionalCredits, null)
  }
})

test('Reaching 23 pool hours does not imply content-area coverage or completed requirements', () => {
  const codes = ['BIOL 3308','BIOL 4320','BIOL 4330','BIOL 3330','BIOL 3310','BIOL 3340','BIOL 4360','BIOL 4303']
  const input = { selectedCourseIds: codes.map(id), assignments: codes.map(code => assignment(code)) }
  const result = audit(input)
  assert.equal(result.upperLevelPool.provisionalCredits!.min, 24)
  assert.equal(result.upperLevelPool.reachesCreditMinimum, true)
  assert.ok(result.areas.every(a => a.status === 'missing'))
  assert.equal(result.upperLevelPool.groupingReviewRequired, true)
  assert.equal(audit({ selectedCourseIds: codes.map(id) }).upperLevelPool.provisionalCredits!.min, 0)
  assert.equal(audit({ ...input, assignments: input.assignments.slice(1) }).upperLevelPool.reachesCreditMinimum, false)
})
