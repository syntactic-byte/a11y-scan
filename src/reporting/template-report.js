import fs from "node:fs/promises"
import path from "node:path"
import { safeSlug } from "../utils/url-utils.js"

function folderForTemplate(template) {
  if (template === "home") return "home"
  if (template === "blog") return "blogs"
  return `${template}s`
}

function renderTemplatePage(template, pages, metrics) {
  const rows = pages.map((page) => `
    <tr>
      <td><a href="../pages/${folderForTemplate(template)}/${safeSlug(page.url)}.html">${page.url}</a></td>
      <td>${page.violations.length}</td>
      <td>${page.status}</td>
    </tr>
  `).join("")

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${template} template report</title>
<style>body{font-family:Georgia,serif;background:#f6f6f1;padding:2rem}table{width:100%;border-collapse:collapse;background:#fff}th,td{border:1px solid #ddd;padding:0.6rem}</style>
</head><body>
<h1>Template: ${template}</h1>
<p>Pages: ${metrics.pages} | Violations: ${metrics.totalViolations}</p>
<table><thead><tr><th>Page</th><th>Violations</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`
}

export async function writeTemplateReports(reportDir, templateSummary, pages) {
  const outputDir = path.join(reportDir, "templates")
  await fs.mkdir(outputDir, { recursive: true })

  for (const [template, metrics] of Object.entries(templateSummary.templates)) {
    const templatePages = pages.filter((page) => page.template === template)
    const filePath = path.join(outputDir, `${safeSlug(template)}.html`)
    await fs.writeFile(filePath, renderTemplatePage(template, templatePages, metrics), "utf8")
  }
}
