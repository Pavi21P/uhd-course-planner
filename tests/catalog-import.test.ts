import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { auditCapture, buildDraft, parseCourseCapture } from '../scripts/catalog-import.ts'
import { applyPrerequisiteReviews } from '../scripts/prerequisite-reviews.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const raw = await readFile(new URL('../data/sources/required-courses.txt', import.meta.url), 'utf8')
const parse = (text: string) => parseCourseCapture(text, '2026-2027', 'cs-program-39')

test('real capture preserves grade, concurrency, and non-course restrictions', () => {
  const courses = parse(raw)
  assert.equal(courses.length, 19)
  assert.equal(courses.find(c => c.code === 'CS 2411')?.prerequisiteText,
    'Grade of C or better in CS 1411; credit or enrollment in MATH 2401.')
  assert.match(courses.find(c => c.code === 'CS 4395')!.prerequisiteText, /B or better.*GPA of 3.0.*department approval/)
  assert.ok(courses.every(c => c.review === 'needs-review' && c.prerequisites.kind === 'condition'))
})

test('empty, partial, and altered source formats fail closed', () => {
  for (const invalid of ['', '<html>Access denied</html>', raw.replace('Credits: 4', 'Credits: unknown'),
    raw.replace('Prerequisite(s): Credit or enrollment in MATH 1404 or MATH 1505.', '')])
    assert.throws(() => parse(invalid))
})

test('duplicates, missing courses, and unexpected credit changes fail', () => {
  const courses = parse(raw)
  assert.throws(() => auditCapture([...courses, courses[0]], ['CS 1411'], 4), /Duplicate/)
  assert.throws(() => auditCapture(courses, ['CS 9999'], 3), /Missing/)
  assert.throws(() => auditCapture(courses, ['CS 1411'], 3), /credit mismatch/)
})

test('offline draft is reproducible and explicitly unpublishable', async () => {
  const first = await buildDraft(root, '2026-2027')
  assert.deepEqual(first, await buildDraft(root, '2026-2027'))
  assert.equal(first.report.requiredCourseCount, 12)
  assert.equal(first.report.requiredCsCredits, 37)
  assert.equal(first.report.publishable, false)
  assert.deepEqual(first.report.missingReferencedCourses,
    ['COMM 1304', 'ENG 1301', 'MATH 1306', 'MATH 1404', 'MATH 1505', 'MATH 2409', 'MATH 2411', 'MATH 2421'])
  assert.equal(first.report.reviewRequired.length, 23)
})

test('active archived edition remains separate from newer research', async () => {
  const current = await buildDraft(root)
  assert.equal(current.draft.catalogYear, '2025-2026')
  assert.equal(current.report.courseCount, 83)
  assert.equal(current.report.requiredCsCredits, 37)
  assert.equal(current.report.reviewRequired.length, 7)
  assert.equal(current.report.publishable, false)
  assert.ok(current.draft.sources.every(s => new URL(s.url).searchParams.get('catoid') === '37'))
  assert.ok(current.draft.courses.every(c => c.id.startsWith('2025-2026:')))
  await assert.rejects(buildDraft(root, '../2026-2027'), /Unsupported catalog/)
  assert.deepEqual(current.report.missingReferencedCourses, ['EET 2131', 'EET 2331'])
})

test('omitted prerequisite statements stay unknown and require a reviewed exception', () => {
  const text = 'CS 1313 - Principles of Game Design\nCredits: 3 Class: 3 Lab: 0\nA course description.'
  assert.throws(() => parseCourseCapture(text, '2025-2026', 'source'), /incomplete/)
  const [course] = parseCourseCapture(text, '2025-2026', 'source', ['CS 1313'])
  assert.equal(course.prerequisiteText, '')
  assert.equal(course.description, 'A course description.')
  assert.equal(course.prerequisites.kind, 'condition')
  assert.equal(course.review, 'needs-review')
})

test('review retains concurrent enrollment, discrete math gates, and senior-project restrictions', async () => {
  const { draft } = await buildDraft(root)
  const get = (code: string) => draft.courses.find(c => c.code === code)!
  assert.deepEqual(get('CS 2411').prerequisites, { kind: 'all', items: [
    { kind: 'course', courseId: '2025-2026:CS 1411', timing: 'before', minimumGrade: 'C' },
    { kind: 'course', courseId: '2025-2026:MATH 2401', timing: 'before-or-concurrent' },
  ] })
  for (const code of ['CS 2302', 'CS 3304', 'CS 3306']) {
    const p = get(code).prerequisites
    assert.equal(p.kind, 'all')
    assert.ok(p.kind === 'all' && p.items.some(i => i.kind === 'course' && i.courseId === '2025-2026:MATH 2305' && i.minimumGrade === 'C'))
  }
  const project = get('CS 4395').prerequisites
  assert.ok(project.kind === 'all' && project.items.length === 4)
  assert.ok(project.items.some(i => i.kind === 'course' && i.minimumGrade === 'B'))
  assert.ok(project.items.some(i => i.kind === 'condition' && i.category === 'permission'))
  const changed = { ...get('CS 2411'), prerequisiteText: 'Grade of B or better in CS 1411.' }
  assert.throws(() => applyPrerequisiteReviews([changed], '2025-2026'), /source changed/)
  const newer = { ...changed, catalogYear: '2026-2027', review: 'needs-review' as const }
  assert.deepEqual(applyPrerequisiteReviews([newer], '2026-2027'), [newer])
})
