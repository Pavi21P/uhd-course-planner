import { z } from 'zod'
import { courseSchema, requirementSchema, sourceSchema, type Course, type Prerequisite } from './catalog-schema.ts'
import { catalogSnapshotSchema, type CatalogSnapshot } from './catalog-snapshot.ts'
import type { MinorSupplement } from './minor-catalog.ts'
import { programStarterIds, type ProgramDefinition } from './program-definition.ts'

export const chemistry: ProgramDefinition = {
  id: 'chemistry-bs', title: 'Chemistry BS', shortTitle: 'Chemistry', exportSlug: 'chemistry', catalogYear: '2025-2026',
  firstCourseId: '2025-2026:CHEM 1307', defaultRequirementIds: ['chemistry-fixed-science', 'chemistry-fixed-major'], defaultCourseIds: [],
  supportingRequirementIds: ['chemistry-writing','chemistry-physics-1','chemistry-physics-2','chemistry-computing-statistics'],
  electiveRequirementIds: ['free-electives'], minimumCredits: 120,
  sourceUrl: 'https://catalog.uhd.edu/preview_program.php?catoid=37&poid=7063&returnto=2409',
  supportingDescription: 'Choose one writing course, one computing/statistics course and a complete lecture/lab pair for each physics level.',
  starterDescription: 'The starter selects 30 fixed science, mathematics and Chemistry courses totaling 70 credits. Supporting choices and common-core completion are separate. No completed courses are assumed.',
  coverageDescription: 'Draft: Natural Sciences graduation rules and preparatory CHEM 1305/1105 descriptions still need verification. Ambiguous prerequisites stay unconnected. Integrated writing/ethics can overlap required courses; minor overlap requires review.',
  minorPlaceholders: [{ id: 'math-minor', title: 'Optional Mathematics minor', subtitle: '18-hour minimum; degree/minor overlap requires review' },
    { id: 'data-minor', title: 'Optional Data Science minor', subtitle: '22/23 hours; no minor is preselected' }],
}
const intakeSchema = z.object({ catalogYear: z.literal('2025-2026'), publishable: z.literal(false), sources: z.array(sourceSchema), courses: z.array(courseSchema),
  report: z.object({ unresolved: z.array(z.object({ courseId: z.string(), reason: z.string().min(1) })) }) })
const degreeSchema = z.object({ catalogYear: z.literal('2025-2026'), programId: z.literal('chemistry-bs'), publishable: z.literal(false),
  minimumCredits: z.literal(120), sources: z.array(sourceSchema), requirements: z.array(requirementSchema), defaultCourseIds: z.array(z.string()), fixedCourseCredits: z.literal(70),
  integratedConditions: z.array(z.object({ id: z.string(), label: z.string(), count: z.number().int().positive(), courseIds: z.array(z.string()), sourceIds: z.array(z.string()), coverage: z.string(), text: z.string() })),
  remaining: z.array(z.string()).min(1), notices: z.array(z.string()).min(1) })
const normalized = (text: string) => text.replace(/\s+/g, ' ').trim()
const sharedContent = (course: Course) => JSON.stringify({ id: course.id, title: normalized(course.title), description: normalized(course.description),
  credits: course.credits, prerequisiteText: normalized(course.prerequisiteText), prerequisites: course.prerequisites, review: course.review })

// Builds a validated preview model only. App.tsx deliberately does not register
// this major until source intake and browser QA are complete.
export function buildChemistryCatalog(base: CatalogSnapshot, programs: MinorSupplement['programs'], intakeInput: unknown, degreeInput: unknown) {
  if (base.catalog.catalogYear !== chemistry.catalogYear) throw new Error('Chemistry requires catalog 2025-2026')
  const intake = intakeSchema.parse(intakeInput)
  const degree = degreeSchema.parse(degreeInput)
  if (new Set(intake.courses.map(course => course.id)).size !== intake.courses.length) throw new Error('Duplicate Chemistry course')
  const byId = new Map(base.catalog.courses.map(course => [course.id, course]))
  for (const course of intake.courses) {
    const shared = byId.get(course.id)
    if (shared && sharedContent(shared) !== sharedContent(course)) throw new Error(`Conflicting shared course: ${course.code}`)
    if (!shared) byId.set(course.id, course)
  }
  const requirements = [...degree.requirements, ...base.catalog.requirements.filter(r => r.area === 'minor')]
  const keep = new Set(requirements.flatMap(r => r.courseIds))
  const minorPrograms = programs.map(program => ({ ...program,
    summary: program.summary.replace('DATA 3402 is suggested for CS majors. ', '') + ' Optional for this Chemistry plan; overlap requires advising.' }))
  minorPrograms.forEach(program => program.courseIds.forEach(id => keep.add(id)))
  const walk = (expression: Prerequisite) => {
    if (expression.kind === 'course' && !keep.has(expression.courseId)) { keep.add(expression.courseId); visit(expression.courseId) }
    if (expression.kind === 'all' || expression.kind === 'any') expression.items.forEach(walk)
  }
  const visit = (id: string) => {
    const course = byId.get(id)
    if (!course) throw new Error(`Missing Chemistry catalog course: ${id}`)
    walk(course.prerequisites)
  }
  ;[...keep].forEach(visit)
  const relevantPolicies = base.coursePolicies.filter(policy => !['conditional-writing-use','requirement-exclusion'].includes(policy.kind))
  // Credit counterpart records can themselves introduce prerequisites or further
  // exclusions; close the set before retaining policies and cutting the catalog.
  let previousSize = -1
  while (previousSize !== keep.size) {
    previousSize = keep.size
    for (const policy of relevantPolicies.filter(policy => policy.courseIds.some(id => keep.has(id))))
      for (const id of policy.courseIds.filter(id => byId.has(id))) { keep.add(id); visit(id) }
  }
  const optionCodes = [...new Set(requirements.flatMap(r => r.unimportedOptions?.map(option => option.code) ?? []))]
  const references = new Set([...keep, ...optionCodes.map(code => `2025-2026:${code}`)])
  const coursePolicies = relevantPolicies.filter(policy => policy.courseIds.some(id => keep.has(id)) && policy.courseIds.every(id => references.has(id)))
  for (const condition of degree.integratedConditions) {
    if (condition.courseIds.length < condition.count || new Set(condition.courseIds).size !== condition.courseIds.length || condition.courseIds.some(id => !keep.has(id)))
      throw new Error('Invalid integrated Chemistry choices')
    coursePolicies.push({ id: condition.id, kind: 'program-condition', courseIds: condition.courseIds, sourceIds: condition.sourceIds,
      text: `${condition.label}: ${condition.text} ${condition.coverage}` })
  }
  const courses = [...byId.values()].filter(course => keep.has(course.id))
  const unresolved = [...base.coverage.unresolvedPrerequisites, ...intake.report.unresolved].filter(issue => keep.has(issue.courseId))
  const snapshot = catalogSnapshotSchema.parse({ snapshotVersion: 1, scope: 'chemistry-bs-planning-catalog',
    catalog: { ...base.catalog, datasetVersion: '2025-2026-chemistry-bs-draft-2026-10-12', courses, requirements,
      sources: [...base.catalog.sources, ...intake.sources, ...degree.sources] },
    coursePolicies,
    coverage: { automaticEligibilityAssessment: false, minorCoursesIncluded: true, unresolvedPrerequisites: unresolved, unimportedOptionCodes: optionCodes,
      notices: [chemistry.coverageDescription, ...degree.notices, ...degree.remaining] },
  })
  const starter = programStarterIds(chemistry, snapshot.catalog)
  if (new Set(degree.defaultCourseIds).size !== degree.defaultCourseIds.length || starter.size !== 30 || starter.size !== degree.defaultCourseIds.length || degree.defaultCourseIds.some(id => !starter.has(id)))
    throw new Error('Chemistry starter does not match reviewed fixed requirements')
  const credits = courses.filter(course => starter.has(course.id)).reduce((sum, course) => sum + course.credits.min, 0)
  if (credits !== degree.fixedCourseCredits) throw new Error('Chemistry starter credit mismatch')
  return { publishable: false as const, definition: chemistry, snapshot, programs: minorPrograms, remaining: degree.remaining }
}
