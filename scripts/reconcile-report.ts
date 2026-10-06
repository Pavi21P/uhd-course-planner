import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { studentReportSchema, summarizeStudentReport } from '../src/data/student-report.ts'
import { programConfig } from '../src/data/program-config.ts'
import { parseCatalogIndex } from './catalog-index.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const report = studentReportSchema.parse(JSON.parse(await readFile(resolve(root, '.local/degree-report.json'), 'utf8')))
if (report.catalogYear !== programConfig.catalogYear) throw new Error('Personal report and active catalog years differ; retain previous reconciliation')
const catalog = parseCatalogIndex(JSON.parse(await readFile(resolve(root,
  `data/sources/${programConfig.catalogYear}/cs-index.json`), 'utf8')), programConfig.catalogYear, programConfig.catalogId)
const summary = summarizeStudentReport(report, catalog.courseCodes)
await mkdir(resolve(root, '.local'), { recursive: true })
await writeFile(resolve(root, '.local/report-reconciliation.json'), JSON.stringify({
  ...summary, comparedCatalogYear: catalog.catalogYear,
  catalogYearMatches: report.catalogYear === catalog.catalogYear,
  note: 'Code-only comparison within the confirmed catalog year. Index presence does not establish elective eligibility. No completion or course-equivalence mapping applied.',
  eligibilityConflicts: report.electivePools.some(pool => pool.courseCodes.includes('CS 3394'))
    ? [{ code: 'CS 3394', sourceUrl: 'https://catalog.uhd.edu/preview_course_nopop.php?catoid=37&coid=68791', note: 'Report lists an elective option, but the archived course description excludes this course from upper-level CS electives. Resolve before counting toward that requirement.' }]
    : [],
}, null, 2) + '\n')
console.log('Saved local report reconciliation. Personal data is not imported by the app or published.')
