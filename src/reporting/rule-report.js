import fs from "node:fs/promises"
import path from "node:path"
import { safeSlug, templateFolder, escapeHtml } from "../utils/url-utils.js"

function renderRulePage(rule) {
  const rows = rule.pages.map((entry) => {
    const remaining = entry.nodes.length - 5
    const nodes = entry.nodes
      .slice(0, 5)
      .map((node) => `<li><code>${escapeHtml((node.target || []).join(" "))}</code></li>`)
      .join("")
    const more = remaining > 0 ? `<li class="muted">and ${remaining} more</li>` : ""

    return `<tr>
      <td><a href="../pages/${templateFolder(entry.template)}/${safeSlug(entry.url)}.html">${escapeHtml(entry.url)}</a></td>
      <td>${escapeHtml(entry.impact)}</td>
      <td><ul>${nodes}${more}</ul></td>
    </tr>`
  }).join("")

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(rule.id)} - a11y-scan</title>
<style>body{font-family:Georgia,serif;background:#f6f6f1;padding:2rem}table{width:100%;border-collapse:collapse;background:#fff}th,td{border:1px solid #ddd;padding:0.6rem;vertical-align:top}code{background:#f3f4f6;padding:0.1rem 0.2rem;border-radius:4px}.muted{color:#6b7280}</style>
</head><body>
<h1>${escapeHtml(rule.id)}</h1>
<p>${escapeHtml(rule.help)} - <a href="${escapeHtml(rule.helpUrl)}">WCAG docs</a></p>
<p>Total occurrences: ${rule.occurrences}</p>
<table>
  <caption>Pages affected by ${escapeHtml(rule.id)}</caption>
  <thead><tr><th>Page</th><th>Impact</th><th>Elements</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`
}

export async function writeRuleReports(reportDir, ruleSummary) {
  const outputDir = path.join(reportDir, "rules")
  await fs.mkdir(outputDir, { recursive: true })

  for (const rule of Object.values(ruleSummary.rules)) {
    await fs.writeFile(path.join(outputDir, `${safeSlug(rule.id)}.html`), renderRulePage(rule), "utf8")
  }
}
