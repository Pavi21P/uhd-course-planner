import test from 'node:test'
import assert from 'node:assert/strict'
import { sectionView } from '../src/data/section-view.ts'

const nodes = [{ id: 'major', position: { x: 10, y: 20 } }, { id: 'gate' }, { id: 'elective' }, { id: 'taken-marker' }]
const edges = [{ source: 'major', target: 'gate' }, { source: 'major', target: 'elective' }, { source: 'taken-marker', target: 'gate' }]

test('sections retain local logic and omit cross-area links without changing the shared graph', () => {
  const view = sectionView(nodes, edges, ['major', 'gate'])
  assert.deepEqual(view.nodes.map(node => node.id), ['major', 'gate'])
  assert.deepEqual(view.edges, [edges[0]])
  assert.equal(view.nodes[0], nodes[0])
  assert.deepEqual(nodes[0].position, { x: 10, y: 20 })
  assert.equal(edges.length, 3)
  const board = sectionView(nodes, edges)
  assert.equal(board.nodes, nodes)
  assert.equal(board.edges, edges)
})

test('completed markers belong to the original course area and preserve its remaining links', () => {
  const markers = [{ id: 'taken-marker', originalId: 'completed-major' }]
  const major = sectionView(nodes, edges, ['major', 'gate', 'completed-major'], markers)
  assert.deepEqual(major.nodes.map(node => node.id), ['major', 'gate', 'taken-marker'])
  assert.deepEqual(major.edges, [edges[0], edges[2]])
  assert.deepEqual(sectionView(nodes, edges, ['elective'], markers).nodes.map(node => node.id), ['elective'])
})

test('an empty section has no dangling edges or unrelated courses', () => {
  assert.deepEqual(sectionView(nodes, edges, ['missing']), { nodes: [], edges: [] })
})
