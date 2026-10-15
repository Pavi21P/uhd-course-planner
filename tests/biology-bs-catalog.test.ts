import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { biology, buildBiologyCatalog } from '../src/data/biology-bs-catalog.ts'
import { loadPlannerCatalog } from '../src/data/minor-catalog.ts'
import { programStarterIds, programStorageKey } from '../src/data/program-definition.ts'
import { calculatePlanCredits } from '../src/data/credit-allocation.ts'
import { graphPrerequisites, catalogSnapshotSchema } from '../src/data/catalog-snapshot.ts'
import { buildPrerequisiteGraph } from '../src/data/prerequisite-graph.ts'
import { auditMandatoryCycles } from '../scripts/prerequisite-audit.ts'
import { auditBiologyAllocation } from '../src/data/biology-allocation.ts'
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const loaded = loadPlannerCatalog(read('../src/data/catalog-2025-2026.json'), read('../src/data/minor-2025-2026.json'))
if (!loaded.ok) throw new Error(loaded.message)
const base = loaded.snapshot
const programs = loaded.programs
const intake = read('../data/drafts/biology-intake-2025-2026.json')
const degree = read('../data/drafts/biology-degree-2025-2026.json')
const shared = read('../data/drafts/chemistry-intake-2025-2026.json')
const original = JSON.stringify({ base, programs, intake, degree, shared })
const preview = buildBiologyCatalog(base, programs, intake, degree, shared)
const { catalog } = preview.snapshot
const starter = [...programStarterIds(biology, catalog)]
const id = (code: string) => '2025-2026:' + code

test('Biology assembly preserves inputs, scopes requirements and builds only the 16-course 34-credit starter', () => {
  assert.equal(preview.publishable, false)
  assert.equal(preview.snapshot.scope, 'biology-bs-planning-catalog')
  assert.equal(starter.length, 16)
  assert.deepEqual(calculatePlanCredits(catalog.courses, starter, preview.snapshot.coursePolicies).degreeCredits, { min: 34, max: 34 })
  assert.equal(JSON.stringify({ base, programs, intake, degree, shared }), original)
  assert.ok(catalog.requirements.every(r => r.programId === biology.id || r.area === 'minor'))
  assert.ok(!catalog.courses.some(c => c.code === 'CHEM 4164'))
  assert.equal(new Set(['cs-bs','math-bs','chemistry-bs','biology-bs'].map(p => programStorageKey(p,'2025-2026'))).size, 4)
  assert.ok(!starter.includes(id('BIOL 4302')))
  assert.ok(!starter.includes(id('TCOM 3302')))
})

test('Biology graph has closed references, no mandatory cycles and no invented unresolved edges', () => {
  const graph = buildPrerequisiteGraph(catalog.courses, starter)
  const nodes = new Set(graph.nodes.map(n => n.id))
  assert.ok(graph.links.every(link => nodes.has(link.source) && nodes.has(link.target)))
  assert.ok(graph.nodes.every(n => Number.isFinite(n.position.x) && Number.isFinite(n.position.y)))
  assert.deepEqual(auditMandatoryCycles(catalog.courses), [])
  for (const issue of intake.report.unresolved) {
    assert.equal(graphPrerequisites(catalog.courses.find(c => c.id === issue.courseId)!), null)
    assert.ok(!graph.links.some(link => link.target === 'tree:' + issue.courseId))
  }
  for (const courseId of intake.report.dependencyCourseIds) assert.ok(catalog.courses.some(c => c.id === courseId))
  assert.ok(!catalog.courses.some(c => c.code === 'BIOL 3103'))
  assert.ok(preview.snapshot.coverage.notices.some(n => n.includes('BIOL 3103')))
  assert.ok(preview.snapshot.coverage.notices.some(n => n.includes('BIOL 3107')))
})

test('Biology retains optional minors, complete choices, integrated and content-area conditions', () => {
  assert.deepEqual(preview.programs.map(p => p.id).sort(), ['minor-data','minor-math'])
  for (const minor of preview.programs) {
    assert.match(minor.summary, /Optional for this Biology plan/)
    assert.ok(minor.courseIds.every(courseId => catalog.courses.some(c => c.id === courseId)))
  }
  assert.equal(catalog.requirements.find(r => r.id === 'biology-high-impact')!.courseSets!.length, 12)
  assert.equal(preview.allocationModel.contentAreaConditions.length, 4)
  assert.equal(preview.snapshot.coursePolicies.filter(p => p.id.startsWith('biology-integrated-') || p.id.startsWith('biology-area-')).length, 6)
  const audit = auditBiologyAllocation(preview.allocationModel, catalog.courses, { selectedCourseIds: starter, assignments: [], areaClaims: [] })
  assert.equal(audit.automaticEligibilityAssessment, false)
  assert.equal(audit.selectedCredits.catalogCredits.min, 34)
  assert.equal(audit.upperLevelPool.reachesCreditMinimum, false)
})

test('Assembly preserves source provenance, actual credits and relevant credit exclusions', () => {
  for (const code of ['MATH 1310','STAT 1312','CHEM 1305','ENG 1301']) assert.ok(catalog.courses.some(c => c.code === code))
  for (const code of ['BIOL 3390','BIOL 4390','BIOL 4399']) assert.ok(catalog.courses.find(c => c.code === code)!.sourceIds.includes('biology-credit-policy-37'))
  assert.deepEqual(catalog.courses.find(c => c.code === 'BIOL 3107')!.credits, { min: 3, max: 3 })
  for (const codes of [['BIOL 4344','CHEM 4344'], ['PHYS 1307','PHYS 2401']])
    assert.equal(calculatePlanCredits(catalog.courses, codes.map(id), preview.snapshot.coursePolicies).degreeCredits, null)
  const dev = catalog.courses.find(c => c.code === 'MATH 0300')!
  assert.ok(dev)
  assert.deepEqual(calculatePlanCredits(catalog.courses, [dev.id], preview.snapshot.coursePolicies).degreeCredits, { min: 0, max: 0 })
  assert.equal(catalogSnapshotSchema.safeParse(preview.snapshot).success, true)
})

test('Biology assembly rejects missing courses, shared conflicts and incomplete notices', () => {
  const missing = structuredClone(intake)
  missing.courses = missing.courses.filter((c: { code: string }) => c.code !== 'BIOL 3306')
  assert.throws(() => buildBiologyCatalog(base, programs, missing, degree, shared), /Missing Biology catalog course/)
  const conflict = structuredClone(intake)
  conflict.courses.find((c: { code: string }) => c.code === 'TCOM 3302').title += ' changed'
  assert.throws(() => buildBiologyCatalog(base, programs, conflict, degree, shared), /Conflicting shared Biology/)
  const noNotice = structuredClone(intake)
  noNotice.report.unresolved = []
  assert.throws(() => buildBiologyCatalog(base, programs, noNotice, degree, shared), /Incomplete prerequisite notices/)
  const duplicate = structuredClone(intake)
  duplicate.courses.push(duplicate.courses[0])
  assert.throws(() => buildBiologyCatalog(base, programs, duplicate, degree, shared), /Duplicate Biology assembly course/)
})

test('Biology assembly rejects changed identities, starters, condition references and restrictions', () => {
  const build = (changed: unknown) => buildBiologyCatalog(base, programs, intake, changed, shared)
  assert.throws(() => build({ ...degree, publishable: true }))
  assert.throws(() => build({ ...degree, catalogYear: '2026-2027' }))
  assert.throws(() => build({ ...degree, defaultCourseIds: degree.defaultCourseIds.slice(1) }), /starter/)
  const badArea = structuredClone(degree)
  badArea.contentAreaConditions[0].courseIds.push(id('BIOL 1301'))
  assert.throws(() => build(badArea), /area outside/)
  const badIntegrated = structuredClone(degree)
  badIntegrated.integratedConditions[0].sourceIds = ['missing-source']
  assert.throws(() => build(badIntegrated), /Unknown policy source/)
  const badRestriction = structuredClone(degree)
  badRestriction.allocationRestrictions[0].incompatibleRequirementIds = ['biology-high-impact','biology-fixed-science']
  assert.throws(() => build(badRestriction), /Invalid Biology allocation restriction/)
  const foreign = structuredClone(degree)
  foreign.requirements[0].programId = 'chemistry-bs'
  assert.throws(() => build(foreign), /Foreign Biology requirement/)
})

test('Biology assembly rejects conflicting policy/source records and wrong shared catalog editions', () => {
  const policy = structuredClone(degree)
  policy.coursePolicies.find((p: { id: string }) => p.id === 'exclusive-phys-2401').text += ' changed'
  assert.throws(() => buildBiologyCatalog(base, programs, intake, policy, shared), /Conflicting Biology policy/)
  const source = structuredClone(intake)
  source.sources.push({ ...base.catalog.sources[0], title: 'conflicting source' })
  assert.throws(() => buildBiologyCatalog(base, programs, source, degree, shared), /Conflicting Biology source/)
  assert.throws(() => buildBiologyCatalog(base, programs, intake, degree, { ...shared, catalogYear: '2026-2027' }))
  const duplicate = structuredClone(degree)
  duplicate.contentAreaConditions[1].id = duplicate.contentAreaConditions[0].id
  assert.throws(() => buildBiologyCatalog(base, programs, intake, duplicate, shared), /Duplicate Biology condition/)
})
