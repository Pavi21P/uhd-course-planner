import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { parseCourseCapture } from '../scripts/catalog-import.ts'

const capture = JSON.parse(await readFile(new URL('../data/sources/2025-2026/chemistry-bs-capture.json', import.meta.url), 'utf8')) as {
  catalogYear: string; catalogId: string
  pages: { sourceUrl: string; text: string; sha256: string }[]
  courses: { code: string; sourceUrl: string; text: string; sha256: string }[]
}

test('Chemistry source checkpoint retains 40 unique same-edition course panels and two source pages', () => {
  assert.equal(capture.catalogYear, '2025-2026')
  assert.equal(capture.catalogId, '37')
  assert.equal(capture.courses.length, 40)
  assert.equal(new Set(capture.courses.map(course => course.code)).size, 40)
  assert.equal(capture.pages.length, 2)
  for (const record of [...capture.pages, ...capture.courses]) {
    const url = new URL(record.sourceUrl)
    assert.equal(url.protocol, 'https:')
    assert.equal(url.hostname, 'catalog.uhd.edu')
    assert.equal(url.searchParams.get('catoid'), '37')
    assert.equal(createHash('sha256').update(record.text).digest('hex'), record.sha256)
  }
  assert.match(capture.pages[0].text, /Chemistry, BS/)
  assert.match(capture.pages[1].text, /Integrated Requirements for all Majors in Natural Sciences/)
})

test('Chemistry capture preserves actual physics credits and distinguishes a corequisite-only laboratory', () => {
  const courses = capture.courses.filter(course => course.code !== 'CHEM 4164')
    .flatMap(course => parseCourseCapture(course.text, capture.catalogYear, 'chemistry-program-37'))
  assert.equal(courses.length, 39)
  const byCode = new Map(courses.map(course => [course.code, course]))
  assert.equal(byCode.get('PHYS 2401')!.credits.min + byCode.get('PHYS 2101')!.credits.min, 5)
  assert.equal(byCode.get('PHYS 1307')!.credits.min + byCode.get('PHYS 1107')!.credits.min, 4)
  assert.match(byCode.get('CHEM 2301')!.prerequisiteText, /Enrollment in CHEM 2101 is recommended/)
  const polymerLab = capture.courses.find(course => course.code === 'CHEM 4164')!
  assert.match(polymerLab.text, /Credits: 1 Class: 0 Lab: 3\nCorequisite\(s\): CHEM 4364/)
  // Parsing preserves concurrency wording; review is a separate step.
  const [lab] = parseCourseCapture(polymerLab.text, capture.catalogYear, 'chemistry-program-37')
  assert.equal(lab.prerequisiteText, 'Corequisite(s): CHEM 4364')
  assert.equal(lab.review, 'needs-review')
  assert.ok(!lab.description.includes('Corequisite(s)'))
  assert.ok(courses.every(course => course.review === 'needs-review'))
})
