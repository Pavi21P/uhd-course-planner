import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildChemistryCatalog, chemistry } from '../src/data/chemistry-bs-catalog.ts'
import { loadPlannerCatalog } from '../src/data/minor-catalog.ts'
import { programStarterIds, programStorageKey } from '../src/data/program-definition.ts'
import { buildPrerequisiteGraph } from '../src/data/prerequisite-graph.ts'
import { calculatePlanCredits } from '../src/data/credit-allocation.ts'
import { graphPrerequisites } from '../src/data/catalog-snapshot.ts'
import { auditMandatoryCycles } from '../scripts/prerequisite-audit.ts'
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const base = loadPlannerCatalog(read('../src/data/catalog-2025-2026.json'), read('../src/data/minor-2025-2026.json'))
if (!base.ok) throw new Error(base.message)
const intake = read('../data/drafts/chemistry-intake-2025-2026.json')
const degree = read('../data/drafts/chemistry-degree-2025-2026.json')
const original = JSON.stringify(base)
const preview = buildChemistryCatalog(base.snapshot, base.programs, intake, degree)
const catalog = preview.snapshot.catalog
const starter = [...programStarterIds(chemistry, catalog)]

test('Chemistry catalog builds a 30-course 70-credit starter while preserving original CS catalog', () => {
  assert.equal(preview.publishable, false)
  assert.equal(preview.definition.id, 'chemistry-bs')
  assert.equal(starter.length, 30)
  assert.deepEqual(calculatePlanCredits(catalog.courses, starter, preview.snapshot.coursePolicies).degreeCredits, { min: 70, max: 70 })
  assert.equal(JSON.stringify(base), original)
  assert.ok(!catalog.requirements.some(group => group.programId === 'computer-science-bs'))
  assert.equal(new Set(catalog.courses.map(course => course.id)).size, catalog.courses.length)
  assert.notEqual(catalog.datasetVersion, base.snapshot.catalog.datasetVersion)
  assert.equal(new Set(['cs-bs','math-bs','chemistry-bs'].map(id => programStorageKey(id, '2025-2026'))).size, 3)
})

test('Chemistry graph retains concurrency and omits unresolved incoming prerequisite rules', () => {
  const graph = buildPrerequisiteGraph(catalog.courses, starter)
  const nodes = new Set(graph.nodes.map(node => node.id))
  assert.ok(graph.links.every(link => nodes.has(link.source) && nodes.has(link.target)))
  assert.ok(graph.nodes.every(node => Number.isFinite(node.position.x) && Number.isFinite(node.position.y)))
  assert.ok(graph.links.some(link => link.target === 'tree:2025-2026:CHEM 4164' && link.timing === 'concurrent'))
  for (const issue of intake.report.unresolved) {
    assert.equal(graphPrerequisites(catalog.courses.find(course => course.id === issue.courseId)!), null)
    assert.ok(!graph.links.some(link => link.target === `tree:${issue.courseId}`))
  }
  assert.deepEqual(auditMandatoryCycles(catalog.courses), [])
  assert.ok(!graph.nodes.some(node => node.courseId === '2025-2026:TCOM 3325'))
})

test('Chemistry keeps paired choices, integrated policies and both optional minor catalogs', () => {
  assert.deepEqual(preview.programs.map(program => program.id).sort(), ['minor-data','minor-math'])
  for (const program of preview.programs) {
    assert.ok(program.summary.includes('Optional'))
    assert.ok(program.courseIds.every(id => catalog.courses.some(course => course.id === id)))
  }
  for (const id of ['chemistry-physics-1','chemistry-physics-2']) assert.equal(catalog.requirements.find(group => group.id === id)!.courseSets!.length, 2)
  const integrated = preview.snapshot.coursePolicies.filter(policy => policy.id.startsWith('chemistry-integrated'))
  assert.equal(integrated.length, 2)
  assert.ok(integrated.every(policy => policy.kind === 'program-condition'))
  const conflict = calculatePlanCredits(catalog.courses, ['2025-2026:PHYS 1307','2025-2026:PHYS 2401'], preview.snapshot.coursePolicies)
  assert.equal(conflict.degreeCredits, null)
  assert.equal(conflict.conflicts.length, 1)
  assert.ok(preview.snapshot.coverage.notices.some(note => note.includes('graduation rules')))
  assert.ok(!catalog.courses.some(course => course.code === 'CHEM 1305'))
})

test('Chemistry construction rejects conflicting shared content, unknown references and missing notices', () => {
  const altered = structuredClone(intake)
  altered.courses.find((course: { code: string }) => course.code === 'TCOM 3302').credits.min = 2
  assert.throws(() => buildChemistryCatalog(base.snapshot, base.programs, altered, degree), /Conflicting shared course/)
  const missing = structuredClone(intake)
  missing.courses = missing.courses.filter((course: { code: string }) => course.code !== 'CHEM 4164')
  assert.throws(() => buildChemistryCatalog(base.snapshot, base.programs, missing, degree), /Missing Chemistry catalog course/)
  const noNotice = structuredClone(intake)
  noNotice.report.unresolved = []
  assert.throws(() => buildChemistryCatalog(base.snapshot, base.programs, noNotice, degree), /Incomplete prerequisite notices/)
  const badDegree = structuredClone(degree)
  badDegree.defaultCourseIds.pop()
  assert.throws(() => buildChemistryCatalog(base.snapshot, base.programs, intake, badDegree), /starter/)
  assert.throws(() => buildChemistryCatalog(base.snapshot, base.programs, intake, { ...degree, publishable: true }))
  assert.throws(() => buildChemistryCatalog(base.snapshot, base.programs, { ...intake, catalogYear: '2026-2027' }, degree))
})
