import { useEffect, useReducer, useRef, useState } from 'react'
import { loadPlan, newHistory, planReducer, savePlan, type PlanContext, type StorageLike } from './data/plan-state'

const browserStorage: StorageLike = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
}

export function usePlan(context: PlanContext) {
  const [loaded] = useState(() => loadPlan(browserStorage, context))
  const [history, dispatch] = useReducer((state: ReturnType<typeof newHistory>, action: Parameters<typeof planReducer>[1]) => planReducer(state, action, context.connectionGraph), loaded.plan, newHistory)
  const [saveStatus, setSaveStatus] = useState(loaded.message)
  const [saveFailed, setSaveFailed] = useState(!loaded.writable)
  const guard = useRef({ raw: loaded.raw, writable: loaded.writable, revision: 0 })
  useEffect(() => {
    if (!guard.current.writable || guard.current.revision === history.revision) return
    guard.current.revision = history.revision
    const result = savePlan(browserStorage, guard.current.raw, history.present)
    if (result.ok) guard.current.raw = result.raw
    else if (result.blocked) guard.current.writable = false
    setSaveStatus(result.message)
    setSaveFailed(!result.ok)
  }, [history.present, history.revision])
  return { history, dispatch, saveStatus, saveFailed }
}
