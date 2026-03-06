import fs from "node:fs/promises"
import path from "node:path"

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>a11y-scan dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #08131d;
      --bg-soft: #102436;
      --panel: rgba(12, 29, 42, 0.84);
      --panel-strong: rgba(10, 24, 35, 0.96);
      --stroke: rgba(157, 197, 220, 0.22);
      --text: #e9f2f8;
      --muted: #9fb4c3;
      --accent: #2dd4bf;
      --accent-2: #38bdf8;
      --warn: #fb923c;
      --critical: #ef4444;
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
      max-width: 1480px;
      margin: 0 auto;
      padding: 1.4rem 1.2rem 2rem;
    }

    .hero {
      border: 1px solid var(--stroke);
      border-radius: 18px;
      background: linear-gradient(120deg, rgba(18, 40, 56, 0.9), rgba(11, 27, 40, 0.85));
      box-shadow: var(--shadow);
      padding: 1.25rem 1.3rem;
      margin-bottom: 1rem;
    }

    .hero h1 {
      margin: 0;
      font-family: "Space Grotesk", sans-serif;
      letter-spacing: 0.01em;
      font-size: clamp(1.4rem, 3vw, 2rem);
    }

    .hero p {
      margin: 0.4rem 0 0;
      color: var(--muted);
      font-size: 0.96rem;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.85rem;
      background: rgba(45, 212, 191, 0.13);
      color: #dcfdf7;
      border: 1px solid rgba(45, 212, 191, 0.35);
      border-radius: 999px;
      font-size: 0.84rem;
      padding: 0.35rem 0.72rem;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 99px;
      background: var(--accent);
      box-shadow: 0 0 0 6px rgba(45, 212, 191, 0.13);
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      70% { transform: scale(1.2); opacity: 0.5; }
      100% { transform: scale(1); opacity: 1; }
    }

    .top-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.85rem;
      margin-bottom: 1rem;
    }

    .stat {
      border: 1px solid var(--stroke);
      border-radius: var(--radius);
      background: linear-gradient(180deg, rgba(12, 30, 44, 0.85), rgba(9, 23, 35, 0.9));
      box-shadow: var(--shadow);
      padding: 0.95rem;
    }

    .label {
      color: var(--muted);
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .value {
      margin-top: 0.35rem;
      font-size: 1.75rem;
      font-weight: 700;
      font-family: "Space Grotesk", sans-serif;
    }

    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.9rem;
    }

    .tab {
      border: 1px solid var(--stroke);
      background: rgba(15, 34, 49, 0.8);
      color: var(--text);
      border-radius: 10px;
      padding: 0.45rem 0.74rem;
      cursor: pointer;
      font-size: 0.86rem;
      transition: transform 120ms ease, background 120ms ease;
    }

    .tab.active {
      background: linear-gradient(90deg, rgba(45, 212, 191, 0.2), rgba(56, 189, 248, 0.22));
      border-color: rgba(45, 212, 191, 0.5);
      color: #f0fdfa;
    }

    .tab:hover { transform: translateY(-1px); }

    .view { display: none; }
    .view.active {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.9rem;
      animation: reveal 180ms ease;
    }

    @keyframes reveal {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .panel {
      border: 1px solid var(--stroke);
      border-radius: var(--radius);
      background: linear-gradient(180deg, var(--panel), var(--panel-strong));
      box-shadow: var(--shadow);
      padding: 0.95rem;
      min-height: 160px;
    }

    .panel h2 {
      margin: 0 0 0.72rem;
      font-size: 1.02rem;
      font-family: "Space Grotesk", sans-serif;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 125px 1fr 60px;
      gap: 0.58rem;
      margin: 0.5rem 0;
      align-items: center;
      font-size: 0.88rem;
    }

    .bar {
      height: 8px;
      border-radius: 999px;
      background: rgba(105, 146, 173, 0.28);
      overflow: hidden;
    }

    .bar span {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--accent), var(--accent-2));
    }

    a { color: var(--accent-2); }
    a:visited { color: #a78bfa; }

    :focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      border: 0;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin-bottom: 0.72rem;
    }

    input, select {
      min-height: 34px;
      border-radius: 8px;
      border: 1px solid var(--stroke);
      background: rgba(5, 17, 27, 0.82);
      color: var(--text);
      padding: 0.42rem 0.52rem;
      font-size: 0.86rem;
    }

    button {
      min-height: 34px;
      border-radius: 8px;
      border: 1px solid rgba(45, 212, 191, 0.4);
      background: linear-gradient(90deg, rgba(45, 212, 191, 0.92), rgba(56, 189, 248, 0.9));
      color: #032430;
      padding: 0.42rem 0.65rem;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
    }

    button.ghost {
      background: rgba(16, 36, 51, 0.78);
      color: var(--text);
      border-color: var(--stroke);
      font-weight: 600;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.84rem;
    }

    th, td {
      border-bottom: 1px solid rgba(159, 180, 195, 0.2);
      text-align: left;
      vertical-align: top;
      padding: 0.46rem;
      line-height: 1.35;
    }

    th { color: #c3d9e7; }
    .muted { color: var(--muted); }

    .detail-box {
      border: 1px solid rgba(159, 180, 195, 0.22);
      background: rgba(4, 15, 24, 0.76);
      border-radius: 10px;
      padding: 0.72rem;
      max-height: 460px;
      overflow: auto;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.8rem;
      background: rgba(8, 23, 36, 0.94);
      border: 1px solid rgba(120, 158, 182, 0.3);
      border-radius: 6px;
      padding: 0.08rem 0.28rem;
    }

    .span-2 { grid-column: span 2; }

    .scan-form-wrap {
      border: 1px solid var(--stroke);
      border-radius: var(--radius);
      background: linear-gradient(120deg, rgba(18, 40, 56, 0.85), rgba(11, 27, 40, 0.8));
      box-shadow: var(--shadow);
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .scan-form-wrap summary {
      padding: 0.75rem 1rem;
      cursor: pointer;
      font-family: "Space Grotesk", sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--accent);
      list-style: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      user-select: none;
    }

    .scan-form-wrap summary::before {
      content: "▶";
      font-size: 0.65rem;
      transition: transform 150ms;
    }

    .scan-form-wrap[open] summary::before { transform: rotate(90deg); }

    .scan-form {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      align-items: center;
      padding: 0 1rem 0.85rem;
    }

    .scan-form input[type="url"] { flex: 1 1 240px; }
    .scan-form input[type="number"] { width: 110px; }

    #scanFormMsg {
      font-size: 0.84rem;
      color: var(--accent);
      flex-basis: 100%;
    }

    #scanFormMsg.error { color: var(--critical); }

    .checklist li {
      margin-bottom: 0.45rem;
      color: #d9e8f2;
    }

    .rules-list {
      max-height: 200px;
      overflow-y: auto;
      font-size: 0.82rem;
    }

    .rules-list code {
      display: inline-block;
      margin: 0.15rem 0.1rem;
      padding: 0.12rem 0.35rem;
    }

    @media (max-width: 1200px) {
      .view.active { grid-template-columns: 1fr; }
      .span-2 { grid-column: span 1; }
    }
  </style>
</head>
<body>
  <a href="#main-content" class="sr-only">Skip to main content</a>
  <div class="shell" id="main-content">
    <header class="hero">
      <h1>a11y-scan Live Dashboard</h1>
      <p>Streaming accessibility findings for large websites, with rule-level drilldowns and page troubleshooting.</p>
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-top:0.85rem">
        <div class="status-pill"><span class="dot"></span><span id="scanStatus">Waiting for scan data...</span></div>
        <a id="viewReportBtn" href="./report.html" style="display:none;padding:0.35rem 0.85rem;border-radius:999px;background:linear-gradient(90deg,rgba(45,212,191,0.9),rgba(56,189,248,0.85));color:#032430;font-weight:700;font-size:0.84rem;text-decoration:none">View Report →</a>
      </div>
    </header>

    <details class="scan-form-wrap" id="scanFormWrap">
      <summary>Start New Scan</summary>
      <div class="scan-form">
        <input id="scanUrl" type="url" placeholder="https://example.com" aria-label="Target URL" />
        <select id="scanWcag" aria-label="WCAG level">
          <option value="AAA">WCAG AAA</option>
          <option value="AA">WCAG AA</option>
          <option value="A">WCAG A</option>
        </select>
        <input id="scanMaxPages" type="number" value="2000" min="1" max="50000" aria-label="Max pages" title="Max pages" />
        <input id="scanSampleTemplate" type="number" value="0" min="0" max="100" aria-label="Sample template (0 = off)" title="Sample template (0 = off)" />
        <button id="startScanBtn" type="button">Start Scan</button>
        <span id="scanFormMsg" role="status" aria-live="polite"></span>
      </div>
    </details>

    <section class="top-grid">
      <article class="stat"><div class="label">WCAG Level</div><div id="wcagLevel" class="value">AAA</div></article>
      <article class="stat"><div class="label">Discovered Pages</div><div id="discoveredPages" class="value">0</div></article>
      <article class="stat"><div class="label">Scanned Pages</div><div id="scannedPages" class="value">0</div></article>
      <article class="stat"><div class="label">Violations</div><div id="totalViolations" class="value" style="color: var(--critical)">0</div></article>
      <article class="stat"><div class="label">Passes</div><div id="totalPasses" class="value" style="color: #22c55e">0</div></article>
      <article class="stat"><div class="label">Incomplete</div><div id="totalIncomplete" class="value" style="color: var(--warn)">0</div></article>
      <article class="stat"><div class="label">Inapplicable</div><div id="totalInapplicable" class="value" style="color: var(--muted)">0</div></article>
      <article class="stat"><div class="label">Rules Run</div><div id="rulesRunCount" class="value">0</div></article>
    </section>

    <nav class="tabs" role="tablist" aria-label="Dashboard sections">
      <button class="tab active" role="tab" aria-selected="true" aria-controls="view-overview" data-view="overview" type="button">Overview</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="view-violations" data-view="violations" type="button">Violations</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="view-passes" data-view="passes" type="button">Passes</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="view-incomplete" data-view="incomplete" type="button">Incomplete</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="view-inapplicable" data-view="inapplicable" type="button">Inapplicable</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="view-pages" data-view="pages" type="button">Pages</button>
      <button class="tab" role="tab" aria-selected="false" aria-controls="view-logs" data-view="logs" type="button">Logs & Checklist</button>
    </nav>

    <section id="view-overview" role="tabpanel" class="view active">
      <article class="panel">
        <h2>Results by Type</h2>
        <div id="resultTypeBars" class="muted">No data yet</div>
      </article>
      <article class="panel">
        <h2>Violations by Severity</h2>
        <div id="severityBars" class="muted">No data yet</div>
      </article>
      <article class="panel">
        <h2>Violations by Template</h2>
        <div id="templateBars" class="muted">No data yet</div>
      </article>
      <article class="panel">
        <h2>Rules Executed</h2>
        <div id="rulesList" class="muted">No data yet</div>
      </article>
      <article class="panel span-2">
        <h2>Top Rules</h2>
        <table>
          <thead><tr><th>Rule</th><th>Count</th></tr></thead>
          <tbody id="ruleRows"></tbody>
        </table>
      </article>
    </section>

    <section id="view-violations" role="tabpanel" class="view">
      <article class="panel">
        <h2>Violations Explorer (Rule -> Page -> Nodes)</h2>
        <div class="controls">
          <select id="ruleSelect"><option value="__all__">All rules</option><option value="">— Select a specific rule —</option></select>
          <input id="rulePageSearch" placeholder="Filter pages for selected rule" />
        </div>
        <div class="controls">
          <select id="rulePageSelect"><option value="">Select a page</option></select>
          <button id="rulePageView" type="button">Load Rule Details</button>
        </div>
        <p class="muted">This hierarchy avoids rendering every DOM node at once on large scans.</p>
      </article>
      <article class="panel">
        <h2>Selected Rule Details</h2>
        <div id="ruleDetails" class="detail-box muted">Pick a rule, then a page, then load details.</div>
      </article>
    </section>

    <section id="view-passes" role="tabpanel" class="view">
      <article class="panel">
        <h2>Passes Explorer (Rule -> Page -> Nodes)</h2>
        <div class="controls">
          <select id="passRuleSelect"><option value="__all__">All rules</option><option value="">— Select a specific rule —</option></select>
          <input id="passRulePageSearch" placeholder="Filter pages for selected rule" />
        </div>
        <div class="controls">
          <select id="passRulePageSelect"><option value="">Select a page</option></select>
          <button id="passRulePageView" type="button">Load Pass Details</button>
        </div>
        <p class="muted">These are accessibility checks that passed successfully.</p>
      </article>
      <article class="panel">
        <h2>Selected Pass Details</h2>
        <div id="passRuleDetails" class="detail-box muted">Pick a rule, then a page, then load details.</div>
      </article>
    </section>

    <section id="view-incomplete" role="tabpanel" class="view">
      <article class="panel">
        <h2>Incomplete Explorer (Rule -> Page -> Nodes)</h2>
        <div class="controls">
          <select id="incompleteRuleSelect"><option value="__all__">All rules</option><option value="">— Select a specific rule —</option></select>
          <input id="incompleteRulePageSearch" placeholder="Filter pages for selected rule" />
        </div>
        <div class="controls">
          <select id="incompleteRulePageSelect"><option value="">Select a page</option></select>
          <button id="incompleteRulePageView" type="button">Load Incomplete Details</button>
        </div>
        <p class="muted">These are checks that could not be completed and need manual review.</p>
      </article>
      <article class="panel">
        <h2>Selected Incomplete Details</h2>
        <div id="incompleteRuleDetails" class="detail-box muted">Pick a rule, then a page, then load details.</div>
      </article>
    </section>

    <section id="view-inapplicable" role="tabpanel" class="view">
      <article class="panel">
        <h2>Inapplicable Explorer (Rule -> Page)</h2>
        <div class="controls">
          <select id="inapplicableRuleSelect"><option value="__all__">All rules</option><option value="">— Select a specific rule —</option></select>
          <input id="inapplicableRulePageSearch" placeholder="Filter pages for selected rule" />
        </div>
        <div class="controls">
          <select id="inapplicableRulePageSelect"><option value="">Select a page</option></select>
          <button id="inapplicableRulePageView" type="button">Load Inapplicable Details</button>
        </div>
        <p class="muted">These are rules that don't apply to the page (e.g., no video element = no caption rules).</p>
      </article>
      <article class="panel">
        <h2>Selected Inapplicable Details</h2>
        <div id="inapplicableRuleDetails" class="detail-box muted">Pick a rule, then a page, then load details.</div>
      </article>
    </section>

    <section id="view-pages" role="tabpanel" class="view">
      <article class="panel">
        <h2>Pages and Violations</h2>
        <div class="controls">
          <input id="pageSearch" placeholder="Filter by URL" />
          <select id="templateFilter"><option value="">All templates</option></select>
        </div>
        <table>
          <thead><tr><th>URL</th><th>Template</th><th>Violations</th><th>Passes</th><th>Incomplete</th><th>Inapplicable</th><th>Details</th></tr></thead>
          <tbody id="pageRows"></tbody>
        </table>
      </article>
      <article class="panel">
        <h2>Selected Page Details</h2>
        <div id="pageDetails" class="detail-box muted">Select a page row to load full violation details.</div>
      </article>
    </section>

    <section id="view-logs" role="tabpanel" class="view">
      <article class="panel">
        <h2>Scan Logs</h2>
        <table>
          <thead><tr><th>Time</th><th>Level</th><th>Message</th></tr></thead>
          <tbody id="logRows"></tbody>
        </table>
      </article>
      <article class="panel">
        <h2>Manual Audit Checklist</h2>
        <ul id="checklistRows" class="checklist"></ul>
      </article>
    </section>
  </div>

  <script>
    let selectedRuleFile = ''
    let selectedRuleId = ''
    let cachedRuleData = null

    function activateTab(view) {
      for (const tab of document.querySelectorAll('.tab')) {
        const isActive = tab.dataset.view === view
        tab.classList.toggle('active', isActive)
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false')
      }
      for (const section of document.querySelectorAll('.view')) {
        section.classList.toggle('active', section.id === 'view-' + view)
      }
    }

    for (const tab of document.querySelectorAll('.tab')) {
      tab.addEventListener('click', () => activateTab(tab.dataset.view))
    }

    function renderBars(el, values) {
      const entries = Object.entries(values || {})
      if (entries.length === 0) {
        el.innerHTML = '<span class="muted">No data yet</span>'
        return
      }

      const max = Math.max(...entries.map(([, value]) => value), 1)
      el.innerHTML = entries.map(([label, value]) => {
        const width = Math.round((value / max) * 100)
        return '<div class="bar-row"><span>' + label + '</span><div class="bar" role="meter" aria-valuenow="' + value + '" aria-valuemin="0" aria-valuemax="' + max + '" aria-label="' + label + '"><span style="width:' + width + '%"></span></div><strong>' + value + '</strong></div>'
      }).join('')
    }

    function setRows(el, rowsHtml, emptyText, colspan) {
      el.innerHTML = rowsHtml || '<tr><td class="muted" colspan="' + (colspan || 3) + '">' + emptyText + '</td></tr>'
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    async function showPageDetails(path) {
      const box = document.getElementById('pageDetails')
      box.textContent = 'Loading page details...'

      try {
        const response = await fetch('./' + path + '?ts=' + Date.now(), { cache: 'no-store' })
        const page = await response.json()

        const issues = (page.violations || []).map((violation) => {
          const nodes = (violation.nodes || []).map((node) => '<li><code>' + escapeHtml((node.target || []).join(' ')) + '</code></li>').join('')
          return '<article><h4>' + escapeHtml(violation.id) + ' (' + escapeHtml(violation.impact) + ')</h4>' +
            '<p>' + escapeHtml(violation.help) + '</p>' +
            '<p>' + escapeHtml(violation.description) + '</p>' +
            '<p><a target="_blank" rel="noreferrer" href="' + escapeHtml(violation.helpUrl) + '">WCAG documentation</a></p>' +
            '<ul>' + (nodes || '<li>No nodes captured</li>') + '</ul></article>'
        }).join('')

        const passes = (page.passes || []).map((pass) => {
          const nodes = (pass.nodes || []).map((node) => '<li><code>' + escapeHtml((node.target || []).join(' ')) + '</code></li>').join('')
          return '<article><h4>' + escapeHtml(pass.id) + '</h4>' +
            '<p>' + escapeHtml(pass.help) + '</p>' +
            '<ul>' + (nodes || '<li>No nodes captured</li>') + '</ul></article>'
        }).join('')

        const incomplete = (page.incomplete || []).map((item) => {
          const nodes = (item.nodes || []).map((node) => '<li><code>' + escapeHtml((node.target || []).join(' ')) + '</code></li>').join('')
          return '<article><h4>' + escapeHtml(item.id) + ' (' + escapeHtml(item.impact) + ')</h4>' +
            '<p>' + escapeHtml(item.help) + '</p>' +
            '<ul>' + (nodes || '<li>No nodes captured</li>') + '</ul></article>'
        }).join('')

        const inapplicable = (page.inapplicable || []).map((item) => {
          return '<article><h4>' + escapeHtml(item.id) + '</h4>' +
            '<p>' + escapeHtml(item.help) + '</p></article>'
        }).join('')

        const rulesRun = (page.rulesRun || []).map((rule) => '<code>' + escapeHtml(rule) + '</code>').join(' ')

        box.innerHTML =
          '<h3>' + escapeHtml(page.url) + '</h3>' +
          '<p class="muted">Template: ' + escapeHtml(page.template) + ' | Status: ' + escapeHtml(page.status) + ' | Scan: ' + escapeHtml(page.durationMs) + ' ms</p>' +
          '<h4>Rules Run (' + (page.rulesRun || []).length + ')</h4><p class="muted">' + (rulesRun || 'None') + '</p>' +
          '<h4>Violations (' + (page.violations || []).length + ')</h4>' + (issues || '<p class="muted">No violations.</p>') +
          '<h4>Passes (' + (page.passes || []).length + ')</h4>' + (passes || '<p class="muted">No passes.</p>') +
          '<h4>Incomplete (' + (page.incomplete || []).length + ')</h4>' + (incomplete || '<p class="muted">No incomplete.</p>') +
          '<h4>Inapplicable (' + (page.inapplicable || []).length + ')</h4>' + (inapplicable || '<p class="muted">No inapplicable.</p>')
      } catch {
        box.textContent = 'Could not load page details.'
      }
    }

    async function loadRuleData(filePath) {
      if (!filePath) return null
      const response = await fetch('./' + filePath + '?ts=' + Date.now(), { cache: 'no-store' })
      if (!response.ok) throw new Error('Rule index missing')
      return response.json()
    }

    async function populateRulePages() {
      const pageSelect = document.getElementById('rulePageSelect')
      const searchInput = document.getElementById('rulePageSearch')

      if (!selectedRuleFile) {
        pageSelect.innerHTML = '<option value="">Select a page</option>'
        return
      }

      if (!cachedRuleData || cachedRuleData.__file !== selectedRuleFile) {
        const data = await loadRuleData(selectedRuleFile)
        cachedRuleData = { ...data, __file: selectedRuleFile }
      }

      const query = (searchInput.value || '').toLowerCase()
      const pages = (cachedRuleData.pages || [])
        .filter((entry) => !query || entry.url.toLowerCase().includes(query))
        .slice(-1000)
        .reverse()

      pageSelect.innerHTML = '<option value="">Select a page</option>' + pages
        .map((entry) => '<option value="' + escapeHtml(entry.detailPath) + '">' + escapeHtml(entry.url) + ' [' + escapeHtml(entry.impact) + '] (' + entry.nodeCount + ')</option>')
        .join('')
    }

    async function showRuleDetailsForPage() {
      const detailPath = document.getElementById('rulePageSelect').value
      const detailBox = document.getElementById('ruleDetails')
      if (!detailPath || !selectedRuleId) {
        detailBox.textContent = 'Pick a rule and page first.'
        return
      }

      detailBox.textContent = 'Loading rule details...'

      try {
        const response = await fetch('./' + detailPath + '?ts=' + Date.now(), { cache: 'no-store' })
        if (!response.ok) throw new Error('Page detail missing')
        const page = await response.json()

        const matches = (page.violations || []).filter((item) => item.id === selectedRuleId)
        const blocks = matches.map((violation) => {
          const nodes = (violation.nodes || []).map((node) => {
            const selector = escapeHtml((node.target || []).join(' '))
            const failure = escapeHtml(node.failureSummary || '')
            return '<li><div><code>' + selector + '</code></div><div class="muted">' + failure + '</div></li>'
          }).join('')

          return '<article><h4>' + escapeHtml(violation.id) + ' (' + escapeHtml(violation.impact) + ')</h4>' +
            '<p>' + escapeHtml(violation.help) + '</p>' +
            '<p><a target="_blank" rel="noreferrer" href="' + escapeHtml(violation.helpUrl) + '">WCAG documentation</a></p>' +
            '<ul>' + (nodes || '<li>No nodes captured</li>') + '</ul></article>'
        }).join('')

        detailBox.innerHTML = '<h3>' + escapeHtml(page.url) + '</h3>' + (blocks || '<p class="muted">This rule was not found on the selected page detail.</p>')
      } catch {
        detailBox.textContent = 'Could not load rule details for selected page.'
      }
    }

    async function renderRuleExplorer(data) {
      const ruleSelect = document.getElementById('ruleSelect')
      const selected = ruleSelect.value
      const rules = data.ruleCatalog || []

      ruleSelect.innerHTML = '<option value="">Select a rule</option>' + rules
        .map((rule) => '<option value="' + escapeHtml(rule.file) + '" data-rule="' + escapeHtml(rule.id) + '">' + escapeHtml(rule.id) + ' (' + rule.count + ')</option>')
        .join('')

      if (selected && rules.some((rule) => rule.file === selected)) {
        ruleSelect.value = selected
      }
    }

    async function refresh() {
      try {
        const response = await fetch('./raw/live-state.json?ts=' + Date.now(), { cache: 'no-store' })
        if (!response.ok) throw new Error('No live data')
        const data = await response.json()

        document.getElementById('scanStatus').textContent = data.statusMessage || 'Running'
        document.getElementById('wcagLevel').textContent = data.wcagLevel || 'AAA'
        document.getElementById('discoveredPages').textContent = data.discoveredPages || 0
        document.getElementById('scannedPages').textContent = data.scannedPages || 0
        document.getElementById('totalViolations').textContent = data.totalViolations || 0
        document.getElementById('totalPasses').textContent = data.totalPasses || 0
        document.getElementById('totalIncomplete').textContent = data.totalIncomplete || 0
        document.getElementById('totalInapplicable').textContent = data.totalInapplicable || 0
        document.getElementById('rulesRunCount').textContent = (data.rulesRun || []).length || 0

        const resultTypes = {
          Violations: data.totalViolations || 0,
          Passes: data.totalPasses || 0,
          Incomplete: data.totalIncomplete || 0,
          Inapplicable: data.totalInapplicable || 0
        }
        renderBars(document.getElementById('resultTypeBars'), resultTypes)
        renderBars(document.getElementById('severityBars'), data.severity || {})
        renderBars(document.getElementById('templateBars'), data.templateTotals || {})

        const rulesRunEl = document.getElementById('rulesList')
        const rulesRun = data.rulesRun || []
        if (rulesRun.length === 0) {
          rulesRunEl.innerHTML = '<span class="muted">No rules yet</span>'
        } else {
          rulesRunEl.innerHTML = '<div class="rules-list">' + rulesRun.map((rule) => '<code>' + escapeHtml(rule) + '</code>').join(' ') + '</div>'
        }

        await renderRuleExplorer(data)

        const pageSearch = document.getElementById('pageSearch')
        const templateFilter = document.getElementById('templateFilter')

        const selectedTemplate = templateFilter.value
        const templates = Array.from(new Set((data.pageIndex || []).map((page) => page.template))).sort()
        templateFilter.innerHTML = '<option value="">All templates</option>' + templates.map((template) => '<option value="' + template + '">' + template + '</option>').join('')
        templateFilter.value = selectedTemplate

        const filteredPages = (data.pageIndex || [])
          .filter((page) => (!templateFilter.value || page.template === templateFilter.value) && (!pageSearch.value || page.url.toLowerCase().includes(pageSearch.value.toLowerCase())))
          .slice(-500)
          .reverse()

        setRows(
          document.getElementById('ruleRows'),
          (data.topRules || []).map((rule) => '<tr><td>' + escapeHtml(rule.id) + '</td><td>' + rule.count + '</td></tr>').join(''),
          'No rules yet'
        )

        setRows(
          document.getElementById('pageRows'),
          filteredPages.map((page) => '<tr><td>' + escapeHtml(page.url) + '</td><td>' + escapeHtml(page.template) + '</td><td>' + (page.violations || 0) + '</td><td>' + (page.passes || 0) + '</td><td>' + (page.incomplete || 0) + '</td><td>' + (page.inapplicable || 0) + '</td><td><button class="ghost" data-detail="' + escapeHtml(page.detailPath) + '">View</button></td></tr>').join(''),
          'No pages scanned yet',
          7
        )

        for (const button of document.querySelectorAll('[data-detail]')) {
          button.addEventListener('click', () => showPageDetails(button.getAttribute('data-detail')))
        }

        setRows(
          document.getElementById('logRows'),
          (data.logs || []).map((log) => '<tr><td>' + escapeHtml(log.at) + '</td><td>' + escapeHtml(log.level) + '</td><td>' + escapeHtml(log.message) + '</td></tr>').join(''),
          'No logs yet',
          3
        )

        const checklist = (data.manualChecklist || []).map((item) => '<li>' + escapeHtml(item) + '</li>').join('')
        document.getElementById('checklistRows').innerHTML = checklist || '<li class="muted">No manual checklist available.</li>'

        if (data.status === 'completed' && pollTimer) {
          clearInterval(pollTimer)
          pollTimer = null
          const dot = document.querySelector('.dot')
          if (dot) { dot.style.animation = 'none'; dot.style.background = '#22c55e'; }
        }
      } catch {
        document.getElementById('scanStatus').textContent = 'Waiting for first scan update...'
      }
    }

    let pollTimer = null

    document.getElementById('startScanBtn').addEventListener('click', async () => {
      const urlInput = document.getElementById('scanUrl')
      const msg = document.getElementById('scanFormMsg')
      const url = urlInput.value.trim()

      msg.className = ''
      if (!url) {
        msg.className = 'error'
        msg.textContent = 'Please enter a URL.'
        urlInput.focus()
        return
      }

      const btn = document.getElementById('startScanBtn')
      btn.disabled = true
      msg.textContent = 'Starting scan...'

      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            url,
            wcagLevel: document.getElementById('scanWcag').value,
            maxPages: Number(document.getElementById('scanMaxPages').value) || 2000,
            sampleTemplates: Number(document.getElementById('scanSampleTemplate').value) || 0
          })
        })
        const data = await res.json()
        if (res.ok) {
          msg.textContent = 'Scan started — dashboard will update automatically.'
          document.getElementById('scanFormWrap').open = false
          if (!pollTimer) pollTimer = setInterval(refresh, 1500)
          refresh()
        } else {
          msg.className = 'error'
          msg.textContent = 'Error: ' + (data.error || res.statusText)
        }
      } catch (err) {
        msg.className = 'error'
        msg.textContent = 'Error: ' + err.message
      } finally {
        btn.disabled = false
      }
    })

    refresh()
    document.getElementById('pageSearch').addEventListener('input', refresh)
    document.getElementById('templateFilter').addEventListener('change', refresh)
    document.getElementById('ruleSelect').addEventListener('change', async (event) => {
      selectedRuleFile = event.target.value
      selectedRuleId = event.target.options[event.target.selectedIndex]?.dataset?.rule || ''
      cachedRuleData = null
      await populateRulePages()
    })
    document.getElementById('rulePageSearch').addEventListener('input', async () => {
      await populateRulePages()
    })
    document.getElementById('rulePageView').addEventListener('click', async () => {
      await showRuleDetailsForPage()
    })
    pollTimer = setInterval(refresh, 1500)
  </script>
</body>
</html>`

export async function writeDashboard(reportDir) {
  await fs.mkdir(reportDir, { recursive: true })
  await fs.writeFile(path.join(reportDir, "index.html"), DASHBOARD_HTML, "utf8")
}
