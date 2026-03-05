import fs from "node:fs/promises"
import path from "node:path"
import { safeSlug } from "../utils/url-utils.js"

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function templateFolder(template) {
  if (template === "home") return "home"
  if (template === "product") return "products"
  if (template === "collection") return "collections"
  if (template === "blog") return "blogs"
  return "pages"
}

function renderPageHtml(page) {
  const rows = page.violations.map((violation) => {
    const nodes = violation.nodes
      .slice(0, 6)
      .map((node) => `<li><code>${escapeHtml((node.target || []).join(" "))}</code></li>`)
      .join("")

    return `
      <article class="issue impact-${escapeHtml(violation.impact)}">
        <header>
          <h3>${escapeHtml(violation.id)} (${escapeHtml(violation.impact)})</h3>
          <p>${escapeHtml(violation.help)}</p>
          <a href="${escapeHtml(violation.helpUrl)}" target="_blank" rel="noreferrer">WCAG documentation</a>
        </header>
        <p>${escapeHtml(violation.description)}</p>
        <ul>${nodes}</ul>
      </article>
    `
  }).join("")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(page.url)} - a11y-scan</title>
  <style>
    body{font-family:Georgia,serif;background:#f6f6f1;color:#171717;margin:0;padding:2rem}
    main{max-width:1000px;margin:0 auto}
    .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.2rem}
    .card{background:#fff;border:1px solid #ddd;padding:1rem;border-radius:10px}
    .issue{background:#fff;border:1px solid #ddd;border-left:6px solid #7c5f00;padding:1rem;border-radius:10px;margin-bottom:1rem}
    .impact-critical{border-left-color:#8f1d14}
    .impact-serious{border-left-color:#b45309}
    .impact-moderate{border-left-color:#1d4ed8}
    .impact-minor{border-left-color:#166534}
    code{background:#f3f4f6;padding:0.1rem 0.2rem;border-radius:4px}
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(page.url)}</h1>
    <div class="meta">
      <div class="card"><strong>Template</strong><br/>${escapeHtml(page.template)}</div>
      <div class="card"><strong>Status</strong><br/>${escapeHtml(page.status)}</div>
      <div class="card"><strong>Violations</strong><br/>${page.violations.length}</div>
      <div class="card"><strong>Scan Time</strong><br/>${page.durationMs} ms</div>
    </div>
    ${rows || "<p>No violations found.</p>"}
  </main>
</body>
</html>`
}

export async function writePageReports(reportDir, pages) {
  for (const page of pages) {
    const folder = templateFolder(page.template)
    const outputDir = path.join(reportDir, "pages", folder)
    const filename = `${safeSlug(page.url)}.html`

    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(path.join(outputDir, filename), renderPageHtml(page), "utf8")
  }
}
