import fetch from "node-fetch"

function toRegex(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
  return new RegExp(`^${escaped}`)
}

export async function fetchRobots(baseUrl) {
  const origin = new URL(baseUrl).origin
  const robotsUrl = `${origin}/robots.txt`

  let raw = ""
  try {
    const response = await fetch(robotsUrl)
    if (!response.ok) {
      return {
        url: robotsUrl,
        disallow: [],
        allow: [],
        sitemaps: []
      }
    }
    raw = await response.text()
  } catch {
    return {
      url: robotsUrl,
      disallow: [],
      allow: [],
      sitemaps: []
    }
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

  return {
    url: robotsUrl,
    disallow,
    allow,
    sitemaps
  }
}

export function isAllowedByRobots(url, robotsRules) {
  if (!robotsRules) return true
  const path = new URL(url).pathname

  let bestAllow = -1
  let bestDisallow = -1

  for (const rule of robotsRules.allow) {
    const regex = toRegex(rule)
    if (regex.test(path)) bestAllow = Math.max(bestAllow, rule.length)
  }

  for (const rule of robotsRules.disallow) {
    const regex = toRegex(rule)
    if (regex.test(path)) bestDisallow = Math.max(bestDisallow, rule.length)
  }

  return bestAllow >= bestDisallow
}
