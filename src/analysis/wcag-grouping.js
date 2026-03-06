const KNOWN_IMPACTS = new Set(["critical", "serious", "moderate", "minor"])

function newImpactCounter() {
  return { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 }
}

export function buildSeveritySummary(results) {
  const impacts = newImpactCounter()
  let totalViolations = 0
  let totalPasses = 0
  let totalIncomplete = 0

  for (const page of results) {
    for (const violation of page.violations) {
      const count = Math.max(1, violation.nodes.length)
      const key = KNOWN_IMPACTS.has(violation.impact) ? violation.impact : "unknown"
      impacts[key] += count
      totalViolations += count
    }

    if (page.passes) {
      for (const pass of page.passes) {
        totalPasses += Math.max(1, pass.nodes.length)
      }
    }

    if (page.incomplete) {
      for (const item of page.incomplete) {
        totalIncomplete += Math.max(1, item.nodes.length)
      }
    }
  }

  return { totalViolations, totalPasses, totalIncomplete, impacts }
}

export function buildWcagSummary(results) {
  const levels = {
    wcag2a: 0,
    wcag2aa: 0,
    wcag2aaa: 0,
    wcag21a: 0,
    wcag21aa: 0,
    wcag21aaa: 0,
    wcag22a: 0,
    wcag22aa: 0,
    wcag22aaa: 0
  }

  for (const page of results) {
    for (const violation of page.violations) {
      const count = Math.max(1, violation.nodes.length)
      for (const key of Object.keys(levels)) {
        if (violation.tags.includes(key)) levels[key] += count
      }
    }
  }

  return { levels }
}
