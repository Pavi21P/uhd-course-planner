import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { courseSchema, datasetSchema, sourceSchema, type Course } from '../src/data/catalog-schema.ts'
import { programConfig } from '../src/data/program-config.ts'
import { applyPrerequisiteReviews, unresolvedPrerequisiteReasons } from './prerequisite-reviews.ts'
import { reviewCoursePolicies } from './course-policy-reviews.ts'
import { auditMandatoryCycles } from './prerequisite-audit.ts'
import { parseRequirementCapture, requirementSources, buildDegreeRequirements, type RequirementCapture } from './degree-requirements.ts'
import { reconcileDegreeBudget } from '../src/data/credit-allocation.ts'

const editions = {
  '2025-2026': { catalogId: '37', directory: '2025-2026' },
  '2026-2027': { catalogId: '39', directory: '.' },
} as const

const manifestSchema = z.object({
  catalogYear: z.string().regex(/^\d{4}-\d{4}$/), catalogId: z.string().regex(/^\d+$/),
  retrievedOn: z.iso.date(), sources: z.array(sourceSchema).min(1),
  captures: z.array(z.object({ file: z.string().regex(/^[a-z0-9-]+\.txt$/),
    sourceId: z.string(), expectedCourses: z.number().int().positive() })).min(1),
  browserCapture: z.object({ file: z.string().regex(/^[a-z0-9-]+\.json$/),
    expectedCourses: z.number().int().positive(), omittedPrerequisiteCodes: z.array(z.string()) }).optional(),
  coverage: z.object({ requiredCsCodes: z.array(z.string()).min(1), requiredCsCredits: z.number(),
    supportingCodes: z.array(z.string()), complete: z.literal(false), remaining: z.array(z.string()).min(1) }),
})

export function parseCourseCapture(raw: string, catalogYear: string, sourceId: string, omittedPrerequisiteCodes: string[] = []): Course[] {
  if (!raw.trim()) throw new Error('Empty capture; previous data must be retained')
  return raw.split(/\r?\n---COURSE---\r?\n/).map(block => {
    const lines = block.trim().replace(/\u00a0/g, ' ').split(/\r?\n/).map(line => line.trim().replace(/[ \t]+/g, ' '))
    const heading = /^([A-Z]+ \d{4}) - (.+)$/.exec(lines[0] ?? '')
    const hours = /^Credits: (\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))? Class: \d+ Lab: \d+$/.exec(lines[1] ?? '')
    const prerequisite = /^Prerequisite\(s\): (.+)$/.exec(lines[2] ?? '')
    const omissionAllowed = heading && omittedPrerequisiteCodes.includes(heading[1])
    if (!heading || !hours || (!prerequisite && (!omissionAllowed || /^Prerequisite/i.test(lines[2] ?? ''))) || lines.length < (prerequisite ? 4 : 3))
      throw new Error(`Unrecognized or incomplete course block: ${lines[0] ?? '(empty)'}`)
    return courseSchema.parse({
      id: `${catalogYear}:${heading[1]}`, catalogYear, code: heading[1], title: heading[2],
      description: lines.slice(prerequisite ? 3 : 2).join('\n').trim(),
      credits: { min: Number(hours[1]), max: Number(hours[2] ?? hours[1]) },
      prerequisiteText: prerequisite?.[1] ?? '',
      // Raw mentions are audited below, never guessed into prerequisite edges.
      prerequisites: { kind: 'condition', category: 'other', text: prerequisite?.[1] ?? 'No prerequisite statement published in the captured panel; review required.' },
      review: 'needs-review', sourceIds: [sourceId],
    })
  })
}

export function auditCapture(courses: Course[], requiredCodes: string[], expectedCredits: number) {
  const ids = courses.map(course => course.id)
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate course capture')
  const byCode = new Map(courses.map(course => [course.code, course]))
  const missingRequired = requiredCodes.filter(code => !byCode.has(code))
  if (missingRequired.length) throw new Error(`Missing required courses: ${missingRequired.join(', ')}`)
  const required = requiredCodes.map(code => byCode.get(code)!)
  const min = required.reduce((sum, course) => sum + course.credits.min, 0)
  const max = required.reduce((sum, course) => sum + course.credits.max, 0)
  if (min !== expectedCredits || max !== expectedCredits) throw new Error('Required CS credit mismatch')
  // These are discovery candidates, not interpreted graph relationships.
  const referenced = courses.flatMap(course => course.prerequisiteText.match(/[A-Z]{2,}\s*\d{4}/g) ?? [])
    .map(code => code.replace(/([A-Z]+)\s*(\d{4})/, '$1 $2'))
  return { requiredCourseCount: required.length, requiredCsCredits: min,
    missingReferencedCourses: [...new Set(referenced.filter(code => !byCode.has(code)))].sort(),
    reviewRequired: courses.filter(course => course.review !== 'verified').map(course => course.code).sort() }
}

export async function buildDraft(projectRoot: string, catalogYear: string = programConfig.catalogYear) {
  if (!Object.hasOwn(editions, catalogYear)) throw new Error(`Unsupported catalog year: ${catalogYear}`)
  const edition = editions[catalogYear as keyof typeof editions]
  const sourceDir = resolve(projectRoot, 'data/sources', edition.directory)
  const manifest = manifestSchema.parse(JSON.parse(await readFile(resolve(sourceDir, 'manifest.json'), 'utf8')))
  if (manifest.catalogYear !== catalogYear || manifest.catalogId !== edition.catalogId)
    throw new Error('Catalog edition mismatch')
  for (const source of manifest.sources) {
    if (source.catalogYear !== catalogYear || new URL(source.url).searchParams.get('catoid') !== edition.catalogId)
      throw new Error(`Source edition mismatch: ${source.id}`)
  }
  const courses: Course[] = []
  const sources = [...manifest.sources]
  const fingerprints: Record<string, string> = {}
  for (const capture of manifest.captures) {
    const raw = await readFile(resolve(sourceDir, capture.file), 'utf8')
    const parsed = parseCourseCapture(raw, manifest.catalogYear, capture.sourceId)
    if (parsed.length !== capture.expectedCourses) throw new Error(`Capture count mismatch: ${capture.file}`)
    courses.push(...parsed)
    fingerprints[capture.file] = createHash('sha256').update(raw).digest('hex')
  }
  if (manifest.browserCapture) {
    const capture = manifest.browserCapture
    const raw = await readFile(resolve(sourceDir, capture.file), 'utf8')
    const panels = z.object({ catalogYear: z.literal(catalogYear), catalogId: z.literal(edition.catalogId),
      retrievedOn: z.iso.date(), courses: z.array(z.object({ text: z.string().min(1), sourceUrl: z.url() })) }).parse(JSON.parse(raw))
    if (panels.courses.length !== capture.expectedCourses) throw new Error('Browser capture count mismatch')
    for (const panel of panels.courses) {
      const url = new URL(panel.sourceUrl)
      if (url.protocol !== 'https:' || url.hostname !== 'catalog.uhd.edu' || url.searchParams.get('catoid') !== edition.catalogId)
        throw new Error('Browser capture source edition mismatch')
      const sourceId = `course-${edition.catalogId}-${url.searchParams.get('coid')}`
      const parsed = parseCourseCapture(panel.text, catalogYear, sourceId, capture.omittedPrerequisiteCodes)
      if (parsed.length !== 1) throw new Error('Expected one course per browser panel')
      sources.push(sourceSchema.parse({ id: sourceId, url: panel.sourceUrl, title: `${parsed[0].code} - ${parsed[0].title}`,
        catalogYear, retrievedOn: panels.retrievedOn, role: 'catalog' }))
      courses.push(parsed[0])
    }
    fingerprints[capture.file] = createHash('sha256').update(raw).digest('hex')
  }
  let requirementCapture: RequirementCapture | undefined
  if (catalogYear === '2025-2026') {
    const raw = await readFile(resolve(sourceDir, 'requirement-pages.json'), 'utf8')
    const parsed = parseRequirementCapture(raw)
    requirementCapture = parsed.capture
    fingerprints['requirement-pages.json'] = parsed.fingerprint
    sources.push(...requirementSources(requirementCapture))
    for (const panel of requirementCapture.physicsPanels)
      courses.push(...parseCourseCapture(panel, catalogYear, 'core-rules-37'))
  }
  const reviewedCourses = applyPrerequisiteReviews(courses, catalogYear)
  const coursePolicies = reviewCoursePolicies(reviewedCourses, catalogYear)
  const mandatoryPrerequisiteCycles = auditMandatoryCycles(reviewedCourses)
  if (mandatoryPrerequisiteCycles.length) throw new Error('Mandatory prerequisite cycle; review before replacing draft')
  const audit = auditCapture(reviewedCourses, manifest.coverage.requiredCsCodes, manifest.coverage.requiredCsCredits)
  for (const code of manifest.coverage.supportingCodes)
    if (!courses.some(course => course.code === code)) throw new Error(`Missing supporting course: ${code}`)
  const requirements = requirementCapture ? buildDegreeRequirements(reviewedCourses, requirementCapture) : []
  const draft = datasetSchema.parse({ schemaVersion: 1, datasetVersion: `${manifest.catalogYear}-draft-${manifest.retrievedOn}`,
    catalogYear: manifest.catalogYear, synthetic: false, sources,
    courses: reviewedCourses.sort((a,b) => a.code.localeCompare(b.code)), requirements })
  return { draft, report: { status: 'incomplete', publishable: false, courseCount: courses.length,
    catalogYear: manifest.catalogYear, retrievedOn: manifest.retrievedOn, fingerprints, ...audit,
    reviewedOn: catalogYear === '2025-2026' ? '2026-09-30' : null,
    prerequisiteReviewIssues: audit.reviewRequired.map(code => ({ code,
      reason: catalogYear === '2025-2026' ? unresolvedPrerequisiteReasons[code] ?? 'Not yet reviewed.' : 'Not yet reviewed.' })),
    coursePolicies, mandatoryPrerequisiteCycles,
    degreeBudget: requirementCapture ? reconcileDegreeBudget(requirements) : null,
    physicsPathBudget: requirementCapture ? reconcileDegreeBudget(requirements, reviewedCourses.filter(c => ['PHYS 2401', 'PHYS 2402', 'PHYS 2101', 'PHYS 2102'].includes(c.code)).reduce((sum, c) => sum + c.credits.min, 0)) : null,
    requirementCount: requirements.length,
    unimportedRequirementOptions: [...new Set(requirements.flatMap(r => r.unimportedOptions?.map(o => o.code) ?? []))].sort(),
    cycleAuditScope: 'Verified expressions only; mandatory-before edges shared by every alternative. Does not establish feasibility of all alternatives or resolve unreviewed conditions.',
    remaining: manifest.coverage.remaining } }
}

// This checkpoint only writes a draft outside src/public. It cannot overwrite a
// production snapshot. Validate everything before replacing either draft artifact.
async function main() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const { draft, report } = await buildDraft(projectRoot, process.argv[2] ?? programConfig.catalogYear)
  const output = resolve(projectRoot, 'data/drafts')
  await mkdir(output, { recursive: true })
  for (const [name, value] of [[`cs-${draft.catalogYear}.json`, draft], [`import-report-${draft.catalogYear}.json`, report]] as const) {
    const target = resolve(output, name)
    await writeFile(`${target}.tmp`, JSON.stringify(value, null, 2) + '\n', 'utf8')
    await rename(`${target}.tmp`, target)
  }
  console.log(`Draft: ${report.courseCount} courses; ${report.requiredCsCredits} required CS credits.`)
  console.log(`Publication blocked: ${report.reviewRequired.length} prerequisite reviews; ${report.missingReferencedCourses.length} missing referenced courses; coverage incomplete.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch(error => { console.error(error.message); process.exitCode = 1 })
