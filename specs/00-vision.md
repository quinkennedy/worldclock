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
| Config     | Tunables in `config.json`; GUI copies or downloads it; commit the file to change defaults |
| Motion     | Real time on the public page; speed, set time, pause and presets in the dev GUI |
| Day side   | Light "paper", CMYK Ben-Day overprint by land cover |
| Night side | Dark; land a faint tint vs water; zenith star map; stylised moon |
| Twilight   | Soft bands (civil / nautical / astronomical) |
| Classes    | water, arid, forest, ice, grass/tundra |
| Relief     | Lit by the live sun angle; exaggeration tunable via URL |
| Moon       | At sub-lunar point, real phase, stylised size, always visible |
| Stars      | True zenith sky: rotates with sidereal time |
| Data       | Generative; offline prep scripts are OK when they make serving easier |

## Spec map
| #  | Spec                       | Status  | Depends on |
|----|----------------------------|---------|------------|
| 01 | Sun, terminator & twilight | **v1**  | —          |
| 02 | Data prep pipeline         | later   | —          |
| 03 | Land-cover CMYK halftone   | later   | 01, 02     |
| 04 | Relief lit by the sun      | later   | 01, 02     |
| 05 | Night sky: zenith stars    | later   | 01         |
| 06 | Moon                       | later   | 01         |
| 07 | Dev GUI & time control     | **v1, after 01** | 01 (clock.js) |
