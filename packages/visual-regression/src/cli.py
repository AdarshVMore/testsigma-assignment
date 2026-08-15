"""Thin CLI wrapper: compare two screenshots, write diff.png/highlighted.png/result.json.

Usage:
    python cli.py before.png after.png --output-dir output/
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from compare import ImageComparator
from threshold import ComparisonConfig


def main(argv: list[str] | None = None) -> int:
    defaults = ComparisonConfig()
    parser = argparse.ArgumentParser(description="Compare two screenshots and highlight visual differences.")
    parser.add_argument("before", help="Path to the baseline screenshot")
    parser.add_argument("after", help="Path to the new screenshot")
    parser.add_argument("--output-dir", default="output", help="Directory to write diff.png/highlighted.png/result.json into")
    parser.add_argument("--pixel-threshold", type=int, default=defaults.pixel_threshold)
    parser.add_argument("--blur-radius", type=float, default=defaults.blur_radius)
    parser.add_argument("--min-region-area", type=int, default=defaults.min_region_area)
    parser.add_argument("--merge-distance", type=int, default=defaults.merge_distance)
    args = parser.parse_args(argv)

    config = ComparisonConfig(
        pixel_threshold=args.pixel_threshold,
        blur_radius=args.blur_radius,
        min_region_area=args.min_region_area,
        merge_distance=args.merge_distance,
    )
    comparator = ImageComparator(config)
    result = comparator.compare(args.before, args.after)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    payload = result.to_dict()
    payload["config"] = {
        "pixelThreshold": config.pixel_threshold,
        "blurRadius": config.blur_radius,
        "minRegionArea": config.min_region_area,
        "mergeDistance": config.merge_distance,
    }

    if not result.dimension_mismatch:
        comparator.render_diff_image(args.before, args.after).save(output_dir / "diff.png")
        comparator.render_highlighted_image(args.after, result.regions).save(output_dir / "highlighted.png")

    (output_dir / "result.json").write_text(json.dumps(payload, indent=2))

    print(json.dumps(payload, indent=2))
    return 0 if result.passed else 1


if __name__ == "__main__":
    sys.exit(main())
