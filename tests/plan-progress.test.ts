import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { catalogSnapshotSchema } from '../src/data/catalog-snapshot.ts'
import { calculatePlanProgress } from '../src/data/credit-allocation.ts'
import { newHistory, planReducer, loadPlan, savePlan, type Plan } from '../src/data/plan-state.ts'

const snapshot = catalogSnapshotSchema.parse(JSON.parse(await readFile(new URL('../src/data/catalog-2025-2026.json', import.meta.url), 'utf8')))
const id = (code: string) => `2025-2026:${code}`
const progress = (selected: string[], taken: string[] = []) => calculatePlanProgress(snapshot.catalog.courses, selected.map(id), taken.map(id), snapshot.coursePolicies)

test('shared selected references count once and Taken outside the plan contributes no hours', () => {
  const result = progress(['MATH 2305', 'MATH 2305', 'STAT 3311'], ['MATH 2305', 'MATH 2305', 'CS 1411'])
  assert.equal(result.uniqueCourseCount, 2)
  assert.equal(result.completedCourseCount, 1)
  assert.equal(result.unselectedTakenCount, 1)
  assert.deepEqual(result.catalogCredits, { min: 6, max: 6 })
  assert.deepEqual(result.completedCredits, { min: 3, max: 3 })
  assert.deepEqual(result.remainingCredits, { min: 3, max: 3 })
})

test('empty, all-completed and all-remaining selections have exact zero partitions', () => {
  const empty = progress([], ['CS 1411'])
  assert.deepEqual([empty.catalogCredits, empty.completedCredits, empty.remainingCredits], Array(3).fill({ min: 0, max: 0 }))
  assert.deepEqual(progress(['CS 3310']).completedCredits, { min: 0, max: 0 })
  assert.deepEqual(progress(['CS 3310'], ['CS 3310']).remainingCredits, { min: 0, max: 0 })
  assert.throws(() => progress(['UNKNOWN']), /Unknown selected/)
  assert.throws(() => progress([], ['UNKNOWN']), /Unknown taken/)
})

test('variable credits are partitioned by course rather than subtracted as unrelated ranges', () => {
  const courses = snapshot.catalog.courses.slice(0, 2).map((course, index) => ({ ...course, credits: index ? { min: 2, max: 4 } : { min: 1, max: 3 } }))
  const result = calculatePlanProgress(courses, courses.map(course => course.id), [courses[0].id], [])
  assert.deepEqual(result.catalogCredits, { min: 3, max: 7 })
  assert.deepEqual(result.completedCredits, { min: 1, max: 3 })
  assert.deepEqual(result.remainingCredits, { min: 2, max: 4 })
})

test('catalog progress retains degree-credit exclusions and mutual-exclusion review issues', () => {
  const result = progress(['MATH 1300', 'MATH 3302', 'STAT 3309'], ['MATH 1300', 'STAT 3309'])
  assert.equal(result.degreeCredits, null)
  assert.ok(result.conflicts.some(conflict => conflict.policyId === 'statistics-exclusive-credit'))
  assert.deepEqual(result.excludedCourseIds, [id('MATH 1300')])
  assert.deepEqual(result.catalogCredits, { min: 9, max: 9 })
  assert.deepEqual(result.completedCredits, { min: 6, max: 6 })
})

test('selection and completion undo independently without moving or connecting cards; hiding leaves credits unchanged', () => {
  const initial: Plan = { schemaVersion: 1, datasetVersion: snapshot.catalog.datasetVersion,
    selectedCourseIds: [id('MATH 2305')], takenCourseIds: [], customEdges: [],
    positions: { math: { x: 41, y: 93 }, stat: { x: 140, y: 230 } }, preferences: { theme: 'light', hideCompleted: false } }
  const summary = (plan: Plan) => calculatePlanProgress(snapshot.catalog.courses, plan.selectedCourseIds, plan.takenCourseIds, snapshot.coursePolicies)
  const added = planReducer(newHistory(initial), { type: 'select', courseId: id('STAT 3311'), value: true })
  assert.deepEqual(added.present.positions, initial.positions)
  assert.deepEqual(added.present.customEdges, [])
  const taken = planReducer(added, { type: 'take', courseId: id('STAT 3311'), value: true })
  assert.deepEqual(summary(taken.present).completedCredits, { min: 3, max: 3 })
  const hidden = planReducer(taken, { type: 'preferences', preferences: { hideCompleted: true } })
  assert.deepEqual(summary(hidden.present), summary(taken.present))
  const removed = planReducer(hidden, { type: 'select', courseId: id('STAT 3311'), value: false })
  assert.deepEqual(summary(removed.present).completedCredits, { min: 0, max: 0 })
  assert.deepEqual(removed.present.takenCourseIds, [id('STAT 3311')])
  assert.deepEqual(planReducer(removed, { type: 'undo' }).present, hidden.present)
  assert.deepEqual(planReducer(planReducer(removed, { type: 'undo' }), { type: 'redo' }).present, removed.present)
  let raw: string | null = null
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value } }
  assert.ok(savePlan(storage, null, hidden.present).ok)
  const loaded = loadPlan(storage, { defaults: initial, courseIds: new Set(snapshot.catalog.courses.map(course => course.id)), nodeIds: new Set(['math', 'stat']) })
  assert.ok(loaded.writable)
  assert.deepEqual(loaded.plan, hidden.present)
  assert.deepEqual(summary(loaded.plan), summary(taken.present))
})
