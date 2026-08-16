# SHL-002: Persisted, auto-captured fingerprint store

**Status:** Proposed — not started
**Component:** self-healing

## Problem

`HealingLocator` requires the caller to hand-author (or programmatically
extract-and-copy) a fingerprint up front. That's honest and deterministic,
but it's also extra authoring work per locator, and it's not how Testim /
Testsigma actually behave in practice — they capture a fingerprint
automatically on a passing run and heal against that stored snapshot later.

## Proposed change

An opt-in wrapper around the existing `Healer`, not a change to it:

1. On a successful `locate()` (`original-ok` or `healed`), optionally persist
   the *current* fingerprint to a small JSON file keyed by a caller-supplied
   locator name (e.g. `.fingerprints/checkout-submit-button.json`).
2. On a later run, if no fingerprint is supplied explicitly, load it from the
   store instead.
3. Needs an explicit policy for **when the stored fingerprint gets updated**
   after a heal — always overwrite with the healed element's fresh
   fingerprint (so the store "follows" the element across renames), or leave
   it and require a manual re-capture. This is a real design decision that
   needs to be made deliberately, not defaulted to whichever is easiest to
   implement — auto-overwriting means a healed-but-wrong match on run N
   poisons the fingerprint for run N+1 with no human in the loop.

## Why it's not done yet

Adds real state (a file store, a staleness/versioning story, a first-run vs.
Nth-run branch) that a V1 explicitly didn't need to prove the core
scoring/decision logic. Explicit fingerprint authoring (the current design)
is simpler to fully understand and defend, which mattered more for this
submission than matching real tools' exact behavior.

## Effort / risk

Medium. The interesting risk isn't the file I/O, it's the update policy above
— getting it wrong silently degrades healing quality over time in a way that
wouldn't show up until much later, which is a worse failure mode than the
current system's "always requires explicit input."
