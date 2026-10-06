export type ConnectionNode = { id: string; courseId: string }
export type ConnectionLink = { source: string; target: string }
export type ConnectionGraph = { nodes: ConnectionNode[]; official: ConnectionLink[] }

export function connectionError(source: string, target: string, graph: ConnectionGraph, personal: ConnectionLink[]): string | null {
  const courses = new Map(graph.nodes.map(node => [node.id, node.courseId]))
  if (!courses.has(source) || !courses.has(target)) return 'Choose two course cards.'
  if (source === target || courses.get(source) === courses.get(target)) return 'A course cannot connect to itself, including another copy of the same course.'
  if (personal.some(edge => edge.source === source && edge.target === target)) return 'This personal connection already exists.'
  const official = new Map<string, string[]>()
  for (const edge of graph.official) official.set(edge.source, [...(official.get(edge.source) ?? []), edge.target])
  // An official prerequisite may be routed through nested ALL/ANY gates. Follow
  // gates but stop at the next course, so a duplicate never turns an OR into AND.
  for (const node of graph.nodes.filter(node => node.courseId === courses.get(source))) {
    const visited = new Set<string>()
    const pending = [...(official.get(node.id) ?? [])]
    while (pending.length) {
      const id = pending.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      if (courses.has(id)) {
        if (courses.get(id) === courses.get(target)) return 'An official prerequisite connection already covers these courses.'
      } else pending.push(...(official.get(id) ?? []))
    }
  }
  const outgoing = new Map<string, string[]>()
  for (const edge of [...graph.official, ...personal]) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
  const visited = new Set<string>()
  const pending = [target]
  while (pending.length) {
    const id = pending.pop()!
    if (id === source) return 'This connection would create a directed cycle.'
    if (visited.has(id)) continue
    visited.add(id)
    pending.push(...(outgoing.get(id) ?? []))
  }
  return null
}
