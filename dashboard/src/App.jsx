import { useEffect, useMemo, useState } from "react"

const REPORT_BASE = import.meta.env.VITE_REPORT_BASE || "../a11y-report"

function useReportData() {
  const [data, setData] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetch(`${REPORT_BASE}/summary/scan-summary.json`).then((r) => r.json()),
      fetch(`${REPORT_BASE}/summary/severity-summary.json`).then((r) => r.json()),
      fetch(`${REPORT_BASE}/raw/results.json`).then((r) => r.json()),
      fetch(`${REPORT_BASE}/raw/rules.json`).then((r) => r.json()),
      fetch(`${REPORT_BASE}/raw/templates.json`).then((r) => r.json())
    ])
      .then(([summary, severity, pages, rules, templates]) => {
        setData({ summary, severity, pages, rules: rules.rules, templates: templates.templates })
      })
      .catch((fetchError) => setError(fetchError.message))
  }, [])

  return { data, error }
}

function BarChart({ values }) {
  const max = Math.max(...Object.values(values), 1)
  return (
    <div>
      {Object.entries(values).map(([label, value]) => (
        <div key={label} className="bar-row">
          <span>{label}</span>
          <div className="bar"><i style={{ width: `${Math.round((value / max) * 100)}%` }} /></div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { data, error } = useReportData()
  const [query, setQuery] = useState("")
  const [template, setTemplate] = useState("")

  const filteredPages = useMemo(() => {
    if (!data) return []
    return data.pages.filter((page) => {
      if (template && page.template !== template) return false
      if (query && !page.url.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [data, query, template])

  if (error) return <main className="shell">Could not load reports: {error}</main>
  if (!data) return <main className="shell">Loading report files...</main>

  const topRules = Object.values(data.rules).sort((a, b) => b.occurrences - a.occurrences).slice(0, 20)
  const templateViolations = Object.fromEntries(Object.entries(data.templates).map(([k, v]) => [k, v.totalViolations]))

  return (
    <main className="shell">
      <header>
        <h1>a11y-scan Dashboard</h1>
        <p>Overview, pages, rules, templates, and violations</p>
      </header>

      <section className="grid">
        <article className="card"><label>Pages Scanned</label><strong>{data.summary.scannedPages}</strong></article>
        <article className="card"><label>Total Violations</label><strong>{data.severity.totalViolations}</strong></article>
        <article className="card"><label>Triggered Rules</label><strong>{Object.keys(data.rules).length}</strong></article>
      </section>

      <section className="split">
        <article className="card"><h2>Severity</h2><BarChart values={data.severity.impacts} /></article>
        <article className="card"><h2>Templates</h2><BarChart values={templateViolations} /></article>
      </section>

      <section className="card">
        <h2>Rules</h2>
        <table>
          <thead><tr><th>Rule</th><th>Impact</th><th>Occurrences</th></tr></thead>
          <tbody>{topRules.map((rule) => <tr key={rule.id}><td>{rule.id}</td><td>{rule.impact}</td><td>{rule.occurrences}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="card">
        <h2>Pages</h2>
        <div className="controls">
          <input placeholder="Search URL" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="">All templates</option>
            {Object.keys(data.templates).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <table>
          <thead><tr><th>URL</th><th>Template</th><th>Violations</th></tr></thead>
          <tbody>{filteredPages.slice(0, 500).map((page) => <tr key={page.url}><td>{page.url}</td><td>{page.template}</td><td>{page.violations.length}</td></tr>)}</tbody>
        </table>
      </section>
    </main>
  )
}
