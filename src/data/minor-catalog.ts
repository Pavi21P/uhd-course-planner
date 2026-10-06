import { z } from 'zod'
import { courseSchema, requirementSchema, sourceSchema } from './catalog-schema.ts'
import { catalogSnapshotSchema, type CatalogSnapshot } from './catalog-snapshot.ts'

export const minorSupplementSchema = z.strictObject({
  version: z.literal('2025-2026-minors-2026-10-06-complete'),
  baseDatasetVersion: z.literal('2025-2026-planning-2026-09-30'),
  sources: z.array(sourceSchema), courses: z.array(courseSchema), requirements: z.array(requirementSchema),
  coursePolicies: catalogSnapshotSchema.shape.coursePolicies,
  unresolvedPrerequisites: catalogSnapshotSchema.shape.coverage.shape.unresolvedPrerequisites,
  coverage: z.strictObject({ dataIndexCodes: z.array(z.string()).length(9), mathIndexCodes: z.array(z.string()).length(47), mathMissingCodes: z.array(z.string()).length(0) }),
  programs: z.array(z.strictObject({ id: z.string(), title: z.string(), totalLabel: z.string(), summary: z.string(), sourceId: z.string(), courseIds: z.array(z.string()).min(1) })).length(2),
})
export type MinorSupplement = z.infer<typeof minorSupplementSchema>
export function addMinorSupplement(base: CatalogSnapshot, value: unknown) {
  const supplement = minorSupplementSchema.parse(value)
  if (new Set(supplement.programs.map(program => program.id)).size !== 2 || supplement.programs.some(program => !['minor-math', 'minor-data'].includes(program.id))) throw new Error('Invalid minor program identities')
  if (base.catalog.datasetVersion !== supplement.baseDatasetVersion) throw new Error('Minor supplement requires its reviewed base catalog')
  if (supplement.requirements.some(group => group.area !== 'minor')) throw new Error('Minor supplement cannot replace major rules')
  for (const source of supplement.sources) if (new URL(source.url).searchParams.get('catoid') !== '37') throw new Error('Minor source edition mismatch')
  // Append only: dataset validation rejects duplicate/replaced course, source or
  // requirement identities. Existing records and save compatibility stay intact.
  const merged = catalogSnapshotSchema.parse({ ...base,
    coursePolicies: [...base.coursePolicies, ...supplement.coursePolicies],
    catalog: { ...base.catalog, sources: [...base.catalog.sources, ...supplement.sources], courses: [...base.catalog.courses, ...supplement.courses], requirements: [...base.catalog.requirements, ...supplement.requirements] },
    coverage: { ...base.coverage, unresolvedPrerequisites: [...base.coverage.unresolvedPrerequisites, ...supplement.unresolvedPrerequisites], minorCoursesIncluded: true, notices: [...base.coverage.notices.filter(note => !note.includes('minor course areas will be populated')),
      'Minor cards include required choices, the Mathematics CS example and available reviewed options. All 47 indexed MATH course records at 2000+ are included. All nine DATA course records in the 2025-2026 index are included. Minor fulfillment, grade/residency and overlap approval are not automatically assessed.'] },
  })
  const ids = new Set(merged.catalog.courses.map(course => course.id))
  for (const program of supplement.programs) {
    if (new Set(program.courseIds).size !== program.courseIds.length || program.courseIds.some(id => !ids.has(id)) || !supplement.sources.some(source => source.id === program.sourceId)) throw new Error('Invalid minor program references')
  }
  const dataCodes = merged.catalog.courses.filter(course => course.code.startsWith('DATA ')).map(course => course.code).sort()
  if (JSON.stringify(dataCodes) !== JSON.stringify([...supplement.coverage.dataIndexCodes].sort())) throw new Error('DATA index coverage mismatch')
  if (new Set(supplement.coverage.mathMissingCodes).size !== supplement.coverage.mathMissingCodes.length || supplement.coverage.mathMissingCodes.some(code => !/^MATH [234]\d{3}$/.test(code) || merged.catalog.courses.some(course => course.code === code))) throw new Error('Invalid missing Math inventory')
  const mathCodes = merged.catalog.courses.filter(course => /^MATH [234]\d{3}$/.test(course.code)).map(course => course.code).sort()
  if (JSON.stringify(mathCodes) !== JSON.stringify([...supplement.coverage.mathIndexCodes].sort())) throw new Error('Math index coverage mismatch')
  const mathProgramCodes = supplement.programs.find(program => program.id === 'minor-math')!.courseIds.map(id => id.split(':')[1]).sort()
  if (JSON.stringify(mathCodes) !== JSON.stringify(mathProgramCodes)) throw new Error('Math program coverage mismatch')
  return { snapshot: merged, programs: supplement.programs }
}

export function loadPlannerCatalog(base: unknown, supplement: unknown) {
  try { const result = addMinorSupplement(catalogSnapshotSchema.parse(base), supplement); return { ok: true as const, ...result } }
  catch { return { ok: false as const, message: 'Course information could not be loaded. Please restore valid catalog and minor snapshots.' } }
}

