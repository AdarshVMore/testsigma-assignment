import { ConfigurableLogParser, PLAYWRIGHT_LIST_REPORTER } from "../../packages/test-reporter/src/parser";
import { HtmlRenderer } from "../../packages/test-reporter/src/renderer";

/**
 * Demo requirement #3: raw test execution logs converted into a standalone
 * HTML report with pass/fail results and screenshots.
 *
 * `raw-run.log` is the real, unedited stdout captured from actually running
 * examples/self-healing/demo.spec.ts (see README "Important decisions" —
 * Decision 5/6) — not a synthetic fixture. Regenerate it with:
 *   FORCE_COLOR=1 bunx playwright test --config packages/self-healing/playwright.config.ts \
 *     > examples/reporter/raw-run.log 2>&1
 */
async function main() {
  const logPath = new URL("./raw-run.log", import.meta.url);
  const rawLog = await Bun.file(logPath).text();

  const results = new ConfigurableLogParser().parse(rawLog, PLAYWRIGHT_LIST_REPORTER);

  const html = await new HtmlRenderer().render(results, { title: "Self-Healing Locator — Test Report" });

  const outputPath = new URL("./output/report.html", import.meta.url);
  await Bun.write(outputPath, html);

  console.log(`Parsed ${results.length} test result(s) from ${logPath.pathname}`);
  for (const r of results) {
    console.log(`  [${r.status}] ${r.name}${r.duration !== undefined ? ` (${r.duration}ms)` : ""}`);
  }
  console.log(`Wrote ${outputPath.pathname}`);
}

main();
