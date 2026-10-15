import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildBiologyDegreePlan } from '../scripts/biology-degree-plan.ts'
import { buildBiologyIntake } from '../scripts/import-biology.ts'
import { requirementSchema } from '../src/data/catalog-schema.ts'
import { auditRequirementAssignments, calculatePlanCredits } from '../src/data/credit-allocation.ts'
const root = fileURLToPath(new URL('../', import.meta.url))
const plan = await buildBiologyDegreePlan(root)
const intake = await buildBiologyIntake(root)
const group = (id: string) => plan.requirements.find(r => r.id === id)!
const ids = (codes: string[]) => codes.map(code => '2025-2026:' + code)
const assignments = (requirementId: string, courseIds: string[]) => courseIds.map(courseId => ({ requirementId, courseId }))

test('Biology degree draft reproduces fixed requirements without preselecting alternatives', async () => {
  assert.deepEqual(await buildBiologyDegreePlan(root), plan)
  const saved = JSON.parse(await readFile(new URL('../data/drafts/biology-degree-2025-2026.json', import.meta.url), 'utf8'))
  assert.deepEqual(saved, plan)
  assert.equal(plan.publishable, false)
  assert.equal(plan.minimumCredits, 120)
  assert.equal(plan.defaultCourseIds.length, 16)
  assert.equal(plan.fixedCourseCredits, 34)
  assert.equal(group('biology-fixed-science').minimumCredits, 23)
  assert.equal(group('biology-fixed-major').minimumCredits, 11)
  assert.equal(plan.requirements.filter(r => r.area === 'core').reduce((sum, r) => sum + r.minimumCredits!, 0), 42)
  assert.ok(!plan.defaultCourseIds.some(id => /PHYS|TCOM|MATH|CS /.test(id)))
  assert.ok(!plan.requirements.some(r => r.id.startsWith('cs-') || r.area === 'minor'))
  assert.ok(!group('core-020').sourceIds.includes('degree-rules-37'))
  assert.deepEqual(group('biology-math-computing').courseIds, ids(['MATH 2412','CS 1408','CS 1411']))
})

test('High-impact choice accepts six single courses or all six distinct CURE pairs', () => {
  const requirement = group('biology-high-impact')
  assert.equal(requirement.rule, 'choose-set')
  assert.equal(requirement.count, undefined)
  const sets = requirement.courseSets!
  assert.equal(sets.length, 12)
  assert.equal(sets.filter(set => set.length === 1).length, 6)
  assert.equal(sets.filter(set => set.length === 2).length, 6)
  assert.deepEqual(plan.highImpactCreditAlternatives, [3,3,3,3,3,3,2,4,2,4,2,4])
  assert.deepEqual(intake.courses.find(c => c.code === 'BIOL 3107')!.credits, { min: 3, max: 3 })
  assert.ok(plan.remaining.some(note => note.includes('BIOL 3107 explicitly lists 3 credits')))
  for (const set of sets) assert.deepEqual(auditRequirementAssignments(plan.requirements, assignments(requirement.id, set), []), [])
  for (const codes of [['BIOL 3102'], ['BIOL 3300','BIOL 3102'], ['BIOL 3102','BIOL 3104','BIOL 3107'], ['BIOL 3300','BIOL 4399']])
    assert.ok(auditRequirementAssignments(plan.requirements, assignments(requirement.id, ids(codes)), []).length > 0)
  assert.ok(auditRequirementAssignments(plan.requirements, assignments(requirement.id, ids(['BIOL 3102','BIOL 3102'])), []).length > 0)
})

test('New set-choice schema rejects ambiguous counts, duplicates, missing and unknown alternatives', () => {
  const requirement = group('biology-high-impact')
  const sets = requirement.courseSets!
  assert.equal(requirementSchema.safeParse(requirement).success, true)
  for (const changed of [
    { ...requirement, count: 1 }, { ...requirement, courseSets: undefined },
    { ...requirement, courseSets: [sets[0], sets[0]] },
    { ...requirement, courseSets: [...sets, [sets[0][0], sets[0][0]]] },
    { ...requirement, courseSets: [...sets, ['unknown']] },
    { ...requirement, courseSets: sets.slice(1) },
    { ...requirement, rule: 'choose-courses', count: 1 },
  ]) assert.equal(requirementSchema.safeParse(changed).success, false)
  assert.equal(requirementSchema.safeParse(group('biology-physics-1')).success, true)
})

test('Physics choices retain complete pairs and actual unique credit totals', () => {
  for (const level of [1,2]) {
    const requirement = group('biology-physics-' + level)
    const [algebra, calculus] = requirement.courseSets!
    for (const pair of [algebra, calculus]) assert.deepEqual(auditRequirementAssignments(plan.requirements, assignments(requirement.id, pair), []), [])
    assert.ok(auditRequirementAssignments(plan.requirements, assignments(requirement.id, [algebra[0],calculus[1]]), []).length)
    assert.equal(calculatePlanCredits(intake.courses, algebra, []).catalogCredits.min, 4)
    assert.equal(calculatePlanCredits(intake.courses, calculus, []).catalogCredits.min, 5)
  }
  const fixed = calculatePlanCredits(intake.courses, [...plan.defaultCourseIds, ...plan.defaultCourseIds], plan.coursePolicies)
  assert.equal(fixed.uniqueCourseCount, 16)
  assert.deepEqual(fixed.degreeCredits, { min: 34, max: 34 })
})

test('Upper-level areas and integrated requirements overlap the credit pool without extra blocks', () => {
  const pool = group('biology-upper-options')
  assert.equal(pool.minimumCredits, 23)
  assert.equal(plan.contentAreaConditions.length, 4)
  const options = [...new Set(plan.contentAreaConditions.flatMap(area => area.courseIds))].sort()
  assert.deepEqual([...pool.courseIds].sort(), options)
  for (const area of plan.contentAreaConditions) {
    assert.equal(area.minimumCourseCount, 1)
    assert.equal(area.addsSeparateCredits, false)
    assert.ok(!plan.requirements.some(r => r.id === area.id))
  }
  assert.deepEqual(plan.integratedConditions.map(c => c.count), [2,1])
  for (const condition of plan.integratedConditions) assert.ok(!plan.requirements.some(r => r.id === condition.id))
  assert.ok(plan.integratedConditions[0].courseIds.includes('2025-2026:MBIO 4120'))
  assert.ok(plan.integratedConditions[1].courseIds.includes('2025-2026:SUST 4301'))
  assert.equal(plan.allocationRestrictions[0].code, 'BIOL 4302')
  assert.match(group('free-electives').constraints.join(' '), /upper-level/)
  assert.ok(plan.remaining.some(note => note.includes('MBIO 3320 OR MBIO 4340')))
})

test('Cross-listed pharmacology cannot produce a doubled degree-credit total', () => {
  const selected = ids(['BIOL 4344','CHEM 4344'])
  const progress = calculatePlanCredits(intake.courses, selected, plan.coursePolicies)
  assert.equal(progress.degreeCredits, null)
  assert.equal(progress.conflicts[0].policyId, 'biology-exclusive-pharmacology')
  for (const id of selected) assert.deepEqual(calculatePlanCredits(intake.courses, [id], plan.coursePolicies).degreeCredits, { min: 3, max: 3 })
  assert.match(plan.coursePolicies.find(p => p.id === 'biology-research-limit')!.text, /six hours/)
  assert.match(plan.coursePolicies.find(p => p.id === 'biology-special-topics-approval')!.text, /approval/)
})

test('Biology degree interpretations reject changed or wrong-edition source pages', async () => {
  const capture = JSON.parse(await readFile(new URL('../data/sources/2025-2026/biology-bs-capture.json', import.meta.url), 'utf8'))
  const changed = structuredClone(capture)
  changed.pages[0].text = changed.pages[0].text.replace('23 hours', '24 hours')
  changed.pages[0].sha256 = createHash('sha256').update(changed.pages[0].text).digest('hex')
  await assert.rejects(buildBiologyDegreePlan(root, changed), /source changed; re-review/)
  const wrong = structuredClone(capture)
  wrong.pages[0].sourceUrl = wrong.pages[0].sourceUrl.replace('catoid=37', 'catoid=39')
  await assert.rejects(buildBiologyDegreePlan(root, wrong), /edition mismatch/)
})
