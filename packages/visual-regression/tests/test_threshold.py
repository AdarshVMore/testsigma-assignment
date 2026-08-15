import pytest
from threshold import ComparisonConfig


def test_defaults_are_valid():
    config = ComparisonConfig()
    assert config.pixel_threshold == 30
    assert config.blur_radius == 1.5
    assert config.min_region_area == 40
    assert config.merge_distance == 10


@pytest.mark.parametrize(
    "kwargs",
    [
        {"pixel_threshold": -1},
        {"pixel_threshold": 256},
        {"blur_radius": -0.5},
        {"min_region_area": -1},
        {"merge_distance": -1},
    ],
)
def test_rejects_invalid_values(kwargs):
    with pytest.raises(ValueError):
        ComparisonConfig(**kwargs)


def test_config_is_immutable():
    config = ComparisonConfig()
    with pytest.raises(Exception):
        config.pixel_threshold = 100  # type: ignore[misc]
