import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"

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

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream"
}

function safeResolve(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0])
  const relative = decoded === "/" ? "/index.html" : decoded
  const normalized = path.normalize(relative).replace(/^([.]{2}[\\/])+/, "")
  return path.join(root, normalized)
}

export async function serveDashboard({ reportDir, port }) {
  const root = path.resolve(reportDir)

  const server = http.createServer(async (req, res) => {
    const filePath = safeResolve(root, req.url || "/")

    try {
      const stat = await fs.stat(filePath)
      const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath
      const data = await fs.readFile(finalPath)
      res.writeHead(200, { "content-type": contentType(finalPath) })
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
}
