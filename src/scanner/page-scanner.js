import fs from "node:fs/promises"
import path from "node:path"
import { runAxe } from "./axe-runner.js"
import { BrowserPool } from "./browser-pool.js"
import { safeSlug } from "../utils/url-utils.js"

async function runKeyboardCheck(page) {
  const focusableCount = await page.$$eval(
    "a, button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    (elements) => elements.length
  )

  let changedFocus = 0
  for (let i = 0; i < Math.min(10, focusableCount); i += 1) {
    await page.keyboard.press("Tab")
    const hasFocus = await page.evaluate(() => document.activeElement && document.activeElement !== document.body)
    if (hasFocus) changedFocus += 1
  }

  return {
    focusableCount,
    tabStopsReached: changedFocus
  }
}

async function runAriaCheck(page) {
  const invalidAriaAttributes = await page.evaluate(() => {
    const validPrefix = /^aria-[a-z-]+$/
    const allElements = Array.from(document.querySelectorAll("*"))
    let invalid = 0

    for (const element of allElements) {
      for (const name of element.getAttributeNames()) {
        if (name.startsWith("aria-") && !validPrefix.test(name)) invalid += 1
      }
    }

    return invalid
  })

  return { invalidAriaAttributes }
}

async function runFocusOrderCheck(page) {
  const labels = await page.$$eval(
    "a, button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    (elements) => elements.slice(0, 20).map((el) => ({
      tag: el.tagName.toLowerCase(),
      tabindex: el.getAttribute("tabindex") || "0",
      text: (el.textContent || "").trim().slice(0, 40)
    }))
  )

  return { firstFocusableElements: labels }
}

async function scanSinglePage(page, url, options) {
  const start = Date.now()
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout })
  await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeout, 7000) }).catch(() => {})
  await page.waitForTimeout(300)

  const [title, violations] = await Promise.all([
    page.title(),
    runAxe(page, options.locale)
  ])

  const checks = {}
  if (options.checkKeyboard) checks.keyboard = await runKeyboardCheck(page)
  if (options.checkAria) checks.aria = await runAriaCheck(page)
  if (options.checkFocusOrder) checks.focusOrder = await runFocusOrderCheck(page)

  if (options.contrastScreenshots && violations.some((v) => v.id === "color-contrast")) {
    const screenshotsDir = path.join(options.reportDir, "raw", "screenshots")
    await fs.mkdir(screenshotsDir, { recursive: true })
    await page.screenshot({ path: path.join(screenshotsDir, `${safeSlug(url)}.png`), fullPage: true })
  }

  return {
    url,
    title,
    status: "ok",
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    violations,
    checks
  }
}

export async function scanPages(urls, options, logger) {
  logger.info(`Scanning ${urls.length} pages with concurrency ${options.concurrency}`)

  const pool = new BrowserPool({
    concurrency: options.concurrency,
    headless: options.headless
  })

  await pool.init()

  const results = await pool.run(urls, async ({ context, url, index }) => {
    logger.progress("Scanning page", index + 1, urls.length)
    const page = await context.newPage()
    try {
      const result = await scanSinglePage(page, url, options)
      await page.close()
      return result
    } catch (error) {
      await page.close()
      return {
        url,
        title: "",
        status: "error",
        scannedAt: new Date().toISOString(),
        durationMs: 0,
        violations: [],
        checks: {},
        error: error.message
      }
    }
  })

  await pool.close()
  return results
}
