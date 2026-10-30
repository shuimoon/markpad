"""Draws the MarkPad launcher icon at every density, plus a 512px preview.

Usage: python tools/make-icon.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.normpath(os.path.join(HERE, "..", "android", "res"))
OUT = os.path.normpath(os.path.join(HERE, "..", ".shots"))

# Palette taken from src/index.css (accent family).
GREEN_TOP = (25, 122, 98)
GREEN_BOT = (15, 92, 74)
PAPER = (246, 244, 236)

DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
SUPERSAMPLE = 4


def rounded_mask(size, radius, ss):
    mask = Image.new("L", (size * ss, size * ss), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (0, 0, size * ss - 1, size * ss - 1), radius=radius * ss, fill=255
    )
    return mask.resize((size, size), Image.LANCZOS)


def gradient(size, ss):
    width = height = size * ss
    base = Image.new("RGB", (1, height))
    for y in range(height):
        t = y / max(1, height - 1)
        base.putpixel(
            (0, y),
            (
                round(GREEN_TOP[0] + (GREEN_BOT[0] - GREEN_TOP[0]) * t),
                round(GREEN_TOP[1] + (GREEN_BOT[1] - GREEN_TOP[1]) * t),
                round(GREEN_TOP[2] + (GREEN_BOT[2] - GREEN_TOP[2]) * t),
            ),
        )
    img = base.resize((width, height), Image.BICUBIC)
    return img


def font_path():
    for candidate in (
        "C:/Windows/Fonts/seguisb.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ):
        if os.path.exists(candidate):
            return candidate
    return None


def draw_icon(size):
    ss = SUPERSAMPLE
    canvas = gradient(size, ss).convert("RGBA")

    # Paper card, slightly rotated, giving the "writing pad" read.
    card_w = int(size * ss * 0.56)
    card_h = int(size * ss * 0.66)
    card = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle(
        (0, 0, card_w - 1, card_h - 1), radius=int(card_w * 0.16), fill=PAPER + (255,)
    )
    # three ruled lines on the paper
    line_x0 = int(card_w * 0.18)
    line_x1 = int(card_w * 0.82)
    for i, ratio in enumerate((0.30, 0.46, 0.62)):
        y = int(card_h * ratio)
        width = line_x1 if i < 2 else int(card_w * 0.62)
        cd.rounded_rectangle(
            (line_x0, y, width, y + max(2, int(card_h * 0.035))),
            radius=int(card_h * 0.02),
            fill=(25, 122, 98, 210 if i < 2 else 120),
        )
    card = card.rotate(-8, resample=Image.BICUBIC, expand=True)

    canvas.alpha_composite(
        card,
        (
            (canvas.width - card.width) // 2,
            (canvas.height - card.height) // 2,
        ),
    )

    path = font_path()
    if path:
        text = "M"
        fsize = int(card_h * 0.42)
        font = ImageFont.truetype(path, fsize)
        layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        box = ld.textbbox((0, 0), text, font=font)
        ld.text(
            (
                (canvas.width - (box[2] - box[0])) // 2 - box[0],
                (canvas.height - (box[3] - box[1])) // 2 - box[1] + int(size * ss * 0.02),
            ),
            text,
            font=font,
            fill=(20, 96, 78, 255),
        )
        canvas.alpha_composite(layer)

    canvas = canvas.resize((size, size), Image.LANCZOS)
    canvas.putalpha(rounded_mask(size, int(size * 0.235), 1))
    return canvas


def main():
    master = draw_icon(512)
    os.makedirs(OUT, exist_ok=True)
    master.save(os.path.join(OUT, "icon-512.png"))
    for density, size in DENSITIES.items():
        folder = os.path.join(RES, "mipmap-" + density)
        os.makedirs(folder, exist_ok=True)
        icon = master.resize((size, size), Image.LANCZOS)
        icon.save(os.path.join(folder, "ic_launcher.png"))
        print("wrote", os.path.join(folder, "ic_launcher.png"), size)


if __name__ == "__main__":
    main()
