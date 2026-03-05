import fetch from "node-fetch"
import { parseStringPromise } from "xml2js"

async function fetchXML(url) {
  const res = await fetch(url)
  return parseStringPromise(await res.text())
}

export async function discoverUrls(base) {

  const root = await fetchXML(`${base}/sitemap.xml`)

  if (!root.sitemapindex) {
    return root.urlset.url.map(u => u.loc[0])
  }

  const sitemaps = root.sitemapindex.sitemap.map(s => s.loc[0])

  let urls = []

  for (const sitemap of sitemaps) {

    const xml = await fetchXML(sitemap)

    if (xml.urlset) {
      urls.push(...xml.urlset.url.map(u => u.loc[0]))
    }

  }

  return urls
}
