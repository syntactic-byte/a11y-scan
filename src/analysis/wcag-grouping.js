function newImpactCounter() {
  return {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    unknown: 0
  }
}

export function buildSeveritySummary(results) {
  const impacts = newImpactCounter()
  let totalViolations = 0

  for (const page of results) {
    for (const violation of page.violations) {
      const count = Math.max(1, violation.nodes.length)
      impacts[violation.impact || "unknown"] += count
      totalViolations += count
    }
  }

  return {
    totalViolations,
    impacts
  }
}

export function buildWcagSummary(results) {
  const levels = {
    "wcag2a": 0,
    "wcag2aa": 0,
    "wcag2aaa": 0,
    "wcag21a": 0,
    "wcag21aa": 0,
    "wcag21aaa": 0,
    "wcag22a": 0,
    "wcag22aa": 0,
    "wcag22aaa": 0
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
