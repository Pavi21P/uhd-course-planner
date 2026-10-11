import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { loadPlannerCatalog } from '../src/data/minor-catalog.ts'
import { buildMathematicsCatalog, mathematics, mathRequiredCodes } from '../src/data/math-bs-catalog.ts'
import { programStarterIds } from '../src/data/program-definition.ts'
import { buildPrerequisiteGraph } from '../src/data/prerequisite-graph.ts'
import { graphPrerequisites } from '../src/data/catalog-snapshot.ts'
const read = (path: string) => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'))
const base = loadPlannerCatalog(read('../src/data/catalog-2025-2026.json'),read('../src/data/minor-2025-2026.json'))
if (!base.ok) throw new Error(base.message)
const original = JSON.stringify(base)
const math = buildMathematicsCatalog(base.snapshot,base.programs)
const catalog = math.snapshot.catalog
const group = (id: string) => catalog.requirements.find(r => r.id === id)!

test('Math source capture identifies catalog 37 and retains requirement evidence', () => {
 const source = read('../data/sources/2025-2026/math-bs-requirements.json')
 assert.equal(source.catalogYear,'2025-2026'); assert.equal(new URL(source.url).searchParams.get('poid'),'7118')
 assert.equal(createHash('sha256').update(source.text).digest('hex'),source.sha256)
 for (const code of mathRequiredCodes) assert.ok(source.text.includes(code))
 assert.match(source.text,/at least one full semester/)
 assert.match(source.text,/Mathematics Core Requirements \(35 hours\)/)
})

test('Math starter has 11 fixed courses and 38 unique hours, with exactly 3 overlapping core hours', () => {
 const selected=programStarterIds(mathematics,catalog)
 assert.equal(selected.size,11)
 const credits=catalog.courses.filter(c=>selected.has(c.id)).reduce((sum,c)=>sum+c.credits.min,0)
 assert.equal(credits,38); assert.equal(credits-3,35)
 assert.deepEqual(group('core-020').courseIds,['2025-2026:MATH 2409'])
 assert.equal(catalog.requirements.filter(r=>r.area==='core').reduce((sum,r)=>sum+(r.minimumCredits ?? 0),0),42)
 assert.equal(group('math-bs-minor').minimumCredits,18)
 assert.equal(42+38-3+4+15+18,114) // Only a minimum budget; minor and choice hours can change the free balance.
 assert.ok(!selected.has('2025-2026:CS 4395'))
})

test('computing alternatives and all three elective slots match the degree requirements', () => {
 assert.deepEqual(group('math-bs-computing').courseIds,['2025-2026:DATA 2401','2025-2026:CS 1411'])
 assert.equal(group('math-bs-computing').count,1)
 assert.deepEqual(group('math-bs-elective-3000').courseIds,['2025-2026:MATH 3309','2025-2026:MATH 3312','2025-2026:MATH 3314'])
 assert.equal(group('math-bs-elective-4000').count,2)
 assert.equal(group('math-bs-elective-4000').courseIds.length,10)
 assert.equal(group('math-bs-elective-additional').minimumCredits,6)
 assert.equal(mathematics.electiveRequirementIds.reduce((n,id)=>n+group(id).minimumCredits!,0),15)
 for(const id of mathematics.electiveRequirementIds) for(const code of ['MATH 3321','MATH 3322','MATH 4294',...mathRequiredCodes]) assert.ok(!group(id).courseIds.includes('2025-2026:'+code))
 assert.equal(group('free-electives').minimumCredits,0)
})

test('Math program removes CS-specific degree requirements and the Mathematics minor', () => {
 assert.ok(!catalog.requirements.some(r=>r.programId==='computer-science-bs'||r.programId==='minor-math'))
 assert.deepEqual(math.programs.map(p=>p.id),['minor-data'])
 assert.ok(!mathematics.minorPlaceholders.some(p=>p.id==='math-minor'))
 assert.ok(!group('core-030').constraints.some(c=>c.includes('degree laboratory-science')))
 assert.equal(JSON.stringify(base),original)
})

test('Math graph uses reviewed prerequisites only and keeps elective choices disconnected', () => {
 const graph = buildPrerequisiteGraph(catalog.courses,[...programStarterIds(mathematics,catalog)])
 assert.ok(graph.nodes.some(n=>n.id==='tree:2025-2026:MATH 2409'))
 assert.ok(graph.links.length>0)
 const numerical=catalog.courses.find(c=>c.code==='MATH 3408')!
 assert.equal(graphPrerequisites(numerical),null)
 assert.ok(!graph.links.some(e=>e.target==='tree:'+numerical.id))
 assert.ok(math.snapshot.coverage.unresolvedPrerequisites.some(i=>i.courseId===numerical.id))
 assert.ok(!graph.nodes.some(n=>n.courseId==='2025-2026:MATH 4301'))
 assert.ok(math.snapshot.coursePolicies.some(p=>p.id==='math-bs-project-approval'&&p.text.includes('one full semester')))
})

test('Math builder rejects wrong edition and missing required course records', () => {
 assert.throws(()=>buildMathematicsCatalog({...base.snapshot,catalog:{...base.snapshot.catalog,catalogYear:'2024-2025'}},base.programs))
 assert.throws(()=>buildMathematicsCatalog({...base.snapshot,catalog:{...base.snapshot.catalog,courses:base.snapshot.catalog.courses.filter(c=>c.code!=='MATH 2409')}},base.programs))
})
