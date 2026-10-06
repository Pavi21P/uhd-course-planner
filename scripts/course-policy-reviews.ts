import { createHash } from 'node:crypto'
import type { Course, Prerequisite } from '../src/data/catalog-schema.ts'
import type { CoursePolicy } from '../src/data/credit-allocation.ts'

// Reviewed 2026-09-30 against the cached catalog 37 panels. These are allocation
// rules for the next checkpoint, not a claim that a chosen plan fulfills a degree.
type Policy = CoursePolicy
const hashes: Record<string, string> = {
  'CS 3324': 'b0a29319c4eaa5e8c77136c5d6770f8035f331cfb7e5b49e5d22c9dcafad22c7',
  'CS 3394': 'e907157e5d9decc568d322b032da613d1d221ed59a43ee4a951f04f015efc312',
  'CS 4301': 'f7d5b4aa8c16f0051d330e9918bdeff3c389bf5bbe9a482fe66e35781c61e066',
  'CS 4306': 'fdf00c21da074a6f6fa8b2642a466279ff1d0038b95459bddab28591bab34729',
  'CS 4328': 'ffae5c09b0ae7aa3ee8a73dd23480355633371cc7794620c6c2eb605a7847ae8',
  'CS 4340': 'b901ad40f25e5c2f5062429341401dc4c17176c616ae99cf4b602956b94c648c',
  'MATH 1300': '247c13eeb43b7cd451552bb527d27329ae6eaa29a28cf034f1d38e971e7b40f1',
  'MATH 3302': '24c3bc1b51b19c393f3c011cf851e2ce8474010896e413092968dc6c12283ecf',
  'STAT 3309': '6eddb7c1c96c88e5b058534eb34037dc337648a289df0d657ba00b3fc75164c6',
}

export function reviewCoursePolicies(courses: Course[], catalogYear: string): Policy[] {
  if (catalogYear !== '2025-2026') return []
  const byCode = new Map(courses.map(c => [c.code, c]))
  const get = (code: string) => {
    const course = byCode.get(code)
    if (!course || course.catalogYear !== catalogYear) throw new Error(`Missing policy source: ${code}`)
    return course
  }
  for (const [code, expected] of Object.entries(hashes)) {
    const actual = createHash('sha256').update(get(code).description).digest('hex')
    if (actual !== expected) throw new Error(`Course policy source changed; re-review ${code}`)
  }
  const policies: Policy[] = []
  const add = (id: string, kind: Policy['kind'], codes: string[], text: string, additionalConditions?: Prerequisite) => {
    policies.push({ id, kind, courseIds: codes.map(code => get(code).id), text,
      sourceIds: [...new Set(codes.flatMap(code => get(code).sourceIds))],
      ...(additionalConditions ? { additionalConditions } : {}) })
  }
  add('no-degree-credit-math-1300', 'degree-credit-exclusion', ['MATH 1300'], 'MATH 1300 may not satisfy degree requirements; its published hours are not degree-applicable hours.')
  add('no-upper-cs-elective-3394', 'requirement-exclusion', ['CS 3394'], 'CS 3394 cannot fulfill the upper-level CS elective requirement. Other uses are not decided by this exclusion.')
  add('statistics-exclusive-credit', 'mutually-exclusive-credit', ['MATH 3302', 'STAT 3309'], 'Credit may not be earned for both MATH 3302 and STAT 3309.')
  for (const code of ['CS 3324', 'CS 4301', 'CS 4306', 'CS 4328', 'CS 4340']) {
    const seminar: Prerequisite = { kind: 'course', courseId: get('CS 4294').id, timing: 'before' }
    add(`writing-use-${code.replace(' ', '-').toLowerCase()}`, 'conditional-writing-use', [code],
      'May fulfill the writing application requirement only with the additional conditions; ordinary enrollment alone does not establish writing credit.',
      code === 'CS 4340' ? seminar : { kind: 'all', items: [seminar, { kind: 'condition', category: 'permission', text: 'department approval' }] })
  }
  for (const [code, expected] of [
    ['CS 3394', 'Junior standing and departmental approval. Course may be repeated for credit with department approval.'],
    ['CS 4390', 'Department approval. Course may be repeated for credit with department approval.'],
  ]) {
    if (get(code).prerequisiteText !== expected) throw new Error(`Repeatability source changed; re-review ${code}`)
    add(`repeat-${code.replace(' ', '-').toLowerCase()}`, 'repeatability', [code],
      'May be repeated for credit with department approval. No repeat limit or automatic duplicate-credit allowance is inferred.')
  }
  for (const [lecture, lab, alternative, sentence] of [
    ['PHYS 2401', 'PHYS 2101', 'PHYS 1307', 'Credit for both PHYS 1307 and PHYS 2401 may not be applied toward a degree.'],
    ['PHYS 2402', 'PHYS 2102', 'PHYS 1308', 'Credit for both PHYS 1308 and PHYS 2402 may not be applied toward a degree.'],
  ]) {
    // Full physics source is also hash-guarded by parseRequirementCapture.
    if (!get(lecture).description.endsWith(sentence)) throw new Error(`Physics credit source changed: ${lecture}`)
    policies.push({ id: `exclusive-${lecture.replace(' ', '-').toLowerCase()}`, kind: 'mutually-exclusive-credit',
      courseIds: [get(lecture).id, `${catalogYear}:${alternative}`], text: sentence, sourceIds: get(lecture).sourceIds })
    add(`lab-pair-${lecture.replace(' ', '-').toLowerCase()}`, 'laboratory-pair', [lecture, lab],
      `Allocate ${lecture} with ${lab} for laboratory-science planning; a lecture or laboratory alone is not a complete pair.`)
  }
  return policies
}
