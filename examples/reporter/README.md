# Reporter example

Demo requirement #3: raw test execution logs converted into a standalone
pass/fail HTML report with screenshots.

`raw-run.log` is the **real, unedited** stdout captured from actually
running `examples/self-healing/demo.spec.ts` — not a synthetic fixture (see
root README "Important decisions", Decision 5). It includes ANSI color
codes, a passing test with embedded screenshot markers, an intentionally
ambiguous-but-passing test, a genuinely failing assertion with its full
Playwright error/stack output, and a skipped test.

## Run

```bash
bun run demo:reporter
```

This parses `raw-run.log` with the built-in `PLAYWRIGHT_LIST_REPORTER`
definition and writes `output/report.html` — open it directly in a browser.

## Regenerating `raw-run.log`

```bash
cd /path/to/repo
FORCE_COLOR=1 bunx playwright test --config packages/self-healing/playwright.config.ts \
  > examples/reporter/raw-run.log 2>&1
```

(`FORCE_COLOR=1` is only there so the captured log still contains ANSI
codes even though stdout isn't a real TTY when piped to a file — otherwise
Playwright disables color automatically, which would understate what the
parser needs to handle.)
