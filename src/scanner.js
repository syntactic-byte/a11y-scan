import { chromium } from "playwright"
import AxeBuilder from "@axe-core/playwright"
import fs from "fs"

export default async function scan(urls) {

  const browser = await chromium.launch()
  const page = await browser.newPage()

  const report = []

  for (const url of urls) {

    console.log("Scanning", url)

    try {

      await page.goto(url, { waitUntil: "networkidle" })

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()

      report.push({
        url,
        violations: results.violations
      })

    } catch {}

  }

  await browser.close()

  fs.writeFileSync(
    "a11y-report.json",
    JSON.stringify(report, null, 2)
  )

  console.log("Report saved: a11y-report.json")

}
