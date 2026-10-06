import { z } from 'zod'
import { connectionError, type ConnectionGraph } from './personal-connections.ts'

export const PLAN_KEY = 'uhd-planner-plan-v1'
const id = z.string().min(1).max(300)
const positionSchema = z.strictObject({ x: z.number().finite(), y: z.number().finite() })
const ids = z.array(id).max(5000).refine(values => new Set(values).size === values.length)
export const planSchema = z.strictObject({
  schemaVersion: z.literal(1), datasetVersion: id,
  positions: z.record(id, positionSchema), selectedCourseIds: ids, takenCourseIds: ids,
  customEdges: z.array(z.strictObject({ id, source: id, target: id })).max(5000),
  preferences: z.strictObject({ theme: z.enum(['light', 'dark']), hideCompleted: z.boolean() }),
})
export type Plan = z.infer<typeof planSchema>
export type Position = z.infer<typeof positionSchema>
export type PlanEdit =
  | { type: 'move'; positions: Record<string, Position> }
  | { type: 'select' | 'take'; courseId: string; value: boolean }
  | { type: 'connect'; edge: Plan['customEdges'][number] }
  | { type: 'disconnect'; edgeId: string }
  | { type: 'preferences'; preferences: Partial<Plan['preferences']> }
export type PlanAction = PlanEdit | { type: 'undo' | 'redo' }
export type History = { past: Plan[]; present: Plan; future: Plan[]; revision: number }
export const newHistory = (plan: Plan): History => ({ past: [], present: plan, future: [], revision: 0 })

export function planReducer(state: History, action: PlanAction, graph?: ConnectionGraph): History {
  if (action.type === 'undo') return state.past.length ? { past: state.past.slice(0, -1), present: state.past.at(-1)!, future: [state.present, ...state.future], revision: state.revision + 1 } : state
  if (action.type === 'redo') return state.future.length ? { past: [...state.past, state.present].slice(-100), present: state.future[0], future: state.future.slice(1), revision: state.revision + 1 } : state
  const old = state.present
  let next = old
  if (action.type === 'move') {
    const entries = Object.entries(action.positions)
    if (!entries.every(([key, value]) => Object.hasOwn(old.positions, key) && positionSchema.safeParse(value).success)) return state
    next = { ...old, positions: { ...old.positions, ...action.positions } }
  } else if (action.type === 'select' || action.type === 'take') {
    const key = action.type === 'select' ? 'selectedCourseIds' : 'takenCourseIds'
    const values = new Set(old[key])
    if (action.value) values.add(action.courseId); else values.delete(action.courseId)
    next = { ...old, [key]: [...values].sort() }
  } else if (action.type === 'connect') {
    if (graph && connectionError(action.edge.source, action.edge.target, graph, old.customEdges)) return state
    if (action.edge.source === action.edge.target || !Object.hasOwn(old.positions, action.edge.source) || !Object.hasOwn(old.positions, action.edge.target) || old.customEdges.some(edge => edge.id === action.edge.id || (edge.source === action.edge.source && edge.target === action.edge.target))) return state
    next = { ...old, customEdges: [...old.customEdges, action.edge] }
  } else if (action.type === 'disconnect') next = { ...old, customEdges: old.customEdges.filter(edge => edge.id !== action.edgeId) }
  else if (action.type === 'preferences') next = { ...old, preferences: { ...old.preferences, ...action.preferences } }
  if (JSON.stringify(old) === JSON.stringify(next)) return state
  return { past: [...state.past, old].slice(-100), present: next, future: [], revision: state.revision + 1 }
}

export type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type PlanContext = { defaults: Plan; courseIds: Set<string>; nodeIds: Set<string>; connectionGraph?: ConnectionGraph }
export function loadPlan(storage: StorageLike, context: PlanContext) {
  let raw: string | null = null
  try {
    raw = storage.getItem(PLAN_KEY)
    if (raw === null) return { plan: context.defaults, raw, writable: true, message: 'Ready · Changes save on this device' }
    const plan = planSchema.parse(JSON.parse(raw))
    if (plan.datasetVersion !== context.defaults.datasetVersion) return { plan: context.defaults, raw, writable: false, message: 'Saved plan uses a different catalog snapshot. It has been preserved. Changes in this preview will not be saved.' }
    if ([...plan.selectedCourseIds, ...plan.takenCourseIds].some(key => !context.courseIds.has(key)) ||
      Object.keys(plan.positions).some(key => !context.nodeIds.has(key)) ||
      plan.customEdges.some(edge => !context.nodeIds.has(edge.source) || !context.nodeIds.has(edge.target) || edge.source === edge.target) ||
      new Set(plan.customEdges.map(edge => edge.id)).size !== plan.customEdges.length) throw new Error('Unknown plan references')
    if (context.connectionGraph) {
      const checked: Plan['customEdges'] = []
      for (const edge of plan.customEdges) {
        if (connectionError(edge.source, edge.target, context.connectionGraph, checked)) throw new Error('Invalid personal connection')
        checked.push(edge)
      }
    }
    return { plan: { ...plan, positions: { ...context.defaults.positions, ...plan.positions } }, raw, writable: true, message: 'Saved plan restored · History starts fresh' }
  } catch {
    return { plan: context.defaults, raw, writable: false, message: 'Saved plan could not be read. Existing data has been preserved. Changes in this preview will not be saved.' }
  }
}

// Compare before writing so another tab's newer plan is never silently replaced.
// A throwing setItem leaves the browser's previous value intact.
export function savePlan(storage: StorageLike, expectedRaw: string | null, plan: Plan) {
  try {
    if (storage.getItem(PLAN_KEY) !== expectedRaw) return { ok: false as const, blocked: true, message: 'The saved plan changed in another tab. Reload to use that plan. Your current changes have not been saved.' }
    const raw = JSON.stringify(planSchema.parse(plan))
    storage.setItem(PLAN_KEY, raw)
    return { ok: true as const, raw, message: 'Saved on this device' }
  } catch {
    return { ok: false as const, blocked: false, message: 'Could not save changes on this device. Keep this page open; saving will retry on your next edit.' }
  }
}
