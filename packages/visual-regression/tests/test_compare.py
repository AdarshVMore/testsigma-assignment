import numpy as np
from PIL import Image

from compare import ImageComparator
from threshold import ComparisonConfig


def _save(image: Image.Image, path) -> str:
    image.save(path)
    return str(path)


def _solid(size=(200, 100), color=(240, 240, 240)) -> Image.Image:
    return Image.new("RGB", size, color)


def test_identical_images_pass_with_zero_diff(tmp_path):
    image = _solid()
    before = _save(image, tmp_path / "before.png")
    after = _save(image.copy(), tmp_path / "after.png")

    result = ImageComparator().compare(before, after)

    assert result.passed is True
    assert result.diff_percentage == 0.0
    assert result.regions == []


def test_subtle_rendering_noise_below_threshold_still_passes(tmp_path):
    # Simulate anti-aliasing/rendering jitter: small, scattered per-pixel
    # noise (well under pixel_threshold=30), not a real UI change.
    rng = np.random.default_rng(42)
    base = np.full((100, 200, 3), 240, dtype=np.int16)
    noisy = base.copy()
    noise = rng.integers(-8, 9, size=noisy.shape)
    noisy = np.clip(noisy + noise, 0, 255).astype(np.uint8)

    before = _save(Image.fromarray(base.astype(np.uint8)), tmp_path / "before.png")
    after = _save(Image.fromarray(noisy), tmp_path / "after.png")

    result = ImageComparator().compare(before, after)

    assert result.passed is True
    assert result.regions == []


def test_obvious_colored_square_is_detected_and_localized(tmp_path):
    before_image = _solid((200, 150), (255, 255, 255))
    after_image = before_image.copy()
    # Paint a solid red 40x40 square at (50, 30) — a large, unambiguous change.
    pixels = after_image.load()
    for x in range(50, 90):
        for y in range(30, 70):
            pixels[x, y] = (255, 0, 0)

    before = _save(before_image, tmp_path / "before.png")
    after = _save(after_image, tmp_path / "after.png")

    result = ImageComparator().compare(before, after)

    assert result.passed is False
    assert result.diff_percentage > 0
    assert len(result.regions) == 1

    region = result.regions[0]
    # Blur softens edges by ~1-2px in each direction — allow a small margin
    # rather than asserting an exact pixel-perfect bounding box.
    assert abs(region.x - 50) <= 4
    assert abs(region.y - 30) <= 4
    assert abs(region.width - 40) <= 6
    assert abs(region.height - 40) <= 6


def test_mismatched_dimensions_are_reported_distinctly(tmp_path):
    before = _save(_solid((200, 100)), tmp_path / "before.png")
    after = _save(_solid((300, 150)), tmp_path / "after.png")

    result = ImageComparator().compare(before, after)

    assert result.dimension_mismatch is True
    assert result.passed is False
    assert result.diff_percentage == 100.0


def test_configurable_pixel_threshold_changes_sensitivity(tmp_path):
    before_image = _solid((100, 100), (200, 200, 200))
    after_image = _solid((100, 100), (215, 215, 215))  # a uniform, subtle 15-level shift

    before = _save(before_image, tmp_path / "before.png")
    after = _save(after_image, tmp_path / "after.png")

    strict = ImageComparator(ComparisonConfig(pixel_threshold=10, min_region_area=1, blur_radius=0))
    lenient = ImageComparator(ComparisonConfig(pixel_threshold=30, min_region_area=1, blur_radius=0))

    assert strict.compare(before, after).passed is False
    assert lenient.compare(before, after).passed is True


def test_render_diff_and_highlighted_images_produce_expected_sizes(tmp_path):
    before_image = _solid((120, 80), (255, 255, 255))
    after_image = before_image.copy()
    pixels = after_image.load()
    for x in range(10, 30):
        for y in range(10, 30):
            pixels[x, y] = (0, 0, 0)

    before = _save(before_image, tmp_path / "before.png")
    after = _save(after_image, tmp_path / "after.png")

    comparator = ImageComparator()
    result = comparator.compare(before, after)

    diff_image = comparator.render_diff_image(before, after)
    assert diff_image.size == (120, 80)
    assert diff_image.mode == "L"

    highlighted_image = comparator.render_highlighted_image(after, result.regions)
    assert highlighted_image.size == (120, 80)
    assert highlighted_image.mode == "RGB"
