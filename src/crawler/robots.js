import { fetchWithTimeout } from "../utils/url-utils.js"

/**
 * Convert a robots.txt path pattern to a RegExp.
 * Supports `*` (wildcard) and `$` (end-of-path anchor) per the spec.
 */
function toRegex(pattern) {
  let hasEndAnchor = false
  let raw = pattern

  if (raw.endsWith("$")) {
    hasEndAnchor = true
    raw = raw.slice(0, -1)
  }

  const escaped = raw
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")

  return new RegExp(`^${escaped}${hasEndAnchor ? "$" : ""}`)
}

export async function fetchRobots(baseUrl) {
  const origin = new URL(baseUrl).origin
  const robotsUrl = `${origin}/robots.txt`

  const empty = { url: robotsUrl, disallow: [], allow: [], sitemaps: [] }

  let raw = ""
  try {
    const response = await fetchWithTimeout(robotsUrl, 10000)
    if (!response.ok) return empty
    raw = await response.text()
  } catch {
    return empty
  }

  const disallow = []
  const allow = []
  const sitemaps = []
  let inGlobalAgent = false

  for (const line of raw.split(/\r?\n/)) {
    const clean = line.split("#")[0].trim()
    if (!clean) continue

    const [keyRaw, ...valueParts] = clean.split(":")
    const key = keyRaw.trim().toLowerCase()
    const value = valueParts.join(":").trim()

    if (key === "user-agent") {
      inGlobalAgent = value === "*"
      continue
    }

    if (key === "sitemap" && value) {
      sitemaps.push(value)
      continue
    }

    if (!inGlobalAgent || !value) continue
    if (key === "disallow") disallow.push(value)
    if (key === "allow") allow.push(value)
  }

  return { url: robotsUrl, disallow, allow, sitemaps }
}

export function isAllowedByRobots(url, robotsRules) {
  if (!robotsRules) return true
  const urlPath = new URL(url).pathname

  let bestAllow = -1
  let bestDisallow = -1

  for (const rule of robotsRules.allow) {
    if (toRegex(rule).test(urlPath)) bestAllow = Math.max(bestAllow, rule.length)
  }

  for (const rule of robotsRules.disallow) {
    if (toRegex(rule).test(urlPath)) bestDisallow = Math.max(bestDisallow, rule.length)
  }

  return bestAllow >= bestDisallow
}
