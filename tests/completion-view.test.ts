import test from 'node:test'
import assert from 'node:assert/strict'
import { completionView } from '../src/data/completion-view.ts'
import { newHistory, planReducer, type Plan } from '../src/data/plan-state.ts'
const node = (id: string, course = true) => ({ id, label: id, ...(course ? { courseId: id } : {}) })
const edge = (source: string, target: string, label = 'Before') => ({ id: `${source}-${target}`, source, target, label })

test('hides consecutive courses, deduplicates branches, and retains original edge explanations', () => {
  const nodes = ['A','B','C','D','E'].map(id => node(id))
  const links = [edge('A','B','Before · C or better'),edge('B','C'),edge('B','D'),edge('D','C'),edge('C','E')]
  const view = completionView(nodes, links, ['B','C','D'], true)
  assert.equal(view.links.length, 1)
  assert.equal(view.links[0].source, 'A'); assert.equal(view.links[0].target, 'E')
  assert.deepEqual(view.links[0].bridge?.taken, ['B','C','D'])
  assert.ok(view.links[0].bridge?.segments.some(text => text.includes('C or better')))
  assert.equal(links.length, 5)
})

test('forks and merges bridge each visible endpoint without self loops', () => {
  const nodes = ['A','B','C','D','E'].map(id => node(id))
  const links = [edge('A','B'),edge('E','B'),edge('B','C'),edge('B','D'),edge('B','A')]
  const view = completionView(nodes, links, ['B'], true)
  assert.deepEqual(view.links.map(link => `${link.source}-${link.target}`).sort(), ['A-C','A-D','E-A','E-C','E-D'])
})

test('ALL/ANY gates and condition nodes stay intact when courses collapse', () => {
  const nodes = [node('A'),node('B'),node('C'),node('ALL',false),node('ANY',false),node('permission',false)]
  const links = [edge('A','B'),edge('B','ANY','Concurrent'),edge('permission','ANY','Condition'),edge('ANY','ALL','One alternative'),edge('ALL','C','All required')]
  const view = completionView(nodes, links, ['B'], true)
  assert.equal(view.hidden.has('ANY'), false)
  assert.ok(view.links.some(link => link.source === 'A' && link.target === 'ANY' && link.bridge?.segments.some(text => text.includes('Concurrent'))))
  assert.ok(view.links.some(link => link.source === 'permission' && link.target === 'ANY'))
  assert.ok(view.links.some(link => link.source === 'ANY' && link.target === 'ALL'))
  assert.equal(view.links.some(link => link.source === 'A' && link.target === 'C'), false)
})

test('completed roots and closed cycles retain compact inputs and terminate', () => {
  const root = completionView(['A','B','C'].map(id => node(id)), [edge('A','B'),edge('B','C')], ['A','B'], true)
  assert.equal(root.compact.length, 1)
  assert.equal(root.links[0].source, 'taken:A'); assert.equal(root.links[0].target, 'C')
  const cycle = completionView(['A','B','C'].map(id => node(id)), [edge('A','B'),edge('B','A'),edge('B','C')], ['A','B'], true)
  assert.equal(cycle.compact.length, 1)
  assert.equal(cycle.links.length, 1)
})

test('duplicate course instances hide together; isolated electives gain no connections', () => {
  const nodes = [{ ...node('tree:A'), courseId:'A' },{ ...node('elective:A'), courseId:'A' },node('B')]
  const view = completionView(nodes,[edge('tree:A','B')],['A'],true)
  assert.equal(view.hidden.size, 2)
  assert.equal(view.links.some(link => link.source.includes('elective:')),false)
})

test('showing completed or undoing completion restores exact edges and saved positions', () => {
  const nodes = ['A','B','C'].map(id => node(id)); const links = [edge('A','B'),edge('B','C')]
  const plan: Plan = { schemaVersion:1,datasetVersion:'test',positions:{B:{x:137,y:299}},selectedCourseIds:['B'],takenCourseIds:[],customEdges:[],preferences:{theme:'light',hideCompleted:true} }
  const taken = planReducer(newHistory(plan),{type:'take',courseId:'B',value:true})
  assert.equal(completionView(nodes,links,taken.present.takenCourseIds,true).links.length,1)
  assert.deepEqual(completionView(nodes,links,['B'],false).links,links)
  const undone = planReducer(taken,{type:'undo'})
  assert.deepEqual(completionView(nodes,links,undone.present.takenCourseIds,true).links,links)
  assert.deepEqual(undone.present.positions,plan.positions)
})
