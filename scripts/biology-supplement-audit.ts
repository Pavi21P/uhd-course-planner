import { createHash } from 'node:crypto'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { parseCourseCapture } from './catalog-import.ts'

const record = z.object({ sourceUrl: z.url(), text: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
const schema = z.object({ catalogYear: z.literal('2025-2026'), catalogId: z.literal('37'), retrievedOn: z.iso.date(),
  publishable: z.literal(false), courses: z.array(record.extend({ code: z.string(), observedAt: z.url() })).length(4),
  pages: z.array(record.extend({ kind: z.enum(['credit-policy', 'course-search']), query: z.string().optional() })).length(2) })
const courseIds: Record<string, string> = { 'ENG 1302': '68976', 'PSY 1303': '69610', 'SOC 1303': '69732', 'MBIO 4310': '69449' }
const creditCodes = ['BIOL 3390', 'BIOL 4390', 'BIOL 4399']
const policyStatement = 'The second digit indicates the number of semester credit hours that the course carries.'
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()
function verify(entry: z.infer<typeof record>) {
  const url = new URL(entry.sourceUrl)
  const editions = [url.searchParams.get('catoid'), url.searchParams.get('cur_cat_oid')].filter(Boolean)
  if (url.origin !== 'https://catalog.uhd.edu' || !editions.length || editions.some(id => id !== '37'))
    throw new Error('Biology supplemental source edition mismatch')
  if (createHash('sha256').update(entry.text).digest('hex') !== entry.sha256)
    throw new Error('Biology supplemental fingerprint mismatch')
  return url
}

export async function auditBiologySupplement(root: string, captureInput?: unknown, originalInput?: unknown) {
  const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
  const capture = schema.parse(captureInput ?? await read('data/sources/2025-2026/biology-supplemental-capture.json'))
  if (new Set(capture.courses.map(panel => panel.code)).size !== 4) throw new Error('Duplicate supplemental course')
  for (const entry of [...capture.pages, ...capture.courses]) verify(entry)
  const policy = capture.pages.find(page => page.kind === 'credit-policy')
  const search = capture.pages.find(page => page.kind === 'course-search')
  if (!policy || !search) throw new Error('Missing supplemental policy or search evidence')
  const policyUrl = new URL(policy.sourceUrl)
  if (policyUrl.pathname !== '/content.php' || policyUrl.searchParams.get('navoid') !== '2421' ||
      !normalize(policy.text).includes(policyStatement)) throw new Error('Credit policy needs re-review')
  const searchUrl = new URL(search.sourceUrl)
  if (search.query !== 'BIOL 3103' || searchUrl.pathname !== '/content.php' || searchUrl.searchParams.get('navoid') !== '2413' ||
      searchUrl.searchParams.get('filter[27]') !== 'BIOL' || searchUrl.searchParams.get('filter[29]') !== '3103' ||
      !search.text.includes('No courses found. Please modify your filter criteria.'))
    throw new Error('Missing exact BIOL 3103 search evidence')
  const courses = capture.courses.map(panel => {
    const url = new URL(panel.sourceUrl)
    if (!courseIds[panel.code] || url.pathname !== '/preview_course_nopop.php' || url.searchParams.get('coid') !== courseIds[panel.code])
      throw new Error('Supplemental course source identity mismatch')
    const parsed = parseCourseCapture(panel.text, capture.catalogYear, `biology-supplement-37-${courseIds[panel.code]}`, ['SOC 1303'])
    const course = parsed[0]
    if (parsed.length !== 1 || course.code !== panel.code) throw new Error('Supplemental panel identity mismatch')
    return course
  })
  const original = (originalInput ?? await read('data/sources/2025-2026/biology-bs-capture.json')) as { catalogYear: string; catalogId: string; courses: { code: string }[] }
  if (original.catalogYear !== capture.catalogYear || original.catalogId !== capture.catalogId) throw new Error('Original Biology edition mismatch')
  const creditEvidence = creditCodes.map(code => {
    const panel = record.extend({ code: z.literal(code) }).parse(original.courses.find((item: { code: string }) => item.code === code))
    verify(panel)
    if (/Credits:/.test(panel.text)) throw new Error('Credit panel changed; re-review policy fallback')
    if (!normalize(panel.text).startsWith(code + ' - ')) throw new Error('Credit panel identity mismatch')
    return { code, credits: { min: 3, max: 3 }, basis: 'Explicit same-edition course-numbering policy',
      directCreditLinePublished: false, policySourceUrl: policy.sourceUrl, policySha256: policy.sha256,
      courseSourceUrl: panel.sourceUrl, courseSha256: panel.sha256,
      explanation: 'The catalog policy assigns semester credit hours from the second digit; this listed course has second digit 3. No class/lab hours are inferred.' }
  })
  return { version: 1, catalogYear: capture.catalogYear, reviewedOn: capture.retrievedOn, publishable: false,
    sources: capture.courses.map(panel => ({ id: `biology-supplement-37-${courseIds[panel.code]}`, url: panel.sourceUrl,
      title: panel.code + ' supplemental course panel', catalogYear: capture.catalogYear, retrievedOn: capture.retrievedOn, role: 'catalog' as const })),
    courses, creditEvidence,
    report: { foundReferencedCodes: courses.map(course => course.code).sort(), unresolvedReferencedCodes: ['BIOL 3103'],
      unresolvedReason: 'The exact same-edition course filter returned no result. This does not prove an equivalency or authorize replacing BIOL 3103 with BIOL 2103.',
      searchSourceUrl: search.sourceUrl, searchSha256: search.sha256,
      prerequisitesStillUnreviewed: courses.map(course => course.code),
      remaining: ['Import the four supplementary records and review their prerequisite expressions.',
        'Apply the three explicit credit resolutions while retaining policy and original-panel provenance.',
        'Retain BIOL 3103 as unresolved; model degree choices and cross-list restrictions before selector integration.'] } }
}
async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const review = await auditBiologySupplement(root)
  const target = resolve(root, 'data/drafts/biology-supplement-review-2025-2026.json')
  await writeFile(`${target}.tmp`, JSON.stringify(review, null, 2) + '\n', 'utf8')
  await rename(`${target}.tmp`, target)
  console.log('Biology supplement: 4 referenced courses found; 3 policy-supported credit resolutions; BIOL 3103 unresolved. Main intake unchanged.')
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch(error => { console.error(error.message); process.exitCode = 1 })
