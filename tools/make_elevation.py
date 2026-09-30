"""NOAA ETOPO 2022 (60 arc-second, surface) -> data/elevation.webp.

Offline prep for spec 02; never run by the site.

    python tools/make_elevation.py        # downloads ~480 MB into tools/cache/

Output: lossless 8-bit RGB WebP (~23% smaller than PNG) holding packed 16-bit elevation,
land and bathymetry, as the mean of each cell:
v = round(metres) + 32768, R = high byte, G = low byte, B = 0. It can't be filtered
linearly, so shaders read it with texelFetch. Row 0 is 90N, column 0 is 180W.
"Surface" means the tops of the ice sheets, which is what the sun lights.

Source: NOAA NCEI (2022), ETOPO 2022 15 Arc-Second Global Relief Model, doi:10.25921/fd45-gt74.
"""
import os

import numpy as np
from PIL import Image

from raster import DATA, area_resample, check_size, etopo_surface, log

OUT = os.path.join(DATA, "elevation.webp")


def main():
    elev = area_resample(etopo_surface())
    log(f"elevation {elev.min():.0f} to {elev.max():.0f} m")
    v = (np.rint(elev) + 32768).astype(np.uint16)
    rgb = np.dstack([v >> 8, v & 0xFF, np.zeros_like(v)]).astype(np.uint8)
    Image.fromarray(rgb, "RGB").save(OUT, lossless=True, quality=100, method=6)
    assert (np.asarray(Image.open(OUT).convert("RGB")) == rgb).all(), "WebP not lossless"
    check_size(OUT)


if __name__ == "__main__":
    main()
