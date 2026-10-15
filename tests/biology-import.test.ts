import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { buildBiologyIntake, parseBiologyPanel } from '../scripts/import-biology.ts'
import { graphPrerequisites } from '../src/data/catalog-snapshot.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const capture = JSON.parse(await readFile(new URL('../data/sources/2025-2026/biology-bs-capture.json', import.meta.url), 'utf8'))
const intake = await buildBiologyIntake(root)
const get = (code: string) => intake.courses.find(course => course.code === code)!
const rehash = (entry: { text: string; sha256: string }) => { entry.sha256 = createHash('sha256').update(entry.text).digest('hex') }

test('Biology intake is reproducible and accounts for every captured option without inventing credits', async () => {
  const saved = JSON.parse(await readFile(new URL('../data/drafts/biology-intake-2025-2026.json', import.meta.url), 'utf8'))
  assert.deepEqual(await buildBiologyIntake(root), intake)
  assert.deepEqual(intake, saved)
  assert.equal(intake.publishable, false)
  assert.equal(intake.report.capturedPanelCount, 85)
  assert.equal(intake.report.courseCount, 82)
  assert.equal(intake.report.newCourseCount, 51)
  assert.equal(intake.report.sharedCourseIds.length, 31)
  assert.equal(intake.report.blockedCourseCount, 3)
  assert.deepEqual(intake.blockedCourses.map(course => course.code).sort(), ['BIOL 3390', 'BIOL 4390', 'BIOL 4399'])
  for (const blocked of intake.blockedCourses) {
    assert.equal(get(blocked.code), undefined)
    assert.ok(!('credits' in blocked))
    assert.match(blocked.reason, /No credit value/)
  }
  assert.equal(intake.report.verifiedCount, 0)
  for (const course of intake.courses) {
    assert.equal(course.review, 'needs-review')
    assert.equal(graphPrerequisites(course), null)
  }
  assert.deepEqual(intake.report.missingReferencedCodes, ['BIOL 3103', 'ENG 1302', 'MBIO 4310', 'PSY 1303', 'SOC 1303'])
})

test('Biology presentation adaptations preserve prerequisite and cross-list evidence', () => {
  assert.equal(get('BIOL 4302').prerequisiteText, 'BIOL 1302/BIOL 1102, CHEM 1308/CHEM 1108, and 4 hours of biology above the 1000-level.')
  assert.match(get('BIOL 4302').description, /^Wildlife biology focuses/)
  assert.match(get('BIOL 3302').prerequisiteText, /enrollment or credit in BIOL 3102/)
  assert.match(get('BIOL 3307').prerequisiteText, /enrollment or credit in BIOL 3107/)
  const crossListings = intake.panelMetadata.filter(meta => meta.crossListings.length)
  assert.equal(crossListings.length, 6)
  for (const meta of crossListings) {
    assert.ok(get(meta.code).description.startsWith(meta.crossListings[0]))
    assert.ok(!get(meta.code).prerequisiteText.startsWith('Crosslisted:'))
  }
  assert.equal(get('BIOL 4344').prerequisiteText, 'CHEM 4340.')
  // The original inline description is retained pending an explicit review, not guessed away.
  assert.equal(get('CHEM 4344').prerequisiteText, 'CHEM 4340. Introduction to fundamental principles in pharmacology and toxicology.')
  assert.equal(get('MBIO 3390').prerequisiteText, '')
  assert.match(JSON.stringify(get('MBIO 3390').prerequisites), /No prerequisite statement published/)
})

test('Biology intake rejects altered evidence, wrong editions and wrong program sources', async () => {
  const changed = structuredClone(capture)
  changed.courses[0].text += ' changed'
  await assert.rejects(buildBiologyIntake(root, changed), /fingerprint/)
  const page = structuredClone(capture)
  page.pages[0].text += ' changed'
  await assert.rejects(buildBiologyIntake(root, page), /fingerprint/)
  for (const replace of ['catoid=39&poid=7092', 'catoid=37&poid=9999']) {
    const wrong = structuredClone(capture)
    wrong.courses[0].sourceUrl = 'https://catalog.uhd.edu/preview_program.php?' + replace
    await assert.rejects(buildBiologyIntake(root, wrong), /edition or program/)
  }
  const wrongYear = structuredClone(capture)
  wrongYear.catalogYear = '2026-2027'
  await assert.rejects(buildBiologyIntake(root, wrongYear))
})

test('Biology inventory and course identity cannot silently change', async () => {
  const duplicate = structuredClone(capture)
  duplicate.courses[1] = duplicate.courses[0]
  await assert.rejects(buildBiologyIntake(root, duplicate), /Duplicate/)
  const missing = structuredClone(capture)
  missing.listedCourseCodes[0] = 'BIOL 9999'
  await assert.rejects(buildBiologyIntake(root, missing), /inventory mismatch/)
  const identity = structuredClone(capture)
  identity.courses[0].text = identity.courses[0].text.replace(identity.courses[0].code, 'BIOL 9999')
  rehash(identity.courses[0])
  await assert.rejects(buildBiologyIntake(root, identity), /identity mismatch/)
})

test('Biology refuses shared source drift even when the new fingerprint is valid', async () => {
  const changed = structuredClone(capture)
  changed.courses[0].text += '\nChanged course description.'
  rehash(changed.courses[0])
  await assert.rejects(buildBiologyIntake(root, changed), /Shared Biology course conflict/)
})

test('Biology adapters do not generalize missing metadata or accept truncated panels', () => {
  assert.throws(() => parseBiologyPanel({ code: 'BIOL 9999', text: 'BIOL 9999 - Unknown\nPrerequisite(s): None.\nDescription.' }, 'source'), /incomplete/)
  assert.throws(() => parseBiologyPanel({ code: 'BIOL 4399', text: 'BIOL 4399 - Senior Honors Thesis\nPrerequisite(s): Senior standing.' }, 'source'), /Incomplete blocked/)
  assert.throws(() => parseBiologyPanel({ code: 'MBIO 3390', text: 'MBIO 3390 - Special Topics\nCredits: 3 Class: 3 Lab: 0\nPrerequisite(s):\nDescription.' }, 'source'), /multiline prerequisite/)
  assert.throws(() => parseBiologyPanel({ code: 'BIOL 9999', text: 'BIOL 9999 - Unknown\nCredits: 3 Class: 3 Lab: 0\nCrosslisted: BIOL 3340.\nPrerequisite(s): None.\nDescription.' }, 'source'), /cross-list format/)
})
