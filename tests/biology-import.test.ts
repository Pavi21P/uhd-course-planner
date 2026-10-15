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
  assert.equal(intake.report.capturedPanelCount, 89)
  assert.equal(intake.report.courseCount, 89)
  assert.equal(intake.report.newCourseCount, 58)
  assert.equal(intake.report.sharedCourseIds.length, 31)
  assert.equal(intake.report.blockedCourseCount, 0)
  assert.deepEqual(intake.blockedCourses, [])
  assert.equal(intake.report.listedOptionCourseCount, 85)
  assert.equal(intake.report.supplementalCourseCount, 4)
  assert.equal(intake.report.policyCreditResolutionCount, 3)
  for (const evidence of intake.creditResolutions) {
    const course = get(evidence.code)
    assert.deepEqual(course.credits, { min: 3, max: 3 })
    assert.equal(evidence.directCreditLinePublished, false)
    assert.ok(course.sourceIds.includes('biology-credit-policy-37'))
    assert.ok(course.sourceIds.includes('biology-intake-37-1'))
  }
  assert.equal(intake.report.verifiedCount, 55)
  assert.equal(intake.report.reusedReviewIds.length, 29)
  assert.equal(intake.report.unresolved.length, 34)
  for (const issue of intake.report.unresolved) {
    assert.ok(issue.reason)
    const course = intake.courses.find(course => course.id === issue.courseId)!
    assert.equal(course.review, 'needs-review')
    assert.equal(graphPrerequisites(course), null)
  }
  assert.deepEqual(intake.report.missingReferencedCodes, ['BIOL 3103'])
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

test('Main Biology import requires intact policy evidence and source-bound credit panels', async () => {
  const supplement = JSON.parse(await readFile(new URL('../data/sources/2025-2026/biology-supplemental-capture.json', import.meta.url), 'utf8'))
  const policy = structuredClone(supplement)
  policy.pages[0].text = policy.pages[0].text.replace('The second digit indicates', 'The second digit does not indicate')
  rehash(policy.pages[0])
  await assert.rejects(buildBiologyIntake(root, undefined, policy), /policy needs re-review/)
  const changed = structuredClone(capture)
  const honors = changed.courses.find((course: {code: string}) => course.code === 'BIOL 4399')
  honors.text = honors.text.replace('Senior standing and enrollment', 'Junior standing and enrollment')
  rehash(honors)
  await assert.rejects(buildBiologyIntake(root, changed), /re-review BIOL 4399/)
  const directCredit = structuredClone(capture)
  const topics = directCredit.courses.find((course: {code: string}) => course.code === 'BIOL 3390')
  topics.text = topics.text.replace('\n\n', '\nCredits: 4 Class: 4 Lab: 0\n')
  rehash(topics)
  await assert.rejects(buildBiologyIntake(root, directCredit), /re-review policy fallback/)
  const broken = structuredClone(supplement)
  broken.courses[0].text += ' altered'
  await assert.rejects(buildBiologyIntake(root, undefined, broken), /fingerprint/)
})
