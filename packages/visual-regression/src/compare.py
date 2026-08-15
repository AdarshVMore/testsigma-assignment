"""Practical V1 screenshot comparator. See README "Visual regression" for the
full rationale and documented limitations; summary here:

Naive pixel-perfect diffing (exact equality or raw absolute-difference sum)
is unusable for real screenshots: anti-aliased text/edge rendering differs
by a few RGB values between otherwise-identical captures, and a 1-2px
layout shift (scrollbar width, sub-pixel font metrics) can shift an entire
edge — a naive diff flags nearly the whole page as "different" on every run.

This pipeline: (1) blur both images identically to symmetrically absorb
anti-aliasing noise without needing image alignment/registration, (2)
threshold the remaining grayscale difference into a boolean changed-pixel
mask, (3) hand the mask to RegionDetector to cluster it into a small number
of bounding boxes, filtering out near-isolated stray pixels that survive
blurring.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from regions import Region, RegionDetector
from threshold import ComparisonConfig


@dataclass
class ComparisonResult:
    passed: bool
    diff_percentage: float
    regions: list[Region]
    dimension_mismatch: bool
    before_size: tuple[int, int]
    after_size: tuple[int, int]

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "diffPercentage": self.diff_percentage,
            "dimensionMismatch": self.dimension_mismatch,
            "beforeSize": list(self.before_size),
            "afterSize": list(self.after_size),
            "regions": [r.to_dict() for r in self.regions],
        }


class ImageComparator:
    def __init__(self, config: Optional[ComparisonConfig] = None):
        self.config = config or ComparisonConfig()
        self.region_detector = RegionDetector()

    def compare(self, before_path: str, after_path: str) -> ComparisonResult:
        before = Image.open(before_path).convert("RGB")
        after = Image.open(after_path).convert("RGB")

        if before.size != after.size:
            # A resized viewport/element isn't a pixel-diffable "regression"
            # in this V1 — reported distinctly rather than silently
            # comparing misaligned arrays (which would produce garbage).
            return ComparisonResult(
                passed=False,
                diff_percentage=100.0,
                regions=[],
                dimension_mismatch=True,
                before_size=before.size,
                after_size=after.size,
            )

        mask = self._diff_mask(before, after)
        regions = self.region_detector.detect(mask, self.config)

        total_pixels = mask.shape[0] * mask.shape[1]
        changed_pixels = int(mask.sum())
        diff_percentage = round(100 * changed_pixels / total_pixels, 4) if total_pixels else 0.0

        return ComparisonResult(
            passed=len(regions) == 0,
            diff_percentage=diff_percentage,
            regions=regions,
            dimension_mismatch=False,
            before_size=before.size,
            after_size=after.size,
        )

    def render_diff_image(self, before_path: str, after_path: str) -> Image.Image:
        """Grayscale heatmap: white = changed pixel, black = unchanged."""
        before = Image.open(before_path).convert("RGB")
        after = Image.open(after_path).convert("RGB")
        mask = self._diff_mask(before, after)
        return Image.fromarray((mask * 255).astype(np.uint8), mode="L")

    def render_highlighted_image(self, after_path: str, regions: list[Region]) -> Image.Image:
        """The after-screenshot with a red box drawn around each changed region."""
        image = Image.open(after_path).convert("RGB")
        draw = ImageDraw.Draw(image)
        for region in regions:
            draw.rectangle(
                [region.x, region.y, region.x + region.width, region.y + region.height],
                outline=(255, 0, 0),
                width=3,
            )
        return image

    def _diff_mask(self, before: Image.Image, after: Image.Image) -> np.ndarray:
        cfg = self.config
        if cfg.blur_radius > 0:
            before = before.filter(ImageFilter.GaussianBlur(cfg.blur_radius))
            after = after.filter(ImageFilter.GaussianBlur(cfg.blur_radius))

        # Grayscale luminance diffing — a documented V1 blind spot: two
        # similarly-bright but differently-colored pixels (e.g. red vs green
        # text) can under-score here. See README limitations.
        before_gray = np.array(before.convert("L"), dtype=np.int16)
        after_gray = np.array(after.convert("L"), dtype=np.int16)

        diff = np.abs(before_gray - after_gray)
        return (diff >= cfg.pixel_threshold).astype(np.uint8)
