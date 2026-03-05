#!/usr/bin/env node

import { Command } from "commander"
import chalk from "chalk"
import { discoverUrls } from "../src/sitemap.js"
import crawl from "../src/crawler.js"
import scan from "../src/scanner.js"
import { generateReport } from "../src/report.js"

const program = new Command()

program
  .argument("<url>")
  .option("--max-pages <number>", "limit scanned pages", 200)
  .option("--concurrency <number>", "parallel scans", 5)
  .option("--exclude <paths...>", "exclude paths")
  .parse()

const options = program.opts()
const url = program.args[0]

async function run() {

  console.log(chalk.cyan("\n🔎 Discovering URLs\n"))

  let urls = []

  try {
    urls = await discoverUrls(url)
  } catch {
    console.log("No sitemap detected — crawling site")
    urls = await crawl(url)
  }

  if (options.exclude) {
    urls = urls.filter(u => !options.exclude.some(e => u.includes(e)))
  }

  urls = urls.slice(0, options.maxPages)

  console.log(`Found ${urls.length} pages\n`)

  const results = await scan(urls, options.concurrency)

  generateReport(results)

}

run()
