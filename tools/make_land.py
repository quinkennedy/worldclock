"""NASA MODIS MCD12C1 land cover (+ ETOPO 2022 ice shelves) -> data/land.png + data/landcover.webp.

Offline prep for spec 02; never run by the site.

MCD12C1 needs a free NASA Earthdata login, so download it by hand: search for
MCD12C1 v061 at https://search.earthdata.nasa.gov/, take the latest year's .hdf and
put it in tools/cache/. Then:

    python tools/make_land.py             # uses the newest MCD12C1*.hdf in tools/cache/

MODIS counts Antarctic ice shelves as water, so cells south of 60S where the ETOPO 2022
surface is above sea level are added as land of class ice (ETOPO downloads if missing).

Outputs, both 4096x2048, row 0 = 90N, column 0 = 180W:
- land.png: 8-bit L, land fraction (255 = land). Inland lakes are water.
- landcover.webp: lossless WebP, 8-bit RGB fractions of each cell, R = arid,
  G = forest, B = ice. Grass/tundra = land - R - G - B, and never goes negative.
The IGBP -> 5-class table is in specs/02-data-prep.md.

Source: Friedl, M., Sulla-Menashe, D. (2022). MODIS/Terra+Aqua Land Cover Type Yearly
L3 Global 0.05Deg CMG V061. NASA EOSDIS LP DAAC. doi:10.5067/MODIS/MCD12C1.061
Ice shelves: NOAA NCEI (2022), ETOPO 2022 Global Relief Model, doi:10.25921/fd45-gt74.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image
from pyhdf.SD import SD, SDC

from raster import CACHE, DATA, area_resample, check_size, etopo_surface, log

# IGBP class -> group. Class 7 (open shrublands) is split by latitude below.
WATER, ARID, FOREST, ICE, GRASS = range(5)
IGBP = {0: WATER, 1: FOREST, 2: FOREST, 3: FOREST, 4: FOREST, 5: FOREST,
        6: GRASS, 8: FOREST, 9: GRASS, 10: GRASS, 11: GRASS, 12: GRASS,
        13: GRASS, 14: GRASS, 15: ICE, 16: ARID}
OPEN_SHRUB = 7
TUNDRA_LAT = 55.0  # open shrubland poleward of this is tundra, else desert scrub
SHELF_LAT = -60.0  # ice shelves are filled in south of this


def lats(h):
    """Cell-centre latitudes of an h-row grid, row 0 at the top."""
    return 90.0 - (np.arange(h) + 0.5) * 180.0 / h


def main():
    files = sorted(glob.glob(os.path.join(CACHE, "MCD12C1.A*.061.*.hdf")))
    if not files:
        sys.exit("no MCD12C1 .hdf in tools/cache/; see this script's docstring")
    src = files[-1]
    log("reading", os.path.basename(src))
    pct = SD(src, SDC.READ).select("Land_Cover_Type_1_Percent")[:]  # (3600, 7200, 17), %
    assert pct.shape == (3600, 7200, 17), pct.shape

    total = pct.sum(axis=2, dtype=np.float32)
    total[total == 0] = 100.0  # unclassified cells: no class set, so they count as water

    frac = np.zeros((5,) + pct.shape[:2], np.float32)
    for cls, group in IGBP.items():
        frac[group] += pct[..., cls]
    tundra = (np.abs(lats(pct.shape[0])) >= TUNDRA_LAT)[:, None]
    frac[GRASS] += np.where(tundra, pct[..., OPEN_SHRUB], 0)
    frac[ARID] += np.where(tundra, 0, pct[..., OPEN_SHRUB])
    frac /= total
    del pct

    small = {g: area_resample(frac[g]) for g in (ARID, FOREST, ICE, GRASS)}
    del frac
    land = small[ARID] + small[FOREST] + small[ICE] + small[GRASS]

    # Ice shelves: floating ice above sea level that MODIS calls water.
    z = etopo_surface()
    above = (z > 0) & (lats(z.shape[0]) < SHELF_LAT)[:, None]
    del z
    shelf = np.maximum(area_resample(above) - land, 0)
    small[ICE] += shelf
    land += shelf
    log(f"ice shelves add {shelf.sum() / land.sum() * 100:.2f}% to land cells")

    # Quantise running totals so R + G + B <= land holds exactly after rounding.
    def q(x):
        return np.rint(np.clip(x, 0, 1) * 255).astype(np.int16)
    c1 = q(small[ARID])
    c2 = q(small[ARID] + small[FOREST])
    c3 = q(small[ARID] + small[FOREST] + small[ICE])
    land8 = np.maximum(q(land), c3)
    rgb = np.dstack([c1, c2 - c1, c3 - c2]).astype(np.uint8)

    out = os.path.join(DATA, "land.png")
    Image.fromarray(land8.astype(np.uint8), "L").save(out, optimize=True)
    check_size(out)
    out = os.path.join(DATA, "landcover.webp")
    Image.fromarray(rgb, "RGB").save(out, lossless=True, quality=100, method=6)
    assert (np.asarray(Image.open(out).convert("RGB")) == rgb).all(), "WebP not lossless"
    check_size(out)


if __name__ == "__main__":
    main()
