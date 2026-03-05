import path from "node:path"
import { discoverUrls } from "./crawler/crawler.js"
import { scanPages } from "./scanner/page-scanner.js"
import { buildWcagSummary, buildSeveritySummary } from "./analysis/wcag-grouping.js"
import { buildRuleSummary } from "./analysis/rule-grouping.js"
import { annotateTemplates, buildTemplateSummary } from "./analysis/template-detection.js"
import { generateReports } from "./reporting/generate-reports.js"
import { createLogger } from "./utils/logger.js"

function parseFormats(formatString) {
  return new Set(
    String(formatString || "html,json,csv")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  )
}

function totalByImpact(results, impact) {
  return results.reduce((acc, page) => {
    const pageCount = page.violations.reduce((sum, violation) => {
      if (violation.impact !== impact) return sum
      return sum + Math.max(1, violation.nodes.length)
    }, 0)
    return acc + pageCount
  }, 0)
}

export async function runScan(targetUrl, options) {
  const logger = createLogger()
  const formats = parseFormats(options.format)
  const reportDir = path.resolve(options.reportDir)

  logger.info(`Discovering URLs for ${targetUrl}`)
  const discovered = await discoverUrls(targetUrl, {
    maxPages: options.maxPages,
    concurrency: options.concurrency,
    include: options.include,
    exclude: options.exclude,
    depth: options.depth,
    sitemap: options.sitemap,
    sampleProducts: options.sampleProducts,
    timeout: options.timeout,
    headless: options.headless
  }, logger)

  logger.success(`Found ${discovered.length} pages`)
  const scanResults = await scanPages(discovered, {
    concurrency: options.concurrency,
    locale: options.locale,
    timeout: options.timeout,
    headless: options.headless,
    reportDir,
    checkKeyboard: options.checkKeyboard,
    checkAria: options.checkAria,
    checkFocusOrder: options.checkFocusOrder,
    contrastScreenshots: options.contrastScreenshots
  }, logger)

  const resultsWithTemplates = annotateTemplates(scanResults)
  const severitySummary = buildSeveritySummary(resultsWithTemplates)
  const wcagSummary = buildWcagSummary(resultsWithTemplates)
  const ruleSummary = buildRuleSummary(resultsWithTemplates)
  const templateSummary = buildTemplateSummary(resultsWithTemplates)

  const summary = {
    scannedPages: resultsWithTemplates.length,
    totalViolations: severitySummary.totalViolations,
    totalRulesTriggered: Object.keys(ruleSummary.rules).length,
    startedAt: logger.startedAt,
    finishedAt: new Date().toISOString(),
    options: {
      maxPages: options.maxPages,
      concurrency: options.concurrency,
      include: options.include,
      exclude: options.exclude,
      depth: options.depth,
      locale: options.locale,
      sitemap: options.sitemap,
      sampleProducts: options.sampleProducts,
      timeout: options.timeout,
      headless: options.headless
    }
  }

  await generateReports({
    reportDir,
    formats,
    summary,
    pages: resultsWithTemplates,
    severitySummary,
    wcagSummary,
    ruleSummary,
    templateSummary,
    logs: logger.logs
  })

  const primaryOutput = formats.has("html")
    ? path.join(reportDir, "index.html")
    : path.join(reportDir, "raw", "results.json")

  logger.success(`Report generated at ${primaryOutput}`)

  const criticalCount = totalByImpact(resultsWithTemplates, "critical")
  const seriousCount = totalByImpact(resultsWithTemplates, "serious")

  let exitCode = 0
  if (options.failOnCritical && criticalCount > 0) {
    logger.error(`Failing because critical violations were found (${criticalCount})`)
    exitCode = 2
  }

  if (options.failOnSerious && seriousCount > 0) {
    logger.error(`Failing because serious violations were found (${seriousCount})`)
    exitCode = 2
  }

  return {
    exitCode,
    reportDir,
    summary,
    criticalCount,
    seriousCount
  }
}
