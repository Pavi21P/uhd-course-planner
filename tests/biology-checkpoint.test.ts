import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { parseCourseCapture } from '../scripts/catalog-import.ts'
import { graphPrerequisites } from '../src/data/catalog-snapshot.ts'

const checkpoint = JSON.parse(await readFile(new URL('../data/sources/2025-2026/biology-bs-intake-checkpoint.json', import.meta.url), 'utf8')) as {
  catalogYear: string; catalogId: string; publishable: boolean; status: string
  inventory: { courseCodes: string[]; groups: { label: string; courseCodes: string[] }[] }
  pages: { sourceUrl: string; text: string; sha256: string }[]
  courses: { code: string; sourceUrl: string; text: string; sha256: string }[]
}

test('Biology recovered checkpoint preserves same-edition provenance and distinct option coverage', () => {
  assert.equal(checkpoint.catalogYear, '2025-2026')
  assert.equal(checkpoint.catalogId, '37')
  assert.equal(checkpoint.publishable, false)
  assert.equal(checkpoint.status, 'partial-source-recovery')
  assert.equal(checkpoint.inventory.courseCodes.length, 85)
  assert.equal(new Set(checkpoint.inventory.courseCodes).size, 85)
  assert.deepEqual([...new Set(checkpoint.inventory.groups.flatMap(group => group.courseCodes))], checkpoint.inventory.courseCodes)
  for (const entry of [...checkpoint.pages, ...checkpoint.courses]) {
    const url = new URL(entry.sourceUrl)
    assert.equal(url.origin, 'https://catalog.uhd.edu')
    assert.equal(url.searchParams.get('catoid'), '37')
    assert.equal(url.searchParams.get('poid'), '7092')
    assert.equal(createHash('sha256').update(entry.text).digest('hex'), entry.sha256)
  }
  assert.match(checkpoint.pages[0].text, /any two Course-based Undergraduate Research Experience/)
  assert.match(checkpoint.pages[0].text, /Up to 6 hours of undergraduate research/)
  assert.match(checkpoint.pages[0].text, /Biology Upper Level Options \(23 hours\)/)
})

test('A recovered Genetics panel stays unreviewed; an inventory never becomes a full catalog', () => {
  assert.equal(checkpoint.courses.length, 1)
  assert.equal(checkpoint.courses[0].code, 'BIOL 2303')
  const [course] = parseCourseCapture(checkpoint.courses[0].text, checkpoint.catalogYear, 'biology-program-37')
  assert.deepEqual(course.credits, { min: 3, max: 3 })
  assert.equal(course.review, 'needs-review')
  assert.equal(graphPrerequisites(course), null)
  assert.equal(course.prerequisiteText, 'BIOL 1302/BIOL 1102,CHEM 1308/CHEM 1108, and credit or enrollment in BIOL 2103.')
  const highImpact = checkpoint.inventory.groups.find(group => group.label === 'One of the Following High Impact Labs')!
  const cure = checkpoint.inventory.groups.find(group => group.label === 'CURE substitution options')!
  assert.equal(highImpact.courseCodes.length, 6)
  assert.equal(cure.courseCodes.length, 4)
  assert.ok(highImpact.courseCodes.includes('BIOL 4399'))
})
