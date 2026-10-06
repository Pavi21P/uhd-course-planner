import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildPrerequisiteGraph, graphCourseId } from '../src/data/prerequisite-graph.ts'
import { catalogSnapshotSchema } from '../src/data/catalog-snapshot.ts'
import type { Course, Prerequisite } from '../src/data/catalog-schema.ts'
import { graphFixture } from '../src/data/graph-fixture.ts'

const snapshot = catalogSnapshotSchema.parse(JSON.parse(readFileSync(new URL('../src/data/catalog-2025-2026.json', import.meta.url), 'utf8')))
const courses = snapshot.catalog.courses
const ref = (id: string, timing: 'before' | 'concurrent' = 'before'): Prerequisite => ({ kind: 'course', courseId: id, timing, minimumGrade: 'C' })
const make = (id: string, prerequisites: Prerequisite): Course => ({ ...courses[0], id, code: id, prerequisites, review: 'verified' })

test('original development fixture keeps electives and minors out of its main prerequisite chain', () => {
  // Explicitly review synthetic expressions for this test only; never publish them.
  const reviewed = graphFixture.courses.map(course => ({ ...course, review: 'verified' as const }))
  const graph = buildPrerequisiteGraph(reviewed, graphFixture.requirements.find(group => group.id === 'major')!.courseIds)
  assert.equal(graph.nodes.filter(node => node.kind === 'course').length, 7)
  assert.equal(graph.nodes.filter(node => node.kind === 'all').length, 1)
  assert.equal(graph.nodes.filter(node => node.kind === 'any').length, 1)
  assert.ok(graph.links.some(edge => edge.timing === 'before-or-concurrent'))
  assert.equal(graph.nodes.some(node => ['TEST EL', 'TEST M', 'TEST DS'].includes(node.text)), false)
})

test('graph preserves nested AND/OR, condition alternatives, grades and concurrency', () => {
  const fixture = [make('A', { kind: 'none' }), make('B', { kind: 'none' }), make('C', { kind: 'all', items: [ref('A'), { kind: 'any', items: [ref('B', 'concurrent'), { kind: 'condition', category: 'permission', text: 'Department approval' }] }] })]
  const graph = buildPrerequisiteGraph(fixture, ['C'])
  const all = graph.nodes.find(node => node.kind === 'all')!
  const any = graph.nodes.find(node => node.kind === 'any')!
  const condition = graph.nodes.find(node => node.kind === 'condition')!
  assert.ok(graph.links.some(edge => edge.source === any.id && edge.target === all.id))
  assert.ok(graph.links.some(edge => edge.source === condition.id && edge.target === any.id))
  assert.ok(graph.links.some(edge => edge.source === graphCourseId('B') && edge.target === any.id && edge.timing === 'concurrent' && edge.minimumGrade === 'C'))
  assert.equal(graph.nodes.filter(node => node.planned).length, 1)
  assert.equal(graph.links.filter(edge => edge.target === graphCourseId('C')).length, 1)
})

test('unresolved prerequisites never produce inferred incoming edges', () => {
  const unresolved = { ...make('A', ref('B')), review: 'needs-review' as const }
  const graph = buildPrerequisiteGraph([unresolved, make('B', { kind: 'none' })], ['A'])
  assert.equal(graph.nodes.length, 1)
  assert.equal(graph.links.length, 0)
})

test('concurrent cycles terminate with stable distinct positions', () => {
  const fixture = [make('A', ref('B', 'concurrent')), make('B', ref('A', 'concurrent'))]
  const graph = buildPrerequisiteGraph(fixture, ['A'])
  assert.equal(graph.nodes.length, 2)
  assert.equal(graph.links.length, 2)
  assert.notDeepEqual(graph.nodes[0].position, graph.nodes[1].position)
  assert.deepEqual(buildPrerequisiteGraph([...fixture].reverse(), ['A']), graph)
})

test('real plan includes Discrete Math gates, preserves reference credits and avoids overlapping cards', () => {
  const selected = [...snapshot.catalog.requirements.filter(group => ['cs-required', 'support-math', 'support-writing'].includes(group.id)).flatMap(group => group.courseIds), '2025-2026:CS 4395']
  const graph = buildPrerequisiteGraph(courses, selected)
  assert.deepEqual(buildPrerequisiteGraph([...courses].reverse(), [...selected].reverse()), graph)
  assert.equal(graph.nodes.filter(node => node.planned).length, 17)
  const gate = `${graphCourseId('2025-2026:CS 3304')}:prerequisite`
  assert.ok(graph.links.some(edge => edge.source === graphCourseId('2025-2026:MATH 2305') && edge.target === gate && edge.minimumGrade === 'C'))
  assert.equal(graph.nodes.some(node => node.courseId === '2025-2026:CS 4319'), false)
  for (let i = 0; i < graph.nodes.length; i++) for (let j = i + 1; j < graph.nodes.length; j++) {
    const a = graph.nodes[i].position, b = graph.nodes[j].position
    assert.ok(Math.abs(a.x - b.x) >= 258 || Math.abs(a.y - b.y) >= 180, `Overlap: ${graph.nodes[i].id} and ${graph.nodes[j].id}`)
  }
  const ids = new Set(graph.nodes.map(node => node.id))
  assert.ok(graph.links.every(edge => ids.has(edge.source) && ids.has(edge.target)))
})
