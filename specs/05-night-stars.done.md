# 05 — Night sky: zenith stars

**Status: done.** Outstanding: the long-run test in `DEV.md`, and tuning the star defaults on the real display.

## Outcome
On the night side, each point shows the star that is directly overhead there. The sky drifts across
the map once per sidereal day (about 4 min faster than the sun), so over months the constellations
visibly move relative to the terminator.

## Scope
- Zenith at (lat, lon) = celestial (Dec = lat, RA = lon + GMST). Compute GMST in JS and pass it as a uniform.
- Stars from 02's `stars.bin` (BSC5 to V ≈ 6.5, with B-V), drawn as points with size/brightness from magnitude.
- Positions are J2000: precess them to the sim date at runtime (about 0.36° by 2026).
- Fades in with the twilight gradient from 01: none in day, full in astronomical night.
- Drawn over the night-side land/water tint and kept subtle, so the tint still reads.

## Implementation
- `js/stars.js` (pure functions, UTC ms in): GMST (IAU 1982, UT1 taken as UTC) and the precession matrix
  (Lieske 1977, Meeus ch. 21), combined into one `mat3` per frame: J2000 equatorial → Earth-fixed, the same
  frame as `sunDirection`. Nutation and proper motion are ignored (both well under a pixel). It also turns each
  star's B−V into an sRGB colour once at load (Ballesteros temperature → Planckian locus, brightest channel = 1).
- `shaders/stars.vert` / `stars.frag`: one `POINTS` draw after the map quad, alpha-blended. Each star is an
  antialiased disc at (lat, lon) of its zenith point, using the map's aspect rules. It's drawn as 3 instances
  shifted by ±360° so stars straddling ±180° aren't cut off.
- Fade: `1 − daylight` from 01's model at the star's zenith point, on the smooth sphere (the sky isn't shaded
  by relief). `shaders/twilight.glsl` holds that model for both shaders; `main.js` pastes it in for
  `#include "twilight.glsl"`.
- Look (`stars` in `config.json`, GUI folder **Stars**): size and alpha run linearly in magnitude from
  `magLimit` (faintest drawn) to `brightMag` and brighter. Sizes are diameters in degrees of longitude, so they
  scale with the screen. Discs smaller than 1.5 px are drawn at 1.5 px and dimmed by area, so faint stars don't
  flicker. `saturation` mixes the B−V colour from white (0) to full (1).
- The map is seen from above the globe, so constellations appear mirror-imaged compared with looking up (as on a
  celestial globe). That's inherent to a true zenith map.

## Open questions
- Should constellation lines be drawn? (The default is no, per "no labels".) : no
- Should the Milky Way appear as a faint band? : no

## Acceptance
- Orion's belt is overhead at about (lat -1°, lon = 83.8° - GMST) at the given `?t=`.
  Checked headless at `?gui&t=2026-01-15T00:00Z` (GMST 114.46°): Alnilam is drawn at lat −1.19°, lon −30.08°
  (its J2000 RA of 84.05°, precessed by +0.33°), with Betelgeuse up and to the east, Rigel down and to the west.
- GMST matches Meeus example 12.a and the precession matches example 21.b to 1e-6°.
