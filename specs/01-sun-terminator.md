# 01 — Sun, terminator & twilight  (v1)

**Status: done.** Outstanding: the long-run test (memory and sleep/wake lock) in `DEV.md`, on the gallery machine.

## Outcome
A full-screen equirectangular map, with the day side as light paper and the night side as
dark space, split by a real terminator with a smooth twilight gradient. Land is a flat tint.

## Scope
- WebGL fragment shader on one full-screen quad. Each pixel -> (lat, lon) -> unit normal.
- The sun direction is computed in JS from UTC (NOAA solar-position algorithm: declination +
  equation of time -> sub-solar lat/lon) and passed to the shader as a uniform.
- Sun altitude at a pixel = asin(dot(normal, sunDir)). A clear-sky illuminance model turns altitude
  into ground lux (~400 at sunset, ~3 at -6°, ~0.01 at -12°, night floor by -18°; rising to ~120 klux
  overhead), and brightness is log lux mapped between `nightLux` and `dayLux`. No stepped bands.
- Land mask: one small raster (from Natural Earth). Land is a slightly different tint from
  water on both the day and night sides.
- The map fills the viewport with full longitude width. On screens wider than 2:1, crop the poles symmetrically.
  From 2:1 down to 16:10, stretch vertically to fill. Narrower than 16:10, stretch to 16:10 and letterbox the rest
  (limit and letterbox colour in `config.json`).
- Build `js/clock.js` here (the sim clock described in 07: anchor, speed, pause). Only the Tweakpane panel waits for 07.
  Redraw every 5 s when live; at 4K the terminator moves about 1 px every 22 s.
- `?gui&t=<ISO date>` starts paused at that time, for testing. The public page (no `?gui`) ignores `?t=`.
- The day/night/land/water colours live in `config.json` (via `js/config.js`), ready for 07's panel.
  The twilight's `nightLux`/`dayLux` are also in `config.json` but stay out of the panel.
- Handles `devicePixelRatio` and resize. Requests a Screen Wake Lock where supported.

## Out of scope
Land-cover colours, dots, relief, stars, moon, any text.

## Acceptance
- `?gui&t=2026-03-20T12:00Z`: the terminator is nearly vertical at about ±90° longitude.
- `?gui&t=2026-06-21T12:00Z`: the Arctic is fully lit and Antarctica fully dark.
- The sub-solar point matches a reference (e.g. timeanddate.com) to within 0.5°.
- Runs for 24 h in Chrome with flat memory use.
