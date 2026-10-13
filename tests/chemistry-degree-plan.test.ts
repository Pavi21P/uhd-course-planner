import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildChemistryDegreePlan } from '../scripts/chemistry-degree-plan.ts'
import { requirementSchema } from '../src/data/catalog-schema.ts'
import { auditRequirementAssignments } from '../src/data/credit-allocation.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const plan = await buildChemistryDegreePlan(root)
const group = (id: string) => plan.requirements.find(r => r.id === id)!
const assignments = (requirementId: string, ids: string[]) => ids.map(courseId => ({ requirementId, courseId }))

test('Chemistry requirements reproduce 30 fixed courses and 70 actual credits without preselecting choices', async () => {
  assert.deepEqual(await buildChemistryDegreePlan(root), plan)
  assert.deepEqual(JSON.parse(await readFile(new URL('../data/drafts/chemistry-degree-2025-2026.json', import.meta.url), 'utf8')), plan)
  assert.equal(plan.publishable, false)
  assert.equal(plan.defaultCourseIds.length, 30)
  assert.equal(new Set(plan.defaultCourseIds).size, 30)
  assert.equal(plan.fixedCourseCredits, 70)
  assert.equal(group('chemistry-fixed-science').minimumCredits, 36)
  assert.equal(group('chemistry-fixed-major').minimumCredits, 34)
  assert.equal(plan.requirements.filter(r => r.area === 'core').reduce((n, r) => n + r.minimumCredits!, 0), 42)
  assert.ok(!plan.defaultCourseIds.some(id => /PHYS|TCOM|CS |STAT/.test(id)))
  assert.equal(group('free-electives').minimumCredits, 0)
  assert.ok(plan.remaining.some(text => /Departmental/.test(text)))
})

test('Physics requirement assignment accepts complete pairs and rejects mixed or incomplete pairs', () => {
  for (const id of ['chemistry-physics-1','chemistry-physics-2']) {
    const requirement = group(id)
    const [algebra, calculus] = requirement.courseSets!
    for (const pair of [algebra, calculus]) assert.deepEqual(auditRequirementAssignments(plan.requirements, assignments(id, pair), []), [])
    for (const invalid of [[algebra[0]], [algebra[0], calculus[1]], [...algebra, ...calculus]])
      assert.equal(auditRequirementAssignments(plan.requirements, assignments(id, invalid), []).length, invalid.length)
    assert.deepEqual(auditRequirementAssignments(plan.requirements, [], []), [])
    assert.equal(requirement.minimumCredits, 4)
    assert.equal(requirement.count, 2)
  }
  assert.deepEqual(plan.physicsCreditAlternatives, [[4,5],[4,5]])
  assert.equal(plan.coursePolicies.length, 2)
  assert.ok(plan.coursePolicies.every(policy => policy.kind === 'mutually-exclusive-credit'))
})

test('Course-set schema rejects incomplete, duplicate, unknown and mismatched alternatives', () => {
  const physics = group('chemistry-physics-1')
  const sets = physics.courseSets!
  for (const courseSets of [[sets[0]], [sets[0], [...sets[0]].reverse()], [sets[0], ['missing','other']], [sets[0], [sets[1][0]]]])
    assert.equal(requirementSchema.safeParse({ ...physics, courseSets }).success, false)
  assert.equal(requirementSchema.safeParse({ ...physics, rule: 'all' }).success, false)
  assert.equal(requirementSchema.safeParse({ ...physics, count: 3 }).success, false)
  assert.equal(requirementSchema.safeParse(physics).success, true)
  assert.equal(requirementSchema.safeParse(group('chemistry-writing')).success, true)
})

test('Chemistry retains writing and computing alternatives without adding integrated-condition credits', () => {
  assert.equal(group('chemistry-writing').count, 1)
  assert.equal(group('chemistry-writing').courseIds.length, 5)
  assert.equal(group('chemistry-computing-statistics').count, 1)
  assert.deepEqual(plan.computingCreditAlternatives, [4,4,3])
  assert.deepEqual(plan.integratedConditions.map(condition => condition.count), [2,1])
  assert.ok(plan.integratedConditions[0].courseIds.includes('2025-2026:CHEM 4140'))
  assert.deepEqual(plan.integratedConditions[1].courseIds, ['2025-2026:CHEM 3320'])
  assert.ok(!plan.requirements.some(r => r.id.startsWith('chemistry-integrated')))
  assert.ok(!plan.requirements.some(r => r.area === 'minor' || r.id.startsWith('cs-')))
})

test('Chemistry promotes newly imported core options and removes CS-specific overlap claims', () => {
  const science = group('core-030')
  for (const code of ['BIOL 1301','BIOL 1302','CHEM 1307','CHEM 1308','PHYS 1307','PHYS 1308']) {
    assert.ok(science.courseIds.includes(`2025-2026:${code}`))
    assert.ok(!science.unimportedOptions?.some(option => option.code === code))
  }
  assert.ok(science.unimportedOptions?.some(option => option.code === 'CHEM 1305'))
  assert.ok(!group('core-020').sourceIds.includes('degree-rules-37'))
  assert.ok(!group('core-020').constraints.some(text => /overlaps MATH 2305/.test(text)))
})
