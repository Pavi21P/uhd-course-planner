import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { buildMinorSupplement } from '../scripts/publish-minors.ts'
import { catalogSnapshotSchema } from '../src/data/catalog-snapshot.ts'
import { addMinorSupplement, loadPlannerCatalog } from '../src/data/minor-catalog.ts'
import { buildPrerequisiteGraph } from '../src/data/prerequisite-graph.ts'
import { calculatePlanCredits } from '../src/data/credit-allocation.ts'
import { loadPlan, type Plan } from '../src/data/plan-state.ts'

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')
const base = catalogSnapshotSchema.parse(JSON.parse(await read('../src/data/catalog-2025-2026.json')))
const raw = await read('../data/sources/2025-2026/minor-capture.json')
const expansionRaw = await read('../data/sources/2025-2026/minor-expansion-capture.json')
const mathRaw = await read('../data/sources/2025-2026/minor-math-capture.json')
const supplement = buildMinorSupplement(raw, base.catalog, expansionRaw, mathRaw)
const merged = addMinorSupplement(base, supplement).snapshot
const selected = [...new Set(base.catalog.requirements.filter(group => ['cs-required', 'support-writing', 'support-math'].includes(group.id)).flatMap(group => group.courseIds)), '2025-2026:CS 4395']

test('minor publication reproduces reviewed artifact and rejects changed capture', async () => {
  assert.deepEqual(supplement, JSON.parse(await read('../src/data/minor-2025-2026.json')))
  assert.throws(() => buildMinorSupplement(raw + ' ', base.catalog, expansionRaw, mathRaw), /re-review/)
  assert.equal(supplement.courses.length, 46)
  assert.equal(supplement.requirements.length, 6)
})

test('minor addition preserves the base records, prerequisite tree and starter credits', () => {
  assert.deepEqual(merged.catalog.courses.slice(0, 83), base.catalog.courses)
  assert.deepEqual(merged.catalog.requirements.slice(0, base.catalog.requirements.length), base.catalog.requirements)
  assert.equal(merged.catalog.courses.length, 129)
  assert.equal(merged.catalog.datasetVersion, base.catalog.datasetVersion)
  assert.deepEqual(buildPrerequisiteGraph(merged.catalog.courses, selected), buildPrerequisiteGraph(base.catalog.courses, selected))
  assert.deepEqual(calculatePlanCredits(merged.catalog.courses, selected, merged.coursePolicies).catalogCredits, { min: 54, max: 54 })
  assert.equal(merged.coverage.minorCoursesIncluded, true)
  assert.ok(merged.coverage.notices.some(note => note.includes('All 47 indexed MATH')))
})

test('minor validation rejects replacements, wrong editions, missing references and duplicate program identities', () => {
  const variants = [
    { ...supplement, courses: [...supplement.courses, base.catalog.courses[0]] },
    { ...supplement, sources: supplement.sources.map(source => ({ ...source, url: source.url.replace('catoid=37', 'catoid=39') })) },
    { ...supplement, programs: [supplement.programs[0], supplement.programs[0]] },
    { ...supplement, programs: supplement.programs.map(program => ({ ...program, courseIds: ['unknown'] })) },
  ]
  for (const variant of variants) assert.equal(loadPlannerCatalog(base, variant).ok, false)
  assert.throws(() => addMinorSupplement({ ...base, catalog: { ...base.catalog, datasetVersion: 'other' } }, supplement), /reviewed base/)
})

test('minor rules preserve paired calculus, nested upper-level hours and optional DATA 3402', () => {
  const group = (id: string) => supplement.requirements.find(group => group.id === id)!
  assert.ok(group('minor-math-calculus').constraints.some(text => text.includes('Do not mix')))
  assert.equal(group('minor-math-additional').minimumCredits, 10)
  assert.equal(group('minor-math-upper').minimumCredits, 6)
  assert.ok(group('minor-math-upper').constraints.some(text => text.includes('not another 6')))
  assert.ok(group('minor-math-upper').courseIds.every(id => group('minor-math-additional').courseIds.includes(id)))
  assert.equal(group('minor-data-required').minimumCredits, 15)
  assert.equal(group('minor-data-required').courseIds.includes('2025-2026:DATA 3402'), false)
  assert.ok(group('minor-data-option').courseIds.includes('2025-2026:DATA 3402'))
  assert.equal(group('minor-data-option').count, 1)
  assert.equal(supplement.courses.find(course => course.code === 'DATA 3401')!.prerequisites.kind, 'all')
  const graph = supplement.courses.find(course => course.code === 'MATH 4308')!.prerequisites
  assert.equal(graph.kind, 'all')
  if (graph.kind === 'all') assert.deepEqual(graph.items.map(item => item.kind), ['any', 'any'])
})

test('pre-minor saved plan retains positions, completion and personal links when new cards appear', () => {
  const saved: Plan = { schemaVersion: 1, datasetVersion: base.catalog.datasetVersion,
    positions: { a: { x: 4964, y: 247 }, b: { x: 4960, y: 471 } },
    selectedCourseIds: selected, takenCourseIds: ['2025-2026:CS 1411'],
    customEdges: [{ id: 'personal', source: 'a', target: 'b' }], preferences: { theme: 'dark', hideCompleted: false } }
  const stored = JSON.stringify(saved)
  const defaults: Plan = { ...saved, positions: { a: { x: 0, y: 0 }, b: { x: 100, y: 100 }, minor: { x: 1200, y: 3500 } } }
  const loaded = loadPlan({ getItem: () => stored, setItem: () => { assert.fail('Reading must not overwrite a saved plan') } }, {
    defaults, courseIds: new Set(merged.catalog.courses.map(course => course.id)), nodeIds: new Set(['a', 'b', 'minor']),
    connectionGraph: { nodes: [{ id: 'a', courseId: '2025-2026:CS 1411' }, { id: 'b', courseId: '2025-2026:MATH 2305' }, { id: 'minor', courseId: '2025-2026:DATA 2401' }], official: [] },
  })
  assert.equal(loaded.writable, true)
  assert.deepEqual(loaded.plan, { ...saved, positions: { ...saved.positions, minor: defaults.positions.minor } })
})

test('DATA index reconciliation exposes seven additional choices without reusing foundation courses', () => {
  assert.deepEqual(supplement.coverage.dataIndexCodes, ['DATA 2401', 'DATA 3334', 'DATA 3394', 'DATA 3401', 'DATA 3402', 'DATA 4300', 'DATA 4320', 'DATA 4395', 'DATA 4419'])
  const options = supplement.requirements.find(group => group.id === 'minor-data-option')!.courseIds
  assert.equal(options.filter(id => id.includes(':DATA ')).length, 7)
  assert.ok(!options.includes('2025-2026:DATA 2401') && !options.includes('2025-2026:DATA 3401'))
  assert.equal(supplement.coverage.mathMissingCodes.length, 0)
  assert.ok(!supplement.coverage.mathMissingCodes.includes('MATH 3321'))
  assert.ok(!supplement.coverage.mathMissingCodes.includes('MATH 3322'))
  assert.ok(!supplement.coverage.mathMissingCodes.includes('MATH 3323'))
  assert.throws(() => buildMinorSupplement(raw, base.catalog, expansionRaw + ' ', mathRaw), /re-review/)
  assert.equal(loadPlannerCatalog(base, { ...supplement, coverage: { ...supplement.coverage, dataIndexCodes: Array(9).fill('DATA 2401') } }).ok, false)
})

test('additional minor cards append after old cards so default positions and saved IDs stay stable', () => {
  const oldData = ['CS 1411','DATA 2401','DATA 3401','MATH 2305','MATH 2421','MATH 2402','MATH 2412','DATA 3334','DATA 3402','MATH 3302','STAT 3311','STAT 3333','DATA 3394','DATA 4300','DATA 4320','DATA 4395','DATA 4419']
  const oldMath = ['MATH 2305','MATH 2307','MATH 2401','MATH 2402','MATH 2403','MATH 2409','MATH 2411','MATH 2412','MATH 2421','MATH 2422','MATH 3301','MATH 3302','MATH 3309','MATH 4308','MATH 3323','MATH 2301','MATH 3303','MATH 3306','MATH 3307','MATH 3312','MATH 3313','MATH 3314','MATH 3317','MATH 3318','MATH 3321','MATH 3322','MATH 3394','MATH 3399','MATH 3408','MATH 4095','MATH 4294','MATH 4301','MATH 4302']
  for (const [programId, previous] of [['minor-data', oldData], ['minor-math', oldMath]] as const) {
    const program = supplement.programs.find(program => program.id === programId)!
    assert.deepEqual(program.courseIds.slice(0, previous.length), previous.map(code => `2025-2026:${code}`))
  }
})

test('new DATA prerequisites retain permission alternatives and concurrent enrollment timing', () => {
  const prerequisite = (code: string) => supplement.courses.find(course => course.code === code)!.prerequisites
  const advanced = prerequisite('DATA 4320')
  assert.equal(advanced.kind, 'any')
  if (advanced.kind === 'any') assert.deepEqual(advanced.items.map(item => item.kind), ['course', 'condition'])
  const learning = prerequisite('DATA 4419')
  assert.equal(learning.kind, 'all')
  if (learning.kind === 'all') assert.deepEqual(learning.items.map(item => item.kind === 'course' && [item.courseId, item.timing, item.minimumGrade]), [
    ['2025-2026:DATA 3401', 'before', 'C'], ['2025-2026:MATH 3323', 'before-or-concurrent', 'C'], ['2025-2026:STAT 3333', 'before-or-concurrent', 'C'],
  ])
  const numerical = prerequisite('MATH 3323')
  assert.equal(numerical.kind, 'any')
  if (numerical.kind === 'any') assert.deepEqual(numerical.items.map(item => item.kind === 'all' ? item.items.length : item.kind), [2, 3, 'condition'])
})

test('MATH 3321/3322 exclusion applies to the upper-level subset rather than the whole additional pool', () => {
  const additional = supplement.requirements.find(group => group.id === 'minor-math-additional')!.courseIds
  const upper = supplement.requirements.find(group => group.id === 'minor-math-upper')!.courseIds
  for (const code of ['MATH 3321', 'MATH 3322']) { assert.ok(additional.includes('2025-2026:' + code)); assert.ok(!upper.includes('2025-2026:' + code)) }
})

test('Math batch preserves concurrent calculus without inventing a minimum grade', () => {
  const prereq = supplement.courses.find(course => course.code === 'MATH 2301')!.prerequisites
  assert.deepEqual(prereq, { kind: 'all', items: [
    { kind: 'course', courseId: '2025-2026:CS 1410', timing: 'before', minimumGrade: 'C' },
    { kind: 'course', courseId: '2025-2026:MATH 2401', timing: 'before-or-concurrent' },
  ] })
  const geometry = supplement.courses.find(course => course.code === 'MATH 3303')!.prerequisites
  assert.equal(geometry.kind, 'all')
  if (geometry.kind === 'all') assert.deepEqual(geometry.items[1], { kind: 'condition', category: 'standing', text: 'Junior standing' })
})

test('Actuarial II retains catalog alternatives without an inferred Actuarial I dependency', () => {
  const prereq = supplement.courses.find(course => course.code === 'MATH 3318')!.prerequisites
  assert.equal(prereq.kind, 'any')
  if (prereq.kind === 'any') assert.deepEqual(prereq.items.map(item => item.kind === 'course' && item.courseId), ['MATH 2402','MATH 2412','MATH 2421','STAT 3309','STAT 3311'].map(code => `2025-2026:${code}`))
  assert.deepEqual(prereq, supplement.courses.find(course => course.code === 'MATH 3317')!.prerequisites)
  const combinatorics = supplement.courses.find(course => course.code === 'MATH 3314')!.prerequisites
  assert.equal(combinatorics.kind, 'any')
  if (combinatorics.kind === 'any') assert.equal(combinatorics.items.length, 5)
})

test('Math records append in capture order and reconcile the exact missing inventory', () => {
  const batch = JSON.parse(mathRaw).courses as { code: string; id: string }[]
  assert.equal(batch.length, 33)
  const program = supplement.programs.find(program => program.id === 'minor-math')!
  assert.equal(program.courseIds.length, 47)
  assert.deepEqual(program.courseIds.slice(15), batch.filter(course => course.code.startsWith('MATH ')).map(course => course.id))
  assert.ok(batch.every(course => !supplement.coverage.mathMissingCodes.includes(course.code)))
  const upper = supplement.requirements.find(group => group.id === 'minor-math-upper')!.courseIds
  assert.ok(!upper.includes('2025-2026:MATH 2301'))
  assert.ok(batch.filter(course => course.code.startsWith('MATH ') && !['MATH 2301','MATH 3321','MATH 3322','MATH 4095'].includes(course.code)).every(course => upper.includes(course.id)))
  assert.throws(() => buildMinorSupplement(raw, base.catalog, expansionRaw, mathRaw + ' '), /Math capture changed/)
})

test('ambiguous or unimported Math prerequisites remain visible review issues and never create automatic edges', () => {
  for (const code of ['MATH 3408','MATH 4095','MATH 4301','MATH 4396']) {
    const course = supplement.courses.find(course => course.code === code)!
    assert.equal(course.review, 'needs-review')
    assert.ok(merged.coverage.unresolvedPrerequisites.some(issue => issue.courseId === course.id))
    assert.equal(buildPrerequisiteGraph(merged.catalog.courses, [course.id]).links.length, 0)
  }
  assert.equal(merged.coverage.unresolvedPrerequisites.length, 11)
  assert.equal(loadPlannerCatalog(base, { ...supplement, unresolvedPrerequisites: [] }).ok, false)
})

test('zero-credit Math course remains informational without contributing to credit-bearing minor choices', () => {
  const id = '2025-2026:MATH 4095'
  const course = supplement.courses.find(course => course.id === id)!
  assert.deepEqual(course.credits, { min: 0, max: 0 })
  assert.ok(supplement.programs.find(program => program.id === 'minor-math')!.courseIds.includes(id))
  assert.ok(supplement.requirements.every(group => !group.courseIds.includes(id)))
  const before = calculatePlanCredits(merged.catalog.courses, selected, merged.coursePolicies)
  const after = calculatePlanCredits(merged.catalog.courses, [...selected, id], merged.coursePolicies)
  assert.deepEqual(after.catalogCredits, before.catalogCredits)
  assert.equal(after.uniqueCourseCount, before.uniqueCourseCount + 1)
  assert.ok(merged.coursePolicies.some(policy => policy.courseIds.includes(id) && policy.kind === 'requirement-exclusion'))
})

test('crosslisted seminars trigger degree-credit conflict and writing prerequisites remain separate conditions', () => {
  const selected = ['2025-2026:CS 4294','2025-2026:MATH 4294']
  const result = calculatePlanCredits(merged.catalog.courses, selected, merged.coursePolicies)
  assert.deepEqual(result.catalogCredits, { min: 4, max: 4 })
  assert.equal(result.degreeCredits, null)
  assert.ok(result.conflicts.some(policy => policy.policyId === 'minor-seminar-exclusive-credit'))
  const writing = merged.coursePolicies.find(policy => policy.id === 'writing-use-math-4301')!.additionalConditions!
  assert.equal(writing.kind, 'all')
  if (writing.kind === 'all') assert.deepEqual(writing.items.map(item => item.kind === 'course' && item.courseId), ['CS 4294','TCOM 3302','COMM 1304'].map(code => `2025-2026:${code}`))
  assert.deepEqual(merged.coursePolicies.slice(0, base.coursePolicies.length), base.coursePolicies)
})


test('complete Math coverage rejects omitted, duplicated and substituted index entries or cards', () => {
  assert.equal(supplement.coverage.mathIndexCodes.length, 47)
  assert.deepEqual(supplement.coverage.mathMissingCodes, [])
  const invalid = [
    { ...supplement, coverage: { ...supplement.coverage, mathIndexCodes: supplement.coverage.mathIndexCodes.slice(1) } },
    { ...supplement, coverage: { ...supplement.coverage, mathIndexCodes: Array(47).fill('MATH 2305') } },
    { ...supplement, coverage: { ...supplement.coverage, mathIndexCodes: ['MATH 4999', ...supplement.coverage.mathIndexCodes.slice(1)] } },
    { ...supplement, programs: supplement.programs.map(program => program.id === 'minor-math' ? { ...program, courseIds: program.courseIds.slice(1) } : program) },
  ]
  for (const value of invalid) assert.equal(loadPlannerCatalog(base, value).ok, false)
})

test('final Math prerequisites preserve alternatives, permission conjunctions and grade/standing conditions', () => {
  const get = (code: string) => supplement.courses.find(course => course.code === code)!
  const operations = get('MATH 4311').prerequisites
  assert.equal(operations.kind, 'any')
  if (operations.kind === 'any') assert.deepEqual(operations.items.map(item => item.kind === 'course' && item.courseId), ['STAT 2305','MATH 2307','MATH 2422','STAT 3311'].map(code => '2025-2026:' + code))
  assert.deepEqual(get('STAT 2305').prerequisites, { kind: 'any', items: [
    { kind: 'course', courseId: '2025-2026:MATH 1324', timing: 'before', minimumGrade: 'C' },
    { kind: 'condition', category: 'permission', text: 'Department approval' },
  ] })
  const history = get('MATH 4312').prerequisites
  assert.equal(history.kind, 'any')
  if (history.kind === 'any') assert.equal(history.items[3].kind, 'all')
  const field = get('MATH 4380').prerequisites
  assert.equal(field.kind, 'all')
  if (field.kind === 'all') assert.deepEqual(field.items.map(item => item.kind === 'condition' && item.text), ['60 semester hours','Department approval','Grades of B or better in 6 hours of upper level math'])
  assert.ok(supplement.programs.every(program => !program.courseIds.includes('2025-2026:STAT 2305')))
  assert.equal(merged.coursePolicies.find(policy => policy.id === 'writing-use-math-4304')!.additionalConditions!.kind, 'all')
})

test('omitted credit lines cite the numbering rule and crosslisted projects prevent degree-credit certification', () => {
  for (const code of ['MATH 4380','MATH 4395','MATH 4396','MATH 4399']) {
    const course = supplement.courses.find(course => course.code === code)!
    assert.deepEqual(course.credits, { min: 3, max: 3 })
    assert.ok(course.sourceIds.includes('minor-credit-numbering-37'))
    assert.ok(course.description.includes('omits a credit line'))
  }
  const result = calculatePlanCredits(merged.catalog.courses, ['2025-2026:CS 4395','2025-2026:MATH 4395'], merged.coursePolicies)
  assert.deepEqual(result.catalogCredits, { min: 6, max: 6 })
  assert.equal(result.degreeCredits, null)
  assert.ok(result.conflicts.some(policy => policy.policyId === 'minor-project-exclusive-credit'))
})
