import { createHash } from 'node:crypto'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { datasetSchema, type Course } from '../src/data/catalog-schema.ts'
import { loadPlannerCatalog } from '../src/data/minor-catalog.ts'
import { parseCourseCapture } from './catalog-import.ts'
import { chemistryUnresolvedReasons, reviewChemistryPrerequisites } from './chemistry-prerequisite-reviews.ts'
import { auditMandatoryCycles } from './prerequisite-audit.ts'

const record = z.object({ sourceUrl: z.url(), text: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
const captureSchema = z.object({ catalogYear: z.literal('2025-2026'), catalogId: z.literal('37'), retrievedOn: z.iso.date(),
  courses: z.array(record.extend({ code: z.string() })).length(40), pages: z.array(record).length(2) })
const supplementalSchema = captureSchema.extend({ courses: z.array(record.extend({ code: z.string() })).length(5) })
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()
const comparable = (course: Course) => ({ code: course.code, title: normalize(course.title), credits: course.credits,
  description: normalize(course.description), prerequisiteText: normalize(course.prerequisiteText), prerequisites: course.prerequisites, review: course.review })

export async function buildChemistryIntake(root: string, captureInput?: unknown, supplementInput?: unknown) {
  const readJson = async (name: string) => JSON.parse(await readFile(resolve(root, name), 'utf8')) as unknown
  const capture = captureSchema.parse(captureInput ?? await readJson('data/sources/2025-2026/chemistry-bs-capture.json'))
  const supplement = supplementalSchema.parse(supplementInput ?? await readJson('data/sources/2025-2026/chemistry-supplemental-capture.json'))
  const captures = [capture, supplement]
  const entries = captures.flatMap(item => item.courses)
  for (const entry of captures.flatMap(item => [...item.courses, ...item.pages])) {
    const url = new URL(entry.sourceUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'catalog.uhd.edu' || url.searchParams.get('catoid') !== capture.catalogId)
      throw new Error('Chemistry source edition mismatch')
    if (createHash('sha256').update(entry.text).digest('hex') !== entry.sha256) throw new Error('Chemistry capture fingerprint mismatch')
  }
  if (new Set(entries.map(course => course.code)).size !== entries.length) throw new Error('Duplicate Chemistry course')
  const sourceUrls = [...new Set(entries.map(course => course.sourceUrl))]
  const sources = sourceUrls.map((url, index) => ({ id: `chemistry-intake-37-${index + 1}`, url,
    title: 'Chemistry BS course description capture', catalogYear: capture.catalogYear, retrievedOn: captures.find(item => item.courses.some(course => course.sourceUrl === url))!.retrievedOn, role: 'catalog' as const }))
  const courses = reviewChemistryPrerequisites(entries.map(entry => {
    const parsed = parseCourseCapture(entry.text, capture.catalogYear, sources.find(source => source.url === entry.sourceUrl)!.id)
    if (parsed.length !== 1 || parsed[0].code !== entry.code) throw new Error('Chemistry course identity mismatch')
    return parsed[0]
  }))
  const base = loadPlannerCatalog(await readJson('src/data/catalog-2025-2026.json'), await readJson('src/data/minor-2025-2026.json'))
  if (!base.ok) throw new Error(base.message)
  const existing = new Map(base.snapshot.catalog.courses.map(course => [course.id, course]))
  const reusedCourseIds: string[] = []
  for (const course of courses) {
    const shared = existing.get(course.id)
    if (!shared) continue
    if (JSON.stringify(comparable(course)) !== JSON.stringify(comparable(shared))) throw new Error(`Shared course conflict: ${course.code}`)
    reusedCourseIds.push(course.id)
  }
  // Validate references and cycles with shared dependencies, but keep the intake
  // separate from production. Existing records and source identities remain intact.
  const merged = datasetSchema.parse({ ...base.snapshot.catalog, requirements: [], sources: [...base.snapshot.catalog.sources, ...sources],
    courses: [...base.snapshot.catalog.courses, ...courses.filter(course => !existing.has(course.id))] })
  const cycles = auditMandatoryCycles(merged.courses)
  if (cycles.length) throw new Error('Chemistry import creates a mandatory-before cycle')
  const knownCodes = new Set(merged.courses.map(course => course.code))
  const missingReferencedCodes = [...new Set(courses.flatMap(course => course.prerequisiteText.match(/[A-Z]{2,}\s*\d{4}/g) ?? [])
    .map(code => code.replace(/([A-Z]+)\s*(\d{4})/, '$1 $2')).filter(code => !knownCodes.has(code)))].sort()
  return { version: 1, catalogYear: capture.catalogYear, publishable: false as const, sources, courses,
    report: { courseCount: courses.length, newCourseCount: courses.length - reusedCourseIds.length, reusedCourseIds,
      verifiedCount: courses.filter(course => course.review === 'verified').length,
      unresolved: courses.filter(course => course.review !== 'verified').map(course => ({ courseId: course.id, reason: chemistryUnresolvedReasons[course.code] })),
      missingReferencedCodes, mandatoryBeforeCycles: cycles,
      remaining: ['Resolve or explicitly retain ambiguous prerequisite cases.', 'Complete Chemistry selector integration and browser validation.'] } }
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const draft = await buildChemistryIntake(root)
  const target = resolve(root, 'data/drafts/chemistry-intake-2025-2026.json')
  await writeFile(`${target}.tmp`, JSON.stringify(draft, null, 2) + '\n', 'utf8')
  await rename(`${target}.tmp`, target)
  console.log(`Chemistry intake: ${draft.report.courseCount} courses; ${draft.report.verifiedCount} reviewed; ${draft.report.unresolved.length} unresolved; ${draft.report.newCourseCount} new. Publication disabled.`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch(error => { console.error(error.message); process.exitCode = 1 })
