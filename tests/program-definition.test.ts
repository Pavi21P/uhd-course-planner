import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { loadPlannerCatalog } from '../src/data/minor-catalog.ts'
import { computerScience, programStarterIds, programStorageKey } from '../src/data/program-definition.ts'
import { loadPlan, PLAN_KEY, savePlan, type Plan, type StorageLike } from '../src/data/plan-state.ts'

const read = (name: string) => JSON.parse(readFileSync(new URL('../src/data/' + name, import.meta.url), 'utf8'))
const loaded = loadPlannerCatalog(read('catalog-2025-2026.json'), read('minor-2025-2026.json'))
if (!loaded.ok) throw new Error(loaded.message)
const catalog = loaded.snapshot.catalog
const initial: Plan = { schemaVersion: 1, datasetVersion: 'fixture', positions: { shared: { x: 1, y: 2 } }, selectedCourseIds: ['shared-course'], takenCourseIds: [], customEdges: [], preferences: { theme: 'light', hideCompleted: false } }
const context = (storageKey: string) => ({ storageKey, defaults: initial, courseIds: new Set(['shared-course']), nodeIds: new Set(['shared']) })
const memory = () => {
  const values = new Map<string,string>()
  const storage: StorageLike = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key,value) } }
  return { values, storage }
}

test('CS definition preserves the existing 17-course, 54-hour starter and legacy save key', () => {
  const ids = programStarterIds(computerScience, catalog)
  assert.equal(ids.size, 17)
  assert.equal(catalog.courses.filter(course => ids.has(course.id)).reduce((sum, course) => sum + course.credits.min, 0), 54)
  assert.ok(ids.has('2025-2026:CS 4395'))
  assert.equal(programStorageKey('cs-bs', '2025-2026'), PLAN_KEY)
})

test('program save namespaces separate majors and catalog years', () => {
  const keys = ['cs-bs','math-bs','chemistry-bs','biology-bs'].flatMap(id => ['2025-2026','2026-2027'].map(year => programStorageKey(id,year)))
  assert.equal(new Set(keys).size, 8)
  assert.throws(() => programStorageKey('', '2025-2026'))
  assert.throws(() => programStorageKey('math-bs', '2025'))
})

test('same course IDs and snapshot IDs cannot leak selections, completion or positions across majors', () => {
  const {storage,values} = memory()
  const csKey = programStorageKey('cs-bs','2025-2026'), mathKey = programStorageKey('math-bs','2025-2026')
  const cs = { ...initial, takenCourseIds: ['shared-course'], positions: { shared: { x: 88, y: 99 } } }
  assert.ok(savePlan(storage,null,cs,csKey).ok)
  const original = values.get(csKey)
  assert.deepEqual(loadPlan(storage,context(mathKey)).plan, initial)
  assert.ok(savePlan(storage,null,{ ...initial, selectedCourseIds: [] },mathKey).ok)
  assert.equal(values.get(csKey), original)
  assert.deepEqual(loadPlan(storage,context(csKey)).plan, cs)
  assert.deepEqual(loadPlan(storage,context(mathKey)).plan.selectedCourseIds, [])
})

test('cross-tab conflict detection is scoped to the selected major', () => {
  const {storage,values} = memory()
  const csKey = programStorageKey('cs-bs','2025-2026'), mathKey = programStorageKey('math-bs','2025-2026')
  values.set(csKey,'newer-cs-save')
  assert.ok(savePlan(storage,null,initial,mathKey).ok)
  assert.equal(savePlan(storage,null,initial,csKey).ok, false)
  const mathBefore = values.get(mathKey)
  assert.equal(savePlan(storage,null,initial,mathKey).ok, false)
  assert.equal(values.get(csKey),'newer-cs-save')
  assert.equal(values.get(mathKey), mathBefore)
})

test('invalid saves in one major are preserved without blocking another major', () => {
  const {storage,values} = memory()
  const key = programStorageKey('biology-bs','2025-2026')
  values.set(key, 'broken')
  assert.equal(loadPlan(storage,context(key)).writable,false)
  assert.equal(loadPlan(storage,context(PLAN_KEY)).writable,true)
  assert.equal(values.get(key),'broken')
})

test('incomplete or mixed-edition program definitions fail before selecting courses', () => {
  assert.throws(() => programStarterIds({...computerScience,catalogYear:'2024-2025'},catalog))
  assert.throws(() => programStarterIds({...computerScience,defaultRequirementIds:['unknown']},catalog))
  assert.throws(() => programStarterIds({...computerScience,supportingRequirementIds:['unknown']},catalog))
  assert.throws(() => programStarterIds({...computerScience,defaultCourseIds:['2025-2026:FAKE 1000']},catalog))
  assert.throws(() => programStarterIds({...computerScience,firstCourseId:'missing'},catalog))
})
