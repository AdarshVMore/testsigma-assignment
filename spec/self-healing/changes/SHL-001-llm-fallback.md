# SHL-001: OpenRouter LLM fallback for ambiguous heals

**Status:** Proposed — not started
**Component:** self-healing

## Problem

`Healer` reports `ambiguous` when the best candidate clears `FAILURE_FLOOR`
but either doesn't clear `AUTO_HEAL_MIN_SCORE` or doesn't clear it by enough
margin over the second-best. Right now that's a dead end for automation — a
human has to look at the candidate breakdown and decide. The assignment
explicitly asks for an optional LLM fallback for exactly this case.

## Proposed change

A new module (`llm-fallback.ts`), invoked only from `Healer`'s `ambiguous`
branch, never from `original-ok`/`healed`/`failed`:

1. No-ops cleanly (returns the original `ambiguous` result unchanged) if
   `OPENROUTER_API_KEY` isn't set — this path must never be load-bearing for
   the rest of the system.
2. Sends the target fingerprint and the candidates' fingerprints (structured
   JSON only — never raw HTML or a screenshot) to OpenRouter, asking it to
   pick one candidate index or say "none."
3. Validates the response before trusting it, in this order: (a) is it valid
   JSON matching the expected shape, (b) is the chosen index one of the
   indices actually offered — never a hallucinated candidate, (c) does that
   candidate re-clear `FAILURE_FLOOR` under the existing deterministic
   scorer. The LLM is only allowed to break ties among already-plausible
   candidates; it can never introduce a pick the heuristic considers
   implausible.
4. On any validation failure, falls back to the original `ambiguous` result
   — the LLM path can only upgrade `ambiguous` to `healed`, never downgrade
   anything or override a `failed`.

## Why it's not done yet

Scoped out explicitly when time budget was set to "a few hours" — cut before
the integration-demo script, since it's the riskier and more optional of the
two per the original plan. The `ambiguous` status already exists as a
distinct, first-class outcome specifically so this has a clean seam to plug
into later.

## Effort / risk

Small-to-medium. The validation logic (step 3) is the part worth taking time
over — a naive "trust the LLM's pick" implementation would violate the
assignment's explicit "output must be validated before being trusted"
requirement. Testing needs a mocked `fetch` (no real network/key in CI) plus
the no-key no-op path, matching the pattern already used for it in the
`Healer` test suite design.
