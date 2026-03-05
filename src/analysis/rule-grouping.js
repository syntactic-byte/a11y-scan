export function buildRuleSummary(results) {
  const rules = {}

  for (const page of results) {
    for (const violation of page.violations) {
      if (!rules[violation.id]) {
        rules[violation.id] = {
          id: violation.id,
          help: violation.help,
          helpUrl: violation.helpUrl,
          impact: violation.impact,
          occurrences: 0,
          pages: []
        }
      }

      const count = Math.max(1, violation.nodes.length)
      rules[violation.id].occurrences += count
      rules[violation.id].pages.push({
        url: page.url,
        title: page.title,
        template: page.template,
        nodes: violation.nodes,
        impact: violation.impact
      })
    }
  }

  return { rules }
}
