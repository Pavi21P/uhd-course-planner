import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDraft } from './catalog-import.ts'
import { catalogSnapshotSchema } from '../src/data/catalog-snapshot.ts'

export function prepareSnapshot({ draft, report }: Awaited<ReturnType<typeof buildDraft>>) {
  const requiredGroups = ['cs-required', 'cs-writing-project', 'support-writing', 'support-math', 'support-statistics', 'support-science']
  for (const id of requiredGroups) if (!draft.requirements.some(r => r.id === id)) throw new Error(`Missing required group: ${id}`)
  const expectedRequired = ['CS 1411', 'CS 2301', 'CS 2302', 'CS 2411', 'CS 3304', 'CS 3306', 'CS 3321', 'CS 4294', 'CS 4303', 'CS 4315', 'CS 4318', 'CS 4395',
    'TCOM 3302', 'MATH 2305', 'MATH 2401', 'MATH 2402', 'MATH 2307', 'STAT 3311', 'MATH 3302', 'PHYS 2401', 'PHYS 2101', 'PHYS 2402', 'PHYS 2102']
  for (const code of expectedRequired) {
    const course = draft.courses.find(c => c.code === code)
    if (!course || course.review !== 'verified') throw new Error(`Unresolved required course: ${code}`)
  }
  // COMM 1304 has a complete official panel but no published prerequisite line.
  // Preserve that observed absence as an unknown condition; never claim "none".
  const speech = draft.courses.find(c => c.code === 'COMM 1304')
  if (!speech || speech.prerequisiteText !== '' || speech.prerequisites.kind !== 'condition' || speech.review !== 'needs-review')
    throw new Error('Speech source exception requires re-review')
  if (report.requiredCsCredits !== 37 || report.degreeBudget?.uniqueRequirementHours !== 116 || report.physicsPathBudget?.uniqueRequirementHours !== 118)
    throw new Error('Degree reconciliation changed')
  const core = draft.requirements.filter(r => r.area === 'core')
  if (core.length !== 10 || core.reduce((sum, r) => sum + (r.minimumCredits ?? 0), 0) !== 42) throw new Error('Incomplete core requirements')
  if (report.mandatoryPrerequisiteCycles.length) throw new Error('Unresolved prerequisite cycle')
  return catalogSnapshotSchema.parse({ snapshotVersion: 1, scope: 'cs-planning-catalog',
    catalog: { ...draft, datasetVersion: '2025-2026-planning-2026-09-30' }, coursePolicies: report.coursePolicies,
    coverage: { automaticEligibilityAssessment: false, minorCoursesIncluded: false,
      unresolvedPrerequisites: report.prerequisiteReviewIssues.map(i => ({ courseId: `${draft.catalogYear}:${i.code}`, reason: i.reason })),
      unimportedOptionCodes: report.unimportedRequirementOptions,
      notices: [
        'Seven courses have absent or unresolved prerequisite statements; their original wording is retained and no automatic prerequisite edges are created for them.',
        'Core choice names without imported descriptions cannot be selected as course cards or counted for credit.',
        'Laboratory-science choices currently cover the Physics I/II lecture-and-laboratory pathway. Other laboratory-science options remain unconfigured.',
        'Writing-course substitution needs approval. Permission, placement, transfer articulation and graduation eligibility are not automatically determined.',
        'Mathematics and Data Science minor course areas will be populated in the minor checkpoint.',
      ] } })
}

export async function writeCatalogSnapshot(target: string, input: Awaited<ReturnType<typeof buildDraft>>) {
  // Complete validation before touching the current snapshot. One atomic rename
  // means malformed refreshes preserve the previous usable offline artifact.
  const snapshot = prepareSnapshot(input)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(`${target}.tmp`, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
  await rename(`${target}.tmp`, target)
  return snapshot
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const snapshot = await writeCatalogSnapshot(resolve(root, 'src/data/catalog-2025-2026.json'), await buildDraft(root))
  console.log(`Offline planning catalog: ${snapshot.catalog.courses.length} courses, ${snapshot.catalog.requirements.length} requirement groups. Coverage notices retained.`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch(error => { console.error(error.message); process.exitCode = 1 })
