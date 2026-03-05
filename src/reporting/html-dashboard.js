import fs from "node:fs/promises"
import path from "node:path"
import { safeSlug } from "../utils/url-utils.js"

function renderBars(values) {
  const max = Math.max(...Object.values(values), 1)
  return Object.entries(values).map(([label, value]) => {
    const width = Math.round((value / max) * 100)
    return `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${width}%"></i></div><strong>${value}</strong></div>`
  }).join("")
}

export async function writeDashboard(reportDir, payload) {
  const topRules = Object.values(payload.ruleSummary.rules)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 20)

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>a11y-scan dashboard</title>
  <style>
    :root{--bg:#0f172a;--panel:#111827;--card:#1f2937;--ink:#f8fafc;--muted:#94a3b8;--accent:#14b8a6;--warn:#fb923c}
    body{margin:0;font-family:ui-sans-serif,Segoe UI,Helvetica,Arial;background:radial-gradient(circle at 20% 0%,#1d4ed8 0%,var(--bg) 40%);color:var(--ink)}
    header{padding:2rem 2rem 1rem}
    h1{margin:0 0 .4rem 0;font-size:2rem}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;padding:1rem 2rem}
    .card{background:linear-gradient(180deg,var(--card),var(--panel));border:1px solid #334155;border-radius:12px;padding:1rem}
    .label{font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
    .value{font-size:1.8rem;margin-top:.4rem}
    .layout{display:grid;grid-template-columns:1fr 1fr;gap:1rem;padding:1rem 2rem 2rem}
    .panel{background:linear-gradient(180deg,var(--panel),#0b1220);border:1px solid #334155;border-radius:12px;padding:1rem}
    .bar-row{display:grid;grid-template-columns:110px 1fr 50px;gap:.6rem;align-items:center;margin:.5rem 0}
    .bar{height:8px;background:#374151;border-radius:999px;overflow:hidden}
    .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),#22d3ee)}
    table{width:100%;border-collapse:collapse;font-size:.9rem}
    th,td{border-bottom:1px solid #334155;padding:.5rem;text-align:left}
    input,select{background:#020617;border:1px solid #334155;color:var(--ink);padding:.45rem;border-radius:8px}
    .controls{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.8rem}
    @media (max-width:1000px){.layout{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header>
    <h1>a11y-scan Report Dashboard</h1>
    <p>Overview, pages, rules, templates, violations, and scan logs</p>
  </header>
  <section class="grid">
    <article class="card"><div class="label">Pages Scanned</div><div class="value">${payload.summary.scannedPages}</div></article>
    <article class="card"><div class="label">Total Violations</div><div class="value">${payload.severitySummary.totalViolations}</div></article>
    <article class="card"><div class="label">Rules Triggered</div><div class="value">${payload.summary.totalRulesTriggered}</div></article>
    <article class="card"><div class="label">Run Duration</div><div class="value">${new Date(payload.summary.finishedAt).getTime() - new Date(payload.summary.startedAt).getTime()} ms</div></article>
  </section>

  <section class="layout">
    <article class="panel">
      <h2>Violations by Severity</h2>
      ${renderBars(payload.severitySummary.impacts)}
    </article>

    <article class="panel">
      <h2>Violations by Template</h2>
      ${renderBars(Object.fromEntries(Object.entries(payload.templateSummary.templates).map(([k, v]) => [k, v.totalViolations])))}
    </article>

    <article class="panel">
      <h2>Rules</h2>
      <table>
        <thead><tr><th>Rule</th><th>Impact</th><th>Occurrences</th></tr></thead>
        <tbody>
          ${topRules.map((rule) => `<tr><td><a href="rules/${safeSlug(rule.id)}.html">${rule.id}</a></td><td>${rule.impact}</td><td>${rule.occurrences}</td></tr>`).join("")}
        </tbody>
      </table>
    </article>

    <article class="panel">
      <h2>Pages</h2>
      <div class="controls">
        <input id="pageSearch" placeholder="Search URL" />
        <select id="templateFilter"><option value="">All templates</option>${Object.keys(payload.templateSummary.templates).map((template) => `<option value="${template}">${template}</option>`).join("")}</select>
      </div>
      <table>
        <thead><tr><th>URL</th><th>Template</th><th>Violations</th></tr></thead>
        <tbody id="pageRows"></tbody>
      </table>
    </article>

    <article class="panel">
      <h2>Scan Logs</h2>
      <table><thead><tr><th>Time</th><th>Level</th><th>Message</th></tr></thead><tbody>${payload.logs.slice(-200).map((log) => `<tr><td>${log.at}</td><td>${log.level}</td><td>${log.message}</td></tr>`).join("")}</tbody></table>
    </article>
  </section>

  <script>
    const pages = ${JSON.stringify(payload.pages.map((page) => ({
      url: page.url,
      template: page.template,
      violations: page.violations.length
    })))};

    const pageRows = document.getElementById("pageRows");
    const pageSearch = document.getElementById("pageSearch");
    const templateFilter = document.getElementById("templateFilter");

    function slug(url) {
      return url
        .replace(/^https?:\/\//, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 180) || "page";
    }

    function templateFolder(template) {
      if (template === "home") return "home";
      if (template === "blog") return "blogs";
      return template + "s";
    }

    function renderPages() {
      const query = pageSearch.value.toLowerCase();
      const template = templateFilter.value;
      const rows = pages
        .filter((page) => (!template || page.template === template) && page.url.toLowerCase().includes(query))
        .slice(0, 400)
        .map((page) => {
          const href = "pages/" + templateFolder(page.template) + "/" + slug(page.url) + ".html";
          return "<tr><td><a href=\"" + href + "\">" + page.url + "</a></td><td>" + page.template + "</td><td>" + page.violations + "</td></tr>";
        })
        .join("");
      pageRows.innerHTML = rows;
    }

    pageSearch.addEventListener("input", renderPages);
    templateFilter.addEventListener("change", renderPages);
    renderPages();
  </script>
</body>
</html>`

  await fs.writeFile(path.join(reportDir, "index.html"), indexHtml, "utf8")
}
