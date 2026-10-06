import type { Course, Prerequisite } from '../src/data/catalog-schema.ts'

// Only edges required on EVERY route, with completion BEFORE enrollment.
// Alternatives and concurrent routes must not create false mandatory cycles.
export function mandatoryBeforeIds(p: Prerequisite): Set<string> {
  if (p.kind === 'course') return new Set(p.timing === 'before' ? [p.courseId] : [])
  if (p.kind !== 'all' && p.kind !== 'any') return new Set()
  const sets = p.items.map(mandatoryBeforeIds)
  if (p.kind === 'all') return new Set(sets.flatMap(s => [...s]))
  return new Set([...sets[0]].filter(id => sets.every(s => s.has(id))))
}

export function auditMandatoryCycles(courses: Course[]): string[][] {
  const edges = new Map(courses.map(c => [c.id, c.review === 'verified' ? [...mandatoryBeforeIds(c.prerequisites)].sort() : []]))
  const visited = new Set<string>()
  const active = new Set<string>()
  const path: string[] = []
  const cycles: string[][] = []
  const visit = (id: string) => {
    if (active.has(id)) { cycles.push([...path.slice(path.indexOf(id)), id]); return }
    if (visited.has(id)) return
    visited.add(id); active.add(id); path.push(id)
    for (const dependency of edges.get(id) ?? []) visit(dependency)
    path.pop(); active.delete(id)
  }
  for (const id of [...edges.keys()].sort()) visit(id)
  return cycles
}
