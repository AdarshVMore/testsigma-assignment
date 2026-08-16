# VR-003: Ignore-region masks

**Status:** Proposed — not started
**Component:** visual-regression

## Problem

There's no way to tell the comparator "this rectangle is known-dynamic
content (a timestamp, an ad slot, an animation frame) — don't diff it." Any
real page with such content will produce false-positive regions there on
every comparison, regardless of whether anything meaningful changed
elsewhere.

## Proposed change

Add an optional `ignore_regions: list[Region]` (reusing the existing `Region`
shape) to `ComparisonConfig` or as a separate `compare()` argument. Before
clustering, zero out the diff mask inside each ignore region (or exclude
components that fall entirely within one) so they never surface as detected
regions, regardless of how much they actually differ.

## Why it's not done yet

Not needed by the current single example (a static mock card with no dynamic
content). A real V1-limitations item, not a design flaw.

## Effort / risk

Small. Purely additive — masking out rectangles in a numpy boolean array
before the connected-components step is a few lines in `RegionDetector` or
`ImageComparator`. Main design question: should a region *partially*
overlapping an ignore box be excluded entirely, clipped, or left alone? Needs
a deliberate answer, not a default.
