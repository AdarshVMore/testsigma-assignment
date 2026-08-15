import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";
import { CandidateGenerator, type Candidate } from "../src/candidate-generator";
import type { ElementFingerprint } from "../src/fingerprint";
import { classify, Scorer } from "../src/scorer";

/**
 * This file IS the weight-tuning harness described in the README: each
 * fixture encodes a target fingerprint as it would have been captured
 * *before* a real-world change (a rename, a copy tweak, a removal), paired
 * with an HTML page representing the DOM *after* that change. If a fixture
 * misclassifies, AUTO_HEAL_MIN_SCORE / MARGIN_MIN / FAILURE_FLOOR or the
 * signal weights in scorer.ts get adjusted until it passes — the thresholds
 * are validated here, not chosen once and left alone.
 *
 * `data-expected="true"` in each fixture HTML is read only by this test's
 * assertions, never by the algorithm — it can't be used to cheat.
 */

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

async function loadFixture(name: string): Promise<void> {
  const file = Bun.file(new URL(`./fixtures/eval/${name}.html`, import.meta.url));
  await page.setContent(await file.text());
}

async function run(target: ElementFingerprint): Promise<{
  result: ReturnType<typeof classify<Candidate>>;
  candidateCount: number;
}> {
  const candidates = await new CandidateGenerator().generate(page, target);
  const scorer = new Scorer();
  const scored = candidates.map((candidate) => ({ candidate, score: scorer.score(target, candidate.fingerprint) }));
  return { result: classify(scored), candidateCount: candidates.length };
}

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

describe("self-healing eval dataset", () => {
  test("id-class-renamed: heals with a high score when only id/class changed", async () => {
    await loadFixture("id-class-renamed");
    const target = baseTarget({
      text: "Submit Order",
      type: "submit",
      classList: ["old-cta", "old-primary"], // pre-rename classes — expected not to match
      domContext: domCtx({ parentTag: "div", ancestorTags: ["div", "form", "body", "html"], siblingIndex: 0, siblingCount: 1 }),
    });

    const { result } = await run(target);

    expect(result.outcome).toBe("healed");
    expect(result.best!.score.total).toBeGreaterThan(0.8);
    const healedElement = await result.best!.candidate.locator.getAttribute("data-expected");
    expect(healedElement).toBe("true");
  });

  test("attribute-drift: still heals, but at a visibly lower score than a clean id/class rename", async () => {
    await loadFixture("attribute-drift");
    const target = baseTarget({
      text: "Submit Order",
      ariaLabel: "Submit your order", // old wording — drifted since
      classList: ["btn-checkout", "btn-large"], // old classes
      domContext: domCtx({ parentTag: "div", ancestorTags: ["div", "body", "html"], siblingIndex: 0, siblingCount: 1 }),
    });

    const { result } = await run(target);

    expect(result.outcome).toBe("healed");
    expect(result.best!.score.total).toBeGreaterThanOrEqual(0.65);
    expect(result.best!.score.total).toBeLessThan(0.85); // meaningfully lower than the clean-rename case above
    const healedElement = await result.best!.candidate.locator.getAttribute("data-expected");
    expect(healedElement).toBe("true");
  });

  test("ambiguous-duplicates: declines to guess between structurally identical candidates", async () => {
    await loadFixture("ambiguous-duplicates");
    const target = baseTarget({
      text: "Delete",
      classList: ["btn-delete"],
      domContext: domCtx({ parentTag: "td", ancestorTags: ["td", "tr", "tbody", "table"], siblingIndex: 0, siblingCount: 1 }),
    });

    const { result, candidateCount } = await run(target);

    expect(candidateCount).toBe(3);
    expect(result.outcome).toBe("ambiguous");
    expect(result.margin).toBeLessThan(0.15);
  });

  test("element-removed: reports failure rather than forcing an unrelated match", async () => {
    await loadFixture("element-removed");
    const target = baseTarget({
      text: "Submit Order",
      type: "submit",
      classList: ["old-cta"],
    });

    const { result, candidateCount } = await run(target);

    expect(candidateCount).toBe(0);
    expect(result.outcome).toBe("failed");
    expect(result.best).toBeNull();
  });
});
