import type { CatalogDataset, Course } from './catalog-schema.ts'
import { auditRequirementAssignments, calculatePlanCredits, type CoursePolicy } from './credit-allocation.ts'

type Assignment = { courseId: string; requirementId: string }
type AreaClaim = { courseId: string; areaId: string }
export type BiologyAllocationModel = {
  programId: string
  requirements: CatalogDataset['requirements']
  coursePolicies: CoursePolicy[]
  contentAreaConditions: { id: string; courseIds: string[]; minimumCourseCount: number }[]
  integratedConditions: { id: string; courseIds: string[]; count: number }[]
  allocationRestrictions: { code: string; incompatibleRequirementIds: string[]; reason: string }[]
}
export type BiologyAllocationInput = {
  selectedCourseIds: string[]
  assignments: Assignment[]
  areaClaims: AreaClaim[]
  // These must come from confirmed advising records, never inferred from selection.
  topicApprovals?: AreaClaim[]
  // Includes repeated enrollments and research outside the imported catalog pool.
  reportedTotalResearchCredits?: number
}

// A planning audit, not a degree-completion or prerequisite eligibility decision.
// Explicit area claims avoid automatically allocating a shared course everywhere.
export function auditBiologyAllocation(model: BiologyAllocationModel, courses: Course[], input: BiologyAllocationInput) {
  if (model.programId !== 'biology-bs') throw new Error('Biology allocation requires the Biology model')
  const byId = new Map(courses.map(c => [c.id, c]))
  const selected = new Set(input.selectedCourseIds)
  for (const id of selected) if (!byId.has(id)) throw new Error('Unknown selected Biology course: ' + id)
  const issues: { code: string; courseId?: string; requirementId?: string; message: string }[] = []
  const issue = (code: string, message: string, courseId?: string, requirementId?: string) => issues.push({ code, message, courseId, requirementId })
  const assignments = [...new Map(input.assignments.map(a => [JSON.stringify([a.courseId, a.requirementId]), a])).values()]
  for (const a of assignments) {
    if (!selected.has(a.courseId)) issue('unselected-assignment', 'An assigned course must be selected.', a.courseId, a.requirementId)
  }
  for (const a of auditRequirementAssignments(model.requirements, assignments, model.coursePolicies))
    issue('invalid-assignment', a.reason, a.courseId, a.requirementId)
  for (const restriction of model.allocationRestrictions) {
    const matches = assignments.filter(a => byId.get(a.courseId)?.code === restriction.code && restriction.incompatibleRequirementIds.includes(a.requirementId))
    if (new Set(matches.map(a => a.requirementId)).size > 1)
      for (const a of matches) issue('prohibited-overlap', restriction.reason, a.courseId, a.requirementId)
  }
  const poolId = 'biology-upper-options'
  const pool = model.requirements.find(r => r.id === poolId)
  if (!pool || pool.minimumCredits === undefined) throw new Error('Missing Biology upper-level pool')
  const poolIds = new Set(assignments.filter(a => a.requirementId === poolId).map(a => a.courseId))
  const highImpact = new Set(assignments.filter(a => a.requirementId === 'biology-high-impact').map(a => a.courseId))
  for (const id of poolIds) if (highImpact.has(id) && !issues.some(i => i.code === 'prohibited-overlap' && i.courseId === id))
    issue('overlap-review', 'High-impact/CURE use in the upper-level pool requires advising review.', id, poolId)
  const claims = [...new Map(input.areaClaims.map(c => [JSON.stringify([c.courseId, c.areaId]), c])).values()]
  const validClaims: AreaClaim[] = []
  const topicIds = new Set(model.coursePolicies.filter(p => p.id === 'biology-special-topics-approval').flatMap(p => p.courseIds))
  for (const claim of claims) {
    const area = model.contentAreaConditions.find(a => a.id === claim.areaId)
    if (!area || !area.courseIds.includes(claim.courseId) || !poolIds.has(claim.courseId) || !selected.has(claim.courseId)) {
      issue('invalid-area-claim', 'Area claims require a selected, assigned option listed in that area.', claim.courseId, claim.areaId)
      continue
    }
    if (topicIds.has(claim.courseId) && !input.topicApprovals?.some(a => a.courseId === claim.courseId && a.areaId === claim.areaId)) {
      issue('topic-approval-required', 'Special Topics needs approval for this specific area.', claim.courseId, claim.areaId)
      continue
    }
    validClaims.push(claim)
  }
  for (const id of poolIds) {
    if (topicIds.has(id) && !validClaims.some(c => c.courseId === id))
      issue('topic-approval-required', 'Special Topics has no approved valid area allocation.', id, poolId)
    if (new Set(validClaims.filter(c => c.courseId === id).map(c => c.areaId)).size > 1)
      issue('area-overlap-review', 'Using one course in multiple content areas requires review.', id, poolId)
  }
  const selectedCredits = calculatePlanCredits(courses, [...selected], model.coursePolicies)
  for (const conflict of selectedCredits.conflicts)
    for (const id of conflict.courseIds) issue('credit-conflict', conflict.message, id)
  const areas = model.contentAreaConditions.map(area => {
    const candidates = validClaims.filter(c => c.areaId === area.id).map(c => c.courseId)
    const hasIssue = issues.some(i => candidates.includes(i.courseId ?? '') || i.requirementId === area.id)
    return { id: area.id, candidateCourseIds: candidates, minimumCourseCount: area.minimumCourseCount,
      status: hasIssue ? 'review-required' as const : candidates.length >= area.minimumCourseCount ? 'candidates-identified' as const : 'missing' as const }
  })
  const integrated = model.integratedConditions.map(condition => {
    const candidates = condition.courseIds.filter(id => selected.has(id))
    return { id: condition.id, candidateCourseIds: candidates, requiredCount: condition.count,
      status: candidates.some(id => issues.some(i => i.code === 'credit-conflict' && i.courseId === id)) ? 'review-required' as const
        : candidates.length >= condition.count ? 'candidates-identified' as const : 'missing' as const }
  })
  const researchPolicy = model.coursePolicies.find(p => p.id === 'biology-research-limit')
  if (!researchPolicy) throw new Error('Missing Biology research policy')
  const researchIds = [...selected].filter(id => researchPolicy.courseIds.includes(id))
  const researchCredits = calculatePlanCredits(courses, researchIds, []).catalogCredits
  const reported = input.reportedTotalResearchCredits
  if (reported !== undefined && (!Number.isFinite(reported) || reported < researchCredits.min))
    throw new Error('Reported research credits must be finite and cover selected research credits')
  const researchStatus = (reported ?? researchCredits.min) > 6 ? 'over-limit' as const
    : reported === undefined ? 'review-required' as const : 'within-reported-limit' as const
  if (researchStatus !== 'within-reported-limit') issue('research-' + researchStatus,
    researchStatus === 'over-limit' ? 'At most six research credits may count toward the degree.' : 'Confirm total research credits including repeats and courses outside the imported pool.')
  // No countable pool total is asserted while assignment, approval or overlap conflicts remain.
  const poolHasIssues = issues.some(i => i.code !== 'research-review-required' && i.code !== 'research-over-limit' &&
    (i.requirementId === poolId || poolIds.has(i.courseId ?? '')))
  const poolCredits = poolHasIssues ? null : calculatePlanCredits(courses, [...poolIds], model.coursePolicies).degreeCredits
  return {
    issues, areas, integrated, selectedCredits,
    upperLevelPool: { requiredCredits: pool.minimumCredits, provisionalCredits: poolCredits,
      reachesCreditMinimum: poolCredits !== null && poolCredits.min >= pool.minimumCredits,
      groupingReviewRequired: true as const },
    research: { knownSelectedCredits: researchCredits, reportedTotalCredits: reported ?? null, maximumDegreeCredits: 6, status: researchStatus },
    automaticEligibilityAssessment: false as const,
    notices: ['Candidate coverage is not requirement completion. Lecture/lab grouping and the MBIO 3320 OR MBIO 4340 with MBIO 4140 sequence still require review.',
      'Integrated and content-area conditions add no credits. Unique selected credits are not approved degree allocations.',
      'Research totals are caller-reported; repeats and other research courses are not inferred. Grades, residency and prerequisites are not assessed.'],
  }
}
