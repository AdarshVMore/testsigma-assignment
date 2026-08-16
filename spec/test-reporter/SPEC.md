# Test reporter — SPEC

## Goal

Turn raw, unstructured test-execution log text into a normalized list of
`TestResult`s, and render those into a single shareable, standalone HTML
report with pass/fail/skip status, durations, error details, and screenshots.

## Scope

**In scope:** parsing one well-supported raw log format (Playwright's `list`
reporter stdout) via a declarative, swappable parser definition; rendering a
self-contained HTML report from any `TestResult[]`, regardless of source.

**Out of scope (V1):**
- A second concrete `ParserDefinition` proving the "add formats without
  touching the engine" claim with more than one real example — see
  [`changes/TR-003`](changes/TR-003-second-parser-definition.md).
- LLM-assisted generation of a `ParserDefinition` for an unknown format — see
  [`changes/TR-002`](changes/TR-002-llm-parser-config-generator.md).
- Any structured (JSON/XML) log format — the one built format is deliberately
  unstructured text, since that's where a parser has real work to do.

## Inputs

- `rawText: string` — full raw log content (may include ANSI color codes).
- `definition: ParserDefinition` — `{ name, stripAnsi, rules: LineRule[] }`.
  Each `LineRule` is `{ role, pattern: RegExp (named capture groups),
  statusMap? }`. `role` is one of a fixed vocabulary: `testResult`,
  `failureDetailStart`, `attachment`, `errorBoundary` (see "Behavior" and
  `DESIGN.md` for why this vocabulary is fixed rather than fully open-ended).
- For rendering: `TestResult[]` (from any source, not just the parser) plus
  optional `title` and a `loadScreenshot` override.

## Outputs

- `parse()` → `TestResult[]`: `{ name, status: "passed"|"failed"|"skipped",
  duration?: number (ms), error?: string, screenshot?: string }`.
- `ReportModel.summary()` → `{ total, passed, failed, skipped,
  totalDurationMs, passRate }`. `passRate = passed / (passed + failed)` —
  skipped tests are excluded from the denominator entirely, not counted
  against the rate.
- `HtmlRenderer.render()` → a single self-contained HTML string: inline
  `<style>`, no external assets, screenshots base64-inlined, all
  interpolated text (names, error/stack traces) HTML-escaped.

## Behavior

Line-by-line state machine over the (optionally ANSI-stripped) text:

1. A line matching `testResult` creates a new `TestResult`, attaches whatever
   screenshot path was pending (see #4), and ends any in-progress error
   accumulation from a previous failure block.
2. A line matching `failureDetailStart` looks up the `TestResult` **by name**
   among already-created results and, if found, starts accumulating every
   subsequent line into that result's `error` field (see "Known gaps" — this
   name-only lookup is the component's biggest weak point).
3. A line matching `errorBoundary` ends accumulation without starting a new
   target (used for the run's final "N failed"/"N passed" summary lines).
4. A line matching `attachment` is buffered as "pending" and assigned to the
   **next** `testResult` line's `screenshot` field — not the most recently
   *completed* test, because real captured output shows a test's own console
   output (including screenshot markers) prints *during* its body, before its
   own pass/fail line.
5. Any other line: appended to the current failure's `error` if one is
   active, otherwise silently ignored.

## Failure behavior

- **No error/warning signal for malformed or truncated input.** A log that
  got cut off mid-run, or was captured from a crashed process, produces
  whatever partial `TestResult[]` the state machine happened to build — there
  is no "this input looks incomplete" flag.
- **Screenshot file not found at render time** → a visible "Screenshot not
  found: `<path>`" note in the HTML, not a thrown error — rendering a report
  must not fail just because one screenshot went missing.
- **`failureDetailStart` with no matching name** → silently dropped (no
  `TestResult` created, no error attached anywhere) rather than raising.

## Assumptions

- Log format follows Playwright's actual list-reporter output shape closely
  enough to match `PLAYWRIGHT_LIST_REPORTER`'s regexes — verified against a
  real captured run (`examples/reporter/raw-run.log`), not invented.
- Test names are unique within a single log — see "Known gaps."
- A `TestResult` has at most one associated screenshot (inherited directly
  from the assignment's own required model shape).

## Acceptance criteria

- Parsing `examples/reporter/raw-run.log` (real, ANSI-colored, mixed
  pass/fail/skip output) produces the correct 4 results with correct
  statuses, durations, and one correctly-attached screenshot.
- A failing test's full multi-line error block (including embedded blank
  lines) is captured intact and correctly bounded — doesn't leak into the
  next result, doesn't get truncated at an internal blank line.
- Rendered HTML never contains unescaped user-controlled text — an error
  message containing `<script>`/`&`/quotes renders as inert text.
- `bun test packages/test-reporter` passes (15 tests) with zero environment
  variables set.

## Known gaps (from the 2026-08-15 audit)

1. **Failure-to-summary correlation is keyed on test name alone, not
   location.** Two tests sharing an exact name (plausible across different
   spec files in a real suite) will collide in the internal `byName` map —
   the second one silently overwrites the first as the lookup target, so a
   failure detail block can get attached to the wrong `TestResult`, or a
   first test's own error can be lost entirely if the second test with the
   same name didn't fail. This is the closest thing to an actual bug found
   in the whole audit, not just a documented limitation. See `changes/TR-001`.
2. **No rule for Playwright's "N flaky" / retry-attempt output** — a suite
   run with retries enabled produces log shapes this parser has never been
   tested against.
3. **The `errorBoundary` pattern is fairly loose** (`/^\s*\d+\s+(passed|
   failed|skipped)\b/`) — a line inside an error block whose own text
   happens to start with a number followed by one of those words (e.g. an
   assertion library printing `"3 failed assertions"` as part of its own
   output) would prematurely end error accumulation.
4. **`guessMimeType` trusts the file extension, never the actual bytes** — a
   mismatched extension embeds correct bytes under a misleading MIME type.
5. **No size guard on base64-inlining** — fine at demo scale, unbounded for a
   real suite with many/large screenshots.
