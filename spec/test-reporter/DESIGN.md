# Test reporter — DESIGN

Reflects `packages/test-reporter/src/*.ts` as it exists today. See `SPEC.md`
for the contract this is implementing.

## Pipeline

```
raw log text ──▶ ConfigurableLogParser.parse(text, ParserDefinition) ──▶ TestResult[]
                                                                              │
                                                                              ▼
                                                    ReportModel.summary() (counts/pass-rate)
                                                                              │
                                                                              ▼
                                                    HtmlRenderer.render() ──▶ report.html
```

Three files: `model.ts` (the shared `TestResult`/`ReportSummary` shapes, from
the assignment brief directly), `parser.ts` (the engine + the one concrete
format definition), `renderer.ts` (HTML output).

## Why a declarative `ParserDefinition`, not per-format code branches

A `ParserDefinition` is pure data — a name, an ANSI-strip flag, and a list of
`{ role, pattern: RegExp, statusMap? }` rules. No embedded functions
anywhere. This is deliberate on two counts: (a) adding a new log format means
writing a new definition object, not adding a branch to a growing
if/else chain in the engine, and (b) because nothing in a definition is ever
`eval`'d as code, a definition is just JSON — safe to inspect, and safe for an
LLM to generate later (`changes/TR-002`) without that being a code-injection
surface.

**What "declarative" doesn't mean here**: the *engine's* control flow — the
four-role state machine (test result / failure detail start / attachment /
error boundary) — is fixed, not itself configurable. A new format needs
regexes for these four roles to fit its own text into; a log whose structure
genuinely doesn't fit this shape (no inline summary line, or no failure-detail
section at all) would need a new role added to the engine, not just a new
definition. This is a scoping choice, not an oversight, and it's why
`SPEC.md` describes the role vocabulary as fixed.

## Why Playwright's list-reporter stdout is the one format built well

Three reasons, in order of how much they actually mattered: it's genuinely
producible by `examples/self-healing/demo.spec.ts` (a real integration, not a
synthetic fixture written to make the parser look good); it's real
unstructured text worth parsing (not JSON, where there'd be no real parsing
work); and it has one legitimate parsing wrinkle — ANSI color codes wrapping
the status glyphs — that's a genuine, defensible thing to handle rather than
an artificially inserted complication.

## Why screenshots attach to the *next* test-result line, not the most recent

The original assumption (before checking real output) was "a screenshot
marker belongs to whichever test most recently finished." Checking the
actual captured `raw-run.log` showed this is backwards: Playwright's list
reporter prints a test's own console output — including this repo's
`[screenshot] <path>` markers, logged mid-test via `console.log` — *during*
that test's body, which happens *before* its own pass/fail summary line is
ever printed (the summary line only appears once the test finishes). The
parser buffers a `pendingScreenshot` and assigns it when the *next*
`testResult` line is matched, which is the test whose body just finished
producing that console output. This correction is recorded in `PROMPTS.md`'s
implementation log as one of the bugs caught by checking real output instead
of assuming.

**Known limitation inherited from this design**: only the *last* screenshot
logged before a result line survives (`TestResult.screenshot` is singular,
per the assignment's own required model shape) — multiple screenshots per
test are lossy by design, not oversight.

## Why HTML is escaped and screenshots are base64-inlined

Two decisions made together because "shareable" (the assignment's own word)
implies a single portable artifact: base64-inlining means the report doesn't
depend on relative image paths staying valid wherever it's opened or emailed.
Escaping (`escapeHtml` applied to every interpolated test name and
error/stack string) exists because error/stack text routinely contains
`<`, `&`, and quotes — without escaping, that would either corrupt the
rendered HTML or, if the report is ever hosted rather than opened locally, be
a straightforward stored-content-injection vector. Both are cheap and
non-negotiable rather than "nice to have."

## What was deliberately not built

- **A second concrete `ParserDefinition`** (`changes/TR-003`) — the
  "pluggable formats" claim currently rests on architecture alone (the engine
  genuinely doesn't hardcode Playwright-specific logic outside the one
  definition object), not on a second proven example.
- **LLM-assisted parser-config generation** (`changes/TR-002`) — kept
  completely out of the `parse()`/`render()` call graph by design, so the
  normal path never references `OPENROUTER_API_KEY` at all; would live in its
  own separate, manually-invoked module.
- **Name-only correlation was a known simplification at write time, not
  discovered later** — but the audit is what surfaced it as a real bug risk
  worth prioritizing (`changes/TR-001`) rather than a theoretical one.
