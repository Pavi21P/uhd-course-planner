import { catalogSnapshotSchema, type CatalogSnapshot } from './catalog-snapshot.ts'
import type { CatalogDataset } from './catalog-schema.ts'
import type { MinorSupplement } from './minor-catalog.ts'
import type { ProgramDefinition } from './program-definition.ts'

const sourceId = 'math-bs-degree-37'
export const mathematics: ProgramDefinition = {
  id: 'math-bs', title: 'Mathematics BS', shortTitle: 'Mathematics', exportSlug: 'math', catalogYear: '2025-2026',
  firstCourseId: '2025-2026:MATH 2401', defaultRequirementIds: ['math-bs-required'], defaultCourseIds: [],
  supportingRequirementIds: ['math-bs-computing'], electiveRequirementIds: ['math-bs-elective-3000', 'math-bs-elective-4000', 'math-bs-elective-additional'],
  minimumCredits: 120, sourceUrl: 'https://catalog.uhd.edu/preview_program.php?catoid=37&poid=7118&returnto=2409',
  supportingDescription: 'Choose DATA 2401 or CS 1411 · Each is four hours; choose one for the computing requirement',
  starterDescription: 'The starter selects the 11 fixed Mathematics courses (38 course credits). Three credits of MATH 2409 overlap the common core, giving the catalog’s 35-hour mathematics section. Computing, electives, core options and the approved minor/concentration are additional choices. No completed courses are assumed.',
  coverageDescription: 'Core choices with names only cannot be selected yet. The Data Science minor is one available CST option, not a required choice; other approved minors/concentrations are not imported here. MATH 3408 has ambiguous prerequisite wording and no inferred prerequisite edges. Grade, residency, substitutions and overlapping requirements need review.',
  minorPlaceholders: [{ id: 'approved-cst-minor', title: 'Choose a CST minor or concentration', subtitle: '18 approved hours minimum · Other CST options or teacher certification require advising' }, { id: 'data-minor', title: 'Data Science option', subtitle: '22/23 hours · Explore one available minor below; not automatically selected' }],
}
const ids = (codes: string[]) => codes.map(code => '2025-2026:' + code)
export const mathRequiredCodes = ['MATH 2401','MATH 2402','MATH 2403','MATH 2409','MATH 2307','MATH 3301','MATH 3302','MATH 3306','MATH 3307','MATH 3408','MATH 4395']
const restrictions = [
  'C or better is required for Department of Mathematics and Statistics courses applied to this degree.',
  'MATH 4294, MATH 3321 and MATH 3322 do not count toward mathematics degree requirements.',
  'Special Topics (MATH 4190–4490): at most 3 hours without department chair approval.',
  'Directed Study (MATH 3399–4399): at most 3 hours without department chair approval.',
  'MATH 3394 Undergraduate Research: at most 3 hours without department chair approval.',
  'The 15 elective hours are distinct: one listed 3000-level course, two listed 4000-level courses, and at least 6 additional upper-level hours. Selecting a course does not allocate it to a slot.',
]

export function buildMathematicsCatalog(base: CatalogSnapshot, programs: MinorSupplement['programs']) {
  if (base.catalog.catalogYear !== '2025-2026') throw new Error('Mathematics requires catalog 2025-2026')
  const byId = new Map(base.catalog.courses.map(course => [course.id, course]))
  const group = (id: string, label: string, area: 'major' | 'supporting' | 'elective' | 'minor', rule: 'all' | 'choose-courses' | 'choose-credits', codes: string[], minimumCredits: number, constraints: string[] = [], count?: number): CatalogDataset['requirements'][number] => ({
    id, programId: mathematics.id, label, area, rule, courseIds: ids(codes), minimumCredits, constraints, sourceIds: [sourceId], ...(count === undefined ? {} : { count }),
  })
  const extraCodes = base.catalog.courses.filter(course => /^MATH [34]\d{3}$/.test(course.code) && course.credits.max > 0 && ![...mathRequiredCodes,'MATH 3321','MATH 3322','MATH 4294'].includes(course.code)).map(course => course.code)
  const requirements: CatalogDataset['requirements'] = [
    ...base.catalog.requirements.filter(r => r.area === 'core').map(r => ({ ...r, programId: mathematics.id,
      ...(r.id === 'core-020' ? { courseIds: ids(['MATH 2409']), unimportedOptions: [], optionCoverage: 'listed' as const, sourceIds: [sourceId], constraints: ['MATH 2409 satisfies both core math and the mathematics major; count its credits only once.'] } : {}),
      ...(r.id === 'core-030' ? { constraints: r.constraints.filter(c => !c.includes('degree laboratory-science requirement')) } : {}),
    })),
    group('math-bs-required', 'Required Mathematics courses (38 credits; 35 beyond core overlap)', 'major', 'all', mathRequiredCodes, 38, [restrictions[0], 'Three of the four MATH 2409 credits also satisfy the 42-hour common core.', 'MATH 4395: a faculty advisor and topic must be agreed and approved by the department chair at least one full semester before registration.']),
    group('math-bs-computing', 'Computing: DATA 2401 or CS 1411', 'supporting', 'choose-courses', ['DATA 2401','CS 1411'], 4, ['Choose one course.'], 1),
    group('math-bs-elective-3000', 'Math elective: one listed 3000-level course', 'elective', 'choose-courses', ['MATH 3309','MATH 3312','MATH 3314'], 3, restrictions, 1),
    group('math-bs-elective-4000', 'Math electives: two listed 4000-level courses', 'elective', 'choose-courses', ['MATH 4301','MATH 4302','MATH 4303','MATH 4304','MATH 4305','MATH 4306','MATH 4307','MATH 4308','MATH 4314','MATH 4315'], 6, restrictions, 2),
    { ...group('math-bs-elective-additional', 'Additional upper-level Math electives', 'elective', 'choose-credits', extraCodes, 6, restrictions), optionCoverage: 'open-rule' },
    { ...group('math-bs-minor', 'Approved CST minor or teacher certification concentration', 'minor', 'choose-credits', [], 18, ['Choose a university-approved CST minor or approved teacher-certification concentration. Individual minors can require more than 18 hours.', 'Teacher certification requires Urban Education advising. This requirement does not automatically approve overlap.']), optionCoverage: 'open-rule' },
    { ...group('free-electives', 'Free electives to reach 120 unique hours', 'elective', 'choose-credits', [], 0, ['A variable balance, not a fixed course requirement.']), optionCoverage: 'open-rule' },
    ...base.catalog.requirements.filter(r => r.programId === 'minor-data'),
  ]
  const minorPrograms = programs.filter(p => p.id === 'minor-data').map(p => ({ ...p, summary: p.summary.replace('DATA 3402 is suggested for CS majors. ', '') + ' One available CST minor option; not automatically selected.' }))
  // Keep only this program's choices and their prerequisites in its lookup catalog.
  const keep = new Set(requirements.flatMap(r => r.courseIds))
  minorPrograms.forEach(p => p.courseIds.forEach(id => keep.add(id)))
  const walk = (p: import('./catalog-schema.ts').Prerequisite) => {
    if (p.kind === 'course' && !keep.has(p.courseId)) { keep.add(p.courseId); visit(p.courseId) }
    if (p.kind === 'all' || p.kind === 'any') p.items.forEach(walk)
  }
  const visit = (id: string) => { const course = byId.get(id); if (!course) throw new Error('Missing Math program course: ' + id); walk(course.prerequisites) }
  ;[...keep].forEach(visit)
  // Preserve relevant cross-course credit restrictions and conditional-use references.
  const policies = base.coursePolicies.filter(p => p.courseIds.some(id => keep.has(id)) && p.kind !== 'conditional-writing-use' && p.kind !== 'requirement-exclusion')
  policies.forEach(p => p.courseIds.filter(id => byId.has(id)).forEach(id => { keep.add(id); visit(id) }))
  const courses = base.catalog.courses.filter(c => keep.has(c.id))
  const optionCodes = [...new Set(requirements.flatMap(r => r.unimportedOptions?.map(o => o.code) ?? []))]
  const knownReferences = new Set([...keep, ...ids(optionCodes)])
  const snapshot = catalogSnapshotSchema.parse({
    snapshotVersion: 1, scope: 'math-bs-planning-catalog',
    catalog: { ...base.catalog, datasetVersion: '2025-2026-math-bs-2026-10-11', courses, requirements, sources: [...base.catalog.sources,
      { id: sourceId, url: mathematics.sourceUrl, title: 'Mathematics, BS degree requirements', catalogYear: '2025-2026', retrievedOn: '2026-10-11', role: 'catalog' }] },
    coursePolicies: [...policies.filter(p => p.courseIds.every(id => knownReferences.has(id))),
      { id: 'math-bs-excluded-courses', kind: 'requirement-exclusion', courseIds: ids(['MATH 3321','MATH 3322','MATH 4294']).filter(id => keep.has(id)), text: restrictions[1], sourceIds: [sourceId] },
      { id: 'math-bs-project-approval', kind: 'program-condition', courseIds: ids(['MATH 4395']), text: 'Before MATH 4395: faculty advisor and topic approval by the department chair at least one full semester before registration.', sourceIds: [sourceId] },
    ].filter(p => p.courseIds.length > 0),
    coverage: { automaticEligibilityAssessment: false, minorCoursesIncluded: true, unresolvedPrerequisites: base.coverage.unresolvedPrerequisites.filter(i => keep.has(i.courseId)), unimportedOptionCodes: optionCodes,
      notices: [mathematics.coverageDescription, 'Listed required Mathematics course credits total 38; the catalog labels the section 35 because 3 MATH 2409 hours are shared with common core. Count unique courses once.', 'Elective constraints and the approved minor/concentration require advising; this is not an automatic degree audit.'] },
  })
  return { snapshot, programs: minorPrograms }
}
