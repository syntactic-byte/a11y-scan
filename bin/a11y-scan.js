#!/usr/bin/env node

import crawl from "../src/crawler.js"
import scan from "../src/scanner.js"
import { findSitemaps, parseSitemaps } from "../src/sitemap.js"

const url = process.argv[2]

if (!url) {
  console.log("Usage: a11y-scan <url>")
  process.exit(1)
}

async function run() {

  console.log("🔎 Discovering URLs...")

  let urls = []

  try {
    const sitemaps = await findSitemaps(url)
    urls = await parseSitemaps(sitemaps)
  } catch {
    console.log("No sitemap found, crawling instead")
    urls = await crawl(url)
  }

  console.log(`Found ${urls.length} pages`)

  await scan(urls)

}

run()
