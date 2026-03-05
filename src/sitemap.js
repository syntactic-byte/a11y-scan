import fetch from "node-fetch"
import { parseStringPromise } from "xml2js"

export async function findSitemaps(base) {

  const sitemapUrl = `${base}/sitemap.xml`
  const res = await fetch(sitemapUrl)

  if (!res.ok) throw new Error("No sitemap")

  const xml = await parseStringPromise(await res.text())

  return xml.sitemapindex.sitemap.map(s => s.loc[0])
}

export async function parseSitemaps(sitemaps) {

  const urls = []

  for (const sitemap of sitemaps) {

    const res = await fetch(sitemap)
    const xml = await parseStringPromise(await res.text())

    if (xml.urlset) {
      urls.push(...xml.urlset.url.map(u => u.loc[0]))
    }

  }

  return urls
}
