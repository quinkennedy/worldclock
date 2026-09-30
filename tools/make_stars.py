"""Yale Bright Star Catalogue (BSC5) -> data/stars.bin.

Offline prep for spec 02; never run by the site.

    python tools/make_stars.py            # downloads the catalogue into tools/cache/

Output: little-endian Float32, 4 per star: [raRad, decRad, vmag, bv], brightest first.
Positions are J2000 (spec 05 precesses them at runtime). Every star with a position is
kept (to V ~ 6.5). A missing B-V becomes 0.65, roughly Sun-like.

Source: Hoffleit & Warren (1991), The Bright Star Catalogue, 5th Revised Ed., CDS V/50.
"""
import gzip
import math
import os

import numpy as np

from raster import DATA, check_size, fetch, log

SRC_URL = "https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz"
MISSING_BV = 0.65
OUT = os.path.join(DATA, "stars.bin")


def field(line, start, end):
    """Bytes start..end, 1-based and inclusive as in the CDS ReadMe; None if blank."""
    s = line[start - 1:end].strip()
    return s or None


def main():
    with gzip.open(fetch(SRC_URL, "catalog.gz"), "rt", encoding="ascii") as f:
        lines = f.read().splitlines()

    stars, no_pos, no_bv = [], 0, 0
    for line in lines:
        line = line.ljust(197)
        if field(line, 76, 77) is None or field(line, 103, 107) is None:
            no_pos += 1  # novae and clusters removed from the catalogue
            continue
        ra_h = int(field(line, 76, 77)) + int(field(line, 78, 79)) / 60 + float(field(line, 80, 83)) / 3600
        dec = int(field(line, 85, 86)) + int(field(line, 87, 88)) / 60 + int(field(line, 89, 90)) / 3600
        if line[83] == "-":
            dec = -dec
        bv = field(line, 110, 114)
        if bv is None:
            no_bv += 1
        stars.append((math.radians(ra_h * 15), math.radians(dec),
                      float(field(line, 103, 107)), MISSING_BV if bv is None else float(bv)))

    stars.sort(key=lambda s: s[2])
    np.asarray(stars, "<f4").tofile(OUT)
    log(f"{len(stars)} stars (skipped {no_pos} without a position, filled {no_bv} missing B-V);"
        f" V {stars[0][2]:.2f} to {stars[-1][2]:.2f}")
    check_size(OUT)


if __name__ == "__main__":
    main()
