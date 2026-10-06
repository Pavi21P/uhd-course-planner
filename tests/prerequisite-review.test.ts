import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildDraft } from '../scripts/catalog-import.ts'
import { mandatoryBeforeIds, auditMandatoryCycles } from '../scripts/prerequisite-audit.ts'
import { reviewCoursePolicies } from '../scripts/course-policy-reviews.ts'
import type { Course, Prerequisite } from '../src/data/catalog-schema.ts'

const { draft, report } = await buildDraft(fileURLToPath(new URL('../', import.meta.url)))
const get = (code: string) => draft.courses.find(c => c.code === code)!
const c = (code: string, minimumGrade?: string, timing: 'before' | 'concurrent' = 'before'): Prerequisite =>
  ({ kind: 'course', courseId: `2025-2026:${code}`, timing, ...(minimumGrade ? { minimumGrade } : {}) })

test('statistics choice and differential-equations routes preserve nested alternatives', () => {
  assert.deepEqual(get('CS 4319').prerequisites, { kind: 'all', items: [c('CS 3304', 'C'),
    { kind: 'any', items: [c('STAT 3311', 'C'), c('MATH 3302', 'C')] }] })
  assert.deepEqual(get('MATH 3301').prerequisites, { kind: 'any', items: [c('MATH 2412', 'C'), c('MATH 2422', 'C'),
    { kind: 'all', items: [c('MATH 2307', 'C'), c('MATH 2402', 'C')] }] })
  assert.deepEqual([...mandatoryBeforeIds(get('CS 4319').prerequisites)], ['2025-2026:CS 3304'])
})

test('concurrent and placement alternatives do not demand prior completion', () => {
  assert.deepEqual(get('CS 4326').prerequisites, { kind: 'any', items: [c('CS 3324', 'C'), c('CS 3324', undefined, 'concurrent')] })
  assert.equal(mandatoryBeforeIds(get('CS 4326').prerequisites).size, 0)
  const basic = get('CS 1408').prerequisites
  assert.ok(basic.kind === 'all' && basic.items[1].kind === 'condition' && basic.items[1].category === 'placement')
  assert.equal(mandatoryBeforeIds(basic).size, 0)
  const developmental = get('MATH 1300').prerequisites
  assert.ok(developmental.kind === 'all' && developmental.items[1].kind === 'any' &&
    developmental.items[1].items.every(p => p.kind === 'course' && p.timing === 'concurrent' && p.minimumGrade === undefined))
})

test('permission route remains optional and unresolved expressions remain opaque', () => {
  assert.deepEqual(get('CS 4329').prerequisites, { kind: 'any', items: [c('CS 3304'),
    { kind: 'condition', category: 'permission', text: 'approval from the CSET department' }] })
  assert.deepEqual(report.reviewRequired, ['COMM 1304', 'CS 1313', 'CS 3308', 'CS 3331', 'CS 4306', 'CS 4396', 'STAT 3309'])
  for (const code of report.reviewRequired) assert.equal(get(code).prerequisites.kind, 'condition')
  assert.ok(report.prerequisiteReviewIssues.every(i => i.reason !== 'Not yet reviewed.'))
  assert.equal(draft.courses.filter(c => c.review === 'verified').length, 76)
})

test('mandatory cycle audit detects impossible chains without rejecting concurrent or optional paths', () => {
  const make = (code: string, prerequisites: Prerequisite): Course =>
    ({ ...get('CS 3304'), id: `2025-2026:${code}`, code, prerequisites })
  assert.deepEqual(auditMandatoryCycles([make('A', c('B')), make('B', c('A'))]),
    [['2025-2026:A', '2025-2026:B', '2025-2026:A']])
  assert.deepEqual(auditMandatoryCycles([make('A', c('B', undefined, 'concurrent')), make('B', c('A'))]), [])
  assert.deepEqual(auditMandatoryCycles([make('A', { kind: 'any', items: [c('B'), c('C')] }), make('B', c('A'))]), [])
  assert.deepEqual(report.mandatoryPrerequisiteCycles, [])
})

test('credit exclusions and conditional writing use are independent of enrollment prerequisites', () => {
  const policies = report.coursePolicies
  assert.equal(policies.length, 14)
  assert.deepEqual(policies.find(p => p.kind === 'mutually-exclusive-credit')?.courseIds,
    ['2025-2026:MATH 3302', '2025-2026:STAT 3309'])
  assert.deepEqual(policies.find(p => p.kind === 'degree-credit-exclusion')?.courseIds, ['2025-2026:MATH 1300'])
  assert.deepEqual(policies.find(p => p.kind === 'requirement-exclusion')?.courseIds, ['2025-2026:CS 3394'])
  assert.deepEqual(get('CS 4340').prerequisites, c('CS 3321'))
  assert.deepEqual(policies.find(p => p.id === 'writing-use-cs-4340')?.additionalConditions, c('CS 4294'))
  assert.equal(policies.find(p => p.id === 'writing-use-cs-3324')?.additionalConditions?.kind, 'all')
  assert.equal(policies.filter(p => p.kind === 'repeatability').length, 2)
})

test('description changes invalidate policy reviews, and reviews never apply across editions', () => {
  const changed = draft.courses.map(c => c.code === 'CS 3394' ? { ...c, description: c.description + ' Changed policy.' } : c)
  assert.throws(() => reviewCoursePolicies(changed, '2025-2026'), /policy source changed/)
  assert.deepEqual(reviewCoursePolicies(changed, '2026-2027'), [])
})
