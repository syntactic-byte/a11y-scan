import fs from "node:fs/promises"
import path from "node:path"
import { safeSlug } from "../utils/url-utils.js"

function renderRulePage(rule) {
  const rows = rule.pages.map((entry) => {
    const nodes = entry.nodes
      .slice(0, 5)
      .map((node) => `<li><code>${(node.target || []).join(" ")}</code></li>`)
      .join("")

    return `<tr>
      <td><a href="../pages/${entry.template === "home" ? "home" : `${entry.template}s`}/${safeSlug(entry.url)}.html">${entry.url}</a></td>
      <td>${entry.impact}</td>
      <td><ul>${nodes}</ul></td>
    </tr>`
  }).join("")

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${rule.id} - a11y-scan</title>
<style>body{font-family:Georgia,serif;background:#f6f6f1;padding:2rem}table{width:100%;border-collapse:collapse;background:#fff}th,td{border:1px solid #ddd;padding:0.6rem;vertical-align:top}code{background:#f3f4f6;padding:0.1rem 0.2rem;border-radius:4px}</style>
</head><body>
<h1>${rule.id}</h1>
<p>${rule.help} - <a href="${rule.helpUrl}">WCAG docs</a></p>
<p>Total occurrences: ${rule.occurrences}</p>
<table><thead><tr><th>Page</th><th>Impact</th><th>Elements</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`
}

export async function writeRuleReports(reportDir, ruleSummary) {
  const outputDir = path.join(reportDir, "rules")
  await fs.mkdir(outputDir, { recursive: true })

  const entries = Object.values(ruleSummary.rules)
  for (const rule of entries) {
    await fs.writeFile(path.join(outputDir, `${safeSlug(rule.id)}.html`), renderRulePage(rule), "utf8")
  }
}
