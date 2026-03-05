import fetch from "node-fetch"
import { parseStringPromise } from "xml2js"
import { normalizeUrl } from "../utils/url-utils.js"

async function readXml(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch sitemap ${url}`)
  const text = await response.text()
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
        for (const entry of xml.sitemapindex.sitemap) {
          const nested = normalizeUrl(entry.loc?.[0], sitemapUrl)
          if (nested) sitemapQueue.push(nested)
        }
      }

      if (xml.urlset?.url) {
        for (const entry of xml.urlset.url) {
          const normalized = normalizeUrl(entry.loc?.[0], baseUrl)
          if (normalized) urls.add(normalized)
        }
      }
    } catch {
      logger.warn(`Skipping sitemap ${sitemapUrl}`)
    }
  }

  return [...urls]
}
