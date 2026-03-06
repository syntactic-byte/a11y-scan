import { parseStringPromise } from "xml2js"
import { gunzipSync } from "node:zlib"
import { normalizeUrl, fetchWithTimeout } from "../utils/url-utils.js"

async function readXml(url) {
  const response = await fetchWithTimeout(url, 15000)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())

  let text
  if (url.endsWith(".gz") || response.headers.get("content-type")?.includes("gzip")) {
    try {
      text = gunzipSync(buffer).toString("utf-8")
    } catch {
      text = buffer.toString("utf-8")
    }
  } else {
    text = buffer.toString("utf-8")
  }

  return parseStringPromise(text)
}

function getSitemapCandidates(baseUrl, explicitSitemap, robotsRules) {
  if (explicitSitemap) {
    return [normalizeUrl(explicitSitemap, baseUrl)].filter(Boolean)
  }

  const origin = new URL(baseUrl).origin
  const candidates = [
    ...robotsRules.sitemaps,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`
  ]

  return [...new Set(candidates.map((item) => normalizeUrl(item, origin)).filter(Boolean))]
}

export async function discoverUrlsFromSitemaps(baseUrl, explicitSitemap, robotsRules, logger) {
  const sitemapQueue = getSitemapCandidates(baseUrl, explicitSitemap, robotsRules)
  const visitedSitemaps = new Set()
  const urls = new Set()

  while (sitemapQueue.length > 0 && visitedSitemaps.size < 200) {
    const sitemapUrl = sitemapQueue.shift()
    if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) continue
    visitedSitemaps.add(sitemapUrl)

    try {
      const xml = await readXml(sitemapUrl)

      if (xml.sitemapindex?.sitemap) {
        const nested = xml.sitemapindex.sitemap
        logger.info(`Sitemap index ${sitemapUrl} contains ${nested.length} child sitemaps`)
        for (const entry of nested) {
          const loc = normalizeUrl(String(entry.loc?.[0] || "").trim(), sitemapUrl)
          if (loc) sitemapQueue.push(loc)
        }
      }

      if (xml.urlset?.url) {
        const before = urls.size
        for (const entry of xml.urlset.url) {
          const normalized = normalizeUrl(String(entry.loc?.[0] || "").trim(), baseUrl)
          if (normalized) urls.add(normalized)
        }
        logger.info(`Sitemap ${sitemapUrl} added ${urls.size - before} URLs (total: ${urls.size})`)
      }
    } catch (error) {
      logger.warn(`Skipping sitemap ${sitemapUrl} — ${error.message}`)
    }
  }

  return [...urls]
}
