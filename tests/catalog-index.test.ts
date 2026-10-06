import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { parseCatalogIndex } from '../scripts/catalog-index.ts'

const raw = JSON.parse(await readFile(new URL('../data/sources/2025-2026/cs-index.json', import.meta.url), 'utf8'))
test('archived CS index has complete distinct observed coverage', () => {
  const index = parseCatalogIndex(raw, '2025-2026', '37')
  assert.equal(index.courseCodes.length, 55)
  assert.equal(index.observedPaginationLinkCount, 0)
  assert.ok(index.courseCodes.includes('CS 3394')) // Presence is not eligibility.
})
test('index reconciliation rejects wrong editions and incomplete or duplicate captures', () => {
  assert.throws(() => parseCatalogIndex(raw, '2026-2027', '39'), /edition mismatch/)
  assert.throws(() => parseCatalogIndex({ ...raw, sourceUrl: raw.sourceUrl.replace('cur_cat_oid=37', 'cur_cat_oid=39') }, '2025-2026', '37'), /edition mismatch/)
  assert.throws(() => parseCatalogIndex({ ...raw, courseCodes: raw.courseCodes.slice(1) }, '2025-2026', '37'), /count mismatch/)
  assert.throws(() => parseCatalogIndex({ ...raw, courseCodes: [...raw.courseCodes.slice(1), raw.courseCodes[1]] }, '2025-2026', '37'), /count mismatch/)
})
