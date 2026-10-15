import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { parseCourseCapture } from '../scripts/catalog-import.ts'
import { graphPrerequisites } from '../src/data/catalog-snapshot.ts'
import type { Course } from '../src/data/catalog-schema.ts'

const read = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const capture = await read('../data/sources/2025-2026/biology-bs-capture.json') as {
  catalogYear: string; catalogId: string; retrievedOn: string
  publishable: boolean; coursePanelsComplete: boolean; listedCourseCodes: string[]
  pages: { sourceUrl: string; text: string; sha256: string }[]
  courses: { code: string; sourceUrl: string; text: string; sha256: string }[]
}
const checkpoint = await read('../data/sources/2025-2026/biology-bs-intake-checkpoint.json')
const existing = new Map<string, Course>([
  ...(await read('../src/data/catalog-2025-2026.json')).catalog.courses,
  ...(await read('../src/data/minor-2025-2026.json')).courses,
  ...(await read('../data/drafts/chemistry-intake-2025-2026.json')).courses,
].map((course: Course) => [course.code, course]))
// These source formats remain blocked, rather than silently dropping metadata or inventing credits.
const unsupported = new Set([
  'BIOL 4302', 'BIOL 4399', 'BIOL 4344', 'CHEM 4344', 'MBIO 3390',
  'BIOL 3340', 'BIOL 3140', 'BIOL 3390', 'BIOL 4390', 'BIOL 3302',
  'BIOL 3307', 'BIOL 4313', 'BIOL 4113',
])
const parsed = capture.courses.filter(panel => !unsupported.has(panel.code))
  .flatMap(panel => parseCourseCapture(panel.text, capture.catalogYear, 'biology-program-37'))
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

test('Biology source capture covers all 85 degree options with intact same-edition provenance', () => {
  assert.equal(capture.catalogYear, '2025-2026')
  assert.equal(capture.catalogId, '37')
  assert.equal(capture.retrievedOn, '2026-10-14')
  assert.equal(capture.publishable, false)
  assert.equal(capture.coursePanelsComplete, true)
  assert.equal(capture.pages.length, 1)
  assert.equal(capture.courses.length, 85)
  assert.equal(new Set(capture.courses.map(panel => panel.code)).size, 85)
  assert.deepEqual([...capture.listedCourseCodes].sort(), [...checkpoint.inventory.courseCodes].sort())
  assert.deepEqual(capture.courses.map(panel => panel.code).sort(), [...capture.listedCourseCodes].sort())
  for (const panel of [...capture.pages, ...capture.courses]) {
    const url = new URL(panel.sourceUrl)
    assert.equal(url.origin, 'https://catalog.uhd.edu')
    assert.equal(url.searchParams.get('catoid'), '37')
    assert.equal(url.searchParams.get('poid'), '7092')
    assert.equal(createHash('sha256').update(panel.text).digest('hex'), panel.sha256)
  }
  for (const panel of capture.courses)
    assert.ok(normalize(panel.text).startsWith(panel.code + ' - '), panel.code)
  const page = normalize(capture.pages[0].text)
  for (const rule of ['Biology, BS', 'Major in Biology (120 hours)',
    'Biology Upper Level Options (23 hours)', 'any two Course-based Undergraduate Research Experience',
    'Up to 6 hours of undergraduate research', 'if not used aboved']) assert.ok(page.includes(rule), rule)
})

test('Biology parsing exposes all unsupported panels and creates no reviewed graph edges', () => {
  assert.equal(parsed.length, 72)
  for (const code of unsupported) {
    const panel = capture.courses.find(panel => panel.code === code)!
    assert.throws(() => parseCourseCapture(panel.text, capture.catalogYear, 'biology-program-37'), /Unrecognized or incomplete/)
  }
  for (const course of parsed) {
    assert.equal(course.review, 'needs-review')
    assert.equal(graphPrerequisites(course), null)
  }
  const missingCredits = capture.courses.filter(panel => !/Credits:/.test(panel.text)).map(panel => panel.code).sort()
  assert.deepEqual(missingCredits, ['BIOL 3390', 'BIOL 4390', 'BIOL 4399'])
})

test('Biology shared records reconcile and prerequisite discovery remains explicit', () => {
  const shared = parsed.filter(course => existing.has(course.code))
  assert.equal(shared.length, 31)
  for (const course of shared) {
    const prior = existing.get(course.code)!
    for (const field of ['title', 'description', 'prerequisiteText'] as const)
      assert.equal(normalize(course[field]), normalize(prior[field]), course.code + ': ' + field)
    assert.deepEqual(course.credits, prior.credits, course.code)
  }
  const known = new Set([...capture.listedCourseCodes, ...existing.keys()])
  // Discovery only: legacy codes and aliases are not automatically replaced or turned into edges.
  const missing = [...new Set(parsed.flatMap(course => course.prerequisiteText.match(/[A-Z]{2,}\s*\d{4}/g) ?? [])
    .map(code => code.replace(/([A-Z]+)\s*(\d{4})/, '$1 $2')).filter(code => !known.has(code)))].sort()
  assert.deepEqual(missing, ['BIOL 3103', 'ENG 1302', 'MBIO 4310', 'PSY 1303', 'SOC 1303'])
})
