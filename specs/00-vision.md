# 00 — Vision

## Goal
An ambient art piece for a public/gallery space. A simulated sun lights a globe, and that lit
globe is unwrapped in real time onto a flat map. People read it only as day and night:
no numbers, labels or UI. It's a clock only in the sense that it is always true.

## Audience and setting
- Strangers walking past. It must make sense with no explanation.
- One monitor driven by a laptop/desktop (a decent GPU, WebGL available).
- Hosted as a static GitHub Pages site and runs unattended for weeks.

## Principles
1. **Physically true, visually stylised.** Positions (sun, stars, moon) are real. The rendering is graphic.
2. **Generative.** Images are computed in shaders from data, not painted or photographed.
3. **Real time in public.** The public page moves at the Earth's actual speed. Time-lapse and scrubbing exist only in the dev GUI (07).
4. **Small specs.** Each spec below stands alone and can be shipped by itself.

## Locked decisions
| Area       | Decision |
|------------|----------|
| Projection | Equirectangular. Land fixed, shadow moves west to east. Full longitude always spans the width. |
| Aspect     | Wider than 2:1: crop the poles. 2:1 down to 16:10: stretch vertically to fill. Narrower than 16:10: stretch to 16:10, letterbox the rest. |
| Text       | None on the canvas: no labels, numbers, scale or caption |
| Dev GUI    | Tweakpane, loaded only with `?gui`; `g` toggles; x1 to x100000, reversible; `?t=` works only with `?gui` |
| Presets    | Equinoxes and solstices of the sim time's UTC year, at the instant this piece's solar model gives (within ~10 min of published times). Full/new moon: the next one strictly after the sim time (Meeus ch. 49), so repeated presses step forward. Presets reset the speed to +x1 and keep the pause state |
| Sim clock  | Real time is the wall clock (`Date.now()`), followed at sub-ms resolution via `performance.now()` and re-synced when they drift > 50 ms apart, so fast playback doesn't stutter. Zone-less `?t=`/panel times are UTC |
| Config     | Tunables in `config.json`; GUI copies or downloads it; commit the file to change defaults |
| Motion     | Real time on the public page; speed, set time, pause and presets in the dev GUI |
| Day side   | Light "paper", CMYK Ben-Day overprint by land cover |
| Night side | Dark; land a faint tint vs water; zenith star map; stylised moon |
| Twilight   | One smooth gradient from a clear-sky illuminance model (log lux vs sun altitude), no stepped bands. Only its night/day lux range is in `config.json`, and it isn't in the dev GUI |
| Twilight model (provisional) | `dayLux` 100000: the whole day side shades toward the terminator, brightest at the sub-solar point (revisit with 04's relief lighting). `nightLux` 0.001: full dark from about -18°. The model's physical constants stay in the shader, not config. Clear sky, no moonlight. Night/day colours blend in sRGB, not linear light |
| Classes    | water, arid, forest, ice, grass/tundra. IGBP mapping table in 02 (open shrublands split at \|lat\| 55°; polar barren stays arid) |
| Relief     | Lit by the live sun angle: the sun's altitude is taken against the terrain normal and drives the whole twilight model. Land and seafloor each have an exaggeration in `config.json` and the GUI (no query string) |
| Moon       | At sub-lunar point, real phase, stylised size, always visible |
| Stars      | True zenith sky: rotates with sidereal time (GMST), J2000 precessed to date. No constellation lines, no Milky Way. Fades with 01's twilight on the smooth sphere. Coloured from B−V; size, alpha and colour strength in `config.json` |
| Data       | Generative; offline prep scripts are OK when they make serving easier |
| Data sources | Land cover and land mask: MODIS MCD12C1 v061 (latest year, manual Earthdata download). Elevation: ETOPO 2022 60s surface, with bathymetry. Stars: Yale BSC5, all ~9,100 stars. Details in 02 |
| Data files | 4096x2048 cell-registered equirectangular. `land.png` = land fraction (inland lakes are water; Antarctic ice shelves are land, as ice; Arctic left as MODIS has it). `landcover.webp` = lossless RGB arid/forest/ice fractions (grass = land − sum). `elevation.webp` = lossless WebP, packed 16-bit metres+32768 in R/G (cell means), read with `texelFetch`. `stars.bin` = Float32 [ra, dec, vmag, B-V], J2000, precessed at runtime by 05. 10 MB budget is soft |

## Spec map
| #  | Spec                       | Status  | Depends on |
|----|----------------------------|---------|------------|
| 01 | Sun, terminator & twilight | **done** (long-run test pending, see `DEV.md`) | — |
| 02 | Data prep pipeline         | **done** | —         |
| 03 | Land-cover CMYK halftone   | later   | 01, 02     |
| 04 | Relief lit by the sun      | **done** (long-run test pending) | 01, 02     |
| 05 | Night sky: zenith stars    | **done** (long-run test pending) | 01         |
| 06 | Moon                       | later   | 01         |
| 07 | Dev GUI & time control     | **done** (long-run test pending, see `DEV.md`) | 01 (clock.js) |
| 08 | Anti-solar sky             | idea    | 05         |
