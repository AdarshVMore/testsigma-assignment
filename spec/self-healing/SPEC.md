# Self-healing locator engine — SPEC

## Goal

Given a Playwright locator that no longer resolves to exactly one element (id/class
renamed, attributes drifted, or the element genuinely removed), decide whether a
different element on the current page is confidently the same logical element,
and if so resolve to it — without ever silently guessing when the evidence
doesn't support a confident answer.

## Scope

**In scope:** single-page, same-frame, attached-DOM elements reachable by
`page.locator()`. Deterministic, explainable scoring against an explicitly
supplied fingerprint. A `healed` / `ambiguous` / `failed` decision, with the
full reasoning attached to every outcome.

**Out of scope (V1):**
- Auto-capturing/persisting a fingerprint on first successful run (see [`changes/SHL-002`](changes/SHL-002-persisted-fingerprint-store.md)) — the fingerprint must be supplied by the caller.
- LLM-assisted resolution of `ambiguous` outcomes (see [`changes/SHL-001`](changes/SHL-001-llm-fallback.md)).
- Cross-frame, cross-window, or shadow-DOM-piercing beyond Playwright's own default `locator()` behavior.
- Any healing that mutates the page or writes anything back to disk.

## Inputs

- `page: Page` — a live Playwright page.
- `selector: string` — the original, possibly-broken CSS/text selector.
- `fingerprint: ElementFingerprint` — explicitly supplied by the caller (see
  "Assumptions"). Shape: `tag`, `text`, `ariaLabel`, `role`, `name`,
  `placeholder`, `type`, `id`, `classList`, `attributes` (stable `data-*` +
  `title`/`alt`/`for`), `domContext` (`parentTag`, up to 4 `ancestorTags`,
  `siblingIndex`/`siblingCount` among same-tag siblings).

## Outputs

A `HealingResult`:

| Field | Meaning |
|---|---|
| `status` | `"original-ok"` \| `"healed"` \| `"ambiguous"` \| `"failed"` |
| `locator` | Resolvable Playwright `Locator`, only when status is `original-ok` or `healed` |
| `score` | The winning/best candidate's total score (0..1), or `null` |
| `breakdown` | Full per-signal `SignalScore[]` for that candidate, or `null` |
| `candidatesConsidered` | How many candidates were generated and scored |
| `margin` | Gap between best and second-best score; the best score itself if there was only one candidate; `null` only when there were zero candidates |

## Behavior

1. Try the original selector. If it resolves to **exactly one** element, return
   `original-ok` immediately — no candidate generation, no scoring. (Note: this
   does not check visibility/attachment stability — see "Known gaps".)
2. Otherwise, generate candidates: same-tag elements on the page; if and only if
   there are **zero** same-tag elements, fall back to same-`role` elements
   instead. Capped at 25 candidates (`MAX_CANDIDATES`).
3. Score every candidate against the fingerprint (see scoring model in
   `DESIGN.md`) — an explicit weighted average over the signals the *target*
   fingerprint actually has data for, never a statistical probability.
4. Classify: best score `< 0.35` → `failed`. Best score `>= 0.65` **and**
   margin over the second-best `>= 0.15` → `healed`. Otherwise → `ambiguous`.
5. `ambiguous` and `failed` never return a `locator` — the caller gets the full
   candidate breakdown to decide manually, but nothing is auto-resolved.

## Failure behavior

- **Zero candidates found** (neither same-tag nor same-role elements exist) →
  `failed`, `score: null`, `margin: null`. This is the "element genuinely
  removed" case.
- **`Healer.click()` / `.fill()`** throw synchronously with a message naming the
  actual status when there's no resolvable locator — callers cannot
  accidentally act on an unhealed result.
- **No retries, no timeouts beyond Playwright's own defaults** — a single
  `locate()` call is one deterministic pass over the current DOM state.

## Assumptions

- **The fingerprint must be captured while the original locator still resolved**
  — either by hand, or via `FingerprintExtractor` run earlier in the same test
  (see `examples/self-healing/demo.spec.ts`) or in a prior passing run. The
  engine has no mechanism to derive a fingerprint from an already-broken
  selector, because there's nothing left to inspect through it. This is a
  deliberate scope decision, not an oversight — see `DESIGN.md`.
- The page is not navigating/mutating concurrently with a `locate()` call.
- "Confidently the same element" is defined entirely by the scoring model
  below — there is no semantic/visual understanding of the page.

## Acceptance criteria

- An id/class rename with text/attributes/position otherwise unchanged heals
  automatically (`packages/self-healing/tests/eval.test.ts`,
  `examples/self-healing/demo.spec.ts`).
- A page with several structurally-identical candidates (e.g. repeated row
  actions) is reported `ambiguous`, never resolved to a guess.
- A genuinely removed element is reported `failed`, never resolved to an
  unrelated element.
- Every `healed`/`ambiguous`/`failed` result carries a full, human-readable
  per-signal breakdown sufficient to answer "why did candidate A beat
  candidate B" without reading source code.
- The full test suite (`bun test packages/self-healing`) passes with zero
  environment variables set — nothing in this path is allowed to depend on an
  LLM/network call.

## Known gaps (from the 2026-08-15 audit)

These are real, currently-true limitations — not hypothetical:

1. **Candidate recall gap**: the role-based fallback only fires when there are
   **zero** same-tag elements on the whole page. If a target's tag changed
   (e.g. `<div role="button">` → `<button>`) but the page happens to contain
   *any* unrelated `<button>`, the real candidate is never generated at all —
   not scored low, simply never considered. See `changes/SHL-003`.
2. **Silent truncation**: `MAX_CANDIDATES = 25` truncates without any signal
   that truncation happened. A result with `candidatesConsidered: 25` looks
   identical whether that was every candidate on the page or the first 25 of
   40.
3. **Punctuation-naive text similarity**: `"Add to Cart!"` vs `"Add to Cart"`
   tokenizes to different words (`"cart!"` ≠ `"cart"`), reducing the Jaccard
   score for text a human would call identical.
4. **The DOM-context weight (0.10) has never been validated against a
   legitimate "element moved to a new parent" scenario** — the eval dataset's
   originally-planned 5th fixture for exactly this case was cut for time (see
   `changes/SHL-004`). The other 4 fixtures all keep DOM position essentially
   unchanged, so this signal's behavior on a real redesign is unverified.
5. **`original-ok` doesn't check visibility/attachment** — a selector matching
   exactly one but currently-hidden or about-to-detach element is reported
   `original-ok` with no further check.
6. **The eval dataset (4 fixtures) is small and single-author** — the
   0.65/0.15/0.35 thresholds are validated against it, not against an
   independent or larger sample. Real risk of overfitting to the fixtures'
   own authoring style.
