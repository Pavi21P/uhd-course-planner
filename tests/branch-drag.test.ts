import assert from 'node:assert/strict'
import test from 'node:test'
import { beginBranchDrag, branchPositions } from '../src/data/branch-drag.ts'
import { newHistory, planReducer, type Plan } from '../src/data/plan-state.ts'
import { completionView } from '../src/data/completion-view.ts'

const positions = { a: { x: 10, y: 20 }, gate: { x: 40, y: 30 }, b: { x: 70, y: 20 }, c: { x: 100, y: 80 }, other: { x: 0, y: 100 }, elective: { x: 1000, y: 1000 } }
const links = [['a', 'gate'], ['other', 'gate'], ['gate', 'b'], ['a', 'c'], ['b', 'c']].map(([source, target], i) => ({ id: String(i), source, target, label: 'Before' }))
const initial = (): Plan => ({ schemaVersion: 1, datasetVersion: 'test', positions, selectedCourseIds: ['a', 'b', 'c'], takenCourseIds: ['b'], customEdges: [], preferences: { theme: 'dark', hideCompleted: true } })

test('forks and shared descendants move once with their gate; other parents stay fixed', () => {
  const drag = beginBranchDrag('a', positions, links)!
  assert.deepEqual(Object.keys(drag.positions).sort(), ['a', 'b', 'c', 'gate'])
  const moved = branchPositions(drag, { x: 60, y: -10 })
  for (const id of Object.keys(moved) as (keyof typeof positions)[]) assert.deepEqual(moved[id], { x: positions[id].x + 50, y: positions[id].y - 30 })
  assert.equal(moved.other, undefined)
  assert.deepEqual(positions.a, { x: 10, y: 20 })
})

test('middle-course drag moves only descendants; isolated options stay isolated until connected', () => {
  assert.deepEqual(Object.keys(beginBranchDrag('b', positions, links)!.positions).sort(), ['b', 'c'])
  assert.deepEqual(Object.keys(beginBranchDrag('elective', positions, links)!.positions), ['elective'])
  const custom = [...links, { id: 'custom', source: 'elective', target: 'b', label: 'Custom' }]
  assert.deepEqual(Object.keys(beginBranchDrag('elective', positions, custom)!.positions).sort(), ['b', 'c', 'elective'])
})

test('cycles and duplicate paths terminate; malformed unknown endpoints are ignored', () => {
  const cyclic = [...links, { id: 'cycle', source: 'c', target: 'a', label: '' }, { id: 'missing', source: 'b', target: 'missing', label: '' }]
  assert.deepEqual(Object.keys(beginBranchDrag('b', positions, cyclic)!.positions).sort(), ['a', 'b', 'c', 'gate'])
  assert.equal(beginBranchDrag('missing', positions, cyclic), null)
})

test('hidden descendants retain movement when revealed and the entire drag is one history action', () => {
  const original = initial()
  const nodes = Object.keys(positions).map(id => ({ id, courseId: id, label: id }))
  const hidden = completionView(nodes, links, ['b'], true)
  assert.ok(hidden.hidden.has('b'))
  const drag = beginBranchDrag('a', original.positions, links)!
  const changed = planReducer(newHistory(original), { type: 'move', positions: branchPositions(drag, { x: 20, y: 40 }) })
  assert.equal(changed.past.length, 1)
  assert.deepEqual(changed.present.positions.b, { x: 80, y: 40 })
  assert.deepEqual(changed.present.positions.other, original.positions.other)
  const revealed = completionView(nodes, links, ['b'], false)
  assert.equal(revealed.hidden.size, 0)
  assert.deepEqual(revealed.links, links)
  const undone = planReducer(changed, { type: 'undo' })
  assert.deepEqual(undone.present, original)
  assert.deepEqual(planReducer(undone, { type: 'redo' }).present, changed.present)
})

test('world-coordinate movement preserves fractional deltas without accumulating preview drift', () => {
  const drag = beginBranchDrag('a', positions, links)!
  const worldTarget = { x: 10 + 60 / 0.75, y: 20 + 35 / 0.75 }
  branchPositions(drag, { x: 999, y: 999 })
  const moved = branchPositions(drag, worldTarget)
  assert.equal(moved.c.x - moved.a.x, positions.c.x - positions.a.x)
  assert.ok(Math.abs((moved.c.y - moved.a.y) - (positions.c.y - positions.a.y)) < 1e-10)
  assert.deepEqual(branchPositions(drag, positions.a), drag.positions)
})

test('cancelled gesture ignores subsequent pointer positions and leaves saved history unchanged', () => {
  const drag = beginBranchDrag('a', positions, links)!
  branchPositions(drag, { x: 500, y: 500 })
  drag.cancelled = true
  const restored = branchPositions(drag, { x: 800, y: 800 })
  assert.deepEqual(restored, drag.positions)
  const history = newHistory(initial())
  assert.equal(planReducer(history, { type: 'move', positions: restored }), history)
})
