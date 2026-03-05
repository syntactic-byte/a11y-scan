import fs from "fs"
import chalk from "chalk"

export function generateReport(results, options = {}) {

  const {
    jsonPath = "a11y-report.json",
    htmlPath = "a11y-report.html"
  } = options

  // Save JSON report
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2))

  console.log(chalk.green(`\n✔ JSON report written to ${jsonPath}`))

  // Console summary
  let totalViolations = 0

  console.log("\nAccessibility Summary\n")

  for (const page of results) {

    const count = page.violations.length
    totalViolations += count

    if (count === 0) {
      console.log(chalk.green(`✔ ${page.url}`))
    } else {
      console.log(chalk.red(`✖ ${page.url} (${count} issues)`))

      for (const v of page.violations) {
        console.log(`   ${chalk.yellow(v.id)} — ${v.help}`)
      }
    }
  }

  console.log("\nTotal violations:", totalViolations)

  // Generate HTML report
  const html = generateHTML(results)

  fs.writeFileSync(htmlPath, html)

  console.log(chalk.green(`✔ HTML report written to ${htmlPath}\n`))

}
