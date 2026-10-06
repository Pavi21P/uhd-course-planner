import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeStudentReport, type StudentReport } from '../src/data/student-report.ts'

const fixture: StudentReport = {
  schemaVersion: 1, reportedAt: 'synthetic', catalogYear: null, transferTerm: 'synthetic', coreRuleLabel: 'Core Fall 2020',
  degreeCreditsRequired: 120, degreeCreditsEarned: null, reportedPercent: 97,
  courses: [{ code: 'TEST 1000', status: 'taken', credits: 3, term: 'synthetic', grade: 'A' },
    { code: 'TEST 2000', status: 'in-progress', credits: 4, term: 'synthetic', grade: null }],
  requirementStatuses: [{ id: 'core', label: 'Core', status: 'satisfied', reportedPercent: 0 }],
  remainingCourseNames: ['Unresolved course'],
  electivePools: [{ id: 'one', label: 'One', courseCodes: ['TEST 1000','TEST 3000'] },
    { id: 'two', label: 'Two', courseCodes: ['TEST 1000','TEST 2000'] }],
}

test('does not turn rounded progress, pool membership, or in-progress rows into completion', () => {
  const result = summarizeStudentReport(fixture, ['TEST 1000','TEST 2000'])
  assert.equal(result.remainingDegreeCredits, null)
  assert.equal(result.needsCatalogConfirmation, true)
  assert.deepEqual(result.confirmedTakenCodes, ['TEST 1000'])
  assert.deepEqual(result.inProgressCodes, ['TEST 2000'])
  assert.equal(result.explicitTakenCredits, 3)
  assert.equal(result.explicitInProgressCredits, 4)
  assert.deepEqual(result.unmetRequirementIds, [])
  assert.equal(result.poolUniqueCourseCount, 3)
  assert.deepEqual(result.poolCodesAbsentFromComparedCatalog, ['TEST 3000'])
})

test('rejects conflicting duplicate statuses', () => {
  const input = structuredClone(fixture)
  input.courses.push({ ...input.courses[0], status: 'in-progress' })
  assert.throws(() => summarizeStudentReport(input, []), /Duplicate/)
})
