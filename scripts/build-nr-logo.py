#!/usr/bin/env python3
"""Build the shared NR wordmark (white tile, black extra-bold letters, no border)."""
from __future__ import annotations

import os
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT_PATH = ROOT / "fonts" / "Montserrat-Black.ttf"
ICONS = ROOT / "icons"
SPLASH = ROOT / "splash"
MASTER = ICONS / "logo-nr.svg"

# Icon canvas. Letters fill almost the full width (tight side padding).
CANVAS = 512
PAD_X = 28
PAD_Y = 56
MASKABLE_PAD = 92  # extra safe zone for Android circle crop
LETTER_SPACING_EM = -0.03


def glyph_advance(font: TTFont, ch: str) -> float:
    glyph_set = font.getGlyphSet()
    name = font.getBestCmap()[ord(ch)]
    return float(glyph_set[name].width)


def text_width(font: TTFont, text: str, size: float) -> float:
    units = font["head"].unitsPerEm
    scale = size / units
    width = 0.0
    for i, ch in enumerate(text):
        width += glyph_advance(font, ch) * scale
        if i + 1 < len(text):
            width += LETTER_SPACING_EM * size
    return width


def svg_paths(font: TTFont, text: str, size: float, origin_x: float, baseline: float) -> list[str]:
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    units = font["head"].unitsPerEm
    scale = size / units
    x = origin_x
    paths = []
    for i, ch in enumerate(text):
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyph_set)
        tp = TransformPen(pen, (scale, 0, 0, -scale, x, baseline))
        glyph_set[name].draw(tp)
        paths.append(pen.getCommands())
        x += glyph_advance(font, ch) * scale
        if i + 1 < len(text):
            x += LETTER_SPACING_EM * size
    return paths


def write_master_svg(font: TTFont) -> None:
    size = fit_size(font, CANVAS - 2 * PAD_X)
    width = text_width(font, "NR", size)
    x = (CANVAS - width) / 2
    # Optical vertical center: Montserrat caps sit slightly high if we use cap-height only.
    cap = font["OS/2"].sCapHeight * (size / font["head"].unitsPerEm)
    baseline = (CANVAS + cap) / 2 - 6
    paths = svg_paths(font, "NR", size, x, baseline)
    body = "\n  ".join(f'<path d="{d}" fill="#000000"/>' for d in paths)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS} {CANVAS}" role="img" aria-label="NR">
  <rect width="{CANVAS}" height="{CANVAS}" fill="#ffffff"/>
  {body}
</svg>
'''
    MASTER.write_text(svg)
    print(f"[logo] {MASTER.relative_to(ROOT)}")


def fit_size(font: TTFont, max_width: float) -> float:
    # Binary-search a font size so "NR" is as wide as max_width.
    lo, hi = 40.0, 420.0
    best = lo
    for _ in range(24):
        mid = (lo + hi) / 2
        w = text_width(font, "NR", mid)
        if w <= max_width:
            best = mid
            lo = mid
        else:
            hi = mid
    return best


def render_png(font_file: Path, size_px: int, pad_x: int, pad_y: int, dest: Path) -> None:
    img = Image.new("RGBA", (size_px, size_px), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Scale padding with canvas.
    scale = size_px / CANVAS
    max_w = size_px - 2 * int(round(pad_x * scale))
    # Find a pixel font size that fills max_w.
    lo, hi = 8, size_px
    best = 8
    face = None
    for _ in range(20):
        mid = (lo + hi) // 2
        trial = ImageFont.truetype(str(font_file), mid)
        bbox = draw.textbbox((0, 0), "NR", font=trial, spacing=0)
        # Pillow letter-spacing via font size only; apply tracking by measuring + nudge.
        w = bbox[2] - bbox[0]
        tracking = LETTER_SPACING_EM * mid
        w += tracking
        if w <= max_w:
            best = mid
            face = trial
            lo = mid + 1
        else:
            hi = mid - 1
    face = face or ImageFont.truetype(str(font_file), best)
    # Draw with explicit per-letter positions for negative tracking.
    glyphs = []
    x = 0.0
    for i, ch in enumerate("NR"):
        bbox = draw.textbbox((0, 0), ch, font=face)
        gw = bbox[2] - bbox[0]
        glyphs.append((ch, x - bbox[0], -bbox[1], bbox))
        x += gw
        if i == 0:
            x += LETTER_SPACING_EM * best
    total_w = x
    total_h = draw.textbbox((0, 0), "NR", font=face)[3] - draw.textbbox((0, 0), "NR", font=face)[1]
    ox = (size_px - total_w) / 2
    # Recompute combined visual box for vertical centering.
    union = None
    placed = []
    cursor = ox
    for i, ch in enumerate("NR"):
        bbox = draw.textbbox((0, 0), ch, font=face)
        placed.append((ch, cursor - bbox[0], -bbox[1]))
        next_x = cursor + (bbox[2] - bbox[0])
        if i == 0:
            next_x += LETTER_SPACING_EM * best
        box = (cursor, 0, next_x if i == 0 else cursor + (bbox[2] - bbox[0]), bbox[3] - bbox[1])
        union = box if union is None else (
            min(union[0], box[0]), min(union[1], box[1]),
            max(union[2], box[2]), max(union[3], box[3]),
        )
        cursor = next_x
    visual_h = union[3] - union[1]
    oy = (size_px - visual_h) / 2
    for ch, gx, gy in placed:
        draw.text((gx, oy + gy), ch, font=face, fill=(0, 0, 0, 255))
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PNG")
    print(f"[logo] {dest.relative_to(ROOT)} {img.size}")


def write_ico(src: Path, dest: Path) -> None:
    base = Image.open(src).convert("RGBA")
    ico = [base.resize((s, s), Image.Resampling.LANCZOS) for s in (16, 32, 48)]
    ico[0].save(dest, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"[logo] {dest.relative_to(ROOT)}")


def write_splash(tile: Image.Image, w: int, h: int, dest: Path) -> None:
    img = Image.new("RGB", (w, h), (28, 28, 30))  # #1C1C1E
    side = min(w, h) * 0.22
    logo = tile.resize((int(side), int(side)), Image.Resampling.LANCZOS)
    img.paste(logo, ((w - logo.width) // 2, (h - logo.height) // 2), logo if logo.mode == "RGBA" else None)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PNG")
    print(f"[logo] {dest.relative_to(ROOT)} {img.size}")


def main() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    font = TTFont(str(FONT_PATH))
    write_master_svg(font)

    render_png(FONT_PATH, 512, PAD_X, PAD_Y, ICONS / "icon-512.png")
    render_png(FONT_PATH, 192, PAD_X, PAD_Y, ICONS / "icon-192.png")
    render_png(FONT_PATH, 180, PAD_X, PAD_Y, ICONS / "apple-touch-icon.png")
    render_png(FONT_PATH, 512, MASKABLE_PAD, MASKABLE_PAD, ICONS / "icon-512-maskable.png")
    render_png(FONT_PATH, 96, PAD_X, PAD_Y, ICONS / "shortcut-rnp.png")
    render_png(FONT_PATH, 96, PAD_X, PAD_Y, ICONS / "shortcut-dashboard.png")
    render_png(FONT_PATH, 32, PAD_X, PAD_Y, ICONS / "favicon.png")
    render_png(FONT_PATH, 640, PAD_X, PAD_Y, ICONS / "telegram-nr-avatar.png")

    write_ico(ICONS / "icon-512.png", ROOT / "favicon.ico")
    write_ico(ICONS / "icon-512.png", ICONS / "favicon.ico")

    tile = Image.open(ICONS / "icon-512.png").convert("RGBA")
    for name, w, h in [
        ("splash-750x1334.png", 750, 1334),
        ("splash-828x1792.png", 828, 1792),
        ("splash-1125x2436.png", 1125, 2436),
        ("splash-1170x2532.png", 1170, 2532),
        ("splash-1179x2556.png", 1179, 2556),
        ("splash-1206x2622.png", 1206, 2622),
        ("splash-1242x2688.png", 1242, 2688),
        ("splash-1284x2778.png", 1284, 2778),
        ("splash-1290x2796.png", 1290, 2796),
        ("splash-1320x2868.png", 1320, 2868),
    ]:
        write_splash(tile, w, h, SPLASH / name)


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
