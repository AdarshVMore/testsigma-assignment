# VR-004: Avoid recomputing the diff mask 2-3x per CLI run, and bound region-merge cost

**Status:** Proposed — not started
**Component:** visual-regression

## Problem

Two separate inefficiencies found in the audit, both real but neither
correctness bugs at the current demo scale:

1. `cli.py` calls `comparator.compare()`, then separately
   `comparator.render_diff_image()`, then `comparator.render_highlighted_image()`.
   `compare()` and `render_diff_image()` each independently reload both
   images and recompute `_diff_mask()` from scratch — the same blur +
   grayscale + threshold work happens twice (three image loads total across
   the two calls, when two would do).
2. `RegionDetector._merge_nearby` is O(n²) per pass, and the outer
   restart-on-merge loop makes it worst-case O(n³) across repeated passes.
   Fine for the demo's single region; would degrade on a page producing many
   scattered small diffs (e.g. a broad CSS framework change).

## Proposed change

1. Have `compare()` return (or cache) the computed mask, and have
   `render_diff_image()` accept an optional precomputed mask instead of
   always recomputing — `cli.py` then computes the mask once and reuses it
   for both the result and the diff image.
2. Replace the merge pass with a proper union-find (disjoint-set) over region
   pairs within `merge_distance`, or a spatial index (grid bucketing) to
   avoid the full O(n²) pairwise distance check — only worth doing if a real
   use case actually produces enough regions for it to matter.

## Why it's not done yet

Neither affects correctness or the demo's output; both are performance/API
cleanliness items found by reading the code, not by hitting a real slowdown.

## Effort / risk

Small. Low risk — these are internal refactors with existing test coverage
(`test_compare.py`, `test_regions.py`) that would just need to keep passing
identically.
