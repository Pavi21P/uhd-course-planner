import { readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { courseSchema, sourceSchema, type CatalogDataset } from '../src/data/catalog-schema.ts'
import { minorSupplementSchema, addMinorSupplement } from '../src/data/minor-catalog.ts'
import { catalogSnapshotSchema } from '../src/data/catalog-snapshot.ts'
const year = '2025-2026'
const hash = 'a992ee569c5a42ebcb5b50f92e5e464c3989b2b220b92ae79384190f8b096f6c'
export function buildMinorSupplement(raw: string, base: CatalogDataset, expansionRaw: string, mathRaw: string) {
  if (createHash('sha256').update(raw).digest('hex') !== hash) throw new Error('Minor capture changed; re-review before publication')
  const capture = z.object({ catalogYear: z.literal(year), catalogId: z.literal('37'), sources: z.array(sourceSchema), courses: z.array(courseSchema) }).parse(JSON.parse(raw))
  if (createHash('sha256').update(expansionRaw).digest('hex') !== '04fe2d3ab11d0832db36eacbb07fb3d9bb0379b97acadb2c9908be0f29949ebe') throw new Error('Minor expansion changed; re-review before publication')
  const expansion = z.object({ catalogYear: z.literal(year), catalogId: z.literal('37'), sources: z.array(sourceSchema), courses: z.array(courseSchema), indexes: z.array(z.object({ prefix: z.enum(['DATA', 'MATH']), sourceUrl: z.url(), observedPaginationLinkCount: z.literal(0), courses: z.array(z.object({ code: z.string(), url: z.url() })) })) }).parse(JSON.parse(expansionRaw))
  if (createHash('sha256').update(mathRaw).digest('hex') !== '6ef671521bd81571b3aaaeebbe0829d995d824a3fa7760a38ea84f507227222b') throw new Error('Math capture changed; re-review before publication')
  const mathCapture = z.object({ catalogYear: z.literal(year), catalogId: z.literal('37'), sources: z.array(sourceSchema), courses: z.array(courseSchema), coursePolicies: catalogSnapshotSchema.shape.coursePolicies, unresolvedPrerequisites: catalogSnapshotSchema.shape.coverage.shape.unresolvedPrerequisites }).parse(JSON.parse(mathRaw))
  const courses = [...base.courses, ...capture.courses, ...expansion.courses, ...mathCapture.courses]
  const dataIndexCodes = expansion.indexes.find(index => index.prefix === 'DATA')!.courses.map(course => course.code)
  const mathIndexCodes = expansion.indexes.find(index => index.prefix === 'MATH')!.courses.map(course => course.code).filter(code => Number(code.slice(5)) >= 2000)
  const mathMissingCodes = mathIndexCodes.filter(code => !courses.some(course => course.code === code))
  if (dataIndexCodes.length !== 9 || dataIndexCodes.some(code => !courses.some(course => course.code === code))) throw new Error('Incomplete DATA index reconciliation')
  const ids = (codes: string[]) => codes.map(code => { const course = courses.find(course => course.code === code); if (!course) throw new Error(`Missing minor course ${code}`); return course.id })
  const calculus = ['MATH 2401','MATH 2402','MATH 2411','MATH 2412','MATH 2421','MATH 2422']
  const math = courses.filter(course => /^MATH /.test(course.code) && Number(course.code.slice(5)) >= 2000).map(course => course.code)
  const additionalMath = math.filter(code => !calculus.includes(code) && courses.find(course => course.code === code)!.credits.max > 0)
  const dataRequired = ['CS 1411','DATA 2401','DATA 3401','MATH 2305']
  const dataCalculus = ['MATH 2421','MATH 2402','MATH 2412']
  const dataOptions = ['DATA 3334','DATA 3402','MATH 3302','STAT 3311','STAT 3333', ...dataIndexCodes.filter(code => !['DATA 2401','DATA 3401','DATA 3334','DATA 3402'].includes(code))]
  const common = ['Every course applied to the minor requires C or better.', 'At least 6 upper-level minor hours must be completed at UHD.', 'Major/minor overlap and transfer/residency fulfillment require review; no automatic certification.']
  const group = (id: string, programId: string, label: string, codes: string[], minimumCredits: number, constraints: string[], rule: 'all'|'choose-courses'|'choose-credits' = 'choose-credits', count?: number) => ({id,programId,label,area:'minor',rule,courseIds:ids(codes),minimumCredits,constraints:[...common,...constraints],sourceIds:[programId === 'minor-math' ? 'minor-math-37' : 'minor-data-37'],optionCoverage:'open-rule',...(count ? {count} : {})})
  return minorSupplementSchema.parse({ version:'2025-2026-minors-2026-10-06-complete',baseDatasetVersion:base.datasetVersion,sources:[...capture.sources,...expansion.sources,...mathCapture.sources],courses:[...capture.courses,...expansion.courses,...mathCapture.courses],coverage:{dataIndexCodes,mathIndexCodes,mathMissingCodes},coursePolicies:mathCapture.coursePolicies,unresolvedPrerequisites:mathCapture.unresolvedPrerequisites,
    requirements:[
      group('minor-math-calculus','minor-math','Math minor: one paired calculus sequence',calculus,8,['Choose MATH 2401 AND 2402, OR MATH 2411 AND 2412, OR MATH 2421 AND 2422. Do not mix courses from different pairs.']),
      group('minor-math-additional','minor-math','Math minor: 10 additional MATH hours',additionalMath,10,['MATH 2000-level and above, excluding the six calculus sequence courses. All 47 indexed MATH records at 2000+ are imported; zero-credit MATH 4095 contributes no hours.']),
      group('minor-math-upper','minor-math','Math minor: 6 upper-level hours within those 10',additionalMath.filter(code=>Number(code.slice(5))>=3000 && !['MATH 3321','MATH 3322'].includes(code)),6,['Subset of the 10 additional hours, not another 6 hours. Exclude MATH 3321 and MATH 3322.']),
      group('minor-data-required','minor-data','Data Science minor: required foundation',dataRequired,15,[], 'all'),
      group('minor-data-calculus','minor-data','Data Science minor: choose one calculus course',dataCalculus,4,[], 'choose-courses',1),
      group('minor-data-option','minor-data','Data Science minor: choose one additional course',dataOptions,3,['Any additional DATA course is allowed. All seven additional DATA choices in the 2025-2026 DATA index are imported; DATA 2401 and DATA 3401 remain foundation courses, not additional choices.','Alternatively choose MATH 3302, STAT 3311, or STAT 3333.','DATA 3402 is suggested for CS majors, not mandatory.'], 'choose-courses',1),
    ], programs:[
      {id:'minor-math',title:'Mathematics minor',totalLabel:'18 hours minimum',sourceId:'minor-math-37',courseIds:ids(math),summary:'One paired calculus sequence (2401/2402, 2411/2412, or 2421/2422), plus 10 other MATH hours at 2000+. At least 6 of those 10 must be upper level; MATH 3321/3322 cannot fill that 6-hour subset. C or better and 6 upper-level hours at UHD. Cards include reviewed options and the CS example, not a mandatory list. All 47 indexed MATH records at 2000+ are shown, including informational zero-credit MATH 4095.'},
      {id:'minor-data',title:'Data Science minor',totalLabel:'22 or 23 hours',sourceId:'minor-data-37',courseIds:ids([...dataRequired,...dataCalculus,...dataOptions]),summary:'Required: CS 1411, DATA 2401, DATA 3401, MATH 2305. Choose one of MATH 2421/2402/2412, then one additional DATA course or MATH 3302/STAT 3311/STAT 3333. DATA 3402 is suggested for CS majors. C or better and 6 upper-level hours at UHD. All seven additional DATA choices in this catalog are shown.'},
    ] })
}
async function main() {
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
 const base=catalogSnapshotSchema.parse(JSON.parse(await readFile(resolve(root,'src/data/catalog-2025-2026.json'),'utf8')))
 const supplement=buildMinorSupplement(await readFile(resolve(root,'data/sources/2025-2026/minor-capture.json'),'utf8'),base.catalog,await readFile(resolve(root,'data/sources/2025-2026/minor-expansion-capture.json'),'utf8'),await readFile(resolve(root,'data/sources/2025-2026/minor-math-capture.json'),'utf8'))
 addMinorSupplement(base,supplement)
 const target=resolve(root,'src/data/minor-2025-2026.json')
 await writeFile(target+'.tmp',JSON.stringify(supplement,null,2)+'\n','utf8')
 await rename(target+'.tmp',target)
 console.log(`Published ${supplement.courses.length} appended course records and ${supplement.requirements.length} minor groups; base catalog unchanged.`)
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main()
