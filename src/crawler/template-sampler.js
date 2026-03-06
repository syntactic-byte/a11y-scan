import { chromium } from "playwright"

/**
 * Extract a structural fingerprint from a page's DOM.
 * Captures the tag hierarchy (tag names + nesting depth) of semantic/layout
 * elements, ignoring text content, attributes, and leaf-level repetition.
 * Pages with the same structure but different content produce the same fingerprint.
 */
const STRUCTURAL_TAGS = new Set([
  "header", "nav", "main", "footer", "aside", "section", "article",
  "form", "table", "ul", "ol", "dl", "details",
  "div", "h1", "h2", "h3", "h4", "h5", "h6"
])

function fingerprintFromSkeleton(skeleton) {
  // skeleton is an array of { tag, depth } objects
  // We normalize by collapsing consecutive identical siblings
  const collapsed = []
  for (const node of skeleton) {
    const prev = collapsed[collapsed.length - 1]
    if (prev && prev.tag === node.tag && prev.depth === node.depth) continue
    collapsed.push(node)
  }
  return collapsed.map((n) => `${"  ".repeat(n.depth)}${n.tag}`).join("\n")
}

/**
 * Visit a set of URLs and group them by structural similarity.
 * Returns a reduced list of URLs, keeping at most `perTemplate` URLs
 * from each structural group.
 *
 * @param {string[]} urls - full list of discovered URLs
 * @param {number} perTemplate - how many pages to keep per structural group
 * @param {object} options - { concurrency, timeout, headless }
 * @param {object} logger
 * @returns {Promise<string[]>} sampled URLs
 */
export async function sampleByStructure(urls, perTemplate, options, logger) {
  if (perTemplate <= 0 || urls.length <= perTemplate) return urls

  // Probe a representative sample to discover structural groups.
  // We probe up to 80 URLs or all if fewer, spread evenly across the list.
  const maxProbe = Math.min(urls.length, 80)
  const step = Math.max(1, Math.floor(urls.length / maxProbe))
  const probeUrls = []
  for (let i = 0; i < urls.length && probeUrls.length < maxProbe; i += step) {
    probeUrls.push(urls[i])
  }

  logger.info(`Probing ${probeUrls.length} pages to detect structural templates...`)

  const concurrency = Math.min(options.concurrency || 4, 6)
  const browser = await chromium.launch({ headless: options.headless ?? true })

  // Map URL -> fingerprint
  const fingerprints = new Map()
  const probeQueue = [...probeUrls]

  async function probeWorker() {
    const page = await browser.newPage()
    try {
      while (probeQueue.length > 0) {
        const url = probeQueue.shift()
        if (!url) break

        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout || 15000 })
          await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {})

          const skeleton = await page.evaluate((tags) => {
            const result = []
            const walker = document.createTreeWalker(
              document.body || document.documentElement,
              NodeFilter.SHOW_ELEMENT,
              null
            )

            function getDepth(el) {
              let d = 0
              let node = el
              while (node.parentElement) { d++; node = node.parentElement }
              return d
            }

            let node = walker.currentNode
            while (node) {
              const tag = node.tagName.toLowerCase()
              if (tags.includes(tag)) {
                result.push({ tag, depth: getDepth(node) })
              }
              node = walker.nextNode()
            }
            return result
          }, [...STRUCTURAL_TAGS])

          const fp = fingerprintFromSkeleton(skeleton)
          fingerprints.set(url, fp)
        } catch {
          // If we can't probe a page, give it a unique fingerprint so it isn't dropped
          fingerprints.set(url, `__unique__${url}`)
        }
      }
    } finally {
      await page.close().catch(() => {})
    }
  }

  try {
    const workers = Array.from({ length: concurrency }, () => probeWorker())
    await Promise.all(workers)
  } finally {
    await browser.close().catch(() => {})
  }

  // Group probed URLs by fingerprint
  const groups = new Map()
  for (const [url, fp] of fingerprints) {
    if (!groups.has(fp)) groups.set(fp, [])
    groups.get(fp).push(url)
  }

  logger.info(`Detected ${groups.size} unique page structures from ${fingerprints.size} probed pages`)

  // Now assign ALL urls (including unprobed ones) to groups.
  // Unprobed URLs get assigned to a group by matching their URL path pattern
  // to the nearest probed URL in the same group.
  // Strategy: group unprobed URLs by their path prefix pattern, then
  // assign each group to the fingerprint of the probed URL with the
  // most similar path prefix.
  const allGrouped = new Map() // fingerprint -> url[]
  for (const [fp, fpUrls] of groups) {
    allGrouped.set(fp, [...fpUrls])
  }

  // For unprobed URLs, find the probed URL with the longest common path prefix
  const probedEntries = [...fingerprints.entries()]
  for (const url of urls) {
    if (fingerprints.has(url)) continue // already grouped

    const urlPath = new URL(url).pathname
    let bestFp = null
    let bestLen = -1

    for (const [probedUrl, fp] of probedEntries) {
      const probedPath = new URL(probedUrl).pathname
      // Find common prefix length
      let common = 0
      const limit = Math.min(urlPath.length, probedPath.length)
      for (let i = 0; i < limit; i++) {
        if (urlPath[i] === probedPath[i]) common = i + 1
        else break
      }
      if (common > bestLen) {
        bestLen = common
        bestFp = fp
      }
    }

    if (bestFp && allGrouped.has(bestFp)) {
      allGrouped.get(bestFp).push(url)
    } else {
      // Fallback: unique group
      const uniqueFp = `__unprobed__${url}`
      allGrouped.set(uniqueFp, [url])
    }
  }

  // Pick up to perTemplate from each group
  const sampled = []
  for (const [, groupUrls] of allGrouped) {
    sampled.push(...groupUrls.slice(0, perTemplate))
  }

  logger.info(`Template sampling: ${allGrouped.size} groups, ${sampled.length} URLs selected (${perTemplate} per group)`)

  return sampled
}
