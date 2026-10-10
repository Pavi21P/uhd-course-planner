// A view-only projection: never change the shared plan or its graph.
export function sectionView<N extends { id: string }, E extends { source: string; target: string }>(
  nodes: N[], edges: E[], regionIds?: readonly string[], compact: readonly { id: string; originalId: string }[] = [],
): { nodes: N[]; edges: E[] } {
  if (!regionIds) return { nodes, edges }
  const ids = new Set(regionIds)
  for (const marker of compact) if (ids.has(marker.originalId)) ids.add(marker.id)
  const sectionNodes = nodes.filter(node => ids.has(node.id))
  const visible = new Set(sectionNodes.map(node => node.id))
  return { nodes: sectionNodes, edges: edges.filter(edge => visible.has(edge.source) && visible.has(edge.target)) }
}
