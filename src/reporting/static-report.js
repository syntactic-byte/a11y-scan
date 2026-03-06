import fs from "node:fs/promises"
import path from "node:path"
import { escapeHtml, safeSlug, templateFolder } from "../utils/url-utils.js"

function computeScore(impacts, scannedPages) {
  const { critical = 0, serious = 0, moderate = 0, minor = 0, unknown = 0 } = impacts
  const weighted = critical * 10 + serious * 5 + moderate * 2 + minor * 1 + unknown * 1
  const penaltyPerPage = weighted / Math.max(scannedPages, 1)
  return Math.max(0, Math.round(100 - penaltyPerPage))
}

function scoreColor(score) {
  if (score >= 90) return "#22c55e"
  if (score >= 70) return "#fb923c"
  return "#ef4444"
}

function scoreLabel(score) {
  if (score >= 90) return "Good"
  if (score >= 70) return "Needs Work"
  return "Poor"
}

function bar(value, max, color) {
  const pct = Math.round((value / Math.max(max, 1)) * 100)
  return `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>`
}

const IMPACT_COLOR = {
  critical: "#ef4444",
  serious: "#fb923c",
  moderate: "#facc15",
  minor: "#60a5fa",
  unknown: "#9ca3af"
}

const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3, unknown: 4 }

function formatDate(iso) {
  if (!iso) return "–"
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  } catch {
    return iso
  }
}

function pagePath(page) {
  const folder = templateFolder(page.template)
  return `pages/${folder}/${safeSlug(page.url)}.html`
}

export async function writeStaticReport(reportDir, payload) {
  const { summary, severitySummary, ruleSummary, templateSummary, pages } = payload
  const impacts = severitySummary.impacts || {}
  const score = computeScore(impacts, summary.scannedPages)
  const color = scoreColor(score)
  const label = scoreLabel(score)

  const impactOrder = IMPACT_ORDER
  const violationRules = Object.values(ruleSummary.rules)
    .sort((a, b) => (impactOrder[a.impact] ?? 4) - (impactOrder[b.impact] ?? 4) || b.occurrences - a.occurrences)

  const templateData = Object.entries(templateSummary.templates)
    .filter(([, t]) => t.totalViolations > 0)
    .sort((a, b) => b[1].totalViolations - a[1].totalViolations)

  const pagesWithViolations = pages
    .filter((p) => p.violations && p.violations.length > 0)
    .sort((a, b) => {
      const aCount = a.violations.reduce((s, v) => s + Math.max(1, v.nodes.length), 0)
      const bCount = b.violations.reduce((s, v) => s + Math.max(1, v.nodes.length), 0)
      return bCount - aCount
    })

  const maxImpact = Math.max(...Object.values(impacts), 1)
  const maxTemplate = Math.max(...templateData.map(([, t]) => t.totalViolations), 1)
  const maxRule = Math.max(...violationRules.map((r) => r.occurrences), 1)
  const targetUrl = summary.targetUrl || "–"
  const wcagLevel = (summary.options && summary.options.wcagLevel) || "AAA"

  const severityRows = ["critical", "serious", "moderate", "minor", "unknown"]
    .filter((k) => (impacts[k] || 0) > 0)
    .map((k) => `
      <div class="bar-row">
        <span class="bar-label">${k}</span>
        ${bar(impacts[k] || 0, maxImpact, IMPACT_COLOR[k])}
        <strong class="bar-count">${impacts[k] || 0}</strong>
      </div>`).join("")

  const templateRows = templateData.map(([name, t]) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(name)}</span>
      ${bar(t.totalViolations, maxTemplate, "#2dd4bf")}
      <strong class="bar-count">${t.totalViolations}</strong>
    </div>`).join("")

  const ruleTableRows = violationRules.map((rule) => {
    const impactBadge = `<span class="badge badge-${escapeHtml(rule.impact || "unknown")}">${escapeHtml(rule.impact || "unknown")}</span>`
    const docLink = rule.helpUrl
      ? `<a href="${escapeHtml(rule.helpUrl)}" target="_blank" rel="noreferrer">docs</a>`
      : ""
    return `<tr>
      <td>${impactBadge}</td>
      <td><code>${escapeHtml(rule.id)}</code></td>
      <td>${escapeHtml(rule.help)}</td>
      <td class="num">${rule.occurrences}</td>
      <td class="num">${rule.pages.length}</td>
      <td>${docLink}</td>
    </tr>`
  }).join("")

  const pageTableRows = pagesWithViolations.map((page) => {
    const violationCount = page.violations.reduce((s, v) => s + Math.max(1, v.nodes.length), 0)
    const link = `<a href="./${escapeHtml(pagePath(page))}">${escapeHtml(page.url)}</a>`
    const topImpact = page.violations.reduce((worst, v) => {
      return (impactOrder[v.impact] ?? 4) < (impactOrder[worst] ?? 4) ? v.impact : worst
    }, "unknown")
    return `<tr>
      <td>${link}</td>
      <td>${escapeHtml(page.template || "–")}</td>
      <td><span class="badge badge-${escapeHtml(topImpact)}">${escapeHtml(topImpact)}</span></td>
      <td class="num">${violationCount}</td>
    </tr>`
  }).join("")

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>a11y-scan Report — ${escapeHtml(targetUrl)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #08131d;
      --panel: rgba(12, 29, 42, 0.84);
      --panel-strong: rgba(10, 24, 35, 0.96);
      --stroke: rgba(157, 197, 220, 0.22);
      --text: #e9f2f8;
      --muted: #9fb4c3;
      --accent: #2dd4bf;
      --accent-2: #38bdf8;
      --radius: 14px;
      --shadow: 0 10px 35px rgba(2, 8, 14, 0.45);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--text);
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(1300px 600px at 8% -12%, rgba(45, 212, 191, 0.2), transparent 60%),
        radial-gradient(1000px 500px at 95% 0%, rgba(56, 189, 248, 0.2), transparent 64%),
        linear-gradient(160deg, #051019 0%, #0a1823 42%, #0e1f2f 100%);
      min-height: 100vh;
    }

    .shell {
      max-width: 1300px;
      margin: 0 auto;
      padding: 1.6rem 1.2rem 3rem;
    }

    .hero {
      border: 1px solid var(--stroke);
      border-radius: 18px;
      background: linear-gradient(120deg, rgba(18, 40, 56, 0.9), rgba(11, 27, 40, 0.85));
      box-shadow: var(--shadow);
      padding: 1.5rem 1.5rem;
      margin-bottom: 1.2rem;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1rem;
      align-items: center;
    }

    .hero-meta h1 {
      margin: 0 0 0.2rem;
      font-family: "Space Grotesk", sans-serif;
      font-size: clamp(1.3rem, 2.5vw, 1.9rem);
    }

    .hero-meta p { margin: 0.2rem 0; color: var(--muted); font-size: 0.9rem; }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.84rem;
      color: var(--accent-2);
      margin-bottom: 0.65rem;
    }

    .score-ring {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 6px solid;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .score-num {
      font-family: "Space Grotesk", sans-serif;
      font-size: 2.4rem;
      font-weight: 700;
      line-height: 1;
    }

    .score-lbl {
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-top: 0.15rem;
    }

    .grid-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.85rem;
      margin-bottom: 1.2rem;
    }

    .stat {
      border: 1px solid var(--stroke);
      border-radius: var(--radius);
      background: linear-gradient(180deg, rgba(12, 30, 44, 0.85), rgba(9, 23, 35, 0.9));
      box-shadow: var(--shadow);
      padding: 0.95rem;
    }

    .stat-label {
      color: var(--muted);
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .stat-value {
      margin-top: 0.3rem;
      font-size: 1.75rem;
      font-weight: 700;
      font-family: "Space Grotesk", sans-serif;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.2rem;
    }

    .panel {
      border: 1px solid var(--stroke);
      border-radius: var(--radius);
      background: linear-gradient(180deg, var(--panel), var(--panel-strong));
      box-shadow: var(--shadow);
      padding: 1rem;
    }

    .panel h2 {
      margin: 0 0 0.85rem;
      font-family: "Space Grotesk", sans-serif;
      font-size: 1rem;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 100px 1fr 54px;
      gap: 0.5rem;
      align-items: center;
      margin: 0.45rem 0;
      font-size: 0.86rem;
    }

    .bar-label { text-transform: capitalize; }

    .bar-track {
      height: 8px;
      border-radius: 999px;
      background: rgba(105, 146, 173, 0.22);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    .bar-count { text-align: right; font-weight: 700; }

    .panel-full {
      border: 1px solid var(--stroke);
      border-radius: var(--radius);
      background: linear-gradient(180deg, var(--panel), var(--panel-strong));
      box-shadow: var(--shadow);
      padding: 1rem;
      margin-bottom: 1.2rem;
      overflow: auto;
    }

    .panel-full h2 {
      margin: 0 0 0.85rem;
      font-family: "Space Grotesk", sans-serif;
      font-size: 1rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.84rem;
    }

    th, td {
      border-bottom: 1px solid rgba(159, 180, 195, 0.16);
      text-align: left;
      vertical-align: top;
      padding: 0.48rem 0.5rem;
      line-height: 1.35;
    }

    th { color: #c3d9e7; font-weight: 600; }
    td.num { text-align: right; }

    a { color: var(--accent-2); }
    a:visited { color: #a78bfa; }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.78rem;
      background: rgba(8, 23, 36, 0.9);
      border: 1px solid rgba(120, 158, 182, 0.25);
      border-radius: 5px;
      padding: 0.06rem 0.26rem;
    }

    .badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.18rem 0.5rem;
      border-radius: 999px;
      background: rgba(100, 120, 140, 0.3);
      color: #cde;
    }

    .badge-critical { background: rgba(239, 68, 68, 0.22); color: #fca5a5; }
    .badge-serious  { background: rgba(251, 146, 60, 0.22); color: #fdba74; }
    .badge-moderate { background: rgba(250, 204, 21, 0.18); color: #fde68a; }
    .badge-minor    { background: rgba(96, 165, 250, 0.2);  color: #93c5fd; }
    .badge-unknown  { background: rgba(156, 163, 175, 0.2); color: #d1d5db; }

    .muted { color: var(--muted); }

    #pageSearch {
      padding: 0.4rem 0.6rem;
      border-radius: 8px;
      border: 1px solid var(--stroke);
      background: rgba(5, 17, 27, 0.82);
      color: var(--text);
      font-size: 0.86rem;
      min-width: 260px;
      margin-bottom: 0.75rem;
    }

    .empty { color: var(--muted); font-size: 0.9rem; padding: 0.5rem 0; }

    @media (max-width: 900px) {
      .grid-2 { grid-template-columns: 1fr; }
      .hero { grid-template-columns: 1fr; }
      .score-ring { margin: 0 auto; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <a class="back-link" href="./index.html">← Back to Live Dashboard</a>

    <header class="hero">
      <div class="hero-meta">
        <h1>Accessibility Report</h1>
        <p><strong>URL:</strong> ${escapeHtml(targetUrl)}</p>
        <p><strong>WCAG Level:</strong> ${escapeHtml(wcagLevel)}</p>
        <p><strong>Scanned:</strong> ${escapeHtml(formatDate(summary.startedAt))} → ${escapeHtml(formatDate(summary.finishedAt))}</p>
        ${summary.totalViolations === 0
          ? '<p style="color:#22c55e;font-weight:600;margin-top:0.5rem">No violations found — great job!</p>'
          : `<p style="color:#9fb4c3;margin-top:0.5rem">Below are the issues that need to be fixed to improve accessibility.</p>`}
      </div>
      <div class="score-ring" style="border-color:${color};color:${color}" aria-label="Score: ${score}/100 — ${label}">
        <span class="score-num">${score}</span>
        <span class="score-lbl">${escapeHtml(label)}</span>
      </div>
    </header>

    <section class="grid-stats" aria-label="Summary statistics">
      <article class="stat">
        <div class="stat-label">Pages Scanned</div>
        <div class="stat-value">${summary.scannedPages}</div>
      </article>
      <article class="stat">
        <div class="stat-label">Total Violations</div>
        <div class="stat-value" style="color:#ef4444">${severitySummary.totalViolations}</div>
      </article>
      <article class="stat">
        <div class="stat-label">Critical</div>
        <div class="stat-value" style="color:#ef4444">${impacts.critical || 0}</div>
      </article>
      <article class="stat">
        <div class="stat-label">Serious</div>
        <div class="stat-value" style="color:#fb923c">${impacts.serious || 0}</div>
      </article>
      <article class="stat">
        <div class="stat-label">Moderate</div>
        <div class="stat-value" style="color:#facc15">${impacts.moderate || 0}</div>
      </article>
      <article class="stat">
        <div class="stat-label">Minor</div>
        <div class="stat-value" style="color:#60a5fa">${impacts.minor || 0}</div>
      </article>
      <article class="stat">
        <div class="stat-label">Pages with Violations</div>
        <div class="stat-value">${pagesWithViolations.length}</div>
      </article>
      <article class="stat">
        <div class="stat-label">Rules Triggered</div>
        <div class="stat-value">${violationRules.length}</div>
      </article>
    </section>

    ${severityRows || templateRows ? `
    <div class="grid-2">
      ${severityRows ? `
      <article class="panel">
        <h2>Violations by Severity</h2>
        ${severityRows}
      </article>` : ""}
      ${templateRows ? `
      <article class="panel">
        <h2>Violations by Template</h2>
        ${templateRows}
      </article>` : ""}
    </div>` : ""}

    ${violationRules.length > 0 ? `
    <div class="panel-full">
      <h2>Rules to Fix (${violationRules.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Impact</th>
            <th>Rule</th>
            <th>Description</th>
            <th class="num">Occurrences</th>
            <th class="num">Pages</th>
            <th>Docs</th>
          </tr>
        </thead>
        <tbody>
          ${ruleTableRows}
        </tbody>
      </table>
    </div>` : ""}

    ${pagesWithViolations.length > 0 ? `
    <div class="panel-full">
      <h2>Pages with Violations (${pagesWithViolations.length})</h2>
      <input id="pageSearch" type="search" placeholder="Filter by URL…" aria-label="Filter pages by URL" />
      <table id="pageTable">
        <thead>
          <tr>
            <th>URL</th>
            <th>Template</th>
            <th>Worst Impact</th>
            <th class="num">Violations</th>
          </tr>
        </thead>
        <tbody id="pageBody">
          ${pageTableRows}
        </tbody>
      </table>
    </div>` : '<div class="panel-full"><p class="empty">No pages with violations found.</p></div>'}
  </div>

  <script>
    const search = document.getElementById('pageSearch')
    const rows = document.querySelectorAll('#pageBody tr')
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase()
        for (const row of rows) {
          const url = row.querySelector('td')?.textContent?.toLowerCase() || ''
          row.hidden = q.length > 0 && !url.includes(q)
        }
      })
    }
  </script>
</body>
</html>`

  await fs.mkdir(reportDir, { recursive: true })
  await fs.writeFile(path.join(reportDir, "report.html"), html, "utf8")
}
