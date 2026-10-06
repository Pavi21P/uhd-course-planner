import type { Position } from './plan-state.ts'

type Link = { source: string; target: string }
export type BranchDrag = { root: string; positions: Record<string, Position>; cancelled: boolean }

// Use original links, including logic gates and custom connections. Display
// visibility and completion bridges must never determine branch membership.
export function beginBranchDrag(root: string, positions: Record<string, Position>, links: Link[]): BranchDrag | null {
  if (!positions[root]) return null
  const outgoing = new Map<string, string[]>()
  for (const link of links) outgoing.set(link.source, [...(outgoing.get(link.source) ?? []), link.target])
  const visited = new Set<string>()
  const pending = [root]
  const snapshot: Record<string, Position> = {}
  while (pending.length) {
    const id = pending.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    if (!positions[id]) continue
    snapshot[id] = { ...positions[id] }
    pending.push(...(outgoing.get(id) ?? []))
  }
  return { root, positions: snapshot, cancelled: false }
}

// React Flow provides world coordinates, already adjusted for zoom/pan. Always
// derive from the starting snapshot rather than accumulating per-frame deltas.
export function branchPositions(drag: BranchDrag, target: Position): Record<string, Position> {
  const start = drag.positions[drag.root]
  if (drag.cancelled || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return { ...drag.positions }
  const dx = target.x - start.x
  const dy = target.y - start.y
  return Object.fromEntries(Object.entries(drag.positions).map(([id, position]) => [id, { x: position.x + dx, y: position.y + dy }]))
}
