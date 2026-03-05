import { chromium } from "playwright"
import AxeBuilder from "@axe-core/playwright"
import pLimit from "p-limit"

export default async function scan(urls, concurrency = 5) {

  const browser = await chromium.launch()

  const limit = pLimit(concurrency)

  const tasks = urls.map(url =>
    limit(async () => {

      const page = await browser.newPage()

      console.log("Scanning", url)

      try {

        await page.goto(url, { waitUntil: "networkidle" })

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()

        await page.close()

        return {
          url,
          violations: results.violations
        }

      } catch {

        return {
          url,
          violations: []
        }

      }

    })
  )

  const results = await Promise.all(tasks)

  await browser.close()

  return results
}
