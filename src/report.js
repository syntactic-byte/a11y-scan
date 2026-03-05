import fs from "fs"

export function generateReport(results) {

  fs.writeFileSync(
    "a11y-report.json",
    JSON.stringify(results, null, 2)
  )

  const grouped = {}

  for (const page of results) {
    for (const v of page.violations) {

      if (!grouped[v.id]) grouped[v.id] = []

      grouped[v.id].push({
        url: page.url,
        impact: v.impact,
        description: v.help
      })

    }
  }

  const html = `
<html>
<head>
<title>Accessibility Report</title>
<style>
body{font-family:sans-serif;padding:40px}
.rule{margin-bottom:30px;border:1px solid #ddd;padding:15px}
.impact{font-weight:bold}
</style>
</head>

<body>

<h1>Accessibility Report</h1>

<h2>Pages scanned: ${results.length}</h2>

${Object.entries(grouped).map(([rule, items]) => `
<div class="rule">

<h3>${rule}</h3>

${items.map(i => `
<p>
<span class="impact">${i.impact}</span>
<br>
${i.description}
<br>
${i.url}
</p>
`).join("")}

</div>
`).join("")}

</body>
</html>
`

  fs.writeFileSync("a11y-report.html", html)

  console.log("\nReports generated:")
  console.log("a11y-report.json")
  console.log("a11y-report.html\n")
}
