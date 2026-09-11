#!/usr/bin/env python3
"""
Derive the light-background Suffolk Tennis Partnership lockup from the official
dark-background artwork.

The brand pack ships the lockup with white ink (LTA mark, rule and "TENNIS
PARTNERSHIP"), which is correct on navy and invisible on the white surfaces the
signed-in app uses. Rather than redraw it, this recolours the white ink to the
partnership navy, keeping the pink "SUFFOLK" and every shape byte-identical to
the official file.

The "LTA" letters are knocked out of the parallelogram (transparent holes). On a
pure-white page they'd read correctly by accident, but on a tinted surface they
would pick up the tint - so enclosed holes inside the mark are filled with solid
white, which is what the official light artwork shows.

Outputs are cropped to their ink bounding box, so a CSS height means "the logo is
exactly this tall" and responsive sizing is predictable.

    python3 scripts/make-light-logo.py        # requires Pillow
"""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/assets/suffolk-tennis-logo-landscape-v2.png"
OUT_LOCKUP = ROOT / "src/assets/suffolk-tennis-logo-landscape-light.png"
OUT_MARK = ROOT / "src/assets/suffolk-tennis-mark-light.png"

NAVY = (31, 45, 107)
OPAQUE = 128


def is_pink(r: int, g: int, b: int) -> bool:
    return r > 140 and b > 80 and g < r - 50


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()

    # The pink wordmark's left edge separates the LTA mark from the type.
    pink_x = min(
        x
        for y in range(0, h, 4)
        for x in range(0, w, 4)
        if px[x, y][3] > 60 and is_pink(*px[x, y][:3])
    )
    mark_limit = pink_x - 20

    out = Image.new("RGBA", (w, h))
    o = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                o[x, y] = (0, 0, 0, 0)
            elif is_pink(r, g, b):
                o[x, y] = (r, g, b, a)
            else:
                o[x, y] = (*NAVY, a)

    # Flood the exterior so enclosed transparent regions can be told apart.
    exterior = [[False] * w for _ in range(h)]
    q: deque = deque()

    def seed(x: int, y: int) -> None:
        if px[x, y][3] <= OPAQUE and not exterior[y][x]:
            exterior[y][x] = True
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not exterior[ny][nx] and px[nx, ny][3] <= OPAQUE:
                exterior[ny][nx] = True
                q.append((nx, ny))

    for y in range(h):
        for x in range(mark_limit):
            if px[x, y][3] <= OPAQUE and not exterior[y][x]:
                o[x, y] = (255, 255, 255, 255)

    lockup = out.crop(out.getbbox())
    lockup.save(OUT_LOCKUP, optimize=True)

    mark = out.crop((0, 0, mark_limit, h))
    mark = mark.crop(mark.getbbox())
    mark.save(OUT_MARK, optimize=True)

    print(f"{OUT_LOCKUP.relative_to(ROOT)}  {lockup.size[0]}x{lockup.size[1]}")
    print(f"{OUT_MARK.relative_to(ROOT)}  {mark.size[0]}x{mark.size[1]}")


if __name__ == "__main__":
    main()
