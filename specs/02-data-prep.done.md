# 02 — Data prep pipeline  (done)

## Outcome
Scripts in `tools/` that turn public datasets into small, shader-ready files committed
under `data/`. The site itself never processes raw data.

This spec changes only `tools/`, `data/` and docs. `data/land.png` keeps its format, so no
`js/` or `shaders/` change (and no long-run test) is needed. Specs 03–05 consume the new files.

## Sources
| Data       | Source | Licence | Download |
|------------|--------|---------|----------|
| Land cover | NASA MODIS **MCD12C1** v061 (IGBP, Land_Cover_Type_1_Percent), latest year (2025 at time of writing) | No restrictions on reuse; citation requested | **Manual**: needs a free NASA Earthdata login; place the `.hdf` in `tools/cache/` |
| Elevation  | NOAA **ETOPO 2022** 60 arc-second, **surface** (ice-sheet tops), land + bathymetry | Public domain | Script downloads it |
| Stars      | **Yale Bright Star Catalogue**, 5th rev. ed. (Hoffleit & Warren 1991), CDS V/50 | Free with citation | Script downloads it |

Raw downloads live in `tools/cache/` (gitignored). Python deps are in `tools/requirements.txt`.

## Outputs
All rasters are equirectangular 4096x2048, cell-registered: row 0's top edge is 90°N, column 0's
left edge is 180°W. Downsampling is an area average.

| File | Format | Contents |
|------|--------|----------|
| `data/land.png`      | 8-bit L   | Land fraction, 0 = water, 255 = land (same format as spec 01's mask). Land = 1 − IGBP water %, plus ice shelves (below). Inland lakes are water. |
| `data/landcover.webp` | lossless WebP, 8-bit RGB | Fraction of each cell: R = arid, G = forest, B = ice. Grass/tundra = land − R − G − B; water = 1 − land. Filterable linearly; spec 03 mixes ink recipes by fraction. |
| `data/elevation.webp` | lossless WebP, 8-bit RGB | Packed 16-bit: `v = round(metres) + 32768`, R = high byte, G = low byte, B = 0. Includes bathymetry. Each texel is its cell's mean, so extremes are lower (Everest's cell ≈ 6,370 m). Lossless WebP because it's 23% smaller than PNG (8.4 vs 10.9 MB). Not linearly filterable: shaders use `texelFetch` and filter manually. |
| `data/stars.bin`     | Float32 LE | Every BSC5 star with a position (9,096; complete to V ≈ 6.5, a few companions down to 7.96), brightest first, 4 floats each: `[raRad, decRad, vmag, bv]`. J2000 positions (spec 05 applies precession at runtime). Missing B-V (310 stars) becomes 0.65. |

Size budget: aim for `data/` under 10 MB, but it's soft. Keep 4096x2048 and report the total.

## IGBP -> 5 classes
| IGBP | Name | Class |
|------|------|-------|
| 0  | Water | water |
| 1–5 | Evergreen/deciduous needleleaf/broadleaf, mixed forest | forest |
| 6  | Closed shrublands | grass/tundra |
| 7  | Open shrublands | grass/tundra where \|lat\| ≥ 55°, else arid (splits Arctic tundra from desert scrub) |
| 8  | Woody savannas | forest |
| 9–14 | Savannas, grasslands, permanent wetlands, croplands, urban, cropland/natural mosaic | grass/tundra |
| 15 | Snow and ice | ice |
| 16 | Barren (including high-Arctic polar desert) | arid |
| 255 | Unclassified | water |

**Ice shelves:** MODIS calls the Antarctic ice shelves (Ross, Ronne, …) water. South of 60°S, cells where the
ETOPO 2022 surface is above sea level (computed at ETOPO's 1′ resolution, then area-averaged) are added to
land as ice, so Antarctica's outline includes its shelves. The rule is not applied in the Arctic: there it would
fill inland lakes (their surface is above sea level), and the real Arctic shelves (Petermann, 79N, Milne, …) total
a few thousand km², mostly already land in MODIS, and some have collapsed since the source data.

## Scripts
- `tools/make_land.py`: MCD12C1 (+ ETOPO for ice shelves) -> `land.png` + `landcover.webp`
- `tools/make_elevation.py`: ETOPO 2022 -> `elevation.webp`
- `tools/make_stars.py`: BSC5 -> `stars.bin`

Spec 01's Natural Earth script (`make_land_mask.py`) is removed. README credits all three sources.

## Acceptance
- The generated files match the formats above. Preview images (the class map in flat colours, hillshaded
  elevation, a star plot) are checked by eye before commit.
- `land.png` still drives spec 01 unchanged: the page runs and the Great Lakes, Victoria and Baikal show as water, and the Ross/Ronne ice shelves as land.
- Spot checks: Sahara and central Australia arid, Amazon and Congo forest, Greenland, Antarctica and the Ross/Ronne ice shelves ice,
  Arctic Canada grass/tundra; highest cell (Himalaya) ≈ 6,370 m, deepest (Mariana Trench) ≈ −10,360 m; Sirius is the first star (V −1.46).
