function detectTemplate(url) {
  const pathname = new URL(url).pathname
  if (pathname === "/") return "home"
  if (pathname.startsWith("/products/")) return "product"
  if (pathname.startsWith("/collections/")) return "collection"
  if (pathname.startsWith("/blogs/")) return "blog"
  if (pathname.startsWith("/pages/")) return "page"
  return "page"
}

export function annotateTemplates(results) {
  return results.map((page) => ({
    ...page,
    template: detectTemplate(page.url)
  }))
}

export function buildTemplateSummary(results) {
  const templates = {}

  for (const page of results) {
    if (!templates[page.template]) {
      templates[page.template] = {
        pages: 0,
        totalViolations: 0,
        impacts: {
          critical: 0,
          serious: 0,
          moderate: 0,
          minor: 0,
          unknown: 0
        }
      }
    }

    templates[page.template].pages += 1
    for (const violation of page.violations) {
      const count = Math.max(1, violation.nodes.length)
      templates[page.template].totalViolations += count
      templates[page.template].impacts[violation.impact || "unknown"] += count
    }
  }

  return { templates }
}
