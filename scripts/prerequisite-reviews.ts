import type { Course, Prerequisite } from '../src/data/catalog-schema.ts'

// Reviewed against catalog 37 course panels on 2026-09-27. Exact prerequisite
// text binds each interpretation to its source; changed text requires re-review.
const year = '2025-2026'
const course = (code: string, minimumGrade?: string, timing: 'before' | 'before-or-concurrent' | 'concurrent' = 'before'): Prerequisite =>
  ({ kind: 'course', courseId: `${year}:${code}`, timing, ...(minimumGrade ? { minimumGrade } : {}) })
const all = (...items: Prerequisite[]): Prerequisite => ({ kind: 'all', items })
const any = (...items: Prerequisite[]): Prerequisite => ({ kind: 'any', items })
const condition = (text: string, category: 'other' | 'standing' | 'permission' | 'placement' = 'other'): Prerequisite =>
  ({ kind: 'condition', category, text })

const reviews: Record<string, { expectedText: string; prerequisites: Prerequisite }> = {
  'TCOM 3302': {
    expectedText: '010 core complete and 040 core complete',
    prerequisites: all(condition('010 core complete'), condition('040 core complete')),
  },
  'CS 2302': {
    expectedText: 'Grade of C or better in CS 1411 and MATH 2305.',
    prerequisites: all(course('CS 1411', 'C'), course('MATH 2305', 'C')),
  },
  'CS 2411': {
    expectedText: 'Grade of C or better in CS 1411; credit or enrollment in MATH 2401.',
    prerequisites: all(course('CS 1411', 'C'), course('MATH 2401', undefined, 'before-or-concurrent')),
  },
  'CS 3304': {
    expectedText: 'Grade of C or better in CS 2411 and MATH 2305.',
    prerequisites: all(course('CS 2411', 'C'), course('MATH 2305', 'C')),
  },
  'CS 3306': {
    expectedText: 'Grade of C or better in CS 2411 and MATH 2305',
    prerequisites: all(course('CS 2411', 'C'), course('MATH 2305', 'C')),
  },
  'CS 3321': {
    expectedText: 'C or better in CS 3304',
    prerequisites: course('CS 3304', 'C'),
  },
  'CS 4303': {
    expectedText: 'Grade of C or better in CS 3304 and CS 3306.',
    prerequisites: all(course('CS 3304', 'C'), course('CS 3306', 'C')),
  },
  'CS 4315': {
    expectedText: 'Grade of C or better in CS 2301 and CS 3304.',
    prerequisites: all(course('CS 2301', 'C'), course('CS 3304', 'C')),
  },
  'CS 4318': {
    expectedText: 'Grade of C or better in CS 3304.',
    prerequisites: course('CS 3304', 'C'),
  },
  'CS 4395': {
    expectedText: 'A grade of B or better in CS 4294, GPA of 3.0 or above, senior standing, and department approval.',
    prerequisites: all(course('CS 4294', 'B'), condition('GPA of 3.0 or above'),
      condition('senior standing', 'standing'), condition('department approval', 'permission')),
  },
}

// Additional manual review on 2026-09-30 using cached September 27 panels.
// Each entry spells out its source text; this is not an automatic prose parser.
const add = (codes: string[], expectedText: string, prerequisites: Prerequisite) => {
  for (const code of codes) {
    if (reviews[code]) throw new Error(`Duplicate prerequisite review: ${code}`)
    reviews[code] = { expectedText, prerequisites }
  }
}
const c = (code: string) => course(code, 'C')
const placement = condition('placement by exam taken at UH-Downtown', 'placement')
const permission = condition('department approval', 'permission')

add(['CS 1311'], 'MATH 1300 or placement by exam.', any(course('MATH 1300'), condition('placement by exam', 'placement')))
add(['CS 1408', 'CS 1410', 'CS 1412'],
  'Credit or enrollment in MATH 1404 or MATH 1505 or MATH 1306; and placement in ENG 1301 or above.',
  all(any(...['MATH 1404', 'MATH 1505', 'MATH 1306'].map(code => course(code, undefined, 'before-or-concurrent'))),
    condition('placement in ENG 1301 or above', 'placement')))
add(['CS 1411'], 'Credit or enrollment in MATH 1404 or MATH 1505.',
  any(course('MATH 1404', undefined, 'before-or-concurrent'), course('MATH 1505', undefined, 'before-or-concurrent')))
add(['CS 2301'], 'Grade of C or better in CS 1411 or CS 1408.', any(c('CS 1411'), c('CS 1408')))
add(['CS 2311'], 'Grade C or better in CS 1411.', c('CS 1411'))
add(['CS 2410'], 'Grade of C or better in CS 1410 and credit or enrollment in MATH 2401.',
  all(c('CS 1410'), course('MATH 2401', undefined, 'before-or-concurrent')))
add(['CS 3300', 'CS 3310'], 'Grade of C or better in CS 2411.', c('CS 2411'))
add(['CS 3305', 'CS 4337'], 'C or better in CS 2411.', c('CS 2411'))
add(['CS 3301'], 'C or better in both MATH 2305 and CS 2411.', all(c('MATH 2305'), c('CS 2411')))
add(['CS 3307', 'CS 4313'], 'C or better in CS 3318.', c('CS 3318'))
add(['CS 3318'], 'Grade of C or better in CS 2411 and MATH 2305.', all(c('CS 2411'), c('MATH 2305')))
add(['CS 3319'], 'C or better in both CS 2301 and CS 2411.', all(c('CS 2301'), c('CS 2411')))
add(['CS 3324', 'CS 3325'], 'Grade of C or better in CS 2411 and CS 2302.', all(c('CS 2411'), c('CS 2302')))
add(['CS 3394'], 'Junior standing and departmental approval. Course may be repeated for credit with department approval.',
  all(condition('Junior standing', 'standing'), condition('departmental approval', 'permission')))
add(['CS 4294'], 'COMM 1304, TCOM 3302, senior standing and department approval.',
  all(course('COMM 1304'), course('TCOM 3302'), condition('senior standing', 'standing'), permission))
add(['CS 4300', 'CS 4332'], 'Grade of C or better in CS 3304.', c('CS 3304'))
add(['CS 4301'], 'CS 3308, MATH 2403 and MATH 3301.', all(course('CS 3308'), course('MATH 2403'), course('MATH 3301')))
add(['CS 4307'], 'C or better in CS 3301.', c('CS 3301'))
add(['CS 4308'], 'C or better in CS 4315.', c('CS 4315'))
add(['CS 4309'], 'C or better in TCOM 3302, senior standing, and department approval.',
  all(c('TCOM 3302'), condition('senior standing', 'standing'), permission))
add(['CS 4310'], 'Grade of C or better in CS 2411 and MATH 2307.', all(c('CS 2411'), c('MATH 2307')))
add(['CS 4311'], 'C or better in both CS 3318 and CS 3304.', all(c('CS 3318'), c('CS 3304')))
add(['CS 4317'], 'C or better in CS 3304 and MATH 2305.', all(c('CS 3304'), c('MATH 2305')))
add(['CS 4319'], 'A grade of C or better in CS 3304, and a grade of C or better in either STAT 3311 or MATH 3302',
  all(c('CS 3304'), any(c('STAT 3311'), c('MATH 3302'))))
add(['CS 4322'], 'Grade of C or better in CS 3304 and CS 3306.', all(c('CS 3304'), c('CS 3306')))
// Grade applies only to the completed-course route, not to concurrent enrollment.
add(['CS 4326'], 'C or better in CS 3324, or concurrent enrollment in CS 3324.',
  any(c('CS 3324'), course('CS 3324', undefined, 'concurrent')))
add(['CS 4328'], 'Grade of C or better in CS 2301 and CS 3304.', all(c('CS 2301'), c('CS 3304')))
add(['CS 4329'], 'CS 3304 or approval from the CSET department.',
  any(course('CS 3304'), condition('approval from the CSET department', 'permission')))
add(['CS 4340'], 'CS 3321', course('CS 3321'))
add(['CS 4380'], 'At least 60 semester hours, grade of B or better in CS 3304, CS 3306 and CS 2302 and approval of department chair.',
  all(condition('At least 60 semester hours', 'standing'), ...['CS 3304', 'CS 3306', 'CS 2302'].map(code => course(code, 'B')),
    condition('approval of department chair', 'permission')))
add(['CS 4390'], 'Department approval. Course may be repeated for credit with department approval.', permission)
add(['CS 4399'], 'Approval of department chair and dean.',
  all(condition('Approval of department chair', 'permission'), condition('Approval of dean', 'permission')))

const tsiLink = 'For current TSIA2 College Readiness scores, please see https://www.uhd.edu/testing/Pages/testing-tsia.aspx.'
add(['ENG 1301'], `A TSIA2 score meeting college readiness in Reading and Writing, or TSIA2 Reading and Writing complete, or TSIA2 Reading and Writing exempt. ${tsiLink}`,
  any(...['A TSIA2 score meeting college readiness in Reading and Writing', 'TSIA2 Reading and Writing complete', 'TSIA2 Reading and Writing exempt'].map(text => condition(text, 'placement'))))
add(['MATH 1300'], `A TSIA2 score that does not meet college readiness in Mathematics, and co-enrollment in MATH 1301 or MATH 1324. Successful completion of MATH 1301 or MATH 1324 (with a C or better) will satisfy the TSI requirements for developmental mathematics. ${tsiLink}`,
  all(condition('A TSIA2 score that does not meet college readiness in Mathematics', 'placement'),
    any(course('MATH 1301', undefined, 'concurrent'), course('MATH 1324', undefined, 'concurrent'))))
add(['MATH 1301', 'MATH 1324'], `A grade of C or better in MATH 1300, or TSIA2 score meeting college readiness in Mathematics, or TSIA2 MATH complete, or TSIA2 MATH exempt. ${tsiLink}`,
  any(c('MATH 1300'), ...['TSIA2 score meeting college readiness in Mathematics', 'TSIA2 MATH complete', 'TSIA2 MATH exempt'].map(text => condition(text, 'placement'))))
add(['MATH 1302', 'MATH 1305'], 'A grade of C or better in MATH 1301 or placement by exam taken at UH-Downtown.', any(c('MATH 1301'), placement))
add(['MATH 1306'], 'A grade of C or better in MATH 1301 or MATH 1305 or placement by exam taken at UH-Downtown.', any(c('MATH 1301'), c('MATH 1305'), placement))
add(['MATH 1404'], 'A grade of C or better in MATH 1302 or placement by exam taken at UH-Downtown.', any(c('MATH 1302'), placement))
add(['MATH 1505'], 'A grade of B or better in MATH 1301.', course('MATH 1301', 'B'))
add(['MATH 2305', 'MATH 2401'], 'A grade of C or better in MATH 1404 or in MATH 1505 or placement by exam taken at UH-Downtown.', any(c('MATH 1404'), c('MATH 1505'), placement))
add(['MATH 2307'], 'A grade of C or better in MATH 2401 or MATH 2305 or MATH 2409.', any(c('MATH 2401'), c('MATH 2305'), c('MATH 2409')))
add(['MATH 2402'], 'A grade of C or better in MATH 2401 or MATH 2411.', any(c('MATH 2401'), c('MATH 2411')))
add(['MATH 2403'], 'A grade of C or better in MATH 2402.', c('MATH 2402'))
add(['MATH 2409'], 'A grade of C or better in MATH 2401 or MATH 2411 or MATH 2421.', any(c('MATH 2401'), c('MATH 2411'), c('MATH 2421')))
add(['MATH 2411'], 'A grade of C or better inMATH 1404 or MATH 1505 or placement by exam taken at UH-Downtown.', any(c('MATH 1404'), c('MATH 1505'), placement))
add(['MATH 2412'], 'A grade of C or better in MATH 2411 or MATH 2401.', any(c('MATH 2411'), c('MATH 2401')))
add(['MATH 2421'], 'Grade of C or better in MATH 1404 or in MATH 1505 or placement by exam taken at UH-Downtown.', any(c('MATH 1404'), c('MATH 1505'), placement))
add(['MATH 2422'], 'Grade of C or higher in either MATH 2421 or MATH 2402.', any(c('MATH 2421'), c('MATH 2402')))
add(['MATH 3301'], 'A grade of C or better in MATH 2412, or in MATH 2422, or in both MATH 2307 and MATH 2402.',
  any(c('MATH 2412'), c('MATH 2422'), all(c('MATH 2307'), c('MATH 2402'))))
add(['MATH 3302'], 'A grade of C or better in MATH 2402 or MATH 2421.', any(c('MATH 2402'), c('MATH 2421')))
add(['STAT 3310'], 'A grade of C or better in STAT 3309 or STAT 3311 or department approval.', any(c('STAT 3309'), c('STAT 3311'), permission))
add(['STAT 3311'], 'A grade of C or better in MATH 1404 or MATH 1505.', any(c('MATH 1404'), c('MATH 1505')))
add(['PHYS 2401'], 'Credit in MATH 2402 (or MATH 2412) enrollment in PHYS 2101.',
  all(any(course('MATH 2402'), course('MATH 2412')), course('PHYS 2101', undefined, 'concurrent')))
add(['PHYS 2402'], 'Grade of C or better in PHYS 2401 and credit or enrollment in PHYS 2102.',
  all(c('PHYS 2401'), course('PHYS 2102', undefined, 'before-or-concurrent')))
add(['PHYS 2101'], 'Credit or enrollment in PHYS 2401.', course('PHYS 2401', undefined, 'before-or-concurrent'))
add(['PHYS 2102'], 'Credit or enrollment in PHYS 2402.', course('PHYS 2402', undefined, 'before-or-concurrent'))

export const unresolvedPrerequisiteReasons: Record<string, string> = {
  'COMM 1304': 'No prerequisite statement published in captured panel.',
  'CS 1313': 'No prerequisite statement published in captured panel.',
  'CS 3308': 'Mixed OR and comma-separated courses: preserve text until grouping is confirmed.',
  'CS 3331': 'EET 2331/EET2131 alternative is absent from this edition; slash grouping is unresolved.',
  'CS 4306': 'Mixed OR/AND without explicit grouping; preserve text until grouping is confirmed.',
  'CS 4396': 'Permission wording refers to CS 4395; description says thesis continues that research. Timing needs clarification.',
  'STAT 3309': 'Mixed AND/OR without explicit grouping; preserve text until grouping is confirmed.',
}

export function applyPrerequisiteReviews(courses: Course[], catalogYear: string): Course[] {
  if (catalogYear !== year) return courses
  return courses.map(c => {
    const review = reviews[c.code]
    if (!review) return c
    if (c.catalogYear !== year || c.prerequisiteText !== review.expectedText)
      throw new Error(`Prerequisite source changed; re-review ${c.code}`)
    return { ...c, prerequisites: structuredClone(review.prerequisites), review: 'verified' }
  })
}
