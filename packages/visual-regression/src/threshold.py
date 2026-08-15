"""Configurable knobs for the comparison pipeline (see compare.py)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ComparisonConfig:
    """
    All values are V1 starting defaults, not statistically tuned — they are
    deliberately conservative (few false positives on ordinary anti-aliasing
    noise) and documented as such in the README's "V1 limitations" section.
    """

    #: 0-255 grayscale absolute-difference threshold above which a pixel
    #: counts as "changed". Higher = more tolerant of rendering noise.
    pixel_threshold: int = 30

    #: Gaussian blur radius (px) applied identically to both images before
    #: diffing, to symmetrically absorb anti-aliasing/font-rendering noise.
    #: 0 disables blurring (closer to a naive pixel diff).
    blur_radius: float = 1.5

    #: Connected components smaller than this (in px^2) are discarded as
    #: residual noise rather than reported as a changed region.
    min_region_area: int = 40

    #: Bounding boxes within this many pixels of each other are merged into
    #: one region, so a single real UI change doesn't render as several
    #: adjacent shards.
    merge_distance: int = 10

    def __post_init__(self) -> None:
        if not (0 <= self.pixel_threshold <= 255):
            raise ValueError("pixel_threshold must be within 0..255")
        if self.blur_radius < 0:
            raise ValueError("blur_radius must be >= 0")
        if self.min_region_area < 0:
            raise ValueError("min_region_area must be >= 0")
        if self.merge_distance < 0:
            raise ValueError("merge_distance must be >= 0")
