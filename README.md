# testsigma-assignment

Three cross-cutting automation tools, built as a connected V1 rather than three
disconnected demos: a self-healing Playwright locator, a visual-regression
comparator, and a raw-log-to-HTML test reporter. The self-healing example's
real captured output is what the reporter example actually parses — see
"Architecture" below.

**Full prompt history:** [`PROMPTS.md`](PROMPTS.md).

## What I understood the problem to be

Build a small, defensible working core of each of the three tools listed in
the assignment (self-healing locators, visual regression, test reporting),
optimized for being fully understood and explained live rather than for
feature completeness. The assignment is explicitly graded on judgment under
ambiguity, not on how much gets built — so the interesting parts of this
submission are the *decisions* (see below and `PROMPTS.md`), not raw line
count.

## Architecture

```
Playwright test execution
  └─ self-healing locator (packages/self-healing)
       fingerprint → candidates → scorer → decision (heal / ambiguous / failed)
  └─ screenshots + raw stdout log
       ├─ visual regression (packages/visual-regression, Python)
       │    before.png + after.png → diff mask → regions → highlighted.png
       └─ test reporter (packages/test-reporter)
            raw log → ConfigurableLogParser → TestResult[] → report.html
```

Each package is independently runnable and independently tested; the
reporter's example additionally consumes the self-healing example's *real*
captured stdout (`examples/reporter/raw-run.log`), so the pipeline in the
assignment's own diagram is genuinely exercised end to end, not just
described.

## Important decisions

- **Bun, not Node/npm.** The repo was already scaffolded with `bun init`; fighting that for no benefit wasn't worth it. `bun test`, Bun workspaces, no `dotenv` (Bun auto-loads `.env`).
- **Self-healing fingerprint is explicitly authored, not auto-derived from the broken locator.** The literal flow in the brief ("locator fails → derive fingerprint") has a chicken-and-egg gap: you can't inspect the live DOM through a selector that no longer resolves. `HealingLocator` takes a selector **and** a fingerprint together, captured once (via `FingerprintExtractor`) while the selector still worked — the same idea as writing a resilient locator with documented fallback signals today. A persisted, auto-captured snapshot store (closer to how Testim/Testsigma actually behave) is a natural V2, not built here — see "Next steps."
- **Scoring is an explicit, inspectable weighted average, never dressed up as a probability.** 8 signals (text, aria-label, role, tag, class, form attributes, other stable attributes, DOM context), weights summing to 1.0, text/aria-label weighted highest since they're least likely to change when only ids/classes get refactored. Every score carries a full per-signal breakdown (`value`, `weight`, `applicable`, `contribution`, `detail`) so "why did A beat B" is always answerable — see any `[healing]` line in `examples/self-healing`'s output, or `packages/self-healing/src/scorer.ts`.
  - A signal only counts if the **target** actually had that information (e.g. a plain `<button>` with no `aria-label` isn't penalized for lacking one) — otherwise ordinary elements with only 2-3 identifying signals would have artificially deflated scores.
  - Decision rule: below 0.35 → **failed** (don't force a bad match); ≥0.65 **and** ≥0.15 clear of the second-best candidate → **healed**; otherwise → **ambiguous** (a first-class result, not squashed into pass/fail — the seam a future LLM tiebreaker would plug into).
  - These thresholds are starting values, validated against `packages/self-healing/tests/eval.test.ts` — a small hand-built dataset (clean id/class rename, id+class+aria-label drift, structurally-identical duplicates, a genuinely removed element) that the weights/thresholds were tuned against, not chosen blind.
- **Visual regression: blur + threshold + connected-components, not SSIM.** Naive pixel-perfect diffing flags nearly every pixel as different on real screenshots (anti-aliasing, 1-2px sub-pixel shifts). Both images get a small Gaussian blur before diffing (symmetrically absorbs that noise without needing image alignment), the remaining grayscale difference is thresholded into a mask, and OpenCV's `connectedComponentsWithStats` clusters survivors into bounding boxes. SSIM/perceptual hashing was deliberately skipped — real added complexity for a V1 the assignment says not to over-engineer.
- **Reporter: one format supported well (Playwright's `list` reporter stdout), via a declarative `ParserDefinition`** — regexes + field maps, never embedded functions, so a definition is just JSON (safe to inspect, and safe for an LLM to generate as future work, since nothing in it is ever `eval`'d). Chosen specifically because the self-healing example can produce it for real. One genuine wrinkle worth having solved: screenshot markers are logged *during* a test's body, i.e. **before** that test's own pass/fail summary line — not after, which was the original (wrong) assumption until checked against the real captured log.
- **OpenRouter LLM fallback and LLM-assisted parser-config generation: designed for, not built.** Given the time available, cutting both was the right call over building either partially. The seams exist (`Healer`'s distinct `ambiguous` status; `ParserDefinition` being plain JSON) but no LLM code is written or called anywhere in this repo — verified by running the entire test suite with zero environment variables set.
- **The 4th "integration demo" chaining all three components into one script was cut too** — the reporter example already consumes the self-healing example's real output, so the pipeline isn't hermetically disconnected even without a dedicated orchestrator.

## V1 limitations (documented, not hidden)

**Self-healing:** candidate generation is same-tag-first with a same-role fallback, capped at 25 candidates — not exhaustive. No cross-frame/shadow-DOM support. No persisted fingerprint store (see above).

**Visual regression:** no cross-browser/OS font-rendering normalization (both screenshots must come from the same rendering environment); no image alignment/registration (viewport/scroll must match); purely geometric bounding boxes, no semantic diffing; **grayscale-luminance diffing under-detects same-brightness color changes** — this isn't hypothetical, it's documented in `examples/visual-regression/README.md` because it happened while building that example (a blue→green button color change was briefly invisible to the tool); no ignore-region masks; global thresholds only.

**Reporter:** one log format supported well; the four line "roles" the parser engine understands (test result / failure detail start / attachment / error boundary) are fixed, not user-configurable — a genuinely different log *shape* (not just different regexes) would need a new role, not just a new `ParserDefinition`.

## Assumptions

- "Explainable" scoring means an inspectable heuristic breakdown, not a statistically-calibrated probability — the brief explicitly asks for this distinction.
- A screenshot is associated with "the test whose body logged it," inferred from real Playwright list-reporter ordering, not specified by any external log-format spec.
- "Shareable" HTML report means single-file/self-contained (screenshots base64-inlined) rather than a report + a folder of assets that must travel together.

## Setup

```bash
bun install
python3 -m venv packages/visual-regression/.venv
packages/visual-regression/.venv/bin/pip install -r packages/visual-regression/requirements.txt
```

## Testing

```bash
bun run typecheck                                           # TS type-check (bun transpiles but doesn't type-check)
bun run test                                                 # all TS unit/integration tests (42 tests)
packages/visual-regression/.venv/bin/pytest packages/visual-regression/tests -v   # Python tests (19 tests)
```

## The three required demos

```bash
# 1. Self-healing: id/class renamed mid-test, still found and clicked correctly.
bun run demo:self-healing

# 2. Visual regression: two screenshots, a real detected+highlighted change.
cd packages/visual-regression
.venv/bin/python ../../examples/visual-regression/generate_fixtures.py
.venv/bin/python src/cli.py ../../examples/visual-regression/before.png ../../examples/visual-regression/after.png \
  --output-dir ../../examples/visual-regression/output
cd ../..

# 3. Reporter: the self-healing run's real raw stdout -> a standalone HTML report.
bun run demo:reporter
open examples/reporter/output/report.html
```

Each `examples/*/README.md` has more detail. All three demos' outputs are
already committed under `examples/*/output/` so they can be reviewed without
re-running anything.

## What I'd do next with more time

1. **OpenRouter LLM fallback** for the `ambiguous` case — propose a pick among the already-generated candidates, validate the response is (a) well-formed JSON, (b) one of the actually-offered candidate indices (never a hallucinated element), and (c) re-clears a minimum deterministic-scorer floor — the LLM breaks ties among plausible candidates, it never overrides the heuristic.
2. **Persisted fingerprint store**, auto-captured on first successful locate, so authoring a fingerprint by hand isn't required.
3. **Per-channel (not grayscale) visual diffing** to close the same-luminance blind spot, plus optional ignore-regions for known-dynamic content.
4. **A second reporter `ParserDefinition`** (e.g. JSON-lines or JUnit XML) to prove out the "additional formats without touching the engine" claim with a second real example, not just an architectural argument.
5. **The integration-demo script** chaining all three components through one command, now that all three exist independently.
