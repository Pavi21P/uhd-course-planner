import { z } from 'zod'

const text = z.string().trim().min(1)
const year = z.string().regex(/^\d{4}-\d{4}$/)
const credits = z.number().nonnegative().finite()

export const sourceSchema = z.strictObject({
  id: text,
  url: z.url({ protocol: /^https$/ }),
  title: text,
  catalogYear: year.nullable(),
  retrievedOn: z.iso.date(),
  role: z.enum(['catalog', 'sequence', 'discovery', 'fixture']),
})

export type Prerequisite =
  | { kind: 'none' }
  | { kind: 'course'; courseId: string; timing: 'before' | 'before-or-concurrent' | 'concurrent'; minimumGrade?: string }
  | { kind: 'all' | 'any'; items: Prerequisite[] }
  | { kind: 'condition'; category: 'placement' | 'permission' | 'standing' | 'other'; text: string }

export const prerequisiteSchema: z.ZodType<Prerequisite> = z.lazy(() => z.union([
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('course'), courseId: text,
    timing: z.enum(['before', 'before-or-concurrent', 'concurrent']), minimumGrade: text.optional() }),
  z.strictObject({ kind: z.enum(['all', 'any']), items: z.array(prerequisiteSchema).min(2) }),
  z.strictObject({ kind: z.literal('condition'), category: z.enum(['placement', 'permission', 'standing', 'other']), text }),
]))

export const courseSchema = z.strictObject({
  id: text,
  catalogYear: year,
  code: text,
  title: text,
  description: text,
  credits: z.strictObject({ min: credits, max: credits }).refine(v => v.min <= v.max, 'Invalid credit range'),
  prerequisiteText: z.string(),
  prerequisites: prerequisiteSchema,
  review: z.enum(['verified', 'needs-review', 'synthetic']),
  sourceIds: z.array(text).min(1),
})

// Groups describe requirement slots, not selected courses or graph edges.
export const requirementSchema = z.strictObject({
  id: text,
  programId: text,
  label: text,
  area: z.enum(['major', 'supporting', 'core', 'elective', 'minor']),
  rule: z.enum(['all', 'choose-courses', 'choose-credits']),
  courseIds: z.array(text),
  // Listed choices can be known before their descriptions/credits are imported.
  // These are not course records and must never create implicit credit or nodes.
  unimportedOptions: z.array(z.strictObject({ code: text, title: text })).optional(),
  optionCoverage: z.enum(['listed', 'partial', 'open-rule']).optional(),
  count: z.number().int().positive().optional(),
  minimumCredits: credits.optional(),
  // Text retains subject/level exclusions, residency and overlapping-credit rules.
  constraints: z.array(text),
  sourceIds: z.array(text).min(1),
}).superRefine((v, ctx) => {
  if (v.rule === 'choose-courses' && v.count === undefined)
    ctx.addIssue({ code: 'custom', message: 'Course choice requires count' })
  if (v.rule === 'choose-credits' && v.minimumCredits === undefined)
    ctx.addIssue({ code: 'custom', message: 'Credit choice requires minimumCredits' })
})

export const datasetSchema = z.strictObject({
  schemaVersion: z.literal(1),
  datasetVersion: text,
  catalogYear: year,
  synthetic: z.boolean(),
  sources: z.array(sourceSchema).min(1),
  courses: z.array(courseSchema),
  requirements: z.array(requirementSchema),
}).superRefine((data, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
  const unique = (ids: string[], kind: string) => {
    if (new Set(ids).size !== ids.length) fail(`Duplicate ${kind} ID`)
  }
  unique(data.courses.map(c => c.id), 'course')
  unique(data.sources.map(s => s.id), 'source')
  unique(data.requirements.map(r => r.id), 'requirement')
  const courses = new Set(data.courses.map(c => c.id))
  const sources = new Set(data.sources.map(s => s.id))
  const checkSources = (ids: string[]) => ids.forEach(id => {
    if (!sources.has(id)) fail(`Unknown source: ${id}`)
  })
  const walk = (p: Prerequisite) => {
    if (p.kind === 'course' && !courses.has(p.courseId)) fail(`Unknown course: ${p.courseId}`)
    if (p.kind === 'all' || p.kind === 'any') p.items.forEach(walk)
  }
  for (const s of data.sources) {
    if (s.catalogYear !== null && s.catalogYear !== data.catalogYear) fail('Mixed source catalog years')
    if (!data.synthetic && (s.role === 'fixture' || !/(^|\.)uhd\.edu$/.test(new URL(s.url).hostname)))
      fail('Production source must be official UHD data')
  }
  for (const c of data.courses) {
    if (c.catalogYear !== data.catalogYear || c.id !== `${data.catalogYear}:${c.code}`) fail(`Invalid course identity: ${c.id}`)
    if (!data.synthetic && c.review === 'synthetic') fail('Synthetic course in production dataset')
    checkSources(c.sourceIds)
    walk(c.prerequisites)
  }
  for (const r of data.requirements) {
    checkSources(r.sourceIds)
    unique(r.courseIds, 'requirement course')
    unique(r.unimportedOptions?.map(c => c.code) ?? [], 'unimported option')
    for (const option of r.unimportedOptions ?? [])
      if (data.courses.some(c => c.code === option.code)) fail(`Imported course stored as unimported option: ${option.code}`)
    r.courseIds.forEach(id => { if (!courses.has(id)) fail(`Unknown requirement course: ${id}`) })
    if (r.count !== undefined && r.count > r.courseIds.length + (r.unimportedOptions?.length ?? 0)) fail('Choice exceeds available courses')
  }
})

export type Course = z.infer<typeof courseSchema>
export type CatalogDataset = z.infer<typeof datasetSchema>
