#!/usr/bin/env python3
"""Generate NR Space PWA icons and iOS splash screens from the site logo."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / 'icons'
SPLASH = ROOT / 'splash'
FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'

INK = (17, 17, 17, 255)
WHITE = (255, 255, 255, 255)
BORDER = (17, 17, 17, 28)
SPLASH_BG = (28, 28, 30, 255)


def load_font(size):
    return ImageFont.truetype(FONT, size)


def draw_nr(img, box, letter_ratio=0.42):
    if letter_ratio <= 0:
        return
    draw = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    size = max(8, int(min(w, h) * letter_ratio))
    font = load_font(size)
    text = 'NR'
    tw, th = draw.textbbox((0, 0), text, font=font)[2:]
    # Arial Black-like tight tracking: draw letters slightly closer
    cx = x0 + (w - tw) / 2
    cy = y0 + (h - th) / 2 - th * 0.06
    draw.text((cx, cy), text, font=font, fill=INK)


def tile(size, letter_ratio=0.42, pad_ratio=0.10, radius_ratio=0.22):
    img = Image.new('RGBA', (size, size), WHITE)
    draw = ImageDraw.Draw(img)
    pad = int(size * pad_ratio)
    radius = int(size * radius_ratio)
    box = [pad, pad, size - pad - 1, size - pad - 1]
    draw.rounded_rectangle(box, radius=radius, fill=WHITE, outline=BORDER, width=max(1, size // 80))
    draw_nr(img, box, letter_ratio=letter_ratio)
    return img


def maskable(size=512):
    """Full-bleed white, NR in the center 65% so Android circle/squircle keeps letters."""
    img = Image.new('RGBA', (size, size), WHITE)
    inset = int(size * 0.175)
    draw_nr(img, [inset, inset, size - inset, size - inset], letter_ratio=0.48)
    return img


def shortcut(size, kind):
    img = tile(size, letter_ratio=0.0, pad_ratio=0.08, radius_ratio=0.22)
    draw = ImageDraw.Draw(img)
    m = size * 0.28
    x0, y0, x1, y1 = m, m, size - m, size - m
    sw = max(2, size // 18)
    if kind == 'rnp':
        bars = [(0.18, 0.62), (0.50, 0.28), (0.82, 0.42)]
        for t, top in bars:
            cx = x0 + (x1 - x0) * t
            bw = size * 0.10
            draw.rounded_rectangle(
                [cx - bw / 2, y0 + (y1 - y0) * (top - 0.18), cx + bw / 2, y1],
                radius=bw / 3, fill=INK,
            )
    else:
        pts = [
            (x0, (y0 + y1) / 2),
            (x0 + (x1 - x0) * 0.22, (y0 + y1) / 2),
            (x0 + (x1 - x0) * 0.40, y1 - sw),
            (x0 + (x1 - x0) * 0.62, y0 + sw),
            (x0 + (x1 - x0) * 0.78, (y0 + y1) / 2),
            (x1, (y0 + y1) / 2),
        ]
        draw.line(pts, fill=INK, width=sw, joint='curve')
    return img


def splash(w, h):
    img = Image.new('RGBA', (w, h), SPLASH_BG)
    side = int(min(w, h) * 0.22)
    tile_img = tile(side, letter_ratio=0.44, pad_ratio=0.0, radius_ratio=0.22)
    x = (w - side) // 2
    y = (h - side) // 2
    img.paste(tile_img, (x, y), tile_img)
    return img.convert('RGB')


def save_png(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    out = img.convert('RGB') if img.mode == 'RGBA' else img
    out.save(path, 'PNG', optimize=True)
    print('wrote', path.relative_to(ROOT), out.size)


def main():
    ICONS.mkdir(exist_ok=True)
    SPLASH.mkdir(exist_ok=True)
    save_png(tile(192, letter_ratio=0.44, pad_ratio=0.08), ICONS / 'icon-192.png')
    save_png(tile(512, letter_ratio=0.44, pad_ratio=0.08), ICONS / 'icon-512.png')
    save_png(maskable(512), ICONS / 'icon-512-maskable.png')
    save_png(tile(180, letter_ratio=0.44, pad_ratio=0.08), ICONS / 'apple-touch-icon.png')
    save_png(shortcut(96, 'rnp'), ICONS / 'shortcut-rnp.png')
    save_png(shortcut(96, 'dashboard'), ICONS / 'shortcut-dashboard.png')

    splashes = [
        (1170, 2532),  # 390x844 @3  iPhone 14/15/16
        (1179, 2556),  # 393x852 @3  iPhone 14/15 Pro
        (1206, 2622),  # 402x874 @3  iPhone 16 Pro
        (1284, 2778),  # 428x926 @3  iPhone 14/15 Plus
        (1290, 2796),  # 430x932 @3  iPhone 14/15/16 Pro Max
        (1320, 2868),  # 440x956 @3  iPhone 16 Pro Max
        (1125, 2436),  # 375x812 @3  iPhone 13/12 mini
        (750, 1334),   # 375x667 @2  iPhone SE
        (828, 1792),   # 414x896 @2  iPhone 11 / XR
        (1242, 2688),  # 414x896 @3  iPhone 11 Pro Max
    ]
    for w, h in splashes:
        save_png(splash(w, h), SPLASH / f'splash-{w}x{h}.png')


if __name__ == '__main__':
    main()
