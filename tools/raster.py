"""Shared helpers for the data-prep scripts (spec 02)."""
import os
import sys
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
DATA = os.path.normpath(os.path.join(HERE, "..", "data"))

# Every raster in data/ is equirectangular at this size, cell-registered:
# row 0's top edge is 90N, column 0's left edge is 180W.
WIDTH, HEIGHT = 4096, 2048


def log(*args):
    print(*args, file=sys.stderr)


def fetch(url, name):
    """Download url into tools/cache/name unless it's already there; return the path."""
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        log("downloading", url)
        urllib.request.urlretrieve(url, path + ".part")
        os.replace(path + ".part", path)
    return path


ETOPO_NAME = "ETOPO_2022_v1_60s_N90W180_surface.nc"
ETOPO_URL = ("https://www.ngdc.noaa.gov/thredds/fileServer/global/ETOPO2022/60s/"
             "60s_surface_elev_netcdf/" + ETOPO_NAME)


def etopo_surface():
    """ETOPO 2022 60s surface elevation in metres, 10800x21600, row 0 = 90N, col 0 = 180W."""
    import h5py
    with h5py.File(fetch(ETOPO_URL, ETOPO_NAME), "r") as f:
        z = f["z"][...]
        if f["lat"][0] < f["lat"][-1]:
            z = z[::-1]  # stored south to north
        assert f["lon"][0] < f["lon"][-1]
    assert not (z == -99999).any(), "fill values in source"
    return z


def _area_axis(a, n_out, axis):
    """Area-average a along axis into n_out equal cells (any ratio, not just integers).

    Each source cell is treated as a constant over its width, so the integral up to a
    fractional position is a linear interpolation of the cumulative sum.
    """
    a = np.moveaxis(a, axis, -1)
    n_in = a.shape[-1]
    c = np.zeros(a.shape[:-1] + (n_in + 1,), np.float64)
    np.cumsum(a, axis=-1, dtype=np.float64, out=c[..., 1:])
    edges = np.linspace(0.0, n_in, n_out + 1)
    i = np.minimum(edges.astype(np.int64), n_in - 1)
    f = edges - i
    at = c[..., i] + (c[..., i + 1] - c[..., i]) * f
    out = (at[..., 1:] - at[..., :-1]) * (n_out / n_in)
    return np.moveaxis(out, -1, axis)


def area_resample(a, height=HEIGHT, width=WIDTH, strip=512):
    """Area-average a 2-D array to height x width, in row strips to bound memory."""
    cols = np.concatenate([_area_axis(a[y:y + strip], width, 1)
                           for y in range(0, a.shape[0], strip)])
    return _area_axis(cols, height, 0)


def check_size(path):
    log("wrote", os.path.relpath(path, os.path.join(HERE, "..")),
        f"{os.path.getsize(path) / 1e6:.2f} MB")
