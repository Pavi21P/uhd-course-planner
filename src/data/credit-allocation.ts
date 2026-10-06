import type { CatalogDataset, Course, Prerequisite } from './catalog-schema.ts'

export type CoursePolicy = {
  id: string
  kind: 'degree-credit-exclusion' | 'requirement-exclusion' | 'mutually-exclusive-credit' | 'conditional-writing-use' | 'repeatability' | 'laboratory-pair'
  courseIds: string[]
  text: string
  sourceIds: string[]
  additionalConditions?: Prerequisite
}

// Planned credits only. No completion, grades, transfer articulation, permission,
// residency or graduation eligibility is inferred from a selection.
export function calculatePlanCredits(courses: Course[], selectedIds: string[], policies: CoursePolicy[], degreeMinimum = 120) {
  if (!Number.isFinite(degreeMinimum) || degreeMinimum < 0) throw new Error('Invalid degree minimum')
  const byId = new Map(courses.map(c => [c.id, c]))
  const selected = [...new Set(selectedIds)].map(id => {
    const course = byId.get(id)
    if (!course) throw new Error(`Unknown selected course: ${id}`)
    return course
  })
  const selectedSet = new Set(selected.map(c => c.id))
  const excluded = new Set(policies.filter(p => p.kind === 'degree-credit-exclusion').flatMap(p => p.courseIds))
  const conflicts = policies.filter(p => p.kind === 'mutually-exclusive-credit' && p.courseIds.filter(id => selectedSet.has(id)).length > 1)
    .map(p => ({ policyId: p.id, courseIds: p.courseIds.filter(id => selectedSet.has(id)), message: p.text }))
  const sum = (list: Course[]) => list.reduce((total, c) => ({ min: total.min + c.credits.min, max: total.max + c.credits.max }), { min: 0, max: 0 })
  const degreeCredits = conflicts.length ? null : sum(selected.filter(c => !excluded.has(c.id)))
  return { uniqueCourseCount: selected.length, catalogCredits: sum(selected), degreeCredits,
    excludedCourseIds: selected.filter(c => excluded.has(c.id)).map(c => c.id), conflicts,
    hoursToDegreeMinimum: degreeCredits ? { min: Math.max(0, degreeMinimum - degreeCredits.max), max: Math.max(0, degreeMinimum - degreeCredits.min) } : null }
}

export function auditRequirementAssignments(requirements: CatalogDataset['requirements'], assignments: { courseId: string; requirementId: string }[], policies: CoursePolicy[]) {
  const issues: { courseId: string; requirementId: string; reason: string }[] = []
  const csAllocation = new Map<string, Set<string>>()
  const csSlots = new Set(['cs-required', 'cs-writing-project', 'cs-elective-upper', 'cs-elective-additional'])
  for (const a of assignments) {
    const requirement = requirements.find(r => r.id === a.requirementId)
    const issue = (reason: string) => issues.push({ ...a, reason })
    if (!requirement) { issue('Unknown requirement.'); continue }
    if (a.requirementId !== 'free-electives' && !requirement.courseIds.includes(a.courseId)) issue('Not an imported choice for this requirement; review needed.')
    for (const p of policies.filter(p => p.courseIds.includes(a.courseId))) {
      if (p.kind === 'degree-credit-exclusion') issue(p.text)
      if (p.kind === 'requirement-exclusion' && a.requirementId === 'cs-elective-upper') issue(p.text)
      if (p.kind === 'conditional-writing-use' && a.requirementId === 'cs-writing-project') issue('Approved W-course use and additional conditions must be confirmed.')
    }
    if (csSlots.has(a.requirementId)) {
      const slots = csAllocation.get(a.courseId) ?? new Set<string>()
      slots.add(a.requirementId); csAllocation.set(a.courseId, slots)
    }
  }
  for (const [courseId, slots] of csAllocation)
    if (slots.size > 1) for (const requirementId of slots) issues.push({ courseId, requirementId, reason: 'One course cannot fill multiple distinct CS credit slots.' })
  const scienceIds = new Set(assignments.filter(a => a.requirementId === 'support-science').map(a => a.courseId))
  for (const p of policies.filter(p => p.kind === 'laboratory-pair')) {
    const selected = p.courseIds.filter(id => scienceIds.has(id))
    if (selected.length && selected.length !== p.courseIds.length)
      for (const courseId of selected) issues.push({ courseId, requirementId: 'support-science', reason: p.text })
  }
  return issues
}

export function reconcileDegreeBudget(requirements: CatalogDataset['requirements'], selectedScienceHours?: number) {
  const hours = (id: string) => {
    const requirement = requirements.find(r => r.id === id)
    if (requirement?.minimumCredits === undefined) throw new Error(`Missing requirement credit budget: ${id}`)
    return requirement.minimumCredits
  }
  const core = requirements.filter(r => r.area === 'core').reduce((sum, r) => sum + (r.minimumCredits ?? 0), 0)
  const science = selectedScienceHours ?? hours('support-science')
  if (!Number.isFinite(science) || science < hours('support-science')) throw new Error('Science hours below the laboratory-science minimum')
  const sections = { core, writing: hours('support-writing'), mathematics: hours('support-math') + hours('support-statistics'),
    computerScience: hours('cs-required') + hours('cs-writing-project') + hours('cs-elective-upper') + hours('cs-elective-additional'), laboratoryScience: science }
  const overlaps = { mathematicsCore: 3, scienceCore: 6 } // Catalog 37 degree page.
  const sectionHours = Object.values(sections).reduce((a, b) => a + b, 0)
  const uniqueRequirementHours = sectionHours - overlaps.mathematicsCore - overlaps.scienceCore
  return { degreeMinimum: 120, sections, sectionHours, overlaps, uniqueRequirementHours,
    freeElectiveBalance: Math.max(0, 120 - uniqueRequirementHours),
    scope: 'Requirement budget with catalog-specified overlaps; actual course selections, substitutions and transfer awards may change the balance. Not a personal degree audit.' }
}

// Partition unique selected courses directly: subtracting credit-range endpoints
// can invent impossible remaining-hour ranges. Taken alone never selects a course.
export function calculatePlanProgress(courses: Course[], selectedIds: string[], takenIds: string[], policies: CoursePolicy[]) {
  const known = new Set(courses.map(course => course.id))
  if (takenIds.some(id => !known.has(id))) throw new Error('Unknown taken course')
  const selected = [...new Set(selectedIds)]
  const taken = new Set(takenIds)
  const completed = selected.filter(id => taken.has(id))
  const remaining = selected.filter(id => !taken.has(id))
  return { ...calculatePlanCredits(courses, selected, policies),
    completedCredits: calculatePlanCredits(courses, completed, policies).catalogCredits,
    remainingCredits: calculatePlanCredits(courses, remaining, policies).catalogCredits,
    completedCourseCount: completed.length,
    unselectedTakenCount: [...taken].filter(id => !selected.includes(id)).length,
  }
}
