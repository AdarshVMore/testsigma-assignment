import { expect, test } from "bun:test";
import { ReportModel, type TestResult } from "../src/model";

function results(...partials: Partial<TestResult>[]): TestResult[] {
  return partials.map((p) => ({ name: "unnamed", status: "passed", ...p }));
}

test("summary counts each status and totals duration", () => {
  const model = new ReportModel(
    results(
      { name: "a", status: "passed", duration: 100 },
      { name: "b", status: "passed", duration: 200 },
      { name: "c", status: "failed", duration: 50 },
      { name: "d", status: "skipped" },
    ),
  );

  const summary = model.summary();

  expect(summary.total).toBe(4);
  expect(summary.passed).toBe(2);
  expect(summary.failed).toBe(1);
  expect(summary.skipped).toBe(1);
  expect(summary.totalDurationMs).toBe(350);
});

test("pass rate excludes skipped tests from the denominator", () => {
  const model = new ReportModel(
    results({ status: "passed" }, { status: "passed" }, { status: "failed" }, { status: "skipped" }, { status: "skipped" }),
  );

  // 2 passed / (2 passed + 1 failed) = 0.666..., not / 5 total.
  expect(model.summary().passRate).toBeCloseTo(2 / 3, 5);
});

test("empty result set has a well-defined (not NaN) pass rate", () => {
  const model = new ReportModel([]);
  const summary = model.summary();
  expect(summary.total).toBe(0);
  expect(summary.passRate).toBe(0);
});
