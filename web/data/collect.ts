/**
 * Builds web/data/snapshot.json for the frontend to consume.
 *
 * This is NOT synthetic/mock data — every number here comes from actually
 * running the real backend classes:
 *  - self-healing scenarios: the real eval fixtures (packages/self-healing/tests/fixtures/eval)
 *    plus the demo scenario, run through the real CandidateGenerator/Scorer/classify pipeline.
 *  - visual regression: the real examples/visual-regression/output/result.json.
 *  - test run: the real examples/reporter/raw-run.log, re-parsed through the real ConfigurableLogParser.
 *
 * Regenerate with: bun run web:collect
 */
import { chromium, type Page } from "playwright";
import { CandidateGenerator } from "../../packages/self-healing/src/candidate-generator";
import { FingerprintExtractor, type ElementFingerprint } from "../../packages/self-healing/src/fingerprint";
import { classify, Scorer } from "../../packages/self-healing/src/scorer";
import { ReportModel } from "../../packages/test-reporter/src/model";
import { ConfigurableLogParser, PLAYWRIGHT_LIST_REPORTER } from "../../packages/test-reporter/src/parser";
import type { ArtifactEntry, CandidateDTO, HealingScenario, Snapshot, VisualRegressionResult } from "../src/types";

const REPO_ROOT = new URL("../../", import.meta.url);
const repoPath = (relative: string) => new URL(relative, REPO_ROOT).pathname;

const domCtx = (overrides: Partial<ElementFingerprint["domContext"]>) => ({
  parentTag: null,
  ancestorTags: [],
  siblingIndex: 0,
  siblingCount: 1,
  ...overrides,
});

const baseTarget = (overrides: Partial<ElementFingerprint>): ElementFingerprint => ({
  tag: "button",
  text: "",
  ariaLabel: null,
  role: "button",
  name: null,
  placeholder: null,
  type: null,
  id: null,
  classList: [],
  attributes: {},
  domContext: domCtx({}),
  ...overrides,
});

interface ScenarioSpec {
  id: string;
  title: string;
  description: string;
  source: string;
  originalSelector: string;
  fixtureFile?: string;
  target: ElementFingerprint;
}

const FIXTURE_SCENARIOS: ScenarioSpec[] = [
  {
    id: "id-class-rename",
    title: "Clean id/class rename",
    description:
      "A routine refactor renamed the submit button's id and class. Text, type and DOM position are untouched.",
    source: "packages/self-healing/tests/fixtures/eval/id-class-renamed.html",
    originalSelector: "#cta-submit-order",
    fixtureFile: "id-class-renamed.html",
    target: baseTarget({
      text: "Submit Order",
      type: "submit",
      classList: ["old-cta", "old-primary"],
      domContext: domCtx({ parentTag: "div", ancestorTags: ["div", "form", "body", "html"], siblingIndex: 0, siblingCount: 1 }),
    }),
  },
  {
    id: "attribute-drift",
    title: "Attribute drift",
    description:
      "id, class AND the aria-label wording all drifted — a copywriter tweaked the accessible label too. Only the visible text held steady.",
    source: "packages/self-healing/tests/fixtures/eval/attribute-drift.html",
    originalSelector: "#checkout-cta-v2",
    fixtureFile: "attribute-drift.html",
    target: baseTarget({
      text: "Submit Order",
      ariaLabel: "Submit your order",
      classList: ["btn-checkout", "btn-large"],
      domContext: domCtx({ parentTag: "div", ancestorTags: ["div", "body", "html"], siblingIndex: 0, siblingCount: 1 }),
    }),
  },
  {
    id: "ambiguous-duplicates",
    title: "Ambiguous duplicates",
    description:
      "A table of identical rows, each with a Delete button. The target row's id changed, but every row's button is structurally identical — nothing safely distinguishes them.",
    source: "packages/self-healing/tests/fixtures/eval/ambiguous-duplicates.html",
    originalSelector: "#row-2-delete",
    fixtureFile: "ambiguous-duplicates.html",
    target: baseTarget({
      text: "Delete",
      classList: ["btn-delete"],
      domContext: domCtx({ parentTag: "td", ancestorTags: ["td", "tr", "tbody", "table"], siblingIndex: 0, siblingCount: 1 }),
    }),
  },
  {
    id: "element-removed",
    title: "Element genuinely removed",
    description:
      "The checkout flow was redesigned to auto-submit — the button was actually deleted from the page, not just renamed.",
    source: "packages/self-healing/tests/fixtures/eval/element-removed.html",
    originalSelector: "#legacy-submit-order-btn",
    fixtureFile: "element-removed.html",
    target: baseTarget({
      text: "Submit Order",
      type: "submit",
      classList: ["old-cta"],
    }),
  },
];

async function buildFixtureScenario(page: Page, spec: ScenarioSpec): Promise<HealingScenario> {
  const html = await Bun.file(
    repoPath(`packages/self-healing/tests/fixtures/eval/${spec.fixtureFile}`),
  ).text();
  await page.setContent(html);
  return scoreScenario(page, spec, spec.target, undefined);
}

async function buildDemoScenario(page: Page): Promise<HealingScenario> {
  await page.setContent(`
    <html><body>
      <form>
        <button id="save-draft-btn" class="btn-secondary" type="button">Save Draft</button>
        <button id="legacy-submit-btn" class="btn-legacy" type="submit">Submit Order</button>
      </form>
    </body></html>
  `);

  const targetLocator = page.locator("#legacy-submit-btn");
  const target = await new FingerprintExtractor().extract(targetLocator);
  const targetOuterHtml = await targetLocator.evaluate((el: Element) => el.outerHTML);

  // Simulate the deploy that renamed the button, same as examples/self-healing/demo.spec.ts.
  await page.evaluate(() => {
    const el = document.querySelector("#legacy-submit-btn")!;
    el.id = "cta-2024-submit";
    el.className = "button-refactored primary-refactored";
  });

  const spec: ScenarioSpec = {
    id: "legacy-submit-button",
    title: "Legacy submit button (live demo)",
    description:
      "The scenario exercised by examples/self-healing/demo.spec.ts: a decoy 'Save Draft' button sits next to the real target, proving healing doesn't just grab the first plausible element on the page.",
    source: "examples/self-healing/demo.spec.ts",
    originalSelector: "#legacy-submit-btn",
    target,
  };

  return scoreScenario(page, spec, target, targetOuterHtml);
}

async function scoreScenario(
  page: Page,
  spec: ScenarioSpec,
  target: ElementFingerprint,
  targetOuterHtml: string | undefined,
): Promise<HealingScenario> {
  const rawCandidates = await new CandidateGenerator().generate(page, target);
  const scorer = new Scorer();

  const candidates: CandidateDTO[] = await Promise.all(
    rawCandidates.map(async (candidate, index) => ({
      id: `${spec.id}-c${index}`,
      outerHtml: await candidate.locator.evaluate((el: Element) => el.outerHTML),
      fingerprint: candidate.fingerprint,
      score: scorer.score(target, candidate.fingerprint),
    })),
  );
  candidates.sort((a, b) => b.score.total - a.score.total);

  const classified = classify(candidates.map((c) => ({ candidate: c, score: c.score })));

  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    originalSelector: spec.originalSelector,
    source: spec.source,
    outcome: classified.outcome,
    score: classified.best?.score.total ?? null,
    margin: classified.margin,
    candidatesConsidered: candidates.length,
    target,
    targetOuterHtml,
    candidates,
    winningCandidateId: classified.outcome === "healed" ? classified.best!.candidate.id : null,
  };
}

async function collectSelfHealing(): Promise<HealingScenario[]> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const scenarios: HealingScenario[] = [];
    scenarios.push(await buildDemoScenario(page));
    for (const spec of FIXTURE_SCENARIOS) {
      scenarios.push(await buildFixtureScenario(page, spec));
    }
    return scenarios;
  } finally {
    await browser.close();
  }
}

async function collectVisualRegression(): Promise<VisualRegressionResult> {
  const resultPath = repoPath("examples/visual-regression/output/result.json");
  const raw = JSON.parse(await Bun.file(resultPath).text());

  return {
    passed: raw.passed,
    diffPercentage: raw.diffPercentage,
    dimensionMismatch: raw.dimensionMismatch,
    beforeSize: raw.beforeSize,
    afterSize: raw.afterSize,
    regions: raw.regions,
    config: raw.config,
    images: {
      before: "examples/visual-regression/before.png",
      after: "examples/visual-regression/after.png",
      diff: "examples/visual-regression/output/diff.png",
      highlighted: "examples/visual-regression/output/highlighted.png",
    },
  };
}

async function collectTestRun() {
  const logPath = repoPath("examples/reporter/raw-run.log");
  const rawLog = await Bun.file(logPath).text();
  const results = new ConfigurableLogParser().parse(rawLog, PLAYWRIGHT_LIST_REPORTER);
  const summary = new ReportModel(results).summary();

  return {
    id: "demo-spec-run",
    label: "examples/self-healing/demo.spec.ts",
    source: "examples/reporter/raw-run.log",
    results,
    summary,
  };
}

function collectArtifacts(): ArtifactEntry[] {
  return [
    { id: "sh-01", label: "Before rename", kind: "screenshot", path: "examples/self-healing/output/01-before-rename.png", sourceScreen: "self-healing" },
    { id: "sh-02", label: "After rename, before heal", kind: "screenshot", path: "examples/self-healing/output/02-after-rename-before-heal.png", sourceScreen: "self-healing" },
    { id: "sh-03", label: "After heal + click", kind: "screenshot", path: "examples/self-healing/output/03-after-heal-and-click.png", sourceScreen: "self-healing" },
    { id: "vr-before", label: "Baseline screenshot", kind: "screenshot", path: "examples/visual-regression/before.png", sourceScreen: "visual-diff" },
    { id: "vr-after", label: "Current screenshot", kind: "screenshot", path: "examples/visual-regression/after.png", sourceScreen: "visual-diff" },
    { id: "vr-diff", label: "Diff heatmap", kind: "diff-image", path: "examples/visual-regression/output/diff.png", sourceScreen: "visual-diff" },
    { id: "vr-highlighted", label: "Highlighted regions", kind: "diff-image", path: "examples/visual-regression/output/highlighted.png", sourceScreen: "visual-diff" },
    { id: "vr-result", label: "Comparison result", kind: "json", path: "examples/visual-regression/output/result.json", sourceScreen: "visual-diff" },
    { id: "rp-log", label: "Raw Playwright stdout", kind: "log", path: "examples/reporter/raw-run.log", sourceScreen: "reports" },
    { id: "rp-report", label: "Generated HTML report", kind: "report", path: "examples/reporter/output/report.html", sourceScreen: "reports" },
  ];
}

async function main() {
  console.log("Collecting self-healing scenarios (launching Chromium)...");
  const scenarios = await collectSelfHealing();
  console.log(`  ${scenarios.length} scenarios: ${scenarios.map((s) => `${s.id}=${s.outcome}`).join(", ")}`);

  console.log("Reading visual regression result...");
  const visualRegression = await collectVisualRegression();

  console.log("Parsing test run log...");
  const testRun = await collectTestRun();
  console.log(`  ${testRun.summary.total} tests: ${testRun.summary.passed} passed, ${testRun.summary.failed} failed, ${testRun.summary.skipped} skipped`);

  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(),
    selfHealing: { scenarios },
    visualRegression,
    testRun,
    artifacts: collectArtifacts(),
  };

  const outPath = new URL("./snapshot.json", import.meta.url);
  await Bun.write(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`Wrote ${outPath.pathname}`);
}

main();
