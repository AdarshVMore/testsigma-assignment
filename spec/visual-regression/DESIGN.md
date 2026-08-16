# Visual regression comparator — DESIGN

Reflects `packages/visual-regression/src/*.py` as it exists today. See
`SPEC.md` for the contract this is implementing.

## Pipeline

```
ImageComparator.compare(before, after)
  ├─ dimensions differ? → dimension_mismatch result, stop
  └─ _diff_mask(before, after)
       ├─ Gaussian blur both images (blur_radius)
       ├─ grayscale luminance abs-difference
       └─ threshold (pixel_threshold) → boolean mask
     RegionDetector.detect(mask, config)
       ├─ cv2.connectedComponentsWithStats (8-connectivity)
       ├─ drop components < min_region_area
       └─ merge components within merge_distance
```

Three files: `threshold.py` (config + validation), `compare.py` (the
pipeline), `regions.py` (mask → bounding boxes). `cli.py` is a thin argparse
wrapper writing `diff.png` / `highlighted.png` / `result.json`.

## Why blur + threshold + connected-components, not SSIM

Naive pixel-perfect diffing (exact equality or raw absolute-difference sum)
is unusable on real screenshots: anti-aliased text/edge rendering differs by
a few RGB values between otherwise-identical captures, and a 1-2px layout
shift (scrollbar width, sub-pixel font metrics) can shift an entire edge — a
naive diff flags nearly the whole page as "different" on every run.

The chosen fix is deliberately the cheapest one that addresses this: blur
both images identically first (symmetrically absorbs anti-aliasing noise
without needing any image alignment/registration algorithm), then threshold.
SSIM or perceptual hashing would handle this more robustly and are the
standard "correct" answer in production visual-regression tools (Applitools,
Percy), but they add real complexity — windowed statistics, different failure
modes to explain and defend — that this V1 explicitly chose not to take on.
This is a genuine tradeoff, not a "didn't know better": SSIM is one line to
justify in an interview ("didn't have time to validate it properly") but blur
+ threshold is one paragraph to fully explain and defend from first
principles, which mattered more for this submission.

**Caveat surfaced by the audit**: this whole justification rests on an
assumption — that blur+threshold's noise tolerance is *actually* sufficient
for real anti-aliasing — that was never empirically checked. Every test
image and the example fixture are synthetic (Pillow-drawn shapes/text), not
real Chromium screenshots. See `changes/VR-001`.

## Why grayscale luminance, not per-channel RGB

Simpler (one 2D array instead of three), and covers the common case
(brightness changes dominate most real UI diffs: text appearing/disappearing,
elements resizing, background swaps). The known cost: two colors with similar
luminance but different hue (e.g. a particular blue/green pair) can be nearly
invisible to this diff. This isn't hypothetical — it happened while building
the example fixture (`examples/visual-regression/README.md` documents a blue
`(66,133,244)` → green `(52,168,83)` button color change that the tool
initially failed to detect, because those two colors convert to almost
identical grayscale luminance, ~126 vs ~124). The fixture was changed to a
higher-contrast pair; the underlying blind spot was not fixed, deliberately —
see `changes/VR-002`.

## Why region-count decides pass/fail, not diff percentage

A single real UI change (one button recolored) can be a small percentage of
total pixels but is unambiguously a regression; conversely a page full of
sub-threshold noise could have a nontrivial raw percentage without being a
real change. Region-count (did anything survive the noise-filtering pipeline
at all) is a more honest proxy for "is there a real change" than a raw
percentage threshold would be. `diff_percentage` is kept in the output as a
magnitude indicator, not as a second decision gate — deliberately, to avoid
two thresholds disagreeing with each other.

## Why merge nearby regions instead of reporting every connected component

A single visual change (e.g. a resized button, or a color change that
straddles an anti-aliased edge differently in a couple of spots) can produce
2-3 separate connected components rather than one contiguous blob. Reporting
each as its own region would fragment one real change into several boxes,
which is worse for a human reading the highlighted image than one merged box.
The merge implementation (expand each box by `merge_distance` and check
bounding-box overlap, repeat until no merges happen) is intentionally simple
— O(n²) per pass — since region counts at this tool's intended scale (a UI
component or page section, not a full-page diff with hundreds of scattered
changes) are small. Documented as a scalability limitation, not silently
left unbounded.

## What was deliberately not built

- **SSIM/perceptual hashing** — see above; a conscious complexity tradeoff for V1.
- **Ignore-region masks** (`changes/VR-003`) — no way to mark "this region is
  known-dynamic, don't diff it" (timestamps, ads, animated content).
- **Per-channel diffing** (`changes/VR-002`) — closes the same-luminance blind
  spot documented above.
- **Real-screenshot validation** (`changes/VR-001`) — the component's biggest
  open question, not a "didn't build" so much as a "never actually confirmed
  the core premise against real input."
