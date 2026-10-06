import assert from 'node:assert/strict'
import test from 'node:test'
import { connectionError } from '../src/data/personal-connections.ts'
import { planReducer, newHistory, loadPlan, type Plan } from '../src/data/plan-state.ts'
import { beginBranchDrag } from '../src/data/branch-drag.ts'
import { completionView } from '../src/data/completion-view.ts'
const nodes = ['a','b','c','d','elective'].map(id => ({ id, courseId: id }))
nodes.push({ id: 'a-copy', courseId: 'a' })
const official = [{ source: 'a', target: 'any' }, { source: 'any', target: 'all' }, { source: 'all', target: 'b' }, { source: 'b', target: 'c' }]
const graph = { nodes, official }
const positions = Object.fromEntries([...nodes.map(node => node.id), 'any', 'all'].map((id, i) => [id, { x: i * 100, y: 0 }]))
const original: Plan = { schemaVersion: 1, datasetVersion: 'test', positions, selectedCourseIds: ['a','b'], takenCourseIds: [], customEdges: [], preferences: { theme: 'dark', hideCompleted: false } }

test('rejects same-card and same-course-copy links and non-course endpoints', () => {
  assert.match(connectionError('a','a',graph,[])!, /itself/)
  assert.match(connectionError('a','a-copy',graph,[])!, /itself/)
  assert.match(connectionError('any','d',graph,[])!, /course cards/)
  assert.match(connectionError('a','missing',graph,[])!, /course cards/)
})
test('rejects official duplicates through nested gates and personal duplicates', () => {
  assert.match(connectionError('a','b',graph,[])!, /official/)
  assert.match(connectionError('a-copy','b',graph,[])!, /official/)
  assert.equal(connectionError('a','c',graph,[]), null)
  assert.match(connectionError('a','d',graph,[{source:'a',target:'d'}])!, /already exists/)
})
test('rejects new cycles across mixed links but tolerates unrelated official concurrency cycles', () => {
  assert.match(connectionError('c','a',graph,[])!, /cycle/)
  assert.match(connectionError('d','a',graph,[{source:'c',target:'d'}])!, /cycle/)
  const concurrent = { ...graph, official:[...official,{source:'a',target:'b'},{source:'b',target:'a'}] }
  assert.equal(connectionError('d','elective',concurrent,[]),null)
  assert.match(connectionError('c','a',concurrent,[])!,/cycle/)
})
test('invalid actions leave history unchanged; valid connect/delete share undo and redo', () => {
  const initial = newHistory(original)
  assert.equal(planReducer(initial,{type:'connect',edge:{id:'bad',source:'c',target:'a'}},graph),initial)
  const added = planReducer(initial,{type:'connect',edge:{id:'personal-1',source:'c',target:'d'}},graph)
  assert.equal(added.past.length,1)
  const removed = planReducer(added,{type:'disconnect',edgeId:'personal-1'},graph)
  assert.equal(removed.present.customEdges.length,0)
  assert.deepEqual(planReducer(removed,{type:'undo'},graph).present,added.present)
  assert.deepEqual(planReducer(planReducer(added,{type:'undo'},graph),{type:'redo'},graph).present,added.present)
  assert.deepEqual(graph.official,official)
})
test('saved invalid/cyclic/duplicate personal edges are preserved as an unsaved preview', () => {
  const context = { defaults:original,courseIds:new Set(nodes.map(node=>node.courseId)),nodeIds:new Set(Object.keys(positions)),connectionGraph:graph }
  for (const customEdges of [
    [{id:'bad',source:'c',target:'a'}],
    [{id:'bad',source:'any',target:'d'}],
    [{id:'one',source:'c',target:'d'},{id:'two',source:'c',target:'d'}],
  ]) {
    const raw = JSON.stringify({...original,customEdges})
    const result = loadPlan({getItem:()=>raw,setItem:()=>assert.fail('must not write')},context)
    assert.equal(result.writable,false)
    assert.equal(result.raw,raw)
  }
  const valid = {...original,customEdges:[{id:'valid',source:'c',target:'d'}]}
  assert.deepEqual(loadPlan({getItem:()=>JSON.stringify(valid),setItem:()=>{}},context).plan,valid)
})
test('personal links join branch traversal and keep their provenance in hidden-course bridges', () => {
  const personal = [{id:'custom',source:'c',target:'elective',label:'Personal planning link'}]
  const links = [...official.map((edge,i)=>({...edge,id:String(i),label:'Before'})),...personal]
  assert.ok(beginBranchDrag('a',positions,links)!.positions.elective)
  const projected = completionView(nodes.map(node=>({...node,label:node.id})),links,['c'],true)
  const bridge = projected.links.find(edge=>edge.source==='b' && edge.target==='elective')
  assert.ok(bridge?.bridge?.segments.some(segment=>segment.includes('Personal planning link')))
  assert.ok(!beginBranchDrag('a',positions,official)!.positions.elective)
})
