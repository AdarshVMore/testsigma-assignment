import numpy as np
from regions import RegionDetector
from threshold import ComparisonConfig


def test_empty_mask_yields_no_regions():
    mask = np.zeros((100, 100), dtype=np.uint8)
    regions = RegionDetector().detect(mask, ComparisonConfig())
    assert regions == []


def test_single_solid_square_yields_one_region_at_expected_bbox():
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[10:30, 20:50] = 1  # rows 10..29 (height 20), cols 20..49 (width 30)

    regions = RegionDetector().detect(mask, ComparisonConfig(min_region_area=10))

    assert len(regions) == 1
    region = regions[0]
    assert (region.x, region.y, region.width, region.height) == (20, 10, 30, 20)
    assert region.pixel_count == 30 * 20


def test_stray_single_pixel_is_filtered_out_as_noise():
    mask = np.zeros((50, 50), dtype=np.uint8)
    mask[5, 5] = 1  # a single isolated pixel

    regions = RegionDetector().detect(mask, ComparisonConfig(min_region_area=40))

    assert regions == []


def test_nearby_regions_are_merged_into_one():
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[10:20, 10:20] = 1  # region A: 10x10 at (10,10)
    mask[10:20, 25:35] = 1  # region B: 10x10 at (25,10) — 5px gap from A

    regions = RegionDetector().detect(mask, ComparisonConfig(min_region_area=10, merge_distance=10))

    assert len(regions) == 1
    region = regions[0]
    # union of (10,10,10,10) and (25,10,10,10) -> x:10..35, y:10..20
    assert (region.x, region.y, region.width, region.height) == (10, 10, 25, 10)


def test_far_apart_regions_stay_separate():
    mask = np.zeros((200, 200), dtype=np.uint8)
    mask[10:20, 10:20] = 1
    mask[150:160, 150:160] = 1

    regions = RegionDetector().detect(mask, ComparisonConfig(min_region_area=10, merge_distance=10))

    assert len(regions) == 2


def test_merge_distance_zero_disables_merging():
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[10:20, 10:20] = 1
    mask[10:20, 22:32] = 1  # 2px gap — would normally merge

    regions = RegionDetector().detect(mask, ComparisonConfig(min_region_area=10, merge_distance=0))

    assert len(regions) == 2
