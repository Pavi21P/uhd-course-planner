import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPlan, newHistory, PLAN_KEY, planReducer, savePlan, type Plan, type StorageLike } from '../src/data/plan-state.ts'

const initial = (): Plan => ({ schemaVersion: 1, datasetVersion: 'catalog-a', positions: { a: { x: 10, y: 20 }, b: { x: 30, y: 40 } }, selectedCourseIds: ['course-a'], takenCourseIds: [], customEdges: [], preferences: { theme: 'light', hideCompleted: false } })
const context = () => ({ defaults: initial(), courseIds: new Set(['course-a', 'course-b']), nodeIds: new Set(['a', 'b']) })
class MemoryStorage implements StorageLike {
  raw: string | null
  writes = 0
  failWrite = false
  constructor(raw: string | null = null) { this.raw = raw }
  getItem(key: string) { assert.equal(key, PLAN_KEY); return this.raw }
  setItem(key: string, value: string) { assert.equal(key, PLAN_KEY); if (this.failWrite) throw new Error('Quota'); this.raw = value; this.writes++ }
}

test('one batch movement is one undo step, redo restores it, and a new edit clears redo', () => {
  const original = initial()
  const moved = planReducer(newHistory(original), { type: 'move', positions: { a: { x: 80, y: 90 }, b: { x: 100, y: 120 } } })
  assert.equal(moved.past.length, 1)
  assert.deepEqual(original.positions.a, { x: 10, y: 20 })
  const undone = planReducer(moved, { type: 'undo' })
  assert.deepEqual(undone.present, original)
  assert.deepEqual(planReducer(undone, { type: 'redo' }).present, moved.present)
  const branch = planReducer(undone, { type: 'move', positions: { a: { x: 55, y: 65 } } })
  assert.equal(branch.future.length, 0)
  assert.equal(planReducer(branch, { type: 'redo' }), branch)
})

test('no-op gestures and invalid positions do not create history or clear redo', () => {
  const original = newHistory(initial())
  assert.equal(planReducer(original, { type: 'undo' }), original)
  assert.equal(planReducer(original, { type: 'move', positions: { a: { x: 10, y: 20 } } }), original)
  assert.equal(planReducer(original, { type: 'move', positions: { unknown: { x: 1, y: 2 } } }), original)
  assert.equal(planReducer(original, { type: 'move', positions: { a: { x: Infinity, y: 2 } } }), original)
  const undone = planReducer(planReducer(original, { type: 'move', positions: { a: { x: 50, y: 50 } } }), { type: 'undo' })
  assert.equal(planReducer(undone, { type: 'move', positions: { a: { x: 10, y: 20 } } }), undone)
})

test('history is bounded to the most recent 100 edits', () => {
  let state = newHistory(initial())
  for (let x = 1; x <= 125; x++) state = planReducer(state, { type: 'move', positions: { a: { x, y: 20 } } })
  assert.equal(state.past.length, 100)
  for (let i = 0; i < 110; i++) state = planReducer(state, { type: 'undo' })
  assert.equal(state.present.positions.a.x, 25)
  assert.equal(state.future.length, 100)
})

test('selections, completion, connections and preferences share reversible state', () => {
  let state = newHistory(initial())
  state = planReducer(state, { type: 'select', courseId: 'course-b', value: true })
  state = planReducer(state, { type: 'take', courseId: 'course-a', value: true })
  state = planReducer(state, { type: 'connect', edge: { id: 'custom-1', source: 'a', target: 'b' } })
  assert.equal(planReducer(state, { type: 'connect', edge: { id: 'duplicate', source: 'a', target: 'b' } }), state)
  assert.equal(planReducer(state, { type: 'connect', edge: { id: 'loop', source: 'a', target: 'a' } }), state)
  state = planReducer(state, { type: 'preferences', preferences: { hideCompleted: true, theme: 'dark' } })
  const storage = new MemoryStorage()
  const saved = savePlan(storage, null, state.present)
  assert.ok(saved.ok)
  assert.deepEqual(loadPlan(storage, context()).plan, state.present)
  assert.equal(newHistory(loadPlan(storage, context()).plan).past.length, 0)
  state = planReducer(state, { type: 'undo' })
  assert.deepEqual(state.present.preferences, initial().preferences)
  state = planReducer(state, { type: 'undo' })
  assert.deepEqual(state.present.customEdges, [])
  state = planReducer(state, { type: 'undo' })
  assert.deepEqual(state.present.takenCourseIds, [])
})

test('corrupt, unknown-schema, unknown-course and mismatched-catalog saves are preserved', () => {
  const variants = ['broken-json', JSON.stringify({ ...initial(), schemaVersion: 9 }), JSON.stringify({ ...initial(), datasetVersion: 'catalog-old' }), JSON.stringify({ ...initial(), selectedCourseIds: ['missing'] }), JSON.stringify({ ...initial(), positions: { mystery: { x: 1, y: 2 } } })]
  for (const raw of variants) {
    const storage = new MemoryStorage(raw)
    const loaded = loadPlan(storage, context())
    assert.equal(loaded.writable, false)
    assert.equal(storage.raw, raw)
    assert.equal(storage.writes, 0)
    assert.deepEqual(loaded.plan, initial())
  }
})

test('missing positions receive defaults without overwriting the original saved document', () => {
  const plan = initial(); delete plan.positions.b
  const storage = new MemoryStorage(JSON.stringify(plan))
  const loaded = loadPlan(storage, context())
  assert.equal(loaded.writable, true)
  assert.deepEqual(loaded.plan.positions.b, { x: 30, y: 40 })
  assert.equal(storage.writes, 0)
})

test('failed writes and storage denial retain existing data and report failure', () => {
  const storage = new MemoryStorage(JSON.stringify(initial()))
  storage.failWrite = true
  const before = storage.raw
  const result = savePlan(storage, before, { ...initial(), takenCourseIds: ['course-a'] })
  assert.equal(result.ok, false)
  assert.equal(storage.raw, before)
  const denied = { getItem: () => { throw new Error('Denied') }, setItem: () => { throw new Error('Denied') } }
  assert.equal(loadPlan(denied, context()).writable, false)
  assert.equal(savePlan(denied, null, initial()).ok, false)
})

test('another tab changing the saved plan blocks replacement', () => {
  const storage = new MemoryStorage('another-tab-data')
  const result = savePlan(storage, null, initial())
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.blocked, true)
  assert.equal(storage.raw, 'another-tab-data')
  assert.equal(storage.writes, 0)
})
