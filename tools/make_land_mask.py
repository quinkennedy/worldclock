"""Rasterise Natural Earth land polygons into an equirectangular land mask.

Offline prep for spec 01; never run by the site. Spec 02 will replace this mask
with one derived from the land-cover data.

    python tools/make_land_mask.py            # writes data/land.png

Output: 8-bit greyscale PNG, 255 = land, 0 = water, antialiased coastlines.
Row 0 is 90N, column 0 is 180W.
"""
import json
import os
import sys
import urllib.request

from PIL import Image, ImageDraw

SRC_URL = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
           "master/geojson/ne_50m_land.geojson")
WIDTH, HEIGHT = 4096, 2048
SUPERSAMPLE = 4
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "land.png")


def to_px(lon, lat, w, h):
    return ((lon + 180.0) / 360.0 * w, (90.0 - lat) / 180.0 * h)


def main():
    print("downloading", SRC_URL, file=sys.stderr)
    with urllib.request.urlopen(SRC_URL) as r:
        geo = json.load(r)

    w, h = WIDTH * SUPERSAMPLE, HEIGHT * SUPERSAMPLE
    img = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(img)
    for feat in geo["features"]:
        g = feat["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for rings in polys:
            # Exterior ring fills land; interior rings (holes) cut it back out.
            for i, ring in enumerate(rings):
                draw.polygon([to_px(x, y, w, h) for x, y in ring], fill=255 if i == 0 else 0)

    img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)
    img.save(OUT, optimize=True)
    print("wrote", os.path.normpath(OUT), os.path.getsize(OUT), "bytes", file=sys.stderr)


if __name__ == "__main__":
    main()
