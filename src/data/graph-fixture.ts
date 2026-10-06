import { datasetSchema, type Course, type Prerequisite } from './catalog-schema.ts'

const catalogYear = '2026-2027'
const id = (code: string) => `${catalogYear}:${code}`
const ref = (code: string): Prerequisite => ({ kind: 'course', courseId: id(code), timing: 'before' })
const course = (code: string, prerequisites: Prerequisite = { kind: 'none' }): Course => ({
  id: id(code), catalogYear, code, title: `Synthetic ${code}`, description: 'Development fixture; not a UHD course.',
  credits: { min: 3, max: 3 }, prerequisiteText: 'Synthetic scenario only.', prerequisites,
  review: 'synthetic', sourceIds: ['fixture'],
})

// A -> B -> C; B -> D; C and D -> E; A or D -> F; G co-enrolls with F.
// EL, M and DS stay isolated. They are not prerequisites in this fixture.
export const graphFixture = datasetSchema.parse({
  schemaVersion: 1, datasetVersion: 'fixture-1', catalogYear, synthetic: true,
  sources: [{ id: 'fixture', title: 'Synthetic graph cases', url: 'https://example.invalid/fixture',
    catalogYear, retrievedOn: '2026-09-26', role: 'fixture' }],
  courses: [course('TEST A'), course('TEST B', ref('TEST A')), course('TEST C', ref('TEST B')),
    course('TEST D', ref('TEST B')), course('TEST E', { kind: 'all', items: [ref('TEST C'), ref('TEST D')] }),
    course('TEST F', { kind: 'any', items: [ref('TEST A'), ref('TEST D')] }),
    course('TEST G', { kind: 'course', courseId: id('TEST F'), timing: 'before-or-concurrent' }),
    course('TEST EL'), course('TEST M'), course('TEST DS')],
  requirements: [
    { id: 'major', programId: 'test-cs', label: 'Main fixture', area: 'major', rule: 'all',
      courseIds: ['A','B','C','D','E','F','G'].map(c => id(`TEST ${c}`)), constraints: [], sourceIds: ['fixture'] },
    ...[['elective','EL'], ['math','M'], ['data-science','DS']].map(([program, code]) => ({
      id: program, programId: `test-${program}`, label: `Synthetic ${program}`, area: program === 'elective' ? 'elective' : 'minor',
      rule: 'choose-courses', count: 1, courseIds: [id(`TEST ${code}`)], constraints: [], sourceIds: ['fixture'],
    })),
  ],
})
