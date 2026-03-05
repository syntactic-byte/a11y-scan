# a11y-scan

`a11y-scan` is an open-source accessibility scanning platform for large websites. It combines a Node.js CLI, Playwright rendering, axe-core analysis, and structured HTML/JSON/CSV reporting.

**Requires Node.js >= 18.0.0** (uses native `fetch`).

## Features

- Automatic URL discovery via `sitemap.xml`, sitemap indexes, and Shopify multi-sitemaps
- Playwright BFS fallback crawling with robots.txt support and depth controls
- WCAG 2.0/2.1/2.2 scanning across levels A, AA, and AAA with `@axe-core/playwright`
- Concurrency-aware browser pooling for high-volume scans
- Shopify-first URL sampling (`/products`, `/collections`, `/pages`, `/blogs`)
- Structured report output for large sites (no monolithic report file)
- Live-streaming web dashboard with real-time scan progress (`--dashboard`)
- Hierarchical Violations Explorer (Rule -> Page -> Nodes) for large-site triage
- Manual Audit Checklist for non-automatable AAA criteria
- CI gates (`--fail-on-critical`, `--fail-on-serious`)

## Install

```bash
npm install
npm link
```

Run with npx (no global install):

```bash
npx a11y-scan@latest https://example.com
```

Playwright browser install (first run / CI image setup):

```bash
npx playwright install chromium
```

## Usage

```bash
a11y-scan https://example.com
```

Example:

```bash
a11y-scan https://site.com \
  --concurrency 10 \
  --max-pages 2000 \
  --exclude cart checkout account \
  --report-dir ./a11y-report
```

Generate and immediately serve the live dashboard:

```bash
a11y-scan https://example.com --dashboard --report-dir ./a11y-report
```

With `--dashboard`, the web UI starts first and streams scan progress/results in real time while pages are being scanned. The dashboard automatically stops polling when the scan completes.

Serve an existing report directory without scanning:

```bash
a11y-scan --dashboard --report-dir ./a11y-report --port 4173
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--max-pages <number>` | Maximum pages to scan | `2000` |
| `--concurrency <number>` | Parallel page scans | `10` |
| `--exclude <patterns...>` | Exclude URL patterns (see below) | |
| `--include <patterns...>` | Include URL patterns (see below) | |
| `--locale <locale>` | axe locale (reserved) | `en` |
| `--wcag-level <A\|AA\|AAA>` | WCAG conformance level | `AAA` |
| `--sitemap <url>` | Explicit sitemap URL | |
| `--depth <number>` | BFS crawl depth | `6` |
| `--report-dir <dir>` | Output directory | `./a11y-report` |
| `--format <formats>` | Comma-separated: html,json,csv | `html,json,csv` |
| `--sample-products <number>` | Shopify product sample size | `0` |
| `--timeout <ms>` | Page timeout in milliseconds | `30000` |
| `--headless` / `--no-headless` | Run browser headless or with UI | `true` |
| `--fail-on-critical` | Exit code 2 when critical issues exist | `false` |
| `--fail-on-serious` | Exit code 2 when serious issues exist | `false` |
| `--check-keyboard` | Run keyboard traversal checks | `false` |
| `--check-aria` | Run ARIA attribute checks | `false` |
| `--check-focus-order` | Run focus order checks | `false` |
| `--contrast-screenshots` | Capture contrast screenshots | `false` |
| `--dashboard` | Serve the live dashboard on a local port | `false` |
| `--port <number>` | Dashboard server port | `4173` |

By default, scans run with WCAG `AAA` tags (including 2.0/2.1/2.2 A/AA/AAA sets).

### URL Pattern Filtering

The `--exclude` and `--include` options accept space-separated patterns. Each pattern is matched as a substring against the full URL.

For regex patterns, use the `re:` prefix:

```bash
# Exclude URLs containing "cart" or "checkout"
a11y-scan https://site.com --exclude cart checkout

# Exclude URLs matching a regex pattern
a11y-scan https://site.com --exclude "re:^https://site\\.com/(cart|account)"

# Include only product pages
a11y-scan https://site.com --include "re:/products/"
```

Patterns can also be comma-separated within a single argument:

```bash
a11y-scan https://site.com --exclude cart,checkout,account
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Scan completed successfully (no CI threshold exceeded) |
| `1` | CLI error (missing URL, invalid arguments, runtime crash) |
| `2` | CI threshold exceeded (`--fail-on-critical` or `--fail-on-serious` triggered) |

## Report Structure

```text
a11y-report/
  index.html            # Live-streaming dashboard (self-contained)
  summary/
    scan-summary.json
    wcag-summary.json
    severity-summary.json
  rules/
    color-contrast.html
    ...
  templates/
    product.html
    collection.html
    ...
  pages/
    products/
    collections/
    pages/
    blogs/
    home/
  raw/
    results.json
    results.csv
    rules.json
    templates.json
    scan-logs.json
    live-state.json      # Incremental state used by the dashboard
```

## Dashboards

### Built-in Live Dashboard (recommended)

The built-in dashboard (`--dashboard` flag) is a self-contained HTML file written to `a11y-report/index.html`. It polls `raw/live-state.json` for real-time updates during the scan and stops polling automatically when the scan completes. No additional setup is required.

### React Dashboard (experimental)

There is also a React dashboard scaffold in `dashboard/` built with Vite. This is a separate app intended for further customization:

```bash
npm --prefix dashboard install
npm run dashboard:dev
```

Set `VITE_REPORT_BASE` if your report folder is not `../a11y-report`.

## Architecture

- `bin/cli.js` command parsing and runtime entrypoint
- `src/crawler/*` sitemap, robots, and BFS discovery pipeline
- `src/scanner/*` browser pool + axe/page scanning
- `src/analysis/*` WCAG/rule/template aggregations
- `src/reporting/*` structured report rendering (HTML/JSON/CSV), live-state streaming, dashboard server
- `src/utils/*` URL normalization, HTML escaping, fetch timeout, and logging helpers

Detailed developer notes: `docs/developer.md`.
