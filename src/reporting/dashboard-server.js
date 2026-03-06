import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import { runScan } from "../index.js"
import { writeDashboard } from "./html-dashboard.js"

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
}

const WCAG_LEVELS = new Set(["A", "AA", "AAA"])

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream"
}

function safeResolve(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0])
  const relative = decoded === "/" ? "/index.html" : decoded
  const normalized = path.normalize(relative).replace(/^([.]{2}[\\/])+/, "")
  return path.join(root, normalized)
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => { body += chunk })
    req.on("end", () => resolve(body))
    req.on("error", reject)
  })
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(payload))
}

export async function serveDashboard({ reportDir, port, defaultOptions = {}, initialUrl = null }) {
  const root = path.resolve(reportDir)
  let scanRunning = false

  // Always write fresh dashboard HTML so stale generated files never cause JS errors
  await writeDashboard(root)

  async function startScan(url, overrides = {}) {
    const wcagLevel = WCAG_LEVELS.has(overrides.wcagLevel) ? overrides.wcagLevel : (defaultOptions.wcagLevel || "AAA")
    const scanOptions = {
      format: defaultOptions.format || "html,json,csv",
      locale: defaultOptions.locale || "en",
      wcagLevel,
      maxPages: Number(overrides.maxPages ?? defaultOptions.maxPages ?? 2000),
      concurrency: Number(defaultOptions.concurrency ?? 10),
      depth: Number(overrides.depth ?? defaultOptions.depth ?? 6),
      sampleTemplates: Number(overrides.sampleTemplates ?? defaultOptions.sampleTemplates ?? 0),
      timeout: Number(defaultOptions.timeout ?? 30000),
      headless: defaultOptions.headless ?? true,
      include: defaultOptions.include || [],
      exclude: defaultOptions.exclude || [],
      sitemap: defaultOptions.sitemap || null,
      checkKeyboard: defaultOptions.checkKeyboard ?? true,
      checkAria: defaultOptions.checkAria ?? true,
      checkFocusOrder: defaultOptions.checkFocusOrder ?? true,
      contrastScreenshots: defaultOptions.contrastScreenshots ?? false,
      failOnCritical: false,
      failOnSerious: false,
      reportDir: root
    }

    scanRunning = true
    runScan(url, scanOptions)
      .catch((err) => {
        console.log(`\nScan failed: ${err.message}`)
        if (err.stack) console.log(err.stack)
      })
      .finally(() => { scanRunning = false })
  }

  const server = http.createServer(async (req, res) => {
    // POST /api/scan — start a new scan
    if (req.method === "POST" && req.url === "/api/scan") {
      if (scanRunning) {
        sendJson(res, 409, { error: "A scan is already running" })
        return
      }

      try {
        const raw = await readBody(req)
        const params = JSON.parse(raw || "{}")
        const { url, ...overrides } = params

        if (!url || typeof url !== "string") {
          sendJson(res, 400, { error: "url is required" })
          return
        }

        // Validate the URL is parseable
        try { new URL(url) } catch {
          sendJson(res, 400, { error: "Invalid URL" })
          return
        }

        await startScan(url, overrides)
        sendJson(res, 202, { status: "started", url })
      } catch (err) {
        sendJson(res, 400, { error: err.message })
      }
      return
    }

    // GET /api/status — check if scan is running
    if (req.method === "GET" && req.url?.startsWith("/api/status")) {
      sendJson(res, 200, { scanRunning })
      return
    }

    // Static file serving
    const filePath = safeResolve(root, req.url || "/")
    try {
      const stat = await fs.stat(filePath)
      const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath
      const data = await fs.readFile(finalPath)
      const ct = contentType(finalPath)
      const headers = { "content-type": ct }
      if (ct.startsWith("text/html")) headers["cache-control"] = "no-store"
      res.writeHead(200, headers)
      res.end(data)
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
      res.end("Not found. Run a scan first to generate dashboard files.")
    }
  })

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", resolve)
  })

  console.log(`Dashboard available at http://127.0.0.1:${port}`)
  console.log("Press Ctrl+C to stop the server")

  if (initialUrl) {
    console.log(`Starting scan for ${initialUrl}...`)
    await startScan(initialUrl)
  }
}
