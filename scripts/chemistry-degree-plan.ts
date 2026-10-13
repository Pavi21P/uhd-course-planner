import { readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { datasetSchema, type CatalogDataset } from '../src/data/catalog-schema.ts'
import { loadPlannerCatalog } from '../src/data/minor-catalog.ts'
import { buildChemistryIntake } from './import-chemistry.ts'

const programId = 'chemistry-bs'
const sourceId = 'chemistry-degree-37'
const integratedSourceId = 'natural-sciences-integrated-37'
const ids = (codes: string[]) => codes.map(code => `2025-2026:${code}`)
export const chemistryFixedScienceCodes = ['BIOL 1301','BIOL 1101','BIOL 1302','BIOL 1102','CHEM 1307','CHEM 1107','CHEM 1308','CHEM 1108','CHEM 2301','CHEM 2101','CHEM 2302','CHEM 2102','MATH 2401','MATH 2402','MATH 2403']
export const chemistryFixedMajorCodes = ['CHEM 3300','CHEM 3310','CHEM 3110','CHEM 3320','CHEM 3330','CHEM 3130','CHEM 3332','CHEM 3132','CHEM 4410','CHEM 4340','CHEM 4140','CHEM 4362','CHEM 4162','CHEM 4364','CHEM 4164']
const writingCodes = ['TCOM 3302','TCOM 3325','TCOM 3326','TCOM 3329','TCOM 4306']
const sourceReviews = [
  { id: sourceId, program: '7063', title: 'Chemistry BS degree requirements', hash: '5d4317f3b4c835b086fa0c2bbf3406b0378667016e9c1ba2f82a616706c1819b' },
  { id: integratedSourceId, program: '7019', title: 'Integrated requirements for Natural Sciences', hash: '99f8c321611d7dec205f5493f7a115f739c85a48c94eeb69cf629ed76acbc1ea' },
]

export async function buildChemistryDegreePlan(root: string) {
  const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
  const intake = await buildChemistryIntake(root)
  const capture = await read('data/sources/2025-2026/chemistry-bs-capture.json') as {
    retrievedOn: string; pages: { sourceUrl: string; text: string; sha256: string }[]
  }
  const degreeSources = sourceReviews.map(review => {
    const page = capture.pages.find(p => new URL(p.sourceUrl).searchParams.get('poid') === review.program)
    if (!page || page.sha256 !== review.hash || createHash('sha256').update(page.text).digest('hex') !== review.hash)
      throw new Error(`Chemistry requirements source changed; re-review ${review.program}`)
    return { id: review.id, url: page.sourceUrl, title: review.title, catalogYear: '2025-2026', retrievedOn: capture.retrievedOn, role: 'catalog' as const }
  })
  const base = loadPlannerCatalog(await read('src/data/catalog-2025-2026.json'), await read('src/data/minor-2025-2026.json'))
  if (!base.ok) throw new Error(base.message)
  const sharedIds = new Set(base.snapshot.catalog.courses.map(course => course.id))
  const courses = [...base.snapshot.catalog.courses, ...intake.courses.filter(course => !sharedIds.has(course.id))]
  const byId = new Map(courses.map(course => [course.id, course]))
  const hours = (codes: string[]) => codes.reduce((sum, code) => {
    const course = byId.get(`2025-2026:${code}`)
    if (!course || course.credits.min !== course.credits.max) throw new Error(`Missing fixed Chemistry credits: ${code}`)
    return sum + course.credits.min
  }, 0)
  const group = (id: string, label: string, area: 'major' | 'supporting' | 'elective', rule: 'all' | 'choose-courses' | 'choose-credits', codes: string[], minimumCredits: number, constraints: string[], count?: number): CatalogDataset['requirements'][number] => ({
    id, programId, label, area, rule, courseIds: ids(codes), minimumCredits, constraints, sourceIds: [sourceId], ...(count ? { count } : {}),
  })
  const physics = (level: 1 | 2, codes: string[]): CatalogDataset['requirements'][number] => ({
    ...group(`chemistry-physics-${level}`, `Physics ${level}: choose one complete lecture/lab pair`, 'supporting', 'choose-courses', codes, 4,
      [`Choose ${codes[0]} + ${codes[1]} (4 credits) OR ${codes[2]} + ${codes[3]} (5 credits).`, 'Complete one listed pair; do not mix alternatives. Actual unique course credits are counted, including the extra calculus-physics credit.'], 2),
    courseSets: [ids(codes.slice(0, 2)), ids(codes.slice(2))],
  })
  const requirements: CatalogDataset['requirements'] = [
    ...base.snapshot.catalog.requirements.filter(r => r.area === 'core').map(r => {
      const promoted = (r.unimportedOptions ?? []).filter(option => byId.has(`2025-2026:${option.code}`))
      return { ...r, programId, courseIds: [...r.courseIds, ...ids(promoted.map(option => option.code))],
        unimportedOptions: (r.unimportedOptions ?? []).filter(option => !byId.has(`2025-2026:${option.code}`)),
        ...(r.id === 'core-020' ? { sourceIds: r.sourceIds.filter(id => id !== 'degree-rules-37'), constraints: [
          'Transfer core completion/articulation can satisfy this group; do not infer individual Taken courses.',
          'The core also permits courses for which a listed mathematics option is a prerequisite; this open rule is not exhaustively enumerated.',
        ] } : {}),
        ...(r.id === 'core-030' ? { constraints: ['Choose six approved life/physical science credits. Count each selected course once even when it serves another degree requirement.', 'Transfer core completion/articulation can satisfy this group; do not infer individual Taken courses.'] } : {}),
      }
    }),
    group('chemistry-fixed-science', 'Required science and mathematics', 'supporting', 'all', chemistryFixedScienceCodes, hours(chemistryFixedScienceCodes), ['Fixed courses listed for the standard Chemistry BS; physics and computing/statistics are separate choices.']),
    group('chemistry-fixed-major', 'Required Chemistry major courses', 'major', 'all', chemistryFixedMajorCodes, hours(chemistryFixedMajorCodes), ['CHEM 3300 research requires department approval, instructor permission and minimum GPA 2.0.', 'Lecture and laboratory records have individual credits and enrollment rules.']),
    group('chemistry-writing', 'Technical writing: choose one', 'supporting', 'choose-courses', writingCodes, 3, ['Choose one of the five listed technical writing courses.'], 1),
    physics(1, ['PHYS 1307','PHYS 1107','PHYS 2401','PHYS 2101']),
    physics(2, ['PHYS 1308','PHYS 1108','PHYS 2402','PHYS 2102']),
    group('chemistry-computing-statistics', 'Computing or statistics: choose one', 'supporting', 'choose-courses', ['CS 1408','CS 1411','STAT 3311'], 3, ['CS 1408 and CS 1411 are 4 credits; STAT 3311 is 3 credits. Choose one.'], 1),
    { ...group('free-electives', 'Free electives to reach 120 unique hours', 'elective', 'choose-credits', [], 0, ['Take sufficient electives to reach a minimum of 120 total hours.', 'The degree encourages appropriate field experience or undergraduate research.']), optionCoverage: 'open-rule' },
  ]
  const sources = [...base.snapshot.catalog.sources, ...intake.sources, ...degreeSources]
  // Requirements are validated against the combined lookup without altering the
  // existing CS or Math snapshots. This draft is deliberately not a UI catalog.
  datasetSchema.parse({ ...base.snapshot.catalog, sources, courses, requirements })
  const integratedConditions = [
    { id: 'chemistry-integrated-writing', label: 'Two writing courses', count: 2, courseIds: ids([...writingCodes,'CHEM 4140','CHEM 4362','CHEM 4364']), sourceIds: [integratedSourceId],
      coverage: 'Relevant captured options only; the official page lists additional alternatives.', text: 'A condition overlapping other requirements, not an additional credit block. Count two distinct eligible courses.' },
    { id: 'chemistry-integrated-ethics', label: 'One ethics course', count: 1, courseIds: ids(['CHEM 3320']), sourceIds: [integratedSourceId],
      coverage: 'CHEM 3320 is a required Chemistry course and an approved ethics option; other ethics options are not imported here.', text: 'Overlaps the required major; adds no separate credit block.' },
  ]
  for (const condition of integratedConditions) for (const id of condition.courseIds)
    if (!byId.has(id)) throw new Error(`Missing integrated course: ${id}`)
  const defaultCourseIds = ids([...chemistryFixedScienceCodes, ...chemistryFixedMajorCodes])
  return { version: 1, programId, catalogYear: '2025-2026', publishable: false as const, minimumCredits: 120,
    sourceIds: [sourceId, integratedSourceId], sources: degreeSources, requirements, integratedConditions,
    defaultCourseIds, fixedCourseCredits: hours([...chemistryFixedScienceCodes, ...chemistryFixedMajorCodes]),
    physicsCreditAlternatives: [[4, 5], [4, 5]], computingCreditAlternatives: [4, 4, 3],
    coursePolicies: base.snapshot.coursePolicies.filter(policy => ['exclusive-phys-2401','exclusive-phys-2402'].includes(policy.id)),
    remaining: ['Departmental graduation rules still need source verification.', 'Preparatory CHEM 1305 and CHEM 1105 descriptions are not captured.', 'Eight Chemistry intake prerequisite cases remain explicitly unresolved.', 'UI catalog construction, source coverage and browser validation are pending.'],
    notices: ['Selections do not certify completion or graduation eligibility.', 'Do not add integrated writing/ethics hours again or assume the common core is completed.', 'No minor is mandated by this captured standard Chemistry BS page. Optional minors are a separate planning choice.'] }
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const plan = await buildChemistryDegreePlan(root)
  const target = resolve(root, 'data/drafts/chemistry-degree-2025-2026.json')
  await writeFile(`${target}.tmp`, JSON.stringify(plan, null, 2) + '\n', 'utf8')
  await rename(`${target}.tmp`, target)
  console.log(`Chemistry requirements: ${plan.defaultCourseIds.length} fixed courses, ${plan.fixedCourseCredits} credits; ${plan.requirements.length} groups. Publication disabled.`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch(error => { console.error(error.message); process.exitCode = 1 })
