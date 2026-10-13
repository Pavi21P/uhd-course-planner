import type { Course, Prerequisite } from '../src/data/catalog-schema.ts'
import { applyPrerequisiteReviews } from './prerequisite-reviews.ts'

const year = '2025-2026'
const course = (code: string, timing: 'before' | 'before-or-concurrent' | 'concurrent' = 'before', minimumGrade?: string): Prerequisite =>
  ({ kind: 'course', courseId: `${year}:${code}`, timing, ...(minimumGrade ? { minimumGrade } : {}) })
const all = (...items: Prerequisite[]): Prerequisite => ({ kind: 'all', items })
const any = (...items: Prerequisite[]): Prerequisite => ({ kind: 'any', items })
const condition = (text: string, category: 'other' | 'permission' = 'other'): Prerequisite => ({ kind: 'condition', category, text })
const concurrent = (code: string) => course(code, 'concurrent')
const creditOrEnrollment = (code: string) => course(code, 'before-or-concurrent')
const c = (code: string) => course(code, 'before', 'C')

// Manually reviewed against the captured catalog-37 panels on October 12, 2026.
// Every review is bound to normalized exact text; edits require another review.
const reviews: Record<string, { expectedText: string; prerequisites: Prerequisite }> = {}
const add = (code: string, expectedText: string, prerequisites: Prerequisite) => {
  if (reviews[code]) throw new Error(`Duplicate Chemistry review: ${code}`)
  reviews[code] = { expectedText, prerequisites }
}
for (const code of ['TCOM 3325', 'TCOM 3326', 'TCOM 3329', 'TCOM 4306'])
  add(code, 'Prerequisite: 010 core complete and 040 core complete.', all(condition('010 core complete'), condition('040 core complete')))
add('BIOL 1101', 'Credit or enrollment in BIOL 1301.', creditOrEnrollment('BIOL 1301'))
add('BIOL 1302', 'BIOL 1101, BIOL 1301 and enrollment in BIOL 1102.', all(course('BIOL 1101'), course('BIOL 1301'), concurrent('BIOL 1102')))
add('BIOL 1102', 'BIOL 1101 and credit or enrollment in BIOL 1302.', all(course('BIOL 1101'), creditOrEnrollment('BIOL 1302')))
add('CHEM 1107', 'Credit or enrollment in CHEM 1307.', creditOrEnrollment('CHEM 1307'))
add('CHEM 1308', 'A grade of C or better in CHEM 1307 and credit or enrollment in CHEM 1108.', all(c('CHEM 1307'), creditOrEnrollment('CHEM 1108')))
add('CHEM 1108', 'CHEM 1107 and credit or enrollment in CHEM 1308.', all(course('CHEM 1107'), creditOrEnrollment('CHEM 1308')))
add('CHEM 2301', 'A grade of C or better in CHEM 1308 and CHEM 1108. Enrollment in CHEM 2101 is recommended.', all(c('CHEM 1308'), c('CHEM 1108')))
add('CHEM 2101', 'A letter grade of C or better in CHEM 2301 or enrollment in CHEM 2301.', any(c('CHEM 2301'), concurrent('CHEM 2301')))
add('CHEM 2102', 'A letter grade of C or better in CHEM 2302 or enrollment in CHEM 2302.', any(c('CHEM 2302'), concurrent('CHEM 2302')))
add('PHYS 1307', 'Credit or enrollment in MATH 1302 or the equivalent, enrollment in PHYS 1107.', all(any(creditOrEnrollment('MATH 1302'), condition('Equivalent to MATH 1302')), concurrent('PHYS 1107')))
add('PHYS 1107', 'Credit or enrollment in PHYS 1307.', creditOrEnrollment('PHYS 1307'))
add('PHYS 1308', 'PHYS 1307 and credit or enrollment in PHYS 1108.', all(course('PHYS 1307'), creditOrEnrollment('PHYS 1108')))
add('PHYS 1108', 'Credit or enrollment in PHYS 1308.', creditOrEnrollment('PHYS 1308'))
add('CHEM 3300', 'Approval by the Natural Sciences Department, minimum GPA of 2.0, and permission of instructor.', all(condition('Approval by the Natural Sciences Department', 'permission'), condition('Minimum GPA of 2.0'), condition('Permission of instructor', 'permission')))
add('CHEM 3310', 'CHEM 1308 and CHEM 1108 and credit or enrollment in CHEM 3110.', all(course('CHEM 1308'), course('CHEM 1108'), creditOrEnrollment('CHEM 3110')))
add('CHEM 3110', 'Credit or enrollment in CHEM 3310.', creditOrEnrollment('CHEM 3310'))
add('CHEM 3320', 'BIOL 1302 and BIOL 1102; and CHEM 1308 and CHEM 1108.', all(course('BIOL 1302'), course('BIOL 1102'), course('CHEM 1308'), course('CHEM 1108')))
add('CHEM 3130', 'Credit for or enrollment in CHEM 3330.', creditOrEnrollment('CHEM 3330'))
add('CHEM 3132', 'Credit for or enrollment in CHEM 3332.', creditOrEnrollment('CHEM 3332'))
add('CHEM 4340', 'BIOL 1102 and BIOL 1302 and CHEM 2101 and CHEM 2301.', all(course('BIOL 1102'), course('BIOL 1302'), course('CHEM 2101'), course('CHEM 2301')))
add('CHEM 4140', 'Credit or enrollment in CHEM 4340.', creditOrEnrollment('CHEM 4340'))
add('CHEM 4162', 'Credit or enrollment in CHEM 4362.', creditOrEnrollment('CHEM 4362'))
add('CHEM 4164', 'Corequisite(s): CHEM 4364', concurrent('CHEM 4364'))

export const chemistryUnresolvedReasons: Record<string, string> = {
  'BIOL 1301': 'Scope of credit-or-enrollment across the comma-separated list and English/core alternative needs clarification.',
  'CHEM 1307': 'Timing and AND/OR scope of English/core and high-school chemistry versus CHEM 1305/1105 need clarification; preparatory alternatives are not yet captured.',
  'CHEM 2302': 'The source labels requirements as prerequisites/corequisites without specifying timing. CHEM 2102 is only recommended.',
  'CHEM 3330': 'Slash-separated organic lecture/lab and one year of general physics need explicit interpretation.',
  'CHEM 3332': 'Two numbered alternatives are explicit, but the slash-separated organic pair and general-physics equivalence remain unresolved.',
  'CHEM 4410': 'Slash-separated CHEM 3310/CHEM 3110 does not explicitly state AND or OR.',
  'CHEM 4362': 'Slash-separated physical chemistry lecture/lab pairs need explicit interpretation.',
  'CHEM 4364': 'CHEM 4164 is an explicit corequisite, but CHEM 2301/CHEM 2101 slash grouping remains unresolved; retain the full text without partial graph edges.',
}

export function reviewChemistryPrerequisites(courses: Course[]): Course[] {
  if (courses.some(course => course.catalogYear !== year)) throw new Error('Chemistry review requires catalog 2025-2026')
  return applyPrerequisiteReviews(courses, year).map(course => {
    const review = reviews[course.code]
    if (!review) {
      if (course.review !== 'verified' && !chemistryUnresolvedReasons[course.code]) throw new Error(`Missing Chemistry review: ${course.code}`)
      return course
    }
    if (course.prerequisiteText !== review.expectedText) throw new Error(`Prerequisite source changed; re-review ${course.code}`)
    return { ...course, prerequisites: structuredClone(review.prerequisites), review: 'verified' }
  })
}
