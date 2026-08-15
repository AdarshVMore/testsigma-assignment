"""Clusters a boolean diff mask into bounding-box "changed regions"."""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from threshold import ComparisonConfig


@dataclass
class Region:
    x: int
    y: int
    width: int
    height: int
    pixel_count: int

    def to_dict(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "pixelCount": self.pixel_count,
        }


class RegionDetector:
    """
    Turns a raw "which pixels changed" boolean mask into a small number of
    bounding boxes suitable for drawing on a highlight image — a real UI
    change is one box, not a scatter of individual differing pixels.

    Two steps: (1) 8-connected-component labeling via OpenCV
    (`cv2.connectedComponentsWithStats`) to find contiguous blobs of changed
    pixels, dropping blobs below `min_region_area` as residual noise; (2)
    merge boxes that are within `merge_distance` of each other, since a
    single visual change (e.g. a resized button) often produces two or three
    nearby blobs rather than one contiguous one.
    """

    def detect(self, mask: np.ndarray, config: ComparisonConfig) -> list[Region]:
        num_labels, _labels, stats, _centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)

        regions: list[Region] = []
        for label in range(1, num_labels):  # label 0 is always the background
            x, y, w, h, area = stats[label]
            if area < config.min_region_area:
                continue
            regions.append(Region(x=int(x), y=int(y), width=int(w), height=int(h), pixel_count=int(area)))

        return self._merge_nearby(regions, config.merge_distance)

    def _merge_nearby(self, regions: list[Region], merge_distance: int) -> list[Region]:
        if merge_distance <= 0 or len(regions) <= 1:
            return regions

        merged = list(regions)
        changed = True
        while changed:
            changed = False
            for i in range(len(merged)):
                for j in range(i + 1, len(merged)):
                    if self._within_distance(merged[i], merged[j], merge_distance):
                        merged[i] = self._union(merged[i], merged[j])
                        del merged[j]
                        changed = True
                        break
                if changed:
                    break
        return merged

    @staticmethod
    def _within_distance(a: Region, b: Region, distance: int) -> bool:
        # Expand `a`'s box by `distance` on every side and check for overlap
        # with `b`'s box — equivalent to "the gap between them is <= distance".
        a_x0, a_y0 = a.x - distance, a.y - distance
        a_x1, a_y1 = a.x + a.width + distance, a.y + a.height + distance
        b_x0, b_y0 = b.x, b.y
        b_x1, b_y1 = b.x + b.width, b.y + b.height
        return not (a_x1 < b_x0 or b_x1 < a_x0 or a_y1 < b_y0 or b_y1 < a_y0)

    @staticmethod
    def _union(a: Region, b: Region) -> Region:
        x0, y0 = min(a.x, b.x), min(a.y, b.y)
        x1, y1 = max(a.x + a.width, b.x + b.width), max(a.y + a.height, b.y + b.height)
        return Region(x=x0, y=y0, width=x1 - x0, height=y1 - y0, pixel_count=a.pixel_count + b.pixel_count)
