# VR-001: Validate against real browser-rendered screenshots

**Status:** Proposed — not started
**Component:** visual-regression

## Problem

The comparator's entire reason to exist — tolerating anti-aliasing/rendering
noise that a naive pixel diff would flag — has only ever been tested against
synthetic images: PIL-drawn rectangles/text in `test_compare.py`, and a
hand-drawn mock "login card" (also PIL primitives) in
`examples/visual-regression/`. Real Chromium-rendered HTML/CSS produces
different anti-aliasing/sub-pixel-rendering characteristics than PIL's bitmap
font and shape drawing. The `blur_radius=1.5, pixel_threshold=30` defaults
have never been checked against the thing they're actually meant to tolerate.

## Proposed change

1. Use Playwright (already a dependency elsewhere in this repo) to capture
   two real screenshots of the same real HTML page rendered twice in a row
   with **no changes at all** — the purpose is purely to measure how much
   pixel noise a genuinely identical render produces from run to run
   (font hinting, sub-pixel AA, etc.).
2. Assert the comparator reports `passed: True` on that pair with the current
   defaults. If it doesn't, that's a real finding: the defaults need
   adjusting, not the test.
3. Add a second real-screenshot pair with a genuine, deliberate CSS change
   (matching the spirit of `examples/visual-regression`'s mock card, but
   real) and confirm detection still works on real rendering.
4. If defaults need to change as a result, update `ComparisonConfig`'s
   documented defaults and `DESIGN.md`'s rationale accordingly — this change
   might conclude "the current defaults are fine," which is still a valid
   and valuable outcome.

## Why it's not done yet

Requires wiring Playwright screenshot capture into the Python test suite
(cross-language — the screenshots would need to be captured by a small
TS/Bun script and consumed by pytest, or captured once and checked in as
fixtures), which is more setup than the time budget allowed. Not because it
was considered low-value — it's arguably the single most important gap found
in this audit.

## Effort / risk

Medium. The capture-and-check-in-as-fixtures approach is simpler than a live
cross-language test dependency and is probably the right first step. Risk is
mostly "what if the defaults need to change" — which would ripple into the
example's expected output and possibly `DESIGN.md`'s written rationale, not
just code.
