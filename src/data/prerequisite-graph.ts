import type { Course, Prerequisite } from './catalog-schema.ts'
import { graphPrerequisites } from './catalog-snapshot.ts'

export type GraphItem = {
  id: string
  kind: 'course' | 'all' | 'any' | 'condition'
  courseId?: string
  text: string
  planned: boolean
  position: { x: number; y: number }
}
export type GraphLink = {
  id: string; source: string; target: string; label: string
  timing?: 'before' | 'before-or-concurrent' | 'concurrent'
  minimumGrade?: string
}
export const graphCourseId = (id: string) => `tree:${id}`

// Every expression gets its own gate. In particular, ALL(A, ANY(B, C)) must
// never become three mandatory course-to-course edges. Conditions stay visible.
export function buildPrerequisiteGraph(courses: Course[], selectedIds: string[]) {
  const byId = new Map(courses.map(course => [course.id, course]))
  const selected = new Set(selectedIds)
  const items = new Map<string, GraphItem>()
  const links: GraphLink[] = []
  const add = (item: Omit<GraphItem, 'position'>) => items.set(item.id, { ...item, position: { x: 0, y: 0 } })
  const link = (source: string, target: string, label: string, prerequisite?: Extract<Prerequisite, { kind: 'course' }>) => {
    links.push({ id: `${source}->${target}:${links.length}`, source, target, label,
      ...(prerequisite ? { timing: prerequisite.timing, minimumGrade: prerequisite.minimumGrade } : {}) })
  }
  const visit = (courseId: string) => {
    const id = graphCourseId(courseId)
    if (items.has(id)) return id // Includes concurrent/alternative cycles.
    const course = byId.get(courseId)
    if (!course) throw new Error(`Missing prerequisite course: ${courseId}`)
    add({ id, kind: 'course', courseId, text: course.code, planned: selected.has(courseId) })
    const expression = graphPrerequisites(course)
    if (expression) expand(expression, id, `${id}:prerequisite`, course.code)
    return id
  }
  const expand = (expression: Prerequisite, target: string, path: string, owner: string) => {
    if (expression.kind === 'none') return
    if (expression.kind === 'course') {
      const timing = { before: 'Before', 'before-or-concurrent': 'Before or concurrent', concurrent: 'Concurrent' }[expression.timing]
      link(visit(expression.courseId), target, `${timing}${expression.minimumGrade ? ` · ${expression.minimumGrade} or better` : ''}`, expression)
      return
    }
    add({ id: path, kind: expression.kind, text: expression.kind === 'condition' ? expression.text : `${expression.kind === 'all' ? 'All of these' : 'Any one of these'} for ${owner}`, planned: false })
    link(path, target, expression.kind === 'condition' ? 'Condition' : expression.kind === 'all' ? 'All required' : 'One alternative')
    if (expression.kind !== 'condition') expression.items.forEach((child, index) => expand(child, path, `${path}:${index}`, owner))
  }
  ;[...selected].sort().forEach(visit)
  const nodes = [...items.values()].sort((a, b) => a.id.localeCompare(b.id))
  assignPositions(nodes, links)
  return { nodes, links, width: Math.max(0, ...nodes.map(node => node.position.x + 258)), height: Math.max(0, ...nodes.map(node => node.position.y + 180)) }
}

// Collapse strongly connected components before ranking: concurrent or optional
// cycles are not evidence of an impossible enrollment sequence. This layout is
// display-only and never treats graph reachability as eligibility assessment.
function assignPositions(nodes: GraphItem[], links: GraphLink[]) {
  const outgoing = new Map(nodes.map(node => [node.id, [] as string[]]))
  for (const edge of links) outgoing.get(edge.source)!.push(edge.target)
  const reachable = new Map<string, Set<string>>()
  for (const node of nodes) {
    const seen = new Set<string>()
    const pending = [node.id]
    while (pending.length) {
      const id = pending.pop()!
      if (seen.has(id)) continue
      seen.add(id); pending.push(...outgoing.get(id)!)
    }
    reachable.set(node.id, seen)
  }
  const component = new Map<string, number>()
  let count = 0
  for (const node of nodes) {
    if (component.has(node.id)) continue
    for (const other of nodes) if (reachable.get(node.id)!.has(other.id) && reachable.get(other.id)!.has(node.id)) component.set(other.id, count)
    count++
  }
  const parents = Array.from({ length: count }, () => new Set<number>())
  for (const edge of links) {
    const from = component.get(edge.source)!, to = component.get(edge.target)!
    if (from !== to) parents[to].add(from)
  }
  const ranks = new Map<number, number>()
  const rank = (id: number): number => {
    if (!ranks.has(id)) ranks.set(id, Math.max(0, ...[...parents[id]].map(parent => rank(parent) + 1)))
    return ranks.get(id)!
  }
  const layers = new Map<number, GraphItem[]>()
  for (const node of nodes) {
    const depth = rank(component.get(node.id)!)
    layers.set(depth, [...(layers.get(depth) ?? []), node])
  }
  // Parent barycenters reduce crossings; IDs provide repeatable tie breaks.
  for (const [depth, layer] of [...layers].sort(([a], [b]) => a - b)) {
    const center = (node: GraphItem) => {
      const sources = links.filter(edge => edge.target === node.id).map(edge => nodes.find(item => item.id === edge.source)!).filter(item => rank(component.get(item.id)!) < depth)
      return sources.length ? sources.reduce((sum, item) => sum + item.position.y, 0) / sources.length : 0
    }
    layer.sort((a, b) => center(a) - center(b) || a.id.localeCompare(b.id))
    layer.forEach((node, row) => { node.position = { x: depth * 430, y: 110 + row * 240 } })
  }
}
