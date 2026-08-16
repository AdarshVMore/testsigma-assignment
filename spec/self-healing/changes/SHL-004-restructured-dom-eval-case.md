# SHL-004: Add the missing "restructured DOM" eval fixture

**Status:** Proposed — not started
**Component:** self-healing

## Problem

The original eval-dataset design (see `PROMPTS.md` / the implementation plan)
called for 5 fixtures, the 5th being: element legitimately moved to a
different parent/section (a real redesign), but text/attributes otherwise
unchanged — specifically to prove the `domContext` weight (0.10) isn't so
dominant it blocks a valid heal when position changes for a good reason. Time
budget cut it to 4, dropping exactly this case. The other 4 fixtures
(`id-class-renamed`, `attribute-drift`, `ambiguous-duplicates`,
`element-removed`) all keep DOM position essentially unchanged, so
`domContext`'s behavior when position genuinely shifts has never been
exercised by a test — only by hand-reasoning in `DESIGN.md`.

## Proposed change

Add `packages/self-healing/tests/fixtures/eval/restructured-dom.html`: a
target element moved from one container/section to a structurally different
one (different `ancestorTags`, different `siblingIndex`/`siblingCount`), with
text/role/type/attributes held constant. Add the corresponding case to
`eval.test.ts` asserting `outcome === "healed"` and inspecting the
`domContext` signal's `value` specifically (expect it low, but not so low it
drags the *total* below `AUTO_HEAL_MIN_SCORE` given the other signals still
match).

## Why it's not done yet

Pure time-budget cut, not a design gap — the case was identified before
implementation started and consciously deferred, not missed.

## Effort / risk

Small. This is a test-only addition; if it passes with the current weights/
thresholds, it's confirmation, not a code change. If it fails, that's a real
signal the `domContext` weight or the ancestor-chain similarity calculation
needs adjusting — which would be a second, follow-up change.
