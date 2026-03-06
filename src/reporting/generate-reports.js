import { exportJsonAndCsv } from "./json-export.js"
import { writeDashboard } from "./html-dashboard.js"
import { writePageReports } from "./page-report.js"
import { writeRuleReports } from "./rule-report.js"
import { writeTemplateReports } from "./template-report.js"
import { writeStaticReport } from "./static-report.js"

export async function generateReports(payload) {
  if (payload.formats.has("json") || payload.formats.has("csv")) {
    await exportJsonAndCsv(payload.reportDir, payload)
  }

  if (payload.formats.has("html")) {
    await writePageReports(payload.reportDir, payload.pages)
    await writeRuleReports(payload.reportDir, payload.ruleSummary)
    await writeTemplateReports(payload.reportDir, payload.templateSummary, payload.pages)
    await writeStaticReport(payload.reportDir, payload)
    await writeDashboard(payload.reportDir, payload)
  }
}
