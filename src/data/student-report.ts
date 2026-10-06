import { z } from 'zod'

const code = z.string().regex(/^[A-Z]+ \d{4}$/)
export const studentReportSchema = z.strictObject({
  schemaVersion: z.literal(1),
  reportedAt: z.string().min(1),
  catalogYear: z.string().regex(/^\d{4}-\d{4}$/).nullable(),
  transferTerm: z.string().nullable(),
  coreRuleLabel: z.string(),
  degreeCreditsRequired: z.number().positive(),
  degreeCreditsEarned: z.number().nonnegative().nullable(),
  reportedPercent: z.number().min(0).max(100).nullable(),
  courses: z.array(z.strictObject({
    code, status: z.enum(['taken', 'in-progress']), credits: z.number().positive(),
    term: z.string(), grade: z.string().nullable(),
  })),
  requirementStatuses: z.array(z.strictObject({
    id: z.string(), label: z.string(), status: z.enum(['satisfied', 'not-satisfied', 'unknown']),
    reportedPercent: z.number().min(0).max(100).nullable(),
  })),
  remainingCourseNames: z.array(z.string()),
  electivePools: z.array(z.strictObject({
    id: z.string(), label: z.string(), courseCodes: z.array(code),
  })),
}).superRefine((report, ctx) => {
  if (new Set(report.courses.map(c => c.code)).size !== report.courses.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate course status; resolve conflicting evidence first' })
})

export type StudentReport = z.infer<typeof studentReportSchema>

// No inferred statuses from percentages, blank table cells, or satisfied groups.
// No course is assigned a year-qualified catalog ID until the year is confirmed.
export function summarizeStudentReport(input: unknown, publicCatalogCodes: readonly string[]) {
  const report = studentReportSchema.parse(input)
  const uniquePoolCodes = [...new Set(report.electivePools.flatMap(pool => pool.courseCodes))].sort()
  const available = new Set(publicCatalogCodes)
  return {
    catalogYear: report.catalogYear,
    needsCatalogConfirmation: report.catalogYear === null,
    confirmedTakenCodes: report.courses.filter(c => c.status === 'taken').map(c => c.code),
    inProgressCodes: report.courses.filter(c => c.status === 'in-progress').map(c => c.code),
    // These are subtotals of the supplied explicit rows, not degree totals.
    explicitTakenCredits: report.courses.filter(c => c.status === 'taken').reduce((sum,c) => sum+c.credits,0),
    explicitInProgressCredits: report.courses.filter(c => c.status === 'in-progress').reduce((sum,c) => sum+c.credits,0),
    remainingDegreeCredits: report.degreeCreditsEarned === null ? null : Math.max(0, report.degreeCreditsRequired-report.degreeCreditsEarned),
    remainingCourseNames: report.remainingCourseNames,
    unmetRequirementIds: report.requirementStatuses.filter(r => r.status === 'not-satisfied').map(r => r.id),
    poolUniqueCourseCount: uniquePoolCodes.length,
    // Missing from this edition is not proof of an invalid degree-report option.
    poolCodesAbsentFromComparedCatalog: uniquePoolCodes.filter(code => !available.has(code)),
  }
}
