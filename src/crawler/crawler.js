import { chromium } from "playwright"
import { fetchRobots, isAllowedByRobots } from "./robots.js"
import { discoverUrlsFromSitemaps } from "./sitemap.js"
import {
  getPathDepth,
  isExcluded,
  isIncluded,
  isSameDomain,
  normalizeUrl
} from "../utils/url-utils.js"

function isLikelyShopify(urls) {
  return urls.some((url) => {
    const path = new URL(url).pathname
    return path.startsWith("/products/") || path.startsWith("/collections/") || path.startsWith("/blogs/")
  })
}

function pickByPrefix(urls, prefix, count) {
  const filtered = urls.filter((url) => new URL(url).pathname.startsWith(prefix))
  if (count <= 0) return filtered
  return filtered.slice(0, count)
}

function applyShopifySampling(urls, sampleProducts) {
  if (!isLikelyShopify(urls) || sampleProducts <= 0) return urls

  const selected = new Set()
  const homepage = urls.find((url) => new URL(url).pathname === "/")
  if (homepage) selected.add(homepage)

  for (const url of pickByPrefix(urls, "/products/", sampleProducts)) selected.add(url)
  for (const url of pickByPrefix(urls, "/collections/", 5)) selected.add(url)
  for (const url of pickByPrefix(urls, "/pages/", 0)) selected.add(url)
  for (const url of pickByPrefix(urls, "/blogs/", 0)) selected.add(url)

  return [...selected]
}

function shouldKeep(url, options, robotsRules, baseUrl) {
  if (!isSameDomain(url, baseUrl)) return false
  if (!isAllowedByRobots(url, robotsRules)) return false
  if (!isIncluded(url, options.include)) return false
  if (isExcluded(url, options.exclude)) return false

  const basePath = new URL(baseUrl).pathname
  const depth = getPathDepth(url, basePath)
  if (depth > options.depth) return false

  return true
}

async function crawlByLinks(baseUrl, options, robotsRules, logger) {
  const browser = await chromium.launch({ headless: options.headless })
  const page = await browser.newPage()

  const visited = new Set()
  const output = []
  const queue = [{ url: normalizeUrl(baseUrl), depth: 0 }]

  while (queue.length > 0 && output.length < options.maxPages) {
    const next = queue.shift()
    if (!next?.url) continue

    if (visited.has(next.url)) continue
    visited.add(next.url)

    if (!shouldKeep(next.url, options, robotsRules, baseUrl)) continue
    output.push(next.url)

    logger.progress("Crawling page", output.length, options.maxPages)

    try {
      await page.goto(next.url, { waitUntil: "domcontentloaded", timeout: options.timeout })
      await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeout, 6000) }).catch(() => {})

      if (next.depth >= options.depth) continue

      const links = await page.$$eval("a[href]", (anchors) => anchors.map((anchor) => anchor.getAttribute("href")))
      for (const href of links) {
        const normalized = normalizeUrl(href, next.url)
        if (!normalized || visited.has(normalized)) continue
        queue.push({ url: normalized, depth: next.depth + 1 })
      }
    } catch {
      logger.warn(`Could not crawl ${next.url}`)
    }
  }

  await page.close()
  await browser.close()
  return output
}

export async function discoverUrls(baseUrl, options, logger) {
  const normalizedBase = normalizeUrl(baseUrl)
  if (!normalizedBase) throw new Error("Invalid target URL")

  const robotsRules = await fetchRobots(normalizedBase)
  logger.info("Discovering URLs via sitemap.xml")
  let urls = await discoverUrlsFromSitemaps(normalizedBase, options.sitemap, robotsRules, logger)

  urls = urls.filter((url) => shouldKeep(url, options, robotsRules, normalizedBase))

  if (urls.length === 0) {
    logger.warn("No sitemap URLs found, using Playwright BFS crawl")
    urls = await crawlByLinks(normalizedBase, options, robotsRules, logger)
  }

  const sampled = applyShopifySampling(urls, options.sampleProducts)
  const trimmed = sampled.slice(0, options.maxPages)
  return [...new Set(trimmed)]
}
