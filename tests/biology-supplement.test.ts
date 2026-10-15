import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { auditBiologySupplement } from '../scripts/biology-supplement-audit.ts'
import { graphPrerequisites } from '../src/data/catalog-snapshot.ts'
const root = fileURLToPath(new URL('../', import.meta.url))
const capture = JSON.parse(await readFile(new URL('../data/sources/2025-2026/biology-supplemental-capture.json', import.meta.url), 'utf8'))
const hash = (entry: {text: string; sha256: string}) => { entry.sha256 = createHash('sha256').update(entry.text).digest('hex') }

test('Biology supplement is reproducible and resolves source discovery without inventing graph edges', async () => {
  const review = await auditBiologySupplement(root)
  const saved = JSON.parse(await readFile(new URL('../data/drafts/biology-supplement-review-2025-2026.json', import.meta.url), 'utf8'))
  assert.deepEqual(review, saved)
  assert.equal(review.publishable, false)
  assert.deepEqual(review.report.foundReferencedCodes, ['ENG 1302', 'MBIO 4310', 'PSY 1303', 'SOC 1303'])
  assert.deepEqual(review.report.unresolvedReferencedCodes, ['BIOL 3103'])
  assert.match(review.report.unresolvedReason, /does not prove an equivalency/)
  for (const course of review.courses) {
    assert.equal(course.review, 'needs-review')
    assert.equal(graphPrerequisites(course), null)
  }
  assert.equal(review.courses.find(c => c.code === 'SOC 1303')!.prerequisiteText, '')
  assert.match(review.courses.find(c => c.code === 'MBIO 4310')!.prerequisiteText, /8 additional hours of upper-level science/)
})

test('Missing Biology credit values have explicit same-edition policy provenance', async () => {
  const review = await auditBiologySupplement(root)
  assert.deepEqual(review.creditEvidence.map(c => c.code), ['BIOL 3390', 'BIOL 4390', 'BIOL 4399'])
  for (const credit of review.creditEvidence) {
    assert.deepEqual(credit.credits, { min: 3, max: 3 })
    assert.equal(credit.directCreditLinePublished, false)
    assert.equal(new URL(credit.policySourceUrl).searchParams.get('navoid'), '2421')
    assert.equal(credit.policySha256.length, 64)
    assert.equal(credit.courseSha256.length, 64)
    assert.match(credit.explanation, /No class\/lab hours are inferred/)
  }
})

test('Supplement rejects changed fingerprints, mismatched course identities and editions', async () => {
  const tampered = structuredClone(capture)
  tampered.courses[0].text += ' changed'
  await assert.rejects(auditBiologySupplement(root, tampered), /fingerprint/)
  const identity = structuredClone(capture)
  identity.courses[0].sourceUrl = identity.courses[0].sourceUrl.replace('68976', '69610')
  await assert.rejects(auditBiologySupplement(root, identity), /source identity/)
  const edition = structuredClone(capture)
  edition.pages[0].sourceUrl += '&cur_cat_oid=39'
  await assert.rejects(auditBiologySupplement(root, edition), /edition mismatch/)
  const duplicate = structuredClone(capture)
  duplicate.courses[1] = duplicate.courses[0]
  await assert.rejects(auditBiologySupplement(root, duplicate), /Duplicate/)
  const multiple = structuredClone(capture)
  multiple.courses[0].text += '\n---COURSE---\n' + multiple.courses[1].text
  hash(multiple.courses[0])
  await assert.rejects(auditBiologySupplement(root, multiple), /panel identity/)
})

test('Credit fallback and missing-code claims require their specific source evidence', async () => {
  const policy = structuredClone(capture)
  policy.pages[0].text = policy.pages[0].text.replace('The second digit indicates', 'The second digit does not indicate')
  hash(policy.pages[0])
  await assert.rejects(auditBiologySupplement(root, policy), /policy needs re-review/)
  const search = structuredClone(capture)
  search.pages[1].query = 'BIOL 2103'
  await assert.rejects(auditBiologySupplement(root, search), /exact BIOL 3103/)
  const noResult = structuredClone(capture)
  noResult.pages[1].text = noResult.pages[1].text.replace('No courses found.', 'Courses found.')
  hash(noResult.pages[1])
  await assert.rejects(auditBiologySupplement(root, noResult), /exact BIOL 3103/)
})
