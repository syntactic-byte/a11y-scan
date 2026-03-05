import AxeBuilder from "@axe-core/playwright"
import axe from "axe-core"

const WCAG_TAGS_BY_LEVEL = {
  A: ["wcag2a", "wcag21a", "wcag22a"],
  AA: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"],
  AAA: [
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
}

function mapNodes(nodes) {
  return nodes.map((node) => ({
    target: node.target,
    html: node.html,
    failureSummary: node.failureSummary
  }))
}

function getRulesForTags(tags) {
  const rules = axe.getRules(tags)
  return rules.map((rule) => rule.ruleId)
}

/**
 * Run axe-core accessibility analysis on a Playwright page.
 *
 * @param {import("playwright").Page} page
 * @param {string} locale  – reserved for future locale object support
 * @param {"A"|"AA"|"AAA"} wcagLevel
 */
export async function runAxe(page, locale, wcagLevel = "AAA") {
  const tags = WCAG_TAGS_BY_LEVEL[wcagLevel] || WCAG_TAGS_BY_LEVEL.AAA
  const rulesRun = getRulesForTags(tags)
  
  const builder = new AxeBuilder({ page })
    .withRules(rulesRun)

  // Note: @axe-core/playwright expects a full locale *object*, not a string
  // identifier.  Passing a bare string like "de" would throw.  Until we ship
  // bundled locale JSONs we skip locale configuration and always run English.
  // This keeps the option wired so a future release can accept a path/object.

  const result = await builder.analyze()

  return {
    rulesRun,
    passes: result.passes.map((pass) => ({
      id: pass.id,
      impact: null,
      help: pass.help,
      description: pass.description,
      helpUrl: pass.helpUrl,
      tags: pass.tags,
      nodes: mapNodes(pass.nodes)
    })),
    violations: result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact || "unknown",
      help: violation.help,
      description: violation.description,
      helpUrl: violation.helpUrl,
      tags: violation.tags,
      nodes: mapNodes(violation.nodes)
    })),
    incomplete: result.incomplete.map((item) => ({
      id: item.id,
      impact: item.impact || "unknown",
      help: item.help,
      description: item.description,
      helpUrl: item.helpUrl,
      tags: item.tags,
      nodes: mapNodes(item.nodes)
    })),
    inapplicable: result.inapplicable.map((item) => ({
      id: item.id,
      help: item.help,
      description: item.description,
      helpUrl: item.helpUrl,
      tags: item.tags
    }))
  }
}
