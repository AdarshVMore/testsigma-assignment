"""
Generates before.png / after.png for the visual-regression example: a small
mock "login card" UI, with one deliberate, meaningful change in the "after"
version (the primary button's color and copy changed — a realistic design
tweak). Everything else on the card (fields, copy, layout) is pixel-identical
between the two, so the CLI run demonstrates region detection localizing the
diff to just the button, not the whole page.

Run: .venv/bin/python generate_fixtures.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).parent
WIDTH, HEIGHT = 400, 260


def draw_card(button_color: tuple[int, int, int], button_text: str) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), (245, 246, 248))
    draw = ImageDraw.Draw(image)

    # Card
    draw.rectangle([20, 20, WIDTH - 20, HEIGHT - 20], fill=(255, 255, 255), outline=(220, 220, 224), width=1)

    font = ImageFont.load_default()
    title_font = ImageFont.load_default()

    draw.text((40, 45), "Welcome back", fill=(30, 30, 34), font=title_font)
    draw.text((40, 75), "Sign in to your account to continue", fill=(110, 110, 118), font=font)

    # Email/password field placeholders (unchanged between before/after)
    draw.rectangle([40, 110, WIDTH - 40, 138], fill=(250, 250, 251), outline=(210, 210, 216), width=1)
    draw.text((50, 117), "you@example.com", fill=(150, 150, 158), font=font)
    draw.rectangle([40, 150, WIDTH - 40, 178], fill=(250, 250, 251), outline=(210, 210, 216), width=1)
    draw.text((50, 157), "••••••••", fill=(150, 150, 158), font=font)

    # Primary button — the element that changes between before/after
    draw.rectangle([40, 195, WIDTH - 40, 225], fill=button_color)
    text_bbox = draw.textbbox((0, 0), button_text, font=font)
    text_w = text_bbox[2] - text_bbox[0]
    draw.text((40 + ((WIDTH - 80) - text_w) // 2, 202), button_text, fill=(255, 255, 255), font=font)

    return image


def main() -> None:
    # NOTE: blue (66,133,244) and green (52,168,83) were tried first here and
    # both convert to near-identical grayscale luminance (~126 vs ~124) — a
    # real instance of the documented "grayscale diffing under-detects
    # same-brightness color changes" V1 limitation catching its own demo
    # fixture. Switched to a high-luminance-contrast pair so this example
    # demonstrates detection, not the blind spot.
    before = draw_card(button_color=(66, 133, 244), button_text="Log In")
    after = draw_card(button_color=(17, 17, 17), button_text="Sign In")

    before.save(OUT_DIR / "before.png")
    after.save(OUT_DIR / "after.png")
    print(f"Wrote {OUT_DIR / 'before.png'} and {OUT_DIR / 'after.png'}")


if __name__ == "__main__":
    main()
