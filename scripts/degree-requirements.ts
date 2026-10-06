import { createHash } from 'node:crypto'
import { z } from 'zod'
import { requirementSchema, sourceSchema, type Course } from '../src/data/catalog-schema.ts'

const year = '2025-2026'
const sourceHash = 'ffa7024bd7c0ae299ab376d75e5ec805f2cc714dd3d6d7115862177a254d75bd'
const captureSchema = z.object({ catalogYear: z.literal(year), catalogId: z.literal('37'), retrievedOn: z.iso.date(),
  degree: z.object({ url: z.url(), snapshot: z.string().min(100) }),
  core: z.object({ url: z.url(), snapshot: z.string().min(100) }),
  coreGroups: z.array(z.object({ label: z.string(), minimumCredits: z.number().positive(),
    options: z.array(z.object({ code: z.string(), title: z.string() })).min(1) })).length(10),
  physicsPanels: z.array(z.string().min(100)).length(4),
})

export function parseRequirementCapture(raw: string) {
  if (createHash('sha256').update(raw).digest('hex') !== sourceHash)
    throw new Error('Degree requirement source changed; re-review before import')
  const capture = captureSchema.parse(JSON.parse(raw))
  for (const page of [capture.degree, capture.core]) {
    const url = new URL(page.url)
    if (url.hostname !== 'catalog.uhd.edu' || url.protocol !== 'https:' || url.searchParams.get('catoid') !== '37')
      throw new Error('Requirement source edition mismatch')
  }
  return { capture, fingerprint: sourceHash }
}
export type RequirementCapture = ReturnType<typeof parseRequirementCapture>['capture']
export function requirementSources(capture: RequirementCapture) {
  return [sourceSchema.parse({ id: 'degree-rules-37', url: capture.degree.url, title: 'Computer Science BS requirements', catalogYear: year, retrievedOn: capture.retrievedOn, role: 'catalog' }),
    sourceSchema.parse({ id: 'core-rules-37', url: capture.core.url, title: 'Common Core requirements and physics panels', catalogYear: year, retrievedOn: capture.retrievedOn, role: 'catalog' })]
}

export function buildDegreeRequirements(courses: Course[], capture: RequirementCapture) {
  const byCode = new Map(courses.map(c => [c.code, c]))
  const ids = (codes: string[]) => codes.map(code => {
    const course = byCode.get(code)
    if (!course || course.catalogYear !== year) throw new Error(`Missing degree course: ${code}`)
    return course.id
  })
  const programId = 'computer-science-bs'
  const coreIds = ['010', '020', '030', '040', '050', '060', '070', '080', '090-oral', '090-seminar']
  const requirements = capture.coreGroups.map((g, index) => {
    const options = [...g.options]
    if (coreIds[index] === '020') options.push({ code: 'MATH 2305', title: 'Discrete Mathematical Structures' })
    const constraints = ['Transfer core completion/articulation can satisfy this group; do not infer individual Taken courses.']
    if (coreIds[index] === '020') constraints.push('Degree page explicitly overlaps MATH 2305 with core math. Core also permits courses for which a listed math option is a prerequisite; that open rule is not exhaustively enumerated.')
    if (coreIds[index] === '030') constraints.push('Only six science hours overlap the degree laboratory-science requirement; course credits in excess of six remain unique earned/planned hours.')
    if (coreIds[index] === '090-seminar') constraints.push('If Component Area Option is not complete at transfer: UHD 1301-1308 for fewer than 30 SCH or ENG 1301 not passed; UHD 2301-2308 for at least 30 SCH and ENG 1301 passed. First UHD semester.')
    return requirementSchema.parse({ id: `core-${coreIds[index]}`, programId, label: g.label, area: 'core', rule: 'choose-credits',
      minimumCredits: g.minimumCredits, courseIds: options.filter(o => byCode.has(o.code)).map(o => byCode.get(o.code)!.id),
      unimportedOptions: options.filter(o => !byCode.has(o.code)), optionCoverage: coreIds[index] === '020' ? 'open-rule' : 'listed',
      constraints, sourceIds: coreIds[index] === '020' ? ['core-rules-37', 'degree-rules-37'] : ['core-rules-37'] })
  })
  const add = (id: string, label: string, area: 'major' | 'supporting' | 'elective', rule: 'all' | 'choose-credits', codes: string[], minimumCredits: number, constraints: string[], optionCoverage: 'listed' | 'partial' | 'open-rule' = 'listed') => {
    requirements.push(requirementSchema.parse({ id, programId, label, area, rule, courseIds: ids(codes), minimumCredits, constraints, optionCoverage, sourceIds: ['degree-rules-37'] }))
  }
  const required = ['CS 1411', 'CS 2301', 'CS 2302', 'CS 2411', 'CS 3304', 'CS 3306', 'CS 3321', 'CS 4294', 'CS 4303', 'CS 4315', 'CS 4318']
  add('cs-required', 'Required Computer Science courses', 'major', 'all', required, 34, ['C or better in CS courses applied to the degree.'])
  add('cs-writing-project', 'Senior Project or approved writing course', 'major', 'choose-credits', ['CS 4395', 'CS 3324', 'CS 4301', 'CS 4306', 'CS 4328', 'CS 4340'], 3,
    ['CS 4395 is the named course. Alternatives require approved W-course use and their additional conditions; a catalog option is not automatic approval.', 'A course allocated here cannot also fill a separate CS elective slot.'], 'partial')
  add('support-writing', 'Business and Technical Writing', 'supporting', 'all', ['TCOM 3302'], 3, [])
  add('support-math', 'Required mathematics', 'supporting', 'all', ['MATH 2305', 'MATH 2401', 'MATH 2402', 'MATH 2307'], 14, ['C or better.', 'Three hours overlap core math.'])
  add('support-statistics', 'Statistics option', 'supporting', 'choose-credits', ['STAT 3311', 'MATH 3302'], 3, ['Choose one; C or better. Do not count both as required.'])
  add('support-science', 'Laboratory natural sciences', 'supporting', 'choose-credits', ['PHYS 2401', 'PHYS 2101', 'PHYS 2402', 'PHYS 2102'], 8,
    ['Eight hours of laboratory science; six overlap core science.', 'Physics lecture/lab pairs are one captured pathway, not the complete eligible pool. Laboratories must accompany the appropriate lecture.', 'PHYS 2401/2402 publish four hours each; PHYS 2101/2102 publish one each. Preserve all ten unique hours if selected.'], 'partial')
  const candidates = courses.filter(c => c.code.startsWith('CS ') && Number(c.code.slice(3)) > 1305 && ![...required, 'CS 4395', 'CS 3394'].includes(c.code))
  add('cs-elective-upper', 'Upper-level CS electives', 'elective', 'choose-credits', candidates.filter(c => Number(c.code.slice(3)) >= 3000).map(c => c.code), 15,
    ['C or better; allocate distinct courses beyond required CS/project slots.', 'CS 3394 is excluded by its description; report conflict remains recorded.', 'Permission and repeated-study conditions remain applicable.'])
  add('cs-elective-additional', 'Additional CS elective', 'elective', 'choose-credits', candidates.map(c => c.code), 3,
    ['C or better; CS courses above CS 1305. Use distinct courses beyond the 15-hour upper-level pool.', 'CS 3394 withheld pending eligibility conflict resolution.'], 'partial')
  add('free-electives', 'Free electives to reach 120 unique hours', 'elective', 'choose-credits', [], 0,
    ['Dynamic balance to 120 degree-applicable unique hours; not a fixed four-hour course requirement.', 'Degree-credit exclusions and mutually exclusive credit apply.'], 'open-rule')
  if (requirements.filter(r => r.area === 'core').reduce((sum, r) => sum + r.minimumCredits!, 0) !== 42) throw new Error('Core total mismatch')
  return requirements
}
