"""Rebuild OutRay partner logo: dark mark on transparent + wordmark lockup."""
from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "partners" / "outray.png"
MARK = ROOT / "public" / "partners" / "outray-mark.png"
SVG = ROOT / "public" / "partners" / "outray.svg"


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    out: list[tuple[int, int, int, int]] = []
    for r, g, b, a in im.getdata():
        brightness = (r + g + b) / 3
        if a < 20 or brightness < 40:
            out.append((0, 0, 0, 0))
        else:
            alpha = int(min(255, max(0, (brightness - 40) * 1.3)))
            out.append((17, 17, 17, alpha))
    im.putdata(out)

    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    size = max(im.size)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(
        im,
        ((size - im.size[0]) // 2, (size - im.size[1]) // 2),
        im,
    )
    canvas.save(MARK)

    buf = io.BytesIO()
    canvas.resize((64, 64), Image.Resampling.LANCZOS).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="168" height="40" viewBox="0 0 168 40" role="img" aria-label="OutRay">
  <image href="data:image/png;base64,{b64}" x="0" y="4" width="32" height="32"/>
  <text x="42" y="27" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22" font-weight="700" fill="#111111">OutRay</text>
</svg>
"""
    SVG.write_text(svg, encoding="utf-8")
    print(f"wrote {MARK} ({MARK.stat().st_size} bytes)")
    print(f"wrote {SVG} ({SVG.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
