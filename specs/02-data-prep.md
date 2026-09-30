# 02 — Data prep pipeline  (later)

## Outcome
Scripts in `tools/` that turn public datasets into small, shader-ready textures committed
under `data/`. The site itself never processes raw data.

## Scope
- Elevation: ETOPO / GEBCO -> a 16-bit or packed-RGB equirectangular PNG (land + bathymetry).
- Land cover: MODIS MCD12Q1 or ESA WorldCover -> reclassified into 5 classes
  (water, arid, forest, ice, grass/tundra) and stored as one 8-bit index PNG.
- Land mask: replaces spec 01's Natural Earth mask with one derived from the land-cover data (so coastlines match).
- A star catalogue (e.g. Yale Bright Star, mag < 6) -> a compact binary or JSON of RA, Dec, mag.
- Target: total `data/` under 10 MB. Resolution to be decided per texture (start at 4096x2048).

## Open questions
- Which land-cover source has a licence that's compatible with a public repo?
- How should IGBP classes map onto the 5 classes? (Write the table down in this spec before coding.)
