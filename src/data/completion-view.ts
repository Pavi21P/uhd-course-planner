import type { GraphLink } from './prerequisite-graph.ts'

export type CompletionNode = { id: string; courseId?: string; label: string }
export type DisplayLink = GraphLink & { bridge?: { taken: string[]; segments: string[] } }

// Only course cards collapse. Logical gates/conditions remain visible, so hiding
// a course cannot silently flatten ALL/ANY or discard a required alternative.
export function completionView(nodes: CompletionNode[], links: GraphLink[], takenIds: string[], hide: boolean) {
  const taken = new Set(takenIds)
  const hidden = new Set(hide ? nodes.filter(node => node.courseId && taken.has(node.courseId)).map(node => node.id) : [])
  const labels = new Map(nodes.map(node => [node.id, node.label]))
  const compact: { id: string; originalId: string; label: string }[] = []
  if (!hidden.size) return { hidden, compact, links: links as DisplayLink[] }
  const outgoing = new Map<string, GraphLink[]>()
  const incoming = new Map<string, GraphLink[]>()
  for (const edge of links) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge])
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge])
  }
  const result: DisplayLink[] = links.filter(edge => !hidden.has(edge.source) && !hidden.has(edge.target))
  const covered = new Set<string>()
  const fromSeed = (source: string, initialHidden: string[]) => {
    const reached = new Set<string>()
    const targets = new Set<string>()
    const pending = [...initialHidden]
    while (pending.length) {
      const id = pending.pop()!
      if (reached.has(id)) continue
      reached.add(id); covered.add(id)
      for (const edge of outgoing.get(id) ?? []) {
        if (hidden.has(edge.target)) pending.push(edge.target)
        else if (edge.target !== source) targets.add(edge.target)
      }
    }
    for (const target of [...targets].sort()) {
      // Backward reachability restricts the explanation to this endpoint. This
      // combines duplicate routes without enumerating exponentially many paths.
      const relevant = new Set<string>()
      const backwards = (incoming.get(target) ?? []).map(edge => edge.source).filter(id => reached.has(id))
      while (backwards.length) {
        const id = backwards.pop()!
        if (relevant.has(id)) continue
        relevant.add(id)
        backwards.push(...(incoming.get(id) ?? []).map(edge => edge.source).filter(parent => reached.has(parent)))
      }
      const takenLabels = [...relevant].map(id => labels.get(id) ?? id).sort()
      const segments = [...new Set(links.filter(edge =>
        (relevant.has(edge.source) && (relevant.has(edge.target) || edge.target === target)) ||
        (edge.source === source && relevant.has(edge.target)))
        .map(edge => `${labels.get(edge.source) ?? edge.source} → ${labels.get(edge.target) ?? edge.target}: ${edge.label}`))].sort()
      result.push({ id: `bridge:${JSON.stringify([source, target])}`, source, target,
        label: `Taken path: ${takenLabels.join(', ')}`, bridge: { taken: takenLabels, segments } })
    }
  }
  for (const node of nodes.filter(node => !hidden.has(node.id))) {
    const starts = (outgoing.get(node.id) ?? []).map(edge => edge.target).filter(id => hidden.has(id))
    if (starts.length) fromSeed(node.id, starts)
  }
  // A completed root has no earlier visible card to bridge from. Keep a compact
  // Taken marker so downstream groups still retain that input. Closed cycles
  // similarly get one anchor rather than a dangling edge or infinite traversal.
  const roots = [...hidden].filter(id => !(incoming.get(id)?.length)).sort()
  const remaining = [...new Set([...roots, ...[...hidden].sort()])]
  for (const candidate of remaining) {
    let originalId = candidate
    if (covered.has(originalId)) continue
    const ancestors = new Set<string>()
    while (!ancestors.has(originalId)) {
      ancestors.add(originalId)
      const parent = (incoming.get(originalId) ?? []).map(edge => edge.source).find(id => hidden.has(id) && !covered.has(id))
      if (!parent) break
      originalId = parent
    }
    const id = `taken:${originalId}`
    const before = result.length
    fromSeed(id, [originalId])
    if (result.length > before) compact.push({ id, originalId, label: `Taken · ${labels.get(originalId) ?? originalId}` })
  }
  return { hidden, compact, links: result }
}

