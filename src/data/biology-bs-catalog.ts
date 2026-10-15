import { z } from 'zod'
import { courseSchema, requirementSchema, sourceSchema, type Course, type Prerequisite } from './catalog-schema.ts'
import { catalogSnapshotSchema, type CatalogSnapshot } from './catalog-snapshot.ts'
import type { MinorSupplement } from './minor-catalog.ts'
import { programStarterIds, type ProgramDefinition } from './program-definition.ts'

export const biology: ProgramDefinition = {
  id: 'biology-bs', title: 'Biology BS', shortTitle: 'Biology', exportSlug: 'biology', catalogYear: '2025-2026',
  firstCourseId: '2025-2026:BIOL 1301', defaultRequirementIds: ['biology-fixed-science','biology-fixed-major'], defaultCourseIds: [],
  supportingRequirementIds: ['biology-writing','biology-calculus','biology-math-computing','biology-physics-1','biology-physics-2','biology-seminar','biology-high-impact'],
  electiveRequirementIds: ['biology-upper-options','free-electives'], minimumCredits: 120,
  sourceUrl: 'https://catalog.uhd.edu/preview_program.php?catoid=37&poid=7092',
  supportingDescription: 'Choose writing, mathematics/computing, complete physics pairs, a seminar, and one high-impact course or two distinct CURE courses.',
  starterDescription: 'The starter selects 16 fixed science and Biology courses totaling 34 credits. Choices, core completion and optional minors remain separate. No completed courses are assumed.',
  coverageDescription: 'Draft Biology plan: upper-level content areas, integrated writing/ethics, research limits and overlap require allocation review. Ambiguous prerequisites stay unconnected; grades, residency and graduation eligibility are not assessed.',
  minorPlaceholders: [{ id: 'math-minor', title: 'Optional Mathematics minor', subtitle: '18-hour minimum; degree/minor overlap requires review' },
    { id: 'data-minor', title: 'Optional Data Science minor', subtitle: '22/23 hours; no minor is preselected' }],
}
const text = z.string().min(1)
const poolSchema = z.object({ catalogYear: z.literal('2025-2026'), publishable: z.literal(false), sources: z.array(sourceSchema), courses: z.array(courseSchema),
  report: z.object({ unresolved: z.array(z.object({ courseId: text, reason: text })) }) })
const degreeSchema = z.object({ catalogYear: z.literal('2025-2026'), programId: z.literal('biology-bs'), publishable: z.literal(false),
  minimumCredits: z.literal(120), sources: z.array(sourceSchema), requirements: z.array(requirementSchema), defaultCourseIds: z.array(text), fixedCourseCredits: z.literal(34),
  coursePolicies: catalogSnapshotSchema.shape.coursePolicies,
  integratedConditions: z.array(z.object({ id: text, label: text, count: z.number().int().positive(), courseIds: z.array(text), sourceIds: z.array(text).min(1), coverage: text })).length(2),
  contentAreaConditions: z.array(z.object({ id: text, label: text, minimumCourseCount: z.number().int().positive(), requirementId: z.literal('biology-upper-options'),
    courseIds: z.array(text), sourceIds: z.array(text).min(1), addsSeparateCredits: z.literal(false) })).length(4),
  allocationRestrictions: z.array(z.object({ code: text, incompatibleRequirementIds: z.array(text).min(2), reason: text })).min(1),
  remaining: z.array(text).min(1), notices: z.array(text).min(1) })
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()
const content = (c: Course) => JSON.stringify({ title: normalize(c.title), description: normalize(c.description), credits: c.credits,
  prerequisiteText: normalize(c.prerequisiteText), prerequisites: c.prerequisites, review: c.review })

// Assembly only: registration and browser validation are separate release gates.
// Shared Chemistry intake supplies core choices without importing its degree rules.
export function buildBiologyCatalog(base: CatalogSnapshot, programs: MinorSupplement['programs'], intakeInput: unknown, degreeInput: unknown, sharedInput: unknown) {
  if (base.catalog.catalogYear !== biology.catalogYear || base.scope !== 'cs-planning-catalog') throw new Error('Biology requires the base CS catalog 2025-2026')
  const intake = poolSchema.parse(intakeInput)
  const shared = poolSchema.parse(sharedInput)
  const degree = degreeSchema.parse(degreeInput)
  const byId = new Map(base.catalog.courses.map(c => [c.id, { ...c, sourceIds: [...c.sourceIds] }]))
  for (const pool of [shared, intake]) {
    if (new Set(pool.courses.map(c => c.id)).size !== pool.courses.length) throw new Error('Duplicate Biology assembly course')
    for (const c of pool.courses) {
      const existing = byId.get(c.id)
      if (existing && content(existing) !== content(c)) throw new Error('Conflicting shared Biology course: ' + c.code)
      byId.set(c.id, { ...c, sourceIds: [...new Set([...(existing?.sourceIds ?? []), ...c.sourceIds])] })
    }
  }
  const sources = new Map(base.catalog.sources.map(s => [s.id, s]))
  for (const s of [...shared.sources, ...intake.sources, ...degree.sources]) {
    const existing = sources.get(s.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(s)) throw new Error('Conflicting Biology source: ' + s.id)
    sources.set(s.id, s)
  }
  if (degree.requirements.some(r => r.programId !== biology.id)) throw new Error('Foreign Biology requirement')
  const requirements = [...degree.requirements, ...base.catalog.requirements.filter(r => r.area === 'minor')]
  const minorPrograms = programs.map(p => ({ ...p, summary: p.summary.replace('DATA 3402 is suggested for CS majors. ', '') + ' Optional for this Biology plan; overlap requires advising.' }))
  const keep = new Set([...requirements.flatMap(r => r.courseIds), ...intake.courses.map(c => c.id), ...minorPrograms.flatMap(p => p.courseIds)])
  const visited = new Set<string>()
  const walk = (rule: Prerequisite) => {
    if (rule.kind === 'course') visit(rule.courseId)
    if (rule.kind === 'all' || rule.kind === 'any') rule.items.forEach(walk)
  }
  const visit = (id: string) => {
    if (visited.has(id)) return
    const course = byId.get(id)
    if (!course) throw new Error('Missing Biology catalog course: ' + id)
    visited.add(id); keep.add(id); walk(course.prerequisites)
  }
  ;[...keep].forEach(visit)
  const policies = new Map(base.coursePolicies.filter(p => !['conditional-writing-use','requirement-exclusion'].includes(p.kind)).map(p => [p.id, p]))
  for (const p of degree.coursePolicies) {
    const existing = policies.get(p.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(p)) throw new Error('Conflicting Biology policy: ' + p.id)
    policies.set(p.id, p)
  }
  let previousSize = -1
  while (previousSize !== keep.size) {
    previousSize = keep.size
    for (const p of policies.values()) if (p.courseIds.some(id => keep.has(id))) {
      p.courseIds.filter(id => byId.has(id)).forEach(visit)
      if (p.additionalConditions) walk(p.additionalConditions)
    }
  }
  const optionCodes = [...new Set(requirements.flatMap(r => r.unimportedOptions?.map(o => o.code) ?? []))]
  const references = new Set([...keep, ...optionCodes.map(code => biology.catalogYear + ':' + code)])
  const coursePolicies = [...policies.values()].filter(p => p.courseIds.some(id => keep.has(id)) && p.courseIds.every(id => references.has(id)))
  const conditionIds = new Set<string>()
  for (const condition of [...degree.integratedConditions, ...degree.contentAreaConditions]) {
    if (conditionIds.has(condition.id) || coursePolicies.some(p => p.id === condition.id)) throw new Error('Duplicate Biology condition')
    conditionIds.add(condition.id)
    const count = 'count' in condition ? condition.count : condition.minimumCourseCount
    if (condition.courseIds.length < count || new Set(condition.courseIds).size !== condition.courseIds.length || condition.courseIds.some(id => !keep.has(id)))
      throw new Error('Invalid Biology condition courses')
    if ('requirementId' in condition && condition.courseIds.some(id => !requirements.find(r => r.id === condition.requirementId)?.courseIds.includes(id)))
      throw new Error('Biology area outside upper-level pool')
    coursePolicies.push({ id: condition.id, kind: 'program-condition', courseIds: condition.courseIds, sourceIds: condition.sourceIds,
      text: `${condition.label}: ${count} distinct course(s). ${'coverage' in condition ? condition.coverage : 'Area-specific approval and overlap/grouping review required.'} No separate credit block or completion is inferred.` })
  }
  for (const restriction of degree.allocationRestrictions) {
    if (!intake.courses.some(c => c.code === restriction.code) || new Set(restriction.incompatibleRequirementIds).size !== restriction.incompatibleRequirementIds.length ||
      restriction.incompatibleRequirementIds.some(id => !requirements.some(r => r.id === id && r.courseIds.some(courseId => byId.get(courseId)?.code === restriction.code))))
      throw new Error('Invalid Biology allocation restriction')
  }
  const unresolved = new Map([...base.coverage.unresolvedPrerequisites, ...shared.report.unresolved, ...intake.report.unresolved].map(i => [i.courseId, i]))
  const courses = [...byId.values()].filter(c => keep.has(c.id))
  const snapshot = catalogSnapshotSchema.parse({ snapshotVersion: 1, scope: 'biology-bs-planning-catalog',
    catalog: { ...base.catalog, datasetVersion: '2025-2026-biology-bs-draft-2026-10-15', courses, requirements, sources: [...sources.values()] }, coursePolicies,
    coverage: { automaticEligibilityAssessment: false, minorCoursesIncluded: true,
      unresolvedPrerequisites: [...unresolved.values()].filter(i => keep.has(i.courseId)), unimportedOptionCodes: optionCodes,
      notices: [biology.coverageDescription, ...degree.notices, ...degree.remaining] } })
  const starter = programStarterIds(biology, snapshot.catalog)
  if (starter.size !== 16 || degree.defaultCourseIds.length !== starter.size || new Set(degree.defaultCourseIds).size !== starter.size || degree.defaultCourseIds.some(id => !starter.has(id)))
    throw new Error('Biology starter does not match reviewed fixed requirements')
  const starterCourses = courses.filter(c => starter.has(c.id))
  if (starterCourses.some(c => c.credits.min !== c.credits.max) || starterCourses.reduce((sum, c) => sum + c.credits.min, 0) !== degree.fixedCourseCredits)
    throw new Error('Biology starter credit mismatch')
  return { publishable: false as const, definition: biology, snapshot, programs: minorPrograms, allocationModel: degree, remaining: degree.remaining }
}
