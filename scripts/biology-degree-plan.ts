import { readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { datasetSchema, type CatalogDataset } from '../src/data/catalog-schema.ts'
import type { CoursePolicy } from '../src/data/credit-allocation.ts'
import { loadPlannerCatalog } from '../src/data/minor-catalog.ts'
import { buildBiologyIntake } from './import-biology.ts'
import { buildChemistryIntake } from './import-chemistry.ts'

const programId = 'biology-bs'
const sourceId = 'biology-degree-37'
const integratedId = 'natural-sciences-integrated-37'
const ids = (codes: string[]) => codes.map(code => '2025-2026:' + code)
export const biologyFixedScienceCodes = ['BIOL 1301','BIOL 1101','BIOL 1302','BIOL 1102','CHEM 1307','CHEM 1107','CHEM 1308','CHEM 1108','STAT 3311','MBIO 2305','MBIO 2105']
export const biologyFixedMajorCodes = ['BIOL 2303','BIOL 2103','CHEM 2301','CHEM 2101','BIOL 3306']
const writing = ['TCOM 3302','TCOM 3325','TCOM 3326','TCOM 3329','TCOM 4306']
const highImpact = ['BIOL 3300','BIOL 4302','BIOL 4331','BIOL 4332','BIOL 4361','BIOL 4399']
const cure = ['BIOL 3102','BIOL 3104','BIOL 3107','BIOL 4110']
const areas = [
  { id: 'cell-molecular', label: 'Cell/Molecular', codes: ['BIOL 3308','BIOL 4320','BIOL 4330','BIOL 4344','CHEM 4344','CHEM 4140','CHEM 4340','MBIO 3390','MBIO 4320','MBIO 4120','MBIO 4330','MBIO 4390'] },
  { id: 'plant-fungal', label: 'Plant/Fungal', codes: ['BIOL 3330','BIOL 3130','BIOL 3310','BIOL 3110','BIOL 3340','BIOL 3140','BIOL 3390','BIOL 4390'] },
  { id: 'environmental', label: 'Environmental', codes: ['BIOL 3302','BIOL 3102','BIOL 4360','BIOL 4340','BIOL 4350','MBIO 3340','MBIO 3390','MBIO 4390'] },
  { id: 'organismal', label: 'Organismal', codes: ['BIOL 3105','BIOL 3304','BIOL 3104','BIOL 3305','BIOL 3307','BIOL 3107','BIOL 3320','BIOL 3390','BIOL 4303','BIOL 4310','BIOL 4110','BIOL 4313','BIOL 4113','BIOL 4344','BIOL 4305','BIOL 4390','MBIO 3320','MBIO 4340','MBIO 4140','BIOL 4302'] },
]
type Capture = { retrievedOn: string; pages: { sourceUrl: string; text: string; sha256: string }[] }
export async function buildBiologyDegreePlan(root: string, degreeCaptureInput?: Capture) {
  const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
  const intake = await buildBiologyIntake(root)
  const chemistry = await buildChemistryIntake(root)
  const base = loadPlannerCatalog(await read('src/data/catalog-2025-2026.json'), await read('src/data/minor-2025-2026.json'))
  if (!base.ok) throw new Error(base.message)
  const capture = degreeCaptureInput ?? await read('data/sources/2025-2026/biology-bs-capture.json') as Capture
  const chemistryCapture = await read('data/sources/2025-2026/chemistry-bs-capture.json') as Capture
  const policies = await read('data/sources/2025-2026/chemistry-supplemental-capture.json') as Capture
  const reviews = [
    { capture, key: 'poid', value: '7092', id: sourceId, title: 'Standard Biology BS requirements', hash: '710f61006df27124048c122bc08c029388f424eb62569bf682444d65894a7ea7' },
    { capture: chemistryCapture, key: 'poid', value: '7019', id: integratedId, title: 'Integrated Natural Sciences writing and ethics requirements', hash: '99f8c321611d7dec205f5493f7a115f739c85a48c94eeb69cf629ed76acbc1ea' },
    { capture: policies, key: 'ent_oid', value: '974', id: 'natural-sciences-department-37', title: 'Natural Sciences graduation and enrollment rules', hash: 'f779e77f9c56f0bcb7c8f6e1c23c4c3a8107cfca4cf572413e934de2a1203727' },
    { capture: policies, key: 'ent_oid', value: '966', id: 'cst-general-rules-37', title: 'CST general rules', hash: '6ac09b0b027c8e8162bfcfbc4eda5267ae4fa11bf1c85558e1f75f810394bdb7' },
  ]
  const degreeSources = reviews.map(review => {
    const page = review.capture.pages.find(page => new URL(page.sourceUrl).searchParams.get(review.key) === review.value)
    if (!page || page.sha256 !== review.hash || createHash('sha256').update(page.text).digest('hex') !== review.hash)
      throw new Error('Biology requirement source changed; re-review ' + review.value)
    const url = new URL(page.sourceUrl)
    if (url.origin !== 'https://catalog.uhd.edu' || url.searchParams.get('catoid') !== '37') throw new Error('Biology requirement source edition mismatch')
    return { id: review.id, url: page.sourceUrl, title: review.title, catalogYear: '2025-2026', retrievedOn: review.capture.retrievedOn, role: 'catalog' as const }
  })
  const courses = [...new Map([...base.snapshot.catalog.courses, ...chemistry.courses, ...intake.courses].map(course => [course.id, course])).values()]
  const byId = new Map(courses.map(course => [course.id, course]))
  const hours = (codes: string[]) => ids(codes).reduce((sum, id) => {
    const course = byId.get(id)
    if (!course || course.credits.min !== course.credits.max) throw new Error('Missing fixed Biology credits: ' + id)
    return sum + course.credits.min
  }, 0)
  const group = (id: string, label: string, area: 'supporting' | 'major' | 'elective', rule: CatalogDataset['requirements'][number]['rule'], codes: string[], minimumCredits: number, constraints: string[], count?: number): CatalogDataset['requirements'][number] =>
    ({ id, programId, label, area, rule, courseIds: ids(codes), minimumCredits, constraints, sourceIds: [sourceId], ...(count ? { count } : {}) })
  const physics = (level: number, codes: string[]): CatalogDataset['requirements'][number] => ({
    ...group('biology-physics-' + level, 'Physics ' + level + ': one complete lecture/lab pair', 'supporting', 'choose-courses', codes, 4,
      ['Choose the algebra-physics pair (4 credits) or calculus-physics pair (5 credits). Do not mix lecture/lab alternatives.'], 2),
    courseSets: [ids(codes.slice(0, 2)), ids(codes.slice(2))],
  })
  const highImpactSets = [...highImpact.map(code => ids([code])), ...cure.flatMap((code, i) => cure.slice(i + 1).map(other => ids([code, other])))]
  const optionCodes = [...new Set(areas.flatMap(area => area.codes))]
  const requirements: CatalogDataset['requirements'] = [
    ...base.snapshot.catalog.requirements.filter(r => r.area === 'core').map(r => {
      const promoted = (r.unimportedOptions ?? []).filter(option => byId.has('2025-2026:' + option.code))
      return { ...r, programId, courseIds: [...r.courseIds, ...ids(promoted.map(option => option.code))],
        unimportedOptions: (r.unimportedOptions ?? []).filter(option => !byId.has('2025-2026:' + option.code)),
        ...(r.id === 'core-020' ? { sourceIds: r.sourceIds.filter(id => id !== 'degree-rules-37'), constraints: [
          'Transfer core completion/articulation can satisfy this group; do not infer individual Taken courses.',
          'Additional courses whose prerequisites include a listed mathematics option may qualify; this open rule is not exhaustively enumerated.',
        ] } : {}),
        ...(r.id === 'core-030' ? { constraints: ['Choose six approved life/physical science credits. Count each selected course once even when serving another requirement.', 'Transfer core completion/articulation does not identify individual completed courses.'] } : {}),
      }
    }),
    group('biology-fixed-science', 'Required foundation sciences and statistics', 'supporting', 'all', biologyFixedScienceCodes, hours(biologyFixedScienceCodes), ['Calculus, computing/mathematics and physics are separate choices.']),
    group('biology-fixed-major', 'Required Biology major courses', 'major', 'all', biologyFixedMajorCodes, hours(biologyFixedMajorCodes), ['Seminar and high-impact experience are separate choices.']),
    group('biology-writing', 'Technical writing: choose one', 'supporting', 'choose-courses', writing, 3, ['One listed TCOM course. Also counts toward the two-course integrated writing condition when applicable.'], 1),
    group('biology-calculus', 'Calculus I: choose one', 'supporting', 'choose-courses', ['MATH 2411','MATH 2401'], 4, ['MATH 2411 or MATH 2401.'], 1),
    group('biology-math-computing', 'Additional mathematics or computing: choose one', 'supporting', 'choose-courses', ['MATH 2412','CS 1408','CS 1411'], 4, ['MATH 2402 is not a listed replacement for this degree requirement.'], 1),
    physics(1, ['PHYS 1307','PHYS 1107','PHYS 2401','PHYS 2101']),
    physics(2, ['PHYS 1308','PHYS 1108','PHYS 2402','PHYS 2102']),
    group('biology-seminar', 'Seminar: choose one', 'major', 'choose-courses', ['BIOL 4311','MBIO 4311','SUST 4301'], 3, ['Each listed seminar is an approved integrated ethics option.'], 1),
    { ...group('biology-high-impact', 'One high-impact lab OR two distinct CURE courses', 'major', 'choose-set', [...highImpact, ...cure], 2,
      ['Choose one complete listed alternative: one high-impact course (3 credits) or any two distinct CURE courses (2 or 4 published credits).', 'BIOL 4399 requires Honors Program enrollment.', 'Alternative credit differences do not reduce the 120-hour degree minimum.']), courseSets: highImpactSets },
    { ...group('biology-upper-options', 'Biology upper-level options: 23 unique hours', 'major', 'choose-credits', optionCodes, 23,
      ['Select at least one eligible course in each of the four content areas; these are overlapping conditions on this pool, not extra credit blocks.', 'Special Topics choices require approval.', 'BIOL 4302 may be used here only if not used for the high-impact requirement.', 'Lecture/lab grouping and use across multiple content areas require allocation review; membership alone does not certify eligibility.']), optionCoverage: 'listed' },
    { ...group('free-electives', 'Approved upper-level electives to reach 120 unique hours', 'elective', 'choose-credits', [], 0,
      ['Use approved upper-level electives to reach the degree minimum.', 'At most six hours of undergraduate research count toward the degree.']), optionCoverage: 'open-rule' },
  ]
  const sources = [...new Map([...base.snapshot.catalog.sources, ...chemistry.sources, ...intake.sources, ...degreeSources].map(source => [source.id, source])).values()]
  datasetSchema.parse({ ...base.snapshot.catalog, courses, sources, requirements })
  const integratedConditions = [
    { id: 'biology-integrated-writing', label: 'Two distinct writing courses', count: 2, courseIds: ids([...writing,'BIOL 4310','BIOL 4340','CHEM 4140','MBIO 4120','MBIO 4140']), sourceIds: [integratedId], coverage: 'Relevant Biology pool options only; other approved courses or approved petitions may qualify.' },
    { id: 'biology-integrated-ethics', label: 'One ethics course', count: 1, courseIds: ids(['BIOL 3308','BIOL 4311','BIOL 4303','BIOL 4360','BIOL 4344','CHEM 4344','MBIO 3340','MBIO 4311','MBIO 4310','SUST 4301']), sourceIds: [integratedId], coverage: 'Relevant Biology and supplemental options only; other official alternatives remain available.' },
  ]
  const contentAreaConditions = areas.map(area => ({ id: 'biology-area-' + area.id, label: area.label, minimumCourseCount: 1,
    requirementId: 'biology-upper-options', courseIds: ids(area.codes), sourceIds: [sourceId], addsSeparateCredits: false }))
  const coursePolicies: CoursePolicy[] = [
    ...base.snapshot.coursePolicies.filter(policy => ['exclusive-phys-2401','exclusive-phys-2402'].includes(policy.id)),
    { id: 'biology-exclusive-pharmacology', kind: 'mutually-exclusive-credit', courseIds: ids(['BIOL 4344','CHEM 4344']), sourceIds: [sourceId, ...intake.sources.filter(source => source.id.startsWith('biology-intake-')).map(source => source.id)], text: 'BIOL 4344 and CHEM 4344 are cross-listed; credit may only be earned for one.' },
    { id: 'biology-research-limit', kind: 'program-condition', courseIds: ids(['BIOL 3300','BIOL 4399']), sourceIds: [sourceId], text: 'At most six hours of undergraduate research may count toward the degree, across all research courses and repeat enrollments. These are the currently imported research choices, not an exhaustive research inventory.' },
    { id: 'biology-special-topics-approval', kind: 'program-condition', courseIds: ids(['BIOL 3390','BIOL 4390','MBIO 3390','MBIO 4390']), sourceIds: [sourceId], text: 'Special Topics requires approval for the relevant upper-level content area; course selection alone does not establish approval.' },
    { id: 'biology-natural-sciences-rules', kind: 'program-condition', courseIds: intake.courses.filter(c => /^(BIOL|MBIO|CHEM|PHYS) /.test(c.code)).map(c => c.id), sourceIds: ['natural-sciences-department-37'], text: 'Natural Sciences rules include 2.0 science GPA, C or higher in upper-level science used for graduation, at least 18 upper-level science hours at UHD with 2.0 GPA, satisfactory corequisite completion and the departmental exit survey.' },
    { id: 'biology-cst-rules', kind: 'program-condition', courseIds: ids([...biologyFixedScienceCodes,...biologyFixedMajorCodes]), sourceIds: ['cst-general-rules-37'], text: 'Complete general education and course prerequisites/corequisites; dropping a prerequisite or corequisite may require dropping both courses. Petition advising to reevaluate unapplied transfer credit.' },
  ]
  for (const condition of [...integratedConditions, ...contentAreaConditions, ...coursePolicies]) {
    for (const id of condition.courseIds) if (!byId.has(id)) throw new Error('Unknown Biology condition course: ' + id)
    for (const id of condition.sourceIds) if (!sources.some(source => source.id === id)) throw new Error('Unknown Biology condition source: ' + id)
  }
  return { version: 1, programId, catalogYear: '2025-2026', publishable: false as const, minimumCredits: 120,
    sources: degreeSources, sourceIds: degreeSources.map(source => source.id), requirements, integratedConditions, contentAreaConditions, coursePolicies,
    defaultCourseIds: ids([...biologyFixedScienceCodes,...biologyFixedMajorCodes]), fixedCourseCredits: hours([...biologyFixedScienceCodes,...biologyFixedMajorCodes]),
    highImpactCreditAlternatives: highImpactSets.map(set => hours(set.map(id => byId.get(id)!.code))), physicsCreditAlternatives: [[4,5],[4,5]],
    allocationRestrictions: [
      { code: 'BIOL 4302', incompatibleRequirementIds: ['biology-high-impact','biology-upper-options'], reason: 'Explicit if-not-used-above restriction.' },
    ],
    remaining: ['The Biology allocation audit checks explicit overlap, area-specific topic approvals, candidate coverage and reported research totals; catalog assembly and UI integration remain pending.',
      'Clarify lecture/lab grouping and the MBIO 3320 OR MBIO 4340 with MBIO 4140 sequence before treating content-area selections as satisfied.',
      'BIOL 3107 explicitly lists 3 credits despite the course-numbering policy suggesting 1. Retain the direct published value pending UHD clarification; CURE pairs containing it total 4 credits.',
      'Do not assume CURE/high-impact work can also fill the 23-hour option pool or satisfy multiple content areas without review.',
      'Cross-list counterpart policies for MBIO 3350/3150/4313/4113 remain outside the imported degree pool.',
      intake.report.unresolved.length + ' prerequisite interpretations remain unresolved; BIOL 3103 remains missing.',
      'Scoped catalog assembly, local browser QA and publication verification remain pending.'],
    notices: ['Course selections do not certify completion, allocation, prerequisites or graduation eligibility.',
      'Count each selected course once toward total credits. Integrated writing/ethics and content-area conditions add no separate credit blocks.',
      'No minor is mandated by the captured standard Biology BS page. Optional minors remain separate.'] }
}
async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const plan = await buildBiologyDegreePlan(root)
  const target = resolve(root, 'data/drafts/biology-degree-2025-2026.json')
  await writeFile(`${target}.tmp`, JSON.stringify(plan, null, 2) + '\n', 'utf8')
  await rename(`${target}.tmp`, target)
  console.log(`Biology requirements: ${plan.defaultCourseIds.length} fixed courses, ${plan.fixedCourseCredits} credits; ${plan.requirements.length} groups. Publication disabled.`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch(error => { console.error(error.message); process.exitCode = 1 })
