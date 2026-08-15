import { ReportModel, type TestResult } from "./model";

export interface RenderOptions {
  title?: string;
  /**
   * Resolves a TestResult's `screenshot` path to raw file bytes so it can be
   * base64-inlined into the report (a "shareable" single-file HTML report
   * shouldn't depend on relative image paths still being valid wherever
   * it's opened). Defaults to reading via `Bun.file()`; injectable so
   * renderer.test.ts doesn't need real files on disk. Returns null if the
   * file can't be found — rendered as a visible note, not a crash.
   */
  loadScreenshot?: (path: string) => Promise<Uint8Array | null>;
}

const defaultLoadScreenshot = async (path: string): Promise<Uint8Array | null> => {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return new Uint8Array(await file.arrayBuffer());
};

function guessMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

/**
 * All interpolated user-controlled text (test names, error/stack traces)
 * MUST go through this before being placed in the template — error
 * messages routinely contain `<`/`&`/quotes (stack traces, assertion
 * diffs), and without escaping they'd corrupt the HTML or, worse, be a
 * textbook stored-content-injection vector if the report is ever hosted
 * rather than opened locally.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class HtmlRenderer {
  async render(results: TestResult[], options: RenderOptions = {}): Promise<string> {
    const loadScreenshot = options.loadScreenshot ?? defaultLoadScreenshot;
    const title = options.title ?? "Test Report";
    const summary = new ReportModel(results).summary();

    const rowsHtml = (await Promise.all(results.map((r) => this.renderRow(r, loadScreenshot)))).join("\n");

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <div class="summary">
    <div class="stat"><span class="stat-value">${summary.total}</span><span class="stat-label">Total</span></div>
    <div class="stat stat-passed"><span class="stat-value">${summary.passed}</span><span class="stat-label">Passed</span></div>
    <div class="stat stat-failed"><span class="stat-value">${summary.failed}</span><span class="stat-label">Failed</span></div>
    <div class="stat stat-skipped"><span class="stat-value">${summary.skipped}</span><span class="stat-label">Skipped</span></div>
    <div class="stat"><span class="stat-value">${(summary.passRate * 100).toFixed(0)}%</span><span class="stat-label">Pass rate</span></div>
    <div class="stat"><span class="stat-value">${(summary.totalDurationMs / 1000).toFixed(2)}s</span><span class="stat-label">Duration</span></div>
  </div>
</header>
<main>
${rowsHtml}
</main>
</body>
</html>
`;
  }

  private async renderRow(
    result: TestResult,
    loadScreenshot: NonNullable<RenderOptions["loadScreenshot"]>,
  ): Promise<string> {
    const name = escapeHtml(result.name);
    const duration = result.duration !== undefined ? `${result.duration}ms` : "—";
    const badgeSymbol = { passed: "✓", failed: "✘", skipped: "–" }[result.status];

    let errorHtml = "";
    if (result.error) {
      errorHtml = `<pre class="error">${escapeHtml(result.error)}</pre>`;
    }

    let screenshotHtml = "";
    if (result.screenshot) {
      const bytes = await loadScreenshot(result.screenshot);
      if (bytes) {
        const base64 = Buffer.from(bytes).toString("base64");
        const mime = guessMimeType(result.screenshot);
        screenshotHtml = `<img class="screenshot" src="data:${mime};base64,${base64}" alt="Screenshot for ${name}" />`;
      } else {
        screenshotHtml = `<p class="screenshot-missing">Screenshot not found: ${escapeHtml(result.screenshot)}</p>`;
      }
    }

    return `<article class="result status-${result.status}">
  <div class="result-header">
    <span class="badge">${badgeSymbol}</span>
    <span class="name">${name}</span>
    <span class="duration">${duration}</span>
  </div>
  ${errorHtml}
  ${screenshotHtml}
</article>`;
  }
}

const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem; background: #f7f7f9; color: #1a1a1e;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  h1 { margin: 0 0 1rem; font-size: 1.4rem; }
  .summary { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 2rem; }
  .stat {
    background: #fff; border: 1px solid #e2e2e8; border-radius: 8px;
    padding: 0.75rem 1.25rem; min-width: 80px; text-align: center;
  }
  .stat-value { display: block; font-size: 1.5rem; font-weight: 600; }
  .stat-label { display: block; font-size: 0.75rem; color: #6b6b76; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-passed .stat-value { color: #1a8a4a; }
  .stat-failed .stat-value { color: #c62828; }
  .stat-skipped .stat-value { color: #8a8a94; }
  main { display: flex; flex-direction: column; gap: 0.75rem; max-width: 900px; }
  .result { background: #fff; border: 1px solid #e2e2e8; border-left-width: 4px; border-radius: 8px; padding: 1rem 1.25rem; }
  .result.status-passed { border-left-color: #1a8a4a; }
  .result.status-failed { border-left-color: #c62828; }
  .result.status-skipped { border-left-color: #8a8a94; }
  .result-header { display: flex; align-items: center; gap: 0.75rem; }
  .badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 1.5rem; height: 1.5rem; border-radius: 999px; font-size: 0.85rem; font-weight: 700; color: #fff;
  }
  .status-passed .badge { background: #1a8a4a; }
  .status-failed .badge { background: #c62828; }
  .status-skipped .badge { background: #8a8a94; }
  .name { flex: 1; font-weight: 500; word-break: break-word; }
  .duration { color: #6b6b76; font-size: 0.85rem; font-variant-numeric: tabular-nums; }
  .error {
    margin: 0.75rem 0 0; padding: 0.75rem; background: #fff5f5; border: 1px solid #f3caca;
    border-radius: 6px; font-size: 0.8rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word;
  }
  .screenshot { margin-top: 0.75rem; max-width: 100%; border: 1px solid #e2e2e8; border-radius: 6px; }
  .screenshot-missing { margin-top: 0.5rem; font-size: 0.8rem; color: #8a8a94; font-style: italic; }
`;
