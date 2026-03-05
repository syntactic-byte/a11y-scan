# a11y-scan

`a11y-scan` is an open-source accessibility scanning platform for large websites. It combines a Node.js CLI, Playwright rendering, axe-core analysis, and structured HTML/JSON/CSV reporting.

## Features

- Automatic URL discovery via `sitemap.xml`, sitemap indexes, and Shopify multi-sitemaps
- Playwright BFS fallback crawling with robots.txt support and depth controls
- WCAG 2.0/2.1/2.2 scanning across levels A, AA, and AAA with `@axe-core/playwright`
- Concurrency-aware browser pooling for high-volume scans
- Shopify-first URL sampling (`/products`, `/collections`, `/pages`, `/blogs`)
- Structured report output for large sites (no monolithic report file)
- Interactive report dashboard (`a11y-report/index.html`)
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

Generate and immediately serve the dashboard:

```bash
npx a11y-scan@latest https://example.com --dashboard --report-dir ./a11y-report
```

Serve an existing report directory without scanning:

```bash
npx a11y-scan@latest --dashboard --report-dir ./a11y-report --port 4173
```

## CLI Options

- `--max-pages <number>`
- `--concurrency <number>`
- `--exclude <patterns...>`
- `--include <patterns...>`
- `--locale <locale>`
- `--sitemap <url>`
- `--depth <number>`
- `--report-dir <dir>`
- `--format <html,json,csv>`
- `--sample-products <number>`
- `--timeout <ms>`
- `--headless` / `--no-headless`
- `--fail-on-critical`
- `--fail-on-serious`
- `--check-keyboard`
- `--check-aria`
- `--check-focus-order`
- `--contrast-screenshots`
- `--dashboard`
- `--port <number>`

## Report Structure

```text
a11y-report/
  index.html
  summary/
    scan-summary.json
    wcag-summary.json
    severity-summary.json
  rules/
    color-contrast.html
  templates/
    product.html
    collection.html
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
```

## Dashboard App

There is also a React dashboard scaffold in `dashboard/`.

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
- `src/reporting/*` structured report rendering (HTML/JSON/CSV)
- `src/utils/*` URL normalization and logging helpers

Detailed developer notes: `docs/developer.md`.
