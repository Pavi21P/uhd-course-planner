import { createHash } from 'node:crypto'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { courseSchema, datasetSchema, sourceSchema, type Course } from '../src/data/catalog-schema.ts'
import { parseCourseCapture } from './catalog-import.ts'
import { reviewBiologyPrerequisites } from './biology-prerequisite-reviews.ts'
import { auditMandatoryCycles } from './prerequisite-audit.ts'

const panelSchema = z.object({ code: z.string().regex(/^[A-Z]+ \d{4}$/), sourceUrl: z.url(),
  text: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
const captureSchema = z.object({ catalogYear: z.literal('2025-2026'), catalogId: z.literal('37'),
  retrievedOn: z.iso.date(), publishable: z.literal(false), coursePanelsComplete: z.literal(true),
  listedCourseCodes: z.array(z.string()).length(85), courses: z.array(panelSchema).length(85),
  pages: z.array(panelSchema.omit({ code: true })).length(1) })
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()
const missingCreditCodes = new Set(['BIOL 3390', 'BIOL 4390', 'BIOL 4399'])
const crossListedCodes = new Set(['BIOL 4344', 'CHEM 4344', 'BIOL 3340', 'BIOL 3140', 'BIOL 4313', 'BIOL 4113'])

// Adapt presentation only. Never infer credits, aliases, prerequisite logic or timing.
export function parseBiologyPanel(panel: { code: string; text: string }, sourceId: string) {
  const lines = panel.text.replace(/\u00a0/g, ' ').split(/\r?\n/)
    .map(line => line.trim().replace(/[ \t]+/g, ' ')).filter(Boolean)
  const heading = /^([A-Z]+ \d{4}) - (.+)$/.exec(lines[0] ?? '')
  if (!heading || heading[1] !== panel.code) throw new Error('Biology course identity mismatch')
  if (missingCreditCodes.has(panel.code) && !lines.some(line => /^Credits:/.test(line))) {
    if (!/^Prerequisite\(s\): .+/.test(lines[1] ?? '') || lines.length < 3)
      throw new Error(`Incomplete blocked Biology panel: ${panel.code}`)
    return { blocked: { code: panel.code, title: heading[2], sourceId,
      reason: 'No credit value published in the captured panel; no course record or credit total created.' },
      metadata: { code: panel.code, crossListings: [] as string[], adjustments: [] as string[] } }
  }
  const adjustments: string[] = []
  const crossListings: string[] = []
  if (/^Crosslisted:/.test(lines[2] ?? '')) {
    if (!crossListedCodes.has(panel.code)) throw new Error(`Unreviewed cross-list format: ${panel.code}`)
    crossListings.push(lines.splice(2, 1)[0])
    adjustments.push('Preserved the cross-list notice in description and metadata.')
  }
  if (lines[2] === 'Prerequisite(s):') {
    if (panel.code !== 'BIOL 4302' || !lines[3]?.startsWith('BIOL 1302/BIOL 1102,'))
      throw new Error(`Unreviewed multiline prerequisite: ${panel.code}`)
    lines.splice(2, 2, `Prerequisite(s): ${lines[3]}`)
    adjustments.push('Joined the prerequisite label to its following text line.')
  }
  const parsed = parseCourseCapture(lines.join('\n'), '2025-2026', sourceId, ['MBIO 3390'])
  if (parsed.length !== 1 || parsed[0].code !== panel.code) throw new Error('Biology course identity mismatch')
  const course = courseSchema.parse({ ...parsed[0],
    description: [...crossListings, parsed[0].description].join('\n') })
  if (panel.code === 'MBIO 3390') adjustments.push('No prerequisite statement published; review remains required.')
  return { course, metadata: { code: panel.code, crossListings, adjustments } }
}

export async function buildBiologyIntake(root: string, captureInput?: unknown) {
  const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
  const capture = captureSchema.parse(captureInput ?? await read('data/sources/2025-2026/biology-bs-capture.json'))
  const inventory = new Set(capture.listedCourseCodes)
  if (inventory.size !== 85 || new Set(capture.courses.map(panel => panel.code)).size !== 85)
    throw new Error('Duplicate Biology inventory or panel')
  if (capture.courses.some(panel => !inventory.has(panel.code))) throw new Error('Biology inventory mismatch')
  for (const entry of [...capture.pages, ...capture.courses]) {
    const url = new URL(entry.sourceUrl)
    if (url.origin !== 'https://catalog.uhd.edu' || url.pathname !== '/preview_program.php' ||
        url.searchParams.get('catoid') !== '37' || url.searchParams.get('poid') !== '7092')
      throw new Error('Biology source edition or program mismatch')
    if (createHash('sha256').update(entry.text).digest('hex') !== entry.sha256)
      throw new Error('Biology capture fingerprint mismatch')
  }
  const sources = [...new Set([...capture.pages, ...capture.courses].map(entry => entry.sourceUrl))]
    .map((url, index) => sourceSchema.parse({ id: `biology-intake-37-${index + 1}`, url,
      title: 'Biology BS degree page and course panels', catalogYear: capture.catalogYear,
      retrievedOn: capture.retrievedOn, role: 'catalog' }))
  const results = capture.courses.map(panel => parseBiologyPanel(panel, sources.find(source => source.url === panel.sourceUrl)!.id))
  let courses = results.flatMap(result => result.course ? [result.course] : [])
  const blockedCourses = results.flatMap(result => result.blocked ? [result.blocked] : [])
  // Compare the source fields before reusing any exact-match prerequisite review.
  const sharedDatasets = [(await read('src/data/catalog-2025-2026.json')).catalog,
    await read('src/data/minor-2025-2026.json'), await read('data/drafts/chemistry-intake-2025-2026.json')]
  const existing = new Map<string, Course>(sharedDatasets.flatMap(data => data.courses).map((course: unknown) => { const checked = courseSchema.parse(course); return [checked.code, checked] }))
  const sharedCourseIds: string[] = []
  for (const course of courses) {
    const prior = existing.get(course.code)
    if (!prior) continue
    if (prior.catalogYear !== capture.catalogYear || JSON.stringify(prior.credits) !== JSON.stringify(course.credits) ||
        ['title', 'description', 'prerequisiteText'].some(field =>
          normalize(prior[field as keyof Pick<Course, 'title' | 'description' | 'prerequisiteText'>]) !==
          normalize(course[field as keyof Pick<Course, 'title' | 'description' | 'prerequisiteText'>])))
      throw new Error(`Shared Biology course conflict: ${course.code}`)
    sharedCourseIds.push(course.id)
  }
  const review = reviewBiologyPrerequisites(courses, existing)
  courses = review.courses
  const mergedCourses = new Map([...existing.values(), ...courses].map(course => [course.id, course]))
  const mergedSources = new Map(sharedDatasets.flatMap(data => data.sources).concat(sources).map(source => [source.id, source]))
  datasetSchema.parse({ schemaVersion: 1, datasetVersion: 'biology-intake-' + capture.retrievedOn,
    catalogYear: capture.catalogYear, synthetic: false, sources: [...mergedSources.values()],
    courses: [...mergedCourses.values()], requirements: [] })
  const mandatoryBeforeCycles = auditMandatoryCycles([...mergedCourses.values()])
  if (mandatoryBeforeCycles.length) throw new Error('Biology import creates a mandatory-before cycle')
  // Report the external records needed by reviewed expressions, recursively.
  const ownIds = new Set(courses.map(course => course.id))
  const dependencyIds = new Set<string>()
  const seen = new Set<string>()
  const visit = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    const record = mergedCourses.get(id)!
    if (!ownIds.has(id)) dependencyIds.add(id)
    if (record.review !== 'verified') return
    const walk = (rule: Course['prerequisites']) => {
      if (rule.kind === 'course') visit(rule.courseId)
      else if (rule.kind === 'all' || rule.kind === 'any') rule.items.forEach(walk)
    }
    walk(record.prerequisites)
  }
  courses.forEach(course => visit(course.id))
  // Blocked options intentionally do not count as known course records.
  const known = new Set([...existing.keys(), ...courses.map(course => course.code)])
  const missingReferencedCodes = [...new Set(courses.flatMap(course => course.prerequisiteText.match(/[A-Z]{2,}\s*\d{4}/g) ?? [])
    .map(code => code.replace(/([A-Z]+)\s*(\d{4})/, '$1 $2')).filter(code => !known.has(code)))].sort()
  return { version: 1, catalogYear: capture.catalogYear, publishable: false as const, sources, courses, blockedCourses,
    panelMetadata: results.map(result => result.metadata),
    report: { capturedPanelCount: capture.courses.length, courseCount: courses.length,
      blockedCourseCount: blockedCourses.length, sharedCourseIds, newCourseCount: courses.length - sharedCourseIds.length,
      verifiedCount: courses.filter(course => course.review === 'verified').length,
      reusedReviewIds: review.reusedReviewIds, unresolved: review.unresolved, mandatoryBeforeCycles,
      dependencyCourseIds: [...dependencyIds].sort(),
      prerequisiteReviewRequired: courses.filter(course => course.review !== 'verified').map(course => course.code), missingReferencedCodes,
      sourceFingerprints: capture.courses.map(panel => ({ code: panel.code, sha256: panel.sha256 })),
      degreePageFingerprints: capture.pages.map(page => ({ sourceUrl: page.sourceUrl, sha256: page.sha256 })),
      remaining: ['Verify missing credits from an authoritative same-edition source or retain blocked options.',
        'Review prerequisite logic, cross-list exclusions, aliases and supplementary references.',
        'Model degree requirements, reconcile credits and complete tests/browser QA before registration.'] } }
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const draft = await buildBiologyIntake(root)
  const target = resolve(root, 'data/drafts/biology-intake-2025-2026.json')
  await writeFile(`${target}.tmp`, JSON.stringify(draft, null, 2) + '\n', 'utf8')
  await rename(`${target}.tmp`, target)
  console.log(`Biology intake: ${draft.report.courseCount} courses; ${draft.report.verifiedCount} reviewed; ${draft.report.unresolved.length} unresolved; ${draft.report.blockedCourseCount} missing-credit options blocked. Publication disabled.`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch(error => { console.error(error.message); process.exitCode = 1 })
