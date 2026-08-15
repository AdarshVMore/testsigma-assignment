import { expect, test } from "bun:test";
import { ConfigurableLogParser, PLAYWRIGHT_LIST_REPORTER } from "../src/parser";

const parser = new ConfigurableLogParser();

test("parses passed, failed and skipped statuses with durations", () => {
  const log = [
    "Running 3 tests using 1 worker",
    "",
    "  ✓  1 tests/example.spec.ts:5:1 › adds two numbers (12ms)",
    "  ✘  2 tests/example.spec.ts:9:1 › subtracts two numbers (340ms)",
    "  -  3 tests/example.spec.ts:13:1 › a skipped test",
    "",
    "  1 failed",
    "    tests/example.spec.ts:9:1 › subtracts two numbers",
    "  1 skipped",
    "  1 passed (0.4s)",
  ].join("\n");

  const results = parser.parse(log, PLAYWRIGHT_LIST_REPORTER);

  expect(results).toHaveLength(3);
  expect(results[0]).toMatchObject({ name: "adds two numbers", status: "passed", duration: 12 });
  expect(results[1]).toMatchObject({ name: "subtracts two numbers", status: "failed", duration: 340 });
  expect(results[2]).toMatchObject({ name: "a skipped test", status: "skipped" });
  expect(results[2]!.duration).toBeUndefined();
});

test("converts second-scale durations to milliseconds", () => {
  const log = "  ✓  1 tests/example.spec.ts:5:1 › a slow test (1.2s)";
  const [result] = parser.parse(log, PLAYWRIGHT_LIST_REPORTER);
  expect(result!.duration).toBe(1200);
});

test("attaches the detailed error block to the matching failed test, bounded by the final summary", () => {
  const log = [
    "  ✓  1 tests/example.spec.ts:5:1 › passing test (5ms)",
    "  ✘  2 tests/example.spec.ts:9:1 › failing test (100ms)",
    "",
    "  1) tests/example.spec.ts:9:1 › failing test",
    "",
    "    Error: expect(received).toBe(expected)",
    "",
    "    Expected: 2",
    "    Received: 3",
    "",
    "  1 failed",
    "    tests/example.spec.ts:9:1 › failing test",
    "  1 passed (0.1s)",
  ].join("\n");

  const results = parser.parse(log, PLAYWRIGHT_LIST_REPORTER);
  const failing = results.find((r) => r.name === "failing test")!;

  expect(failing.status).toBe("failed");
  expect(failing.error).toContain("Error: expect(received).toBe(expected)");
  expect(failing.error).toContain("Expected: 2");
  expect(failing.error).toContain("Received: 3");
  // The trailing run summary must not leak into the error text.
  expect(failing.error).not.toContain("1 failed");

  const passing = results.find((r) => r.name === "passing test")!;
  expect(passing.error).toBeUndefined();
});

test("keeps two separate failures' error blocks from bleeding into each other", () => {
  const log = [
    "  ✘  1 tests/example.spec.ts:5:1 › first failure (10ms)",
    "  ✘  2 tests/example.spec.ts:9:1 › second failure (20ms)",
    "",
    "  1) tests/example.spec.ts:5:1 › first failure",
    "",
    "    Error: first error message",
    "",
    "  2) tests/example.spec.ts:9:1 › second failure",
    "",
    "    Error: second error message",
    "",
    "  2 failed",
  ].join("\n");

  const results = parser.parse(log, PLAYWRIGHT_LIST_REPORTER);
  const first = results.find((r) => r.name === "first failure")!;
  const second = results.find((r) => r.name === "second failure")!;

  expect(first.error).toContain("first error message");
  expect(first.error).not.toContain("second error message");
  expect(second.error).toContain("second error message");
  expect(second.error).not.toContain("first error message");
});

test("strips ANSI color codes before matching, producing identical results to plain text", () => {
  const plain = "  ✓  1 tests/example.spec.ts:5:1 › colored test (50ms)";
  const colored = `  \x1b[32m✓\x1b[39m  \x1b[2m1 \x1b[22mtests/example.spec.ts:5:1 \x1b[2m› \x1b[22mcolored test\x1b[2m (50ms)\x1b[22m`;

  const plainResult = parser.parse(plain, PLAYWRIGHT_LIST_REPORTER);
  const coloredResult = parser.parse(colored, PLAYWRIGHT_LIST_REPORTER);

  expect(coloredResult).toEqual(plainResult);
  expect(coloredResult[0]!.name).toBe("colored test");
});

test("associates a [screenshot] marker with the test it appeared during, not an adjacent test", () => {
  const log = [
    "[screenshot] output/step-1.png",
    "[screenshot] output/step-2.png",
    "  ✓  1 tests/example.spec.ts:5:1 › test with screenshots (30ms)",
    "  ✓  2 tests/example.spec.ts:9:1 › test without screenshots (10ms)",
  ].join("\n");

  const results = parser.parse(log, PLAYWRIGHT_LIST_REPORTER);

  // Model only carries one `screenshot` field — last marker logged before
  // the result line wins (see parser.ts docs).
  expect(results[0]).toMatchObject({ name: "test with screenshots", screenshot: "output/step-2.png" });
  expect(results[1]!.screenshot).toBeUndefined();
});

test("unrecognized lines outside any failure block are silently ignored, not misattributed", () => {
  const log = [
    "Running 1 test using 1 worker",
    "[healing] status=healed score=0.87",
    "  ✓  1 tests/example.spec.ts:5:1 › a test (5ms)",
  ].join("\n");

  const results = parser.parse(log, PLAYWRIGHT_LIST_REPORTER);
  expect(results).toHaveLength(1);
  expect(results[0]!.error).toBeUndefined();
});
