import assert from 'node:assert/strict'
import test from 'node:test'
import { datasetSchema } from '../src/data/catalog-schema.ts'
import { graphFixture } from '../src/data/graph-fixture.ts'

test('fixture preserves branch, OR, and concurrent semantics', () => {
  const data = datasetSchema.parse(graphFixture)
  assert.equal(data.courses.length, 10)
  assert.equal(data.courses[4].prerequisites.kind, 'all')
  assert.equal(data.courses[5].prerequisites.kind, 'any')
  assert.deepEqual(data.courses[6].prerequisites, { kind: 'course', courseId: '2026-2027:TEST F', timing: 'before-or-concurrent' })
})

for (const [label, mutate] of [
  ['mixed year', (d) => { d.courses[0].catalogYear = '2025-2026' }],
  ['negative credit', (d) => { d.courses[0].credits.min = -1 }],
  ['duplicate identity', (d) => { d.courses.push(d.courses[0]) }],
  ['unknown prerequisite', (d) => { d.courses[1].prerequisites = { kind: 'course', courseId: 'missing', timing: 'before' } }],
  ['missing provenance', (d) => { d.courses[0].sourceIds = ['missing'] }],
  ['fixture used as real data', (d) => { d.synthetic = false }],
] satisfies [string, (d: typeof graphFixture) => void][]) {
  test(`rejects ${label}`, () => {
    const data = structuredClone(graphFixture)
    mutate(data)
    assert.equal(datasetSchema.safeParse(data).success, false)
  })
}
