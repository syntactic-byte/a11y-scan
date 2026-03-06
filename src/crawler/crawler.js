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
    const p = new URL(url).pathname
    return p.startsWith("/products/") || p.startsWith("/collections/") || p.startsWith("/blogs/")
  })
}

function pickByPrefix(urls, prefix, count) {
  const filtered = urls.filter((url) => new URL(url).pathname.startsWith(prefix))
  if (count <= 0) return filtered
  return filtered.slice(0, count)
}

function applyShopifySampling(urls, sampleTemplate) {
  if (!isLikelyShopify(urls) || sampleTemplate <= 0) return urls

  const selected = new Set()
  const homepage = urls.find((url) => new URL(url).pathname === "/")
  if (homepage) selected.add(homepage)

  for (const url of pickByPrefix(urls, "/products/", sampleTemplate)) selected.add(url)
  for (const url of pickByPrefix(urls, "/collections/", sampleTemplate)) selected.add(url)
  for (const url of pickByPrefix(urls, "/pages/", 0)) selected.add(url)
  for (const url of pickByPrefix(urls, "/blogs/", sampleTemplate)) selected.add(url)

  return [...selected]
}

function shouldKeep(url, options, robotsRules, baseUrl) {
  if (!isSameDomain(url, baseUrl)) return false
  if (!isAllowedByRobots(url, robotsRules)) return false
  if (!isIncluded(url, options.include)) return false
  if (isExcluded(url, options.exclude)) return false

  const basePath = new URL(baseUrl).pathname
  if (getPathDepth(url, basePath) > options.depth) return false

  return true
}

/**
 * BFS crawl with Playwright.  Uses multiple pages for concurrency.
 */
async function crawlByLinks(baseUrl, options, robotsRules, logger) {
  const concurrency = Math.min(options.concurrency || 4, 8)
  const browser = await chromium.launch({ headless: options.headless })

  const visited = new Set()
  const output = []
  const queue = [{ url: normalizeUrl(baseUrl), depth: 0 }]

  function nextFromQueue() {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item?.url || visited.has(item.url)) continue
      visited.add(item.url)
      if (!shouldKeep(item.url, options, robotsRules, baseUrl)) continue
      return item
    }
    return null
  }

  async function crawlWorker() {
    const page = await browser.newPage()
    try {
      while (output.length < options.maxPages) {
        const next = nextFromQueue()
        if (!next) break

        output.push(next.url)
        logger.progress("Crawling page", output.length, options.maxPages)

        try {
          await page.goto(next.url, { waitUntil: "domcontentloaded", timeout: options.timeout })
          await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeout, 6000) }).catch(() => {})

          if (next.depth < options.depth) {
            const links = await page.$$eval("a[href]", (anchors) => anchors.map((a) => a.getAttribute("href")))
            for (const href of links) {
              const normalized = normalizeUrl(href, next.url)
              if (normalized && !visited.has(normalized) && shouldKeep(normalized, options, robotsRules, baseUrl)) {
                queue.push({ url: normalized, depth: next.depth + 1 })
              }
            }
          }
        } catch {
          logger.warn(`Could not crawl ${next.url}`)
        }
      }
    } finally {
      await page.close().catch(() => {})
    }
  }

  try {
    const workers = Array.from({ length: concurrency }, () => crawlWorker())
    await Promise.all(workers)
  } finally {
    await browser.close().catch(() => {})
  }

  return output
}

async function resolveBaseUrl(url, logger) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" })
    const resolved = normalizeUrl(response.url)
    if (resolved && resolved !== url) {
      logger.info(`Resolved ${url} → ${resolved}`)
    }
    return resolved || url
  } catch {
    return url
  }
}

export async function discoverUrls(baseUrl, options, logger) {
  let normalizedBase = normalizeUrl(baseUrl)
  if (!normalizedBase) throw new Error("Invalid target URL")

  normalizedBase = await resolveBaseUrl(normalizedBase, logger)
  const robotsRules = await fetchRobots(normalizedBase)
  logger.info("Discovering URLs via sitemap.xml")
  let urls = await discoverUrlsFromSitemaps(normalizedBase, options.sitemap, robotsRules, logger)
  logger.info(`Sitemap discovery found ${urls.length} raw URLs`)

  const beforeFilter = urls.length
  urls = urls.filter((url) => shouldKeep(url, options, robotsRules, normalizedBase))
  if (beforeFilter > 0 && urls.length < beforeFilter) {
    logger.info(`Filtered to ${urls.length}/${beforeFilter} URLs (depth=${options.depth}, include/exclude/robots rules)`)
  }

  if (urls.length === 0) {
    logger.warn("No sitemap URLs found, using Playwright BFS crawl")
    urls = await crawlByLinks(normalizedBase, options, robotsRules, logger)
  }

  const sampled = applyShopifySampling(urls, options.sampleTemplates)
  if (sampled.length < urls.length) {
    logger.info(`Shopify sampling reduced ${urls.length} URLs to ${sampled.length} (sampleTemplates=${options.sampleTemplates})`)
  }

  const trimmed = sampled.slice(0, options.maxPages)
  return [...new Set(trimmed)]
}
