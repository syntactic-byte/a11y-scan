# Developer Notes

## Scan pipeline

1. CLI parses arguments in `bin/cli.js`
2. `runScan()` (`src/index.js`) orchestrates discovery, scanning, analysis, and reporting
3. URL discovery order:
   - robots/sitemap detection
   - sitemap index recursion
   - BFS Playwright crawling fallback
4. Scanner uses a browser pool (`src/scanner/browser-pool.js`) and per-page axe checks (`src/scanner/axe-runner.js`)
5. Analysis modules group by severity, WCAG tags, rules, and templates
6. Reporting writes raw + summarized machine files and human HTML dashboards

## Shopify strategy

- Shopify-like routes are inferred from URL paths
- Optional sampling mode (`--sample-products`) includes:
  - homepage
  - up to N product pages
  - up to 5 collection pages
  - all `/pages/*`
  - all `/blogs/*`

## Extending advanced checks

Advanced checks are in `src/scanner/page-scanner.js` and designed to be optional:

- keyboard traversal (`--check-keyboard`)
- ARIA attribute check (`--check-aria`)
- focus order snapshot (`--check-focus-order`)
- contrast screenshots (`--contrast-screenshots`)

Add new checks by:

1. Implementing an async helper in `page-scanner.js`
2. Placing the result under `checks` in each page payload
3. Rendering the new fields in page and dashboard reports if needed

## Performance guidance

- Use sitemap discovery first for large websites
- Increase `--concurrency` gradually (8-20 typical)
- Keep `--timeout` conservative on large runs to avoid queue stalls
- For massive catalogs, combine `--sample-products` with `--max-pages`
