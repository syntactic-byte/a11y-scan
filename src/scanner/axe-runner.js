import AxeBuilder from "@axe-core/playwright"

const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag2aaa",
  "wcag21a",
  "wcag21aa",
  "wcag21aaa",
  "wcag22a",
  "wcag22aa",
  "wcag22aaa"
]

function mapNodes(nodes) {
  return nodes.map((node) => ({
    target: node.target,
    html: node.html,
    failureSummary: node.failureSummary
  }))
}

export async function runAxe(page, locale) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS)
  if (locale && locale !== "en") {
    builder.options({ locale })
  }

  const result = await builder.analyze()

  return result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact || "unknown",
    help: violation.help,
    description: violation.description,
    helpUrl: violation.helpUrl,
    tags: violation.tags,
    nodes: mapNodes(violation.nodes)
  }))
}
