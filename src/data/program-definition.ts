import type { CatalogDataset } from './catalog-schema.ts'
import { PLAN_KEY } from './plan-state.ts'

export type ProgramDefinition = {
  id: string; title: string; shortTitle: string; exportSlug: string; catalogYear: string
  firstCourseId: string; defaultRequirementIds: string[]; defaultCourseIds: string[]
  supportingRequirementIds: string[]; electiveRequirementIds: string[]
  supportingDescription: string; starterDescription: string; coverageDescription: string
  sourceUrl: string; minimumCredits: number
  minorPlaceholders: { id: string; title: string; subtitle: string }[]
}

// The original CS key must remain unchanged: existing browser saves need no migration.
export function programStorageKey(programId: string, year: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(programId) || !/^\d{4}-\d{4}$/.test(year)) throw new Error('Invalid program identity')
  return programId === 'cs-bs' && year === '2025-2026' ? PLAN_KEY : `uhd-planner-plan-v1:${year}:${programId}`
}

// Fail closed when a program is wired to the wrong edition or incomplete records.
export function programStarterIds(program: ProgramDefinition, catalog: CatalogDataset) {
  if (program.catalogYear !== catalog.catalogYear) throw new Error('Program catalog edition mismatch')
  const courseIds = new Set(catalog.courses.map(course => course.id))
  const groups = new Map(catalog.requirements.map(group => [group.id, group]))
  for (const id of [...program.defaultRequirementIds, ...program.supportingRequirementIds, ...program.electiveRequirementIds])
    if (!groups.has(id)) throw new Error(`Missing program requirement: ${id}`)
  const ids = new Set([...program.defaultRequirementIds.flatMap(id => groups.get(id)!.courseIds), ...program.defaultCourseIds])
  for (const id of [...ids, program.firstCourseId]) if (!courseIds.has(id)) throw new Error(`Missing program course: ${id}`)
  return ids
}

export const computerScience: ProgramDefinition = {
  minorPlaceholders: [{ id: 'math-minor', title: 'Mathematics', subtitle: '18-hour minimum - reviewed choices in the minor area' }, { id: 'data-minor', title: 'Data Science', subtitle: '22/23 hours - required courses and choices in the minor area' }],
  id: 'cs-bs', title: 'Computer Science BS', shortTitle: 'Computer Science', exportSlug: 'cs', catalogYear: '2025-2026',
  firstCourseId: '2025-2026:CS 1411', defaultRequirementIds: ['cs-required', 'support-writing', 'support-math'],
  defaultCourseIds: ['2025-2026:CS 4395'], supportingRequirementIds: ['support-statistics', 'support-science'],
  electiveRequirementIds: ['cs-elective-upper', 'cs-elective-additional'], minimumCredits: 120,
  supportingDescription: 'Statistics options and the captured physics pathway · Use + to include a course in planned hours',
  starterDescription: 'The starter plan contains required courses and CS 4395. Supporting choices, electives, core options and minors are not added to the total until selected. No completed courses are assumed.',
  coverageDescription: 'Science options currently cover the physics pathway. Minor cards include required and reviewed choices; all 47 indexed MATH courses at 2000+ are imported (including one zero-credit course). All nine DATA catalog courses are imported. Minor grade, residency and overlap fulfillment need review.',
  sourceUrl: 'https://catalog.uhd.edu/preview_program.php?catoid=37&poid=7111',
}
