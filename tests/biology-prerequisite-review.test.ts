import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildBiologyIntake } from '../scripts/import-biology.ts'
import { reviewBiologyPrerequisites } from '../scripts/biology-prerequisite-reviews.ts'
import { mandatoryBeforeIds } from '../scripts/prerequisite-audit.ts'
import { graphPrerequisites } from '../src/data/catalog-snapshot.ts'

const intake = await buildBiologyIntake(fileURLToPath(new URL('../', import.meta.url)))
const get = (code: string) => intake.courses.find(course => course.code === code)!

test('Biology lab reviews preserve before-or-concurrent enrollment and explicit lecture/lab conjunctions', () => {
  for (const [lab, lecture] of [['MBIO 2105', 'MBIO 2305'], ['BIOL 3107', 'BIOL 3307'], ['BIOL 4113', 'BIOL 4313']]) {
    assert.deepEqual(get(lab).prerequisites, { kind: 'course', courseId: '2025-2026:' + lecture, timing: 'before-or-concurrent' })
    assert.equal(mandatoryBeforeIds(get(lab).prerequisites).size, 0)
  }
  assert.deepEqual([...mandatoryBeforeIds(get('BIOL 3308').prerequisites)].sort(), ['2025-2026:BIOL 2103', '2025-2026:BIOL 2303'])
  assert.deepEqual([...mandatoryBeforeIds(get('BIOL 4305').prerequisites)].sort(), ['2025-2026:BIOL 1302', '2025-2026:CHEM 2301'])
  assert.equal(graphPrerequisites(get('BIOL 2303')), null)
})

test('Biology reviews preserve non-course requirements without elevating recommendations', () => {
  const cell = get('BIOL 4320')
  assert.match(cell.prerequisiteText, /CHEM 2301 is recommended but not required/)
  assert.deepEqual([...mandatoryBeforeIds(cell.prerequisites)], ['2025-2026:BIOL 2303'])
  assert.match(JSON.stringify(cell.prerequisites), /6 hours of upper-level biology/)
  assert.match(JSON.stringify(get('BIOL 4311').prerequisites), /Senior standing/)
  assert.match(JSON.stringify(get('BIOL 4311').prerequisites), /Majoring in an area of life science/)
  assert.match(JSON.stringify(get('BIOL 3300').prerequisites), /Minimum GPA of 2.0/)
  assert.match(JSON.stringify(get('BIOL 3300').prerequisites), /Permission of instructor/)
  assert.deepEqual(get('CHEM 4344').prerequisites, get('BIOL 4344').prerequisites)
})

test('Shared Biology reviews keep grade thresholds, concurrent timing and external dependency closure', () => {
  const chemistry = get('CHEM 1308').prerequisites
  assert.ok(JSON.stringify(chemistry).includes('"minimumGrade":"C"'))
  assert.ok(JSON.stringify(chemistry).includes('"timing":"before-or-concurrent"'))
  assert.ok(JSON.stringify(get('BIOL 1302').prerequisites).includes('"timing":"concurrent"'))
  assert.equal(graphPrerequisites(get('BIOL 1301')), null)
  assert.equal(graphPrerequisites(get('CHEM 1307')), null)
  assert.deepEqual(intake.report.mandatoryBeforeCycles, [])
  assert.equal(intake.report.dependencyCourseIds.length, 10)
  assert.ok(intake.report.dependencyCourseIds.includes('2025-2026:MATH 2402'))
  assert.ok(intake.report.dependencyCourseIds.includes('2025-2026:MATH 1300'))
  assert.ok(!intake.report.dependencyCourseIds.includes('2025-2026:MBIO 4310'))
})

test('Changed resolved and unresolved Biology statements require a new review', () => {
  for (const code of ['BIOL 3107', 'BIOL 3308', 'BIOL 2303', 'BIOL 4331', 'MBIO 3390']) {
    const changed = structuredClone(get(code))
    changed.prerequisiteText += ' changed'
    assert.throws(() => reviewBiologyPrerequisites([changed], new Map()), /re-review/)
  }
  const wrongYear = structuredClone(get('BIOL 3107'))
  wrongYear.catalogYear = '2026-2027'
  assert.throws(() => reviewBiologyPrerequisites([wrongYear], new Map()), /requires catalog/)
  const unknown = structuredClone(get('BIOL 3107'))
  unknown.code = 'BIOL 9999'; unknown.id = '2025-2026:BIOL 9999'
  assert.throws(() => reviewBiologyPrerequisites([unknown], new Map()), /Missing Biology review/)
})

test('Shared review reuse rejects changed evidence and clones expressions without mutating input', () => {
  const prior = structuredClone(get('CHEM 1308'))
  const incoming = structuredClone(prior)
  const shared = new Map([[prior.code, prior]])
  incoming.prerequisiteText += ' changed'
  assert.throws(() => reviewBiologyPrerequisites([incoming], shared), /re-review/)
  incoming.prerequisiteText = prior.prerequisiteText
  const original = structuredClone(prior)
  const result = reviewBiologyPrerequisites([incoming], shared)
  assert.deepEqual(result.reusedReviewIds, [prior.id])
  assert.notEqual(result.courses[0].prerequisites, prior.prerequisites)
  assert.deepEqual(prior, original)
  assert.deepEqual(incoming, original)
})

test('Unresolved Biology alternatives never leave behind partial or stale graph edges', () => {
  for (const code of ['MBIO 4310', 'BIOL 4332', 'SOC 1303', 'MBIO 4390', 'BIOL 3340']) {
    const incoming = structuredClone(get(code))
    incoming.review = 'verified'
    incoming.prerequisites = { kind: 'course', courseId: '2025-2026:CHEM 4140', timing: 'before' }
    const result = reviewBiologyPrerequisites([incoming], new Map())
    assert.equal(result.courses[0].prerequisites.kind, 'condition')
    assert.equal(graphPrerequisites(result.courses[0]), null)
    assert.ok(result.unresolved[0].reason)
  }
})

test('Supplemental references unlock complete OR choices without making every alternative mandatory', () => {
  const molecular = get('BIOL 4331').prerequisites
  assert.equal(molecular.kind, 'any')
  if (molecular.kind !== 'any') throw new Error('Expected alternatives')
  assert.deepEqual(molecular.items.map(rule => rule.kind === 'course' ? rule.courseId : '').sort(),
    ['2025-2026:BIOL 4320', '2025-2026:BIOL 4330', '2025-2026:CHEM 4140', '2025-2026:MBIO 4310'])
  assert.equal(mandatoryBeforeIds(molecular).size, 0)
  const social = get('BIOL 4350').prerequisites
  assert.deepEqual([...mandatoryBeforeIds(social)], ['2025-2026:ENG 1302'])
  assert.match(JSON.stringify(social), /8 hours of biology/)
  assert.match(JSON.stringify(social), /Junior standing/)
  assert.equal(social.kind, 'all')
  if (social.kind !== 'all') throw new Error('Expected all requirements')
  const choice = social.items.find(rule => rule.kind === 'any')!
  assert.deepEqual(choice, { kind: 'any', items: [
    { kind: 'course', courseId: '2025-2026:PSY 1303', timing: 'before' },
    { kind: 'course', courseId: '2025-2026:SOC 1303', timing: 'before' },
  ] })
})

test('Supplemental prerequisites keep placement, grade, honors and unknown-topic distinctions', () => {
  assert.deepEqual(get('ENG 1302').prerequisites, { kind: 'any', items: [
    { kind: 'course', courseId: '2025-2026:ENG 1301', timing: 'before', minimumGrade: 'C' },
    { kind: 'condition', category: 'placement', text: 'Placement by examination' },
  ] })
  assert.deepEqual(get('PSY 1303').prerequisites, { kind: 'any', items: [
    { kind: 'course', courseId: '2025-2026:ENG 1301', timing: 'before-or-concurrent' },
    { kind: 'condition', category: 'other', text: '010 core complete' },
  ] })
  const honors = JSON.stringify(get('BIOL 4399').prerequisites)
  assert.match(honors, /Senior standing/)
  assert.match(honors, /Enrollment in the Honors Program in the Natural Sciences/)
  assert.match(get('BIOL 4399').description, /No more than six hours credit/)
  for (const code of ['BIOL 3390', 'BIOL 4390', 'SOC 1303', 'MBIO 4310', 'BIOL 4332'])
    assert.equal(graphPrerequisites(get(code)), null)
  assert.ok(intake.report.dependencyCourseIds.includes('2025-2026:ENG 1301'))
})

test('Supplemental interpretations also fail on changed source statements', () => {
  for (const code of ['ENG 1302', 'PSY 1303', 'SOC 1303', 'MBIO 4310', 'BIOL 3390', 'BIOL 4390', 'BIOL 4399', 'BIOL 4350']) {
    const changed = structuredClone(get(code))
    changed.prerequisiteText += ' changed'
    assert.throws(() => reviewBiologyPrerequisites([changed], new Map()), /re-review/)
  }
})
