import { z } from 'zod'
import { datasetSchema, prerequisiteSchema, type Course } from './catalog-schema.ts'

const text = z.string().min(1)
export const catalogSnapshotSchema = z.strictObject({
  snapshotVersion: z.literal(1),
  scope: z.literal('cs-planning-catalog'),
  catalog: datasetSchema,
  coursePolicies: z.array(z.strictObject({ id: text,
    kind: z.enum(['degree-credit-exclusion', 'requirement-exclusion', 'mutually-exclusive-credit', 'conditional-writing-use', 'repeatability', 'laboratory-pair']),
    courseIds: z.array(text).min(1), text, sourceIds: z.array(text).min(1), additionalConditions: prerequisiteSchema.optional() })),
  coverage: z.strictObject({
    automaticEligibilityAssessment: z.literal(false),
    minorCoursesIncluded: z.boolean(),
    unresolvedPrerequisites: z.array(z.strictObject({ courseId: text, reason: text })),
    unimportedOptionCodes: z.array(text),
    notices: z.array(text).min(1),
  }),
}).superRefine((snapshot, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
  const catalog = snapshot.catalog
  if (catalog.synthetic || catalog.catalogYear !== '2025-2026') fail('Unsupported snapshot edition')
  const courseIds = new Set(catalog.courses.map(c => c.id))
  const optionCodes = new Set(catalog.requirements.flatMap(r => r.unimportedOptions?.map(o => o.code) ?? []))
  const referenceIds = new Set([...courseIds, ...[...optionCodes].map(code => `${catalog.catalogYear}:${code}`)])
  const sourceIds = new Set(catalog.sources.map(s => s.id))
  const expectedIssues = catalog.courses.filter(c => c.review !== 'verified').map(c => c.id).sort()
  const actualIssues = snapshot.coverage.unresolvedPrerequisites.map(i => i.courseId).sort()
  if (JSON.stringify(expectedIssues) !== JSON.stringify(actualIssues)) fail('Incomplete prerequisite notices')
  if (JSON.stringify([...optionCodes].sort()) !== JSON.stringify([...snapshot.coverage.unimportedOptionCodes].sort())) fail('Incomplete option coverage')
  if (new Set(snapshot.coursePolicies.map(p => p.id)).size !== snapshot.coursePolicies.length) fail('Duplicate policy')
  for (const p of snapshot.coursePolicies) {
    p.courseIds.forEach(id => { if (!referenceIds.has(id)) fail(`Unknown policy course: ${id}`) })
    p.sourceIds.forEach(id => { if (!sourceIds.has(id)) fail(`Unknown policy source: ${id}`) })
    if (p.additionalConditions) {
      const walk = (condition: z.infer<typeof prerequisiteSchema>) => {
        if (condition.kind === 'course' && !courseIds.has(condition.courseId)) fail('Unknown conditional-use prerequisite')
        if (condition.kind === 'all' || condition.kind === 'any') condition.items.forEach(walk)
      }
      walk(p.additionalConditions)
    }
  }
})

export type CatalogSnapshot = z.infer<typeof catalogSnapshotSchema>
export function loadCatalogSnapshot(value: unknown) {
  const result = catalogSnapshotSchema.safeParse(value)
  return result.success ? { ok: true as const, snapshot: result.data }
    : { ok: false as const, message: 'Course information could not be loaded. Please restore a valid catalog snapshot.' }
}

// The graph may consume only reviewed structure; raw unresolved mentions never
// become edges. A condition node still needs human interpretation, not clearance.
export function graphPrerequisites(course: Course) {
  return course.review === 'verified' ? course.prerequisites : null
}
