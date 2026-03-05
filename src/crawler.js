import { chromium } from "playwright"

export default async function crawl(startUrl) {

  const browser = await chromium.launch()
  const page = await browser.newPage()

  const visited = new Set()
  const queue = [startUrl]

  while (queue.length) {

    const url = queue.shift()

    if (visited.has(url)) continue
    visited.add(url)

    console.log("Crawling", url)

    try {

      await page.goto(url, { waitUntil: "networkidle" })

      const links = await page.$$eval("a[href]", links =>
        links.map(a => a.href)
      )

      for (const link of links) {
        if (link.startsWith(startUrl) && !visited.has(link)) {
          queue.push(link)
        }
      }

    } catch {}

  }

  await browser.close()

  return [...visited]

}
