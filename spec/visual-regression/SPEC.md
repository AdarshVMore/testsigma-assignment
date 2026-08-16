# Visual regression comparator — SPEC

## Goal

Given a baseline screenshot and a current screenshot of the same page/element,
decide whether the difference between them is a *meaningful* UI change (not
anti-aliasing/rendering noise), and if so, localize it to a small number of
bounding-box regions with a visual diff artifact — without requiring the two
images to be pixel-identical to pass.

## Scope

**In scope:** two same-dimension raster images (PNG in practice), a
configurable comparison pipeline, region-level output, a CLI entry point.

**Out of scope (V1):**
- Image alignment/registration — both captures must already share
  viewport/scroll position; a whole-page shift is reported as a large diff,
  not corrected for.
- SSIM/perceptual hashing or any windowed-statistics comparison.
- Ignore-region masks for known-dynamic content (timestamps, ads, animations)
  — see [`changes/VR-003`](changes/VR-003-ignore-regions.md).
- Per-channel (non-grayscale) diffing — see [`changes/VR-002`](changes/VR-002-per-channel-diffing.md).
- Cross-browser/OS font-rendering normalization.

## Inputs

- `before_path`, `after_path` — file paths to two images.
- `ComparisonConfig` (all validated, immutable):
  - `pixel_threshold: int = 30` (0-255 grayscale diff to count a pixel "changed")
  - `blur_radius: float = 1.5` (Gaussian blur applied to both images before diffing)
  - `min_region_area: int = 40` (px², components smaller than this are noise)
  - `merge_distance: int = 10` (px, nearby regions get merged into one)

## Outputs

`ComparisonResult`:

| Field | Meaning |
|---|---|
| `passed` | `True` iff zero regions survived filtering — **not** a function of `diff_percentage` directly (see "Behavior") |
| `diff_percentage` | % of pixels that crossed `pixel_threshold` after blurring, informational |
| `regions` | `[{x, y, width, height, pixel_count}, ...]`, merged/filtered bounding boxes |
| `dimension_mismatch` | `True` if the two images aren't the same size — short-circuits the rest of the pipeline |
| `before_size` / `after_size` | `(width, height)` |

Plus two rendered images (`render_diff_image` — grayscale heatmap;
`render_highlighted_image` — after-image with red boxes around each region)
and, via the CLI, a `result.json` with the above serialized.

## Behavior

1. Load both images, convert to RGB.
2. If dimensions differ → `dimension_mismatch: True`, `passed: False`,
   `diff_percentage: 100.0`, no regions computed, no diff/highlighted images
   rendered.
3. Otherwise: Gaussian-blur both images identically, take the grayscale
   luminance absolute difference, threshold it into a boolean mask.
4. Cluster the mask into connected components (8-connectivity), drop
   components below `min_region_area`, merge components within
   `merge_distance` of each other.
5. `passed = (len(regions) == 0)`. This is a **region-count** decision, not a
   percentage-threshold decision — a result can have a nonzero
   `diff_percentage` (scattered noise below `min_region_area`) and still
   `passed: True`, and a tiny single region just above `min_region_area` can
   flip `passed: False` even at a near-zero `diff_percentage`. There is no
   separate percentage gate.

## Failure behavior

- Dimension mismatch is a distinct, explicit result — never silently compared
  as misaligned arrays.
- Missing/unreadable image files raise (Pillow's own `IOError`/similar) —
  not caught or translated into a `ComparisonResult`; the CLI will exit
  non-zero with a traceback. No graceful "file not found" `ComparisonResult`
  path exists.
- No retries, no partial results — one comparison is one deterministic pass.

## Assumptions

- Both screenshots come from the same rendering environment (browser, OS,
  DPI/scale factor) and the same viewport/scroll position. The tool has no
  way to detect a DPI mismatch that doesn't also change raw pixel dimensions.
- Images are opaque or the caller doesn't care about alpha — both get
  `.convert("RGB")`, silently flattening any transparency.
- "Meaningful" is entirely defined by the geometric pipeline (blur + threshold
  + connected components) — there's no understanding of *what* changed
  (color vs. text vs. layout), only *where*.

## Acceptance criteria

- Two identical images → `passed: True`, `diff_percentage: 0.0`, no regions.
- Small, scattered per-pixel noise (simulating anti-aliasing) below
  `pixel_threshold` after blurring → `passed: True`.
- A large, unambiguous colored-region change → `passed: False`, one region
  whose bounding box closely matches the changed area (within a few px of
  blur-softened edges).
- Mismatched dimensions → `dimension_mismatch: True`, never a garbage/misaligned
  comparison.
- `pytest packages/visual-regression/tests` passes (19 tests) with zero
  environment variables set.

## Known gaps (from the 2026-08-15 audit)

1. **The anti-aliasing tolerance claim has never been tested against a real
   browser-rendered screenshot.** Every test image and the example's
   before/after pair are synthetic — drawn with Pillow primitives (`rectangle`,
   default bitmap font). Real Chromium sub-pixel text rendering and
   anti-aliasing has different statistical characteristics than PIL-drawn
   shapes. This is the component's single biggest unverified claim — see
   `changes/VR-001`.
2. **The diff mask is recomputed from scratch up to 3 times per CLI
   invocation** (once in `compare()`, again in `render_diff_image()`, and the
   highlighted image reuses `compare()`'s regions but not its mask) —
   inefficient, and relies on `self.config` staying immutable across calls
   rather than that being structurally enforced.
3. **Region merging is O(n²) per pass, worst-case O(n³) across repeated
   passes.** Irrelevant at the demo's scale (1 region); would matter for a
   page with many scattered small diffs.
4. **No graceful handling of missing/corrupt image files** — see "Failure
   behavior" above.
