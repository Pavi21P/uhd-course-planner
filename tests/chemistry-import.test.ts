import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildChemistryIntake } from '../scripts/import-chemistry.ts'
import { reviewChemistryPrerequisites } from '../scripts/chemistry-prerequisite-reviews.ts'
import { mandatoryBeforeIds } from '../scripts/prerequisite-audit.ts'
import { graphPrerequisites } from '../src/data/catalog-snapshot.ts'
import { parseCourseCapture } from '../scripts/catalog-import.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const intake = await buildChemistryIntake(root)
const get = (code: string) => intake.courses.find(course => course.code === code)!

test('Chemistry intake is reproducible, reuses shared identities and remains unpublished', async () => {
  assert.deepEqual(await buildChemistryIntake(root), intake)
  const saved = JSON.parse(await readFile(new URL('../data/drafts/chemistry-intake-2025-2026.json', import.meta.url), 'utf8'))
  assert.deepEqual(intake, saved)
  assert.equal(intake.publishable, false)
  assert.equal(intake.report.courseCount, 40)
  assert.equal(intake.report.verifiedCount, 32)
  assert.equal(intake.report.newCourseCount, 35)
  assert.equal(intake.report.reusedCourseIds.length, 5)
  assert.deepEqual(intake.report.missingReferencedCodes, ['CHEM 1105', 'CHEM 1305'])
  assert.deepEqual(intake.report.mandatoryBeforeCycles, [])
  assert.equal(intake.report.unresolved.length, 8)
  for (const issue of intake.report.unresolved) {
    assert.ok(issue.reason)
    assert.equal(graphPrerequisites(intake.courses.find(course => course.id === issue.courseId)!), null)
  }
})

test('Chemistry separates before, concurrent and grade-qualified enrollment alternatives', () => {
  assert.deepEqual(get('CHEM 4164').prerequisites, { kind: 'course', courseId: '2025-2026:CHEM 4364', timing: 'concurrent' })
  assert.equal(mandatoryBeforeIds(get('CHEM 4164').prerequisites).size, 0)
  assert.deepEqual(get('CHEM 2101').prerequisites, { kind: 'any', items: [
    { kind: 'course', courseId: '2025-2026:CHEM 2301', timing: 'before', minimumGrade: 'C' },
    { kind: 'course', courseId: '2025-2026:CHEM 2301', timing: 'concurrent' },
  ] })
  assert.deepEqual([...mandatoryBeforeIds(get('CHEM 2301').prerequisites)].sort(), ['2025-2026:CHEM 1108', '2025-2026:CHEM 1308'])
  assert.ok(!JSON.stringify(get('CHEM 2301').prerequisites).includes('CHEM 2101'))
  assert.match(get('CHEM 2301').prerequisiteText, /CHEM 2101 is recommended/)
  assert.deepEqual([...mandatoryBeforeIds(get('BIOL 1302').prerequisites)].sort(), ['2025-2026:BIOL 1101', '2025-2026:BIOL 1301'])
  assert.equal(get('CHEM 3300').prerequisites.kind, 'all')
  assert.match(JSON.stringify(get('CHEM 3300').prerequisites), /GPA of 2.0/)
})

test('Chemistry refuses stale reviews, altered capture fingerprints and wrong editions', async () => {
  const changed = structuredClone(get('CHEM 4164'))
  changed.prerequisiteText = 'Credit in CHEM 4364'
  assert.throws(() => reviewChemistryPrerequisites([changed]), /re-review/)
  changed.catalogYear = '2026-2027'
  assert.throws(() => reviewChemistryPrerequisites([changed]), /requires catalog/)
  const capture = JSON.parse(await readFile(new URL('../data/sources/2025-2026/chemistry-bs-capture.json', import.meta.url), 'utf8'))
  capture.courses[0].text += ' changed'
  await assert.rejects(buildChemistryIntake(root, capture), /fingerprint/)
  capture.courses[0].sha256 = createHash('sha256').update(capture.courses[0].text).digest('hex')
  await assert.rejects(buildChemistryIntake(root, capture), /Shared course conflict/)
  capture.catalogId = '39'
  await assert.rejects(buildChemistryIntake(root, capture))
})

test('corequisite-only parsing never treats an empty or malformed statement as omitted', () => {
  const raw = 'CHEM 4164 - Polymer Chemistry Laboratory\nCredits: 1 Class: 0 Lab: 3\nCorequisite(s):\nLaboratory description.'
  assert.throws(() => parseCourseCapture(raw, '2025-2026', 'source', ['CHEM 4164']), /incomplete/)
  const [course] = parseCourseCapture(raw.replace('Corequisite(s):', 'Corequisite(s): CHEM 4364'), '2025-2026', 'source')
  assert.equal(course.prerequisiteText, 'Corequisite(s): CHEM 4364')
  assert.equal(course.review, 'needs-review')
  assert.equal(course.description, 'Laboratory description.')
})
