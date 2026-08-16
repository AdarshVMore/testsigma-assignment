# SHL-003: Candidate recall improvements

**Status:** Proposed — not started
**Component:** self-healing

## Problem

Three related gaps found in the audit, all about candidates that should be
considered but currently aren't (or aren't flagged as excluded):

1. **Role fallback only fires when there are zero same-tag elements at all.**
   `CandidateGenerator.generate()` queries same-tag first; it only tries
   same-role if that query returns *nothing*. If a target's tag legitimately
   changed (`<div role="button">` → `<button>`) but the page has *any*
   unrelated `<button>` elsewhere, the real candidate is never generated —
   not scored low, just never in the pool.
2. **`MAX_CANDIDATES = 25` truncates silently.** `HealingResult.candidatesConsidered`
   reads the same whether that number is the true total on the page or a
   truncated slice of a larger pool.
3. **Text similarity doesn't strip punctuation.** `"Add to Cart!"` vs `"Add to
   Cart"` tokenizes as different words, quietly under-scoring text a human
   would call identical.

## Proposed change

1. Union same-tag and same-role candidate sets instead of fallback-only
   (de-duplicated), capped at `MAX_CANDIDATES` after the union — not before,
   so the cap doesn't accidentally starve one source in favor of the other.
2. Add a `truncated: boolean` field to `HealingResult` (true when the raw
   candidate count before capping exceeded `MAX_CANDIDATES`) so callers can
   at least see when the pool was cut.
3. Strip a small, explicit punctuation set (`. , ! ? ; : ' " ( )`) before
   tokenizing in `textSimilarity`, not a full regex-strip-everything-non-word
   approach (that would also eat meaningful characters in some locales/edge
   cases) — needs a couple of test cases added to `scorer.test.ts` either way.

## Why it's not done yet

None of these came up in the 4 eval fixtures or the demo scenario — they were
found by reading the code critically after the fact (this audit), not by a
failing test. Real but not blocking for the V1 submission.

## Effort / risk

Small, low risk — all three are localized, additive changes with clear test
cases. The union change (#1) is the one worth double-checking against the
existing eval fixtures afterward, since it changes candidate pool composition
and could shift scores/margins on the ambiguous-duplicates fixture in
particular.
