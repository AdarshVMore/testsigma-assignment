import type { TestResult } from "./model";

/**
 * A `ParserDefinition` is pure declarative data — regexes and field maps,
 * never embedded functions — so a definition is just JSON: safe to load,
 * inspect, and (in future work) safe for an LLM to generate, since nothing
 * in it is ever `eval`'d as code. Adding a new log format means writing a
 * new definition, not adding an if/else branch to a growing parser.
 *
 * The engine understands a fixed, small vocabulary of four line "roles" —
 * that vocabulary (not the regexes) is the one thing that isn't
 * per-format-configurable in this V1. It's broad enough to cover most CI
 * runner output shapes (inline pass/fail summary line, an optional detailed
 * failure dump, an optional attachment marker), but a format that doesn't
 * fit this shape at all would need a new role, not just a new definition.
 */
export type LineRole = "testResult" | "failureDetailStart" | "attachment" | "errorBoundary";

export interface LineRule {
  role: LineRole;
  /** Must use named capture groups matching the fields this role needs (see each role's docs below). */
  pattern: RegExp;
  /** Required for the "testResult" role: maps the matched status glyph/word to a normalized status. */
  statusMap?: Record<string, TestResult["status"]>;
}

export interface ParserDefinition {
  name: string;
  /** Strip ANSI color escape codes before matching — most colorized CLI reporters need this. */
  stripAnsi: boolean;
  rules: LineRule[];
}

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

function parseDuration(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = /^([\d.]+)(ms|s)$/.exec(raw.trim());
  if (!match) return undefined;
  const [, amount, unit] = match;
  const value = Number(amount);
  return unit === "s" ? Math.round(value * 1000) : Math.round(value);
}

/**
 * Deterministic engine: given a `ParserDefinition` and raw log text, walks
 * the text line by line and applies the state machine described in each
 * role below. No LLM involvement anywhere in this path — see
 * parser-config-generator note in the README for where that would plug in
 * (not built in this V1).
 *
 * State machine, in the order rules are checked per line:
 *  - "testResult": a line summarizing one test's outcome (status/name/duration).
 *    Creates a TestResult, attaches any pending screenshot logged during
 *    that test's body (see "attachment" below), and closes out any
 *    in-progress error accumulation from a *previous* failure block.
 *  - "failureDetailStart": a line beginning a detailed per-failure dump
 *    (e.g. "  1) some/file.ts:10:1 › test name"). Looks up the already-created
 *    TestResult by name and starts accumulating every subsequent line into
 *    its `error` field.
 *  - "errorBoundary": a line that ends error accumulation without starting
 *    a new one (e.g. the run's final "N failed"/"N passed" summary lines).
 *  - "attachment": a line naming a captured screenshot. Buffered as
 *    "pending" until the *next* testResult line, because in real reporter
 *    output (verified against a real captured Playwright run — see
 *    examples/reporter/raw-run.log) a test's own console output, including
 *    screenshot markers, is printed *before* its pass/fail summary line,
 *    not after.
 */
export class ConfigurableLogParser {
  parse(rawText: string, definition: ParserDefinition): TestResult[] {
    const text = definition.stripAnsi ? stripAnsi(rawText) : rawText;
    const lines = text.split(/\r?\n/);

    const testResultRule = definition.rules.find((r) => r.role === "testResult");
    const failureStartRule = definition.rules.find((r) => r.role === "failureDetailStart");
    const attachmentRule = definition.rules.find((r) => r.role === "attachment");
    const errorBoundaryRules = definition.rules.filter((r) => r.role === "errorBoundary");

    const results: TestResult[] = [];
    const byName = new Map<string, TestResult>();
    let pendingScreenshot: string | null = null;
    let currentFailureTarget: TestResult | null = null;

    for (const line of lines) {
      const testMatch = testResultRule && testResultRule.pattern.exec(line);
      if (testMatch?.groups) {
        currentFailureTarget = null; // a new test starting/finishing ends any prior accumulation
        const status = testResultRule!.statusMap?.[testMatch.groups.statusGlyph ?? ""] ?? "failed";
        const result: TestResult = {
          name: (testMatch.groups.name ?? "").trim(),
          status,
          duration: parseDuration(testMatch.groups.duration),
          screenshot: pendingScreenshot ?? undefined,
        };
        pendingScreenshot = null;
        results.push(result);
        byName.set(result.name, result);
        continue;
      }

      const failureMatch = failureStartRule && failureStartRule.pattern.exec(line);
      if (failureMatch?.groups) {
        const name = (failureMatch.groups.name ?? "").trim();
        const target = byName.get(name);
        if (target) {
          target.error = "";
          currentFailureTarget = target;
        }
        continue;
      }

      const attachmentMatch = attachmentRule && attachmentRule.pattern.exec(line);
      if (attachmentMatch?.groups?.path) {
        pendingScreenshot = attachmentMatch.groups.path.trim();
        continue;
      }

      if (errorBoundaryRules.some((rule) => rule.pattern.test(line))) {
        currentFailureTarget = null;
        continue;
      }

      if (currentFailureTarget) {
        currentFailureTarget.error = currentFailureTarget.error ? `${currentFailureTarget.error}\n${line}` : line;
      }
    }

    for (const result of results) {
      if (result.error !== undefined) result.error = result.error.trim();
    }

    return results;
  }
}

/**
 * The one format this V1 supports well: Playwright's `list` reporter
 * stdout. Chosen because it's genuinely produced by
 * examples/self-healing/demo.spec.ts (a real integration, not a synthetic
 * fixture) and because it has a legitimate parsing wrinkle worth handling —
 * ANSI color codes wrapping the status glyphs.
 */
export const PLAYWRIGHT_LIST_REPORTER: ParserDefinition = {
  name: "playwright-list-reporter",
  stripAnsi: true,
  rules: [
    {
      role: "testResult",
      // "  ✓  1 path/to/file.ts:14:1 › test name (504ms)"
      pattern: /^\s*(?<statusGlyph>[✓✘-])\s+\d+\s+\S+\s+›\s+(?<name>.+?)(?:\s+\((?<duration>[\d.]+m?s)\))?\s*$/,
      statusMap: { "✓": "passed", "✘": "failed", "-": "skipped" },
    },
    {
      role: "failureDetailStart",
      // "  1) path/to/file.ts:104:1 › test name"
      pattern: /^\s*\d+\)\s+\S+\s+›\s+(?<name>.+?)\s*$/,
    },
    {
      role: "attachment",
      pattern: /^\[screenshot\]\s+(?<path>.+)$/,
    },
    {
      role: "errorBoundary",
      // The run's final summary lines, e.g. "  1 failed" / "  2 passed (2.5s)".
      pattern: /^\s*\d+\s+(passed|failed|skipped)\b/,
    },
  ],
};
