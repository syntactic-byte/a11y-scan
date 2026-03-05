const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid"
])

export function normalizeUrl(input, baseUrl) {
  try {
    const url = baseUrl ? new URL(input, baseUrl) : new URL(input)
    url.hash = ""

    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
      url.port = ""
    }

    url.pathname = url.pathname.replace(/\/{2,}/g, "/")
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/$/, "")
    }

    const nextParams = new URLSearchParams()
    for (const [key, value] of [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) continue
      nextParams.append(key, value)
    }

    url.search = nextParams.toString() ? `?${nextParams.toString()}` : ""
    return url.href
  } catch {
    return null
  }
}

export function isSameDomain(a, b) {
  try {
    return new URL(a).hostname === new URL(b).hostname
  } catch {
    return false
  }
}

export function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

function isPatternMatch(url, pattern) {
  const haystack = url.toLowerCase()
  const needle = pattern.toLowerCase()
  if (needle.startsWith("re:")) {
    try {
      const regex = new RegExp(needle.slice(3), "i")
      return regex.test(url)
    } catch {
      return false
    }
  }
  return haystack.includes(needle)
}

export function isIncluded(url, includePatterns) {
  if (!includePatterns || includePatterns.length === 0) return true
  return includePatterns.some((pattern) => isPatternMatch(url, pattern))
}

export function isExcluded(url, excludePatterns) {
  if (!excludePatterns || excludePatterns.length === 0) return false
  return excludePatterns.some((pattern) => isPatternMatch(url, pattern))
}

export function getPathDepth(url, basePathname = "/") {
  const pathname = new URL(url).pathname
  const relative = pathname.startsWith(basePathname) ? pathname.slice(basePathname.length) : pathname
  return relative.split("/").filter(Boolean).length
}

export function safeSlug(input) {
  return input
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180) || "page"
}
