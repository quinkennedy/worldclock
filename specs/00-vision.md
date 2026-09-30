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
| Night side | Dark; land a faint tint vs water; zenith star map; stylised moon; physical moonlight (14) |
| Twilight   | One smooth gradient from a clear-sky illuminance model (log lux vs sun altitude), no stepped bands. Only its night/day lux range is in `config.json`, and it isn't in the dev GUI |
| Twilight model (provisional) | `dayLux` 100000: the whole day side shades toward the terminator, brightest at the sub-solar point (revisit with 04's relief lighting). `nightLux` 0.001: full dark from about -18°. The model's physical constants stay in the shader, not config. Clear sky. Moonlight (14) adds its lux to the sun's before the same mapping. Night/day colours blend in sRGB, not linear light |
| Classes    | water, arid, forest, ice, grass/tundra. IGBP mapping table in 02 (open shrublands split at \|lat\| 55°; polar barren stays arid) |
| Relief     | Lit by the live sun angle: the sun's altitude is taken against the terrain normal and drives the whole twilight model. Land and seafloor each have an exaggeration in `config.json` and the GUI (no query string) |
| Sun & moon discs | Thin outlines at the sub-solar and sub-lunar points, always visible; the moon shows its real phase. Stylised size, each with its own scale in config and the GUI. Same line on both sides of the terminator, different colours. Where they overlap, both outlines show. The moon's phase is a soft terminator line, not a fill |
| Moonlight  | Strictly physical (phase, distance, altitude; no gain or tint), through 01's lux-to-colour mapping. Lights relief against the terrain normal and dims the stars. `moonlight.enabled` toggle in config and the GUI |
| Stars      | True zenith sky: rotates with sidereal time (GMST), J2000 precessed to date. No constellation lines, no Milky Way. Fades with 01's twilight on the smooth sphere. Coloured from B−V; size, alpha and colour strength in `config.json` |
| Data       | Generative; offline prep scripts are OK when they make serving easier |
| Data sources | Land cover and land mask: MODIS MCD12C1 v061 (latest year, manual Earthdata download). Elevation: ETOPO 2022 60s surface, with bathymetry. Stars: Yale BSC5, all ~9,100 stars. Details in 02 |
| Data files | 4096x2048 cell-registered equirectangular. `land.png` = land fraction (inland lakes are water; Antarctic ice shelves are land, as ice; Arctic left as MODIS has it). `landcover.webp` = lossless RGB arid/forest/ice fractions (grass = land − sum). `elevation.webp` = lossless WebP, packed 16-bit metres+32768 in R/G (cell means), read with `texelFetch`. `stars.bin` = Float32 [ra, dec, vmag, B-V], J2000, precessed at runtime by 05. 10 MB budget is soft |
| Prototypes | Each is a self-contained page at `proto/NN-name/index.html`, published on Pages but not linked from the piece. Imports shared code and data by relative path (`../../js/`, `../../shaders/`, `../../data/`), never copies. Tweakpane (same pinned version) always visible, `g` hides it, settings copy/download as JSON. Own defaults in its own folder; `config.json` and `index.html` stay untouched until a later spec adopts the design. The public-page rules (no GUI without `?gui`, no text) don't apply; time source, `highp`, relative paths and leak rules do |
| Sub-specs  | A spec split into parts keeps its number as the umbrella; the parts are `NNa`, `NNb`, … (e.g. `10a-rd-flow-proto.done.md`), each with its own stage |

## Spec map
Spec files are named `NN-name.<stage>.md`, with stage `idea`, `defined`, `ready` or `done`. A spec is renamed when its
stage changes; its number never changes. `ready` means every key decision has been confirmed by Quin.

| #  | Spec                       | Status  | Depends on |
|----|----------------------------|---------|------------|
| 01 | Sun, terminator & twilight | **done** (long-run test pending, see `DEV.md`) | — |
| 02 | Data prep pipeline         | **done** | —         |
| 03 | Land-cover CMYK halftone   | defined | 01, 02     |
| 04 | Relief lit by the sun      | **done** (long-run test pending) | 01, 02     |
| 05 | Night sky: zenith stars    | **done** (long-run test pending) | 01         |
| 06 | Sun & moon discs           | **done** (long-run test pending) | 01         |
| 07 | Dev GUI & time control     | **done** (long-run test pending, see `DEV.md`) | 01 (clock.js) |
| 08 | Anti-solar sky             | idea    | 05         |
| 09 | Ben-Day dot design iteration | idea (prototype first) | (03) |
| 10 | Reaction-diffusion water   | defined (umbrella: living ocean texture) | (02, 09) |
| 10a | RD + fake flow prototype (`proto/10-rd-water/`) | **done** (prototype; tuning on the real display pending) | 02 |
| 11 | Orange-peel projection     | idea (prototype first) | 01 |
| 12 | Globe views                | idea (prototype first) | 01 (06 for moon views) |
| 13 | Spec stage colours in VS Code (dev tooling) | idea | — |
| 14 | Moonlight                  | defined | 06 (touches 01, 04, 05) |
| 15 | Sunset & sunrise colour    | idea (prototype first) | 01 |

Specs 09–12 and 15 are design prototypes built outside `index.html`. Before any of them starts, interview Quin for the real
goal, split it into small sub-specs if needed, and have Quin explicitly confirm each key decision (see each spec).
