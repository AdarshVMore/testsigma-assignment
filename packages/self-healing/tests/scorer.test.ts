import { expect, test } from "bun:test";
import type { ElementFingerprint } from "../src/fingerprint";
import { AUTO_HEAL_MIN_SCORE, FAILURE_FLOOR, MARGIN_MIN, Scorer } from "../src/scorer";

function fp(overrides: Partial<ElementFingerprint>): ElementFingerprint {
  return {
    tag: "button",
    text: "Submit",
    ariaLabel: null,
    role: "button",
    name: null,
    placeholder: null,
    type: null,
    id: "submit-btn",
    classList: ["btn"],
    attributes: {},
    domContext: { parentTag: "div", ancestorTags: ["div", "form"], siblingIndex: 0, siblingCount: 1 },
    ...overrides,
  };
}

test("only id/class changing (everything else identical) scores at or above the auto-heal threshold", () => {
  const target = fp({});
  const candidate = fp({ id: "submit-btn-v2", classList: ["btn-refactored"] });

  const result = new Scorer().score(target, candidate);

  expect(result.total).toBeGreaterThanOrEqual(AUTO_HEAL_MIN_SCORE);
});

test("a genuinely different element scores below the failure floor", () => {
  const target = fp({ text: "Submit", tag: "button", role: "button" });
  const candidate = fp({
    text: "Cancel",
    tag: "a",
    role: "link",
    classList: ["footer-link"],
    domContext: { parentTag: "footer", ancestorTags: ["footer"], siblingIndex: 5, siblingCount: 6 },
  });

  const result = new Scorer().score(target, candidate);

  expect(result.total).toBeLessThan(FAILURE_FLOOR);
});

test("two near-identical candidates land within the ambiguity margin of each other", () => {
  const target = fp({ text: "Delete" });
  const rowA = fp({ text: "Delete", id: "row-1-delete" });
  const rowB = fp({ text: "Delete", id: "row-2-delete" });

  const scorer = new Scorer();
  const scoreA = scorer.score(target, rowA).total;
  const scoreB = scorer.score(target, rowB).total;

  expect(Math.abs(scoreA - scoreB)).toBeLessThan(MARGIN_MIN);
});

test("breakdown is fully inspectable: declared weights sum to 1.0 and total reconstructs from applicable contributions", () => {
  const result = new Scorer().score(fp({}), fp({}));

  const declaredWeightSum = result.signals.reduce((sum, s) => sum + s.weight, 0);
  expect(Math.round(declaredWeightSum * 100) / 100).toBe(1.0);

  const applicable = result.signals.filter((s) => s.applicable);
  const appliedWeightSum = applicable.reduce((sum, s) => sum + s.weight, 0);
  const appliedContributionSum = applicable.reduce((sum, s) => sum + s.contribution, 0);
  expect(Math.abs(appliedContributionSum / appliedWeightSum - result.total)).toBeLessThan(0.001);
});

test("a signal absent from the target (e.g. no aria-label) is excluded, not scored as a miss", () => {
  const target = fp({ ariaLabel: null });
  const result = new Scorer().score(target, fp({ ariaLabel: "Some unrelated label" }));

  const ariaSignal = result.signals.find((s) => s.signal === "ariaLabel")!;
  expect(ariaSignal.applicable).toBe(false);
});

test("partial text match earns partial credit, not all-or-nothing", () => {
  const target = fp({ text: "Add to Cart" });
  const scorer = new Scorer();

  const same = scorer.score(target, fp({ text: "Add to Cart" })).signals.find((s) => s.signal === "text")!.value;
  const partial = scorer.score(target, fp({ text: "Add to Basket" })).signals.find((s) => s.signal === "text")!.value;
  const none = scorer.score(target, fp({ text: "Checkout Now" })).signals.find((s) => s.signal === "text")!.value;

  expect(same).toBe(1);
  expect(partial).toBeGreaterThan(none);
  expect(partial).toBeLessThan(1);
});

test("matching data-testid contributes even when text/aria-label are absent", () => {
  const target = fp({ text: "", ariaLabel: null, attributes: { "data-testid": "checkout-btn" } });
  const matching = fp({ text: "", ariaLabel: null, attributes: { "data-testid": "checkout-btn" } });
  const nonMatching = fp({ text: "", ariaLabel: null, attributes: { "data-testid": "something-else" } });

  const scorer = new Scorer();
  expect(scorer.score(target, matching).total).toBeGreaterThan(scorer.score(target, nonMatching).total);
});
