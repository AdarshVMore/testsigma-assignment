# VR-002: Per-channel (not grayscale) diffing

**Status:** Proposed — not started
**Component:** visual-regression

## Problem

`_diff_mask` converts both images to grayscale luminance before diffing.
Two colors with similar luminance but different hue can be nearly invisible
to this comparison. Not hypothetical — documented in
`examples/visual-regression/README.md`: a blue `(66,133,244)` → green
`(52,168,83)` button recolor was originally used for the example fixture and
the tool reported *no* difference, because those two colors convert to
almost identical grayscale luminance (~126 vs ~124).

## Proposed change

Diff each RGB channel independently (or diff in a perceptually-motivated
space like Lab, though that's a bigger lift) and combine — e.g. a pixel counts
as "changed" if *any* channel's difference crosses the threshold, rather than
converting to a single grayscale value first. Needs a new
`ComparisonConfig` flag or just a straight behavior change (grayscale mode
removed) — worth deciding deliberately, since grayscale is cheaper (1 array
vs. 3) and per-channel could increase false positives from color-space noise
that grayscale currently averages away.

## Why it's not done yet

Scoped out for V1 as a known, documented, explainable limitation rather than
an oversight — the README and `DESIGN.md` both call it out explicitly,
including the fixture near-miss as a concrete example of it in action. Fixing
it properly means also re-validating the noise-tolerance behavior (ties into
`VR-001`), not just swapping the diff math.

## Effort / risk

Small-to-medium for the diff math itself; the real cost is re-tuning
`pixel_threshold` for a 3-channel comparison (a threshold calibrated for
single-channel grayscale differences doesn't necessarily transfer) and
re-running the full test suite's expected values.
