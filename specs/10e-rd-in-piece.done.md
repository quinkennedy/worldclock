# 10e — RD water in the piece  (done; long-run test pending)

Part of 10 (reaction-diffusion water). Brings the prototype's result (`proto/10-rd-water/`, 10a + 10c + 10d) into
`index.html`. The defaults are the prototype's `settings.json` as of 2026-10-08. Every decision below was confirmed by
Quin in the interview on 2026-10-08.

## Outcome
The public page's oceans carry a slowly drifting Gray-Scott pattern that reads as light on moving water. The real
sun and moon glint off it, and the whole map is coloured on the prototype's night → moon → day scale.

## Decisions
1. **Look (Quin):** specular only (10c), with 10d's warm-up and fade. 10b's colour modes and the grey view stay in
   the prototype; 10b stays `defined`.
2. **Base colours (Quin):** the prototype's three-stop blend (night → moon → day on one log-lux scale, linear in
   `log((lux + nightLux) / nightLux)`, with the moon stop at `twilight.moonLux`) replaces 01's two-colour
   `daylight()` blend, for land and water.
   - Land keeps 04's relief: its lux is taken against the terrain normal (land exaggeration).
   - Water uses the smooth sphere. The RD normal replaces sea relief, so `relief.seaExaggeration` is removed.
   - The coast is drawn as in the prototype: `smoothstep(0.4, 0.6, land fraction)` blends water into land.
3. **Moon (Quin):** spec 14's moon lux, as built in the prototype. `moonlight.enabled` (14's name) adds moon lux to
   the base colours; `water.specular.moonGlint` turns on the moon's glint. Both default on. On land the moon's
   altitude is taken against the terrain normal, as 14 says. Stars don't dim with moonlight yet (still open in 14).
4. **Cadence (Quin):** one `requestAnimationFrame` chain, capped at `render.fps` (default 20) at all times, with or
   without the GUI and at any clock speed. The 5 s live timer is gone.
5. **Step rate (Quin):** `water.sim.stepsPerFrame` (default 1, as in the prototype). At 20 fps the RD runs a third
   as fast as the prototype did at 60 Hz, on purpose.
6. **Grid (Quin):** map space only, `water.sim.mapWidth` (1024, 2048 or 4096; default 4096), height = width / 2,
   `latCorrection` 0, `precision` `half` or `float` (default `half`, what `auto` picked for Gray-Scott; `float`
   falls back to `half` without `OES_texture_float_linear`). Screen space stays in the prototype.
7. **Model (Quin):** Gray-Scott only, with the depth-driven A/B parameter blend (`lo`, `hi`, `invert`). Other models
   and parameter sources stay in the prototype.
8. **Stability (Quin):** no automatic handling. The long-run test in `DEV.md` also watches the water. A stability
   sub-spec comes later if needed.
9. **Clock (Quin):** the RD is independent of the sim clock. It steps every rendered frame whatever the clock's
   speed or pause; the GUI has its own RD pause.
10. **Palette (Quin):** the prototype's colours. Day water `#b5aa91`, day land `#b5aa88`; moon water `#0e1722`, moon
    land `#151820`; night water `#08080c`, night land `#05050b`; letterbox `#000000`.
11. **Moon stop (Quin):** `twilight.moonLux` (0.25) is config-only, like `nightLux` and `dayLux`.
12. **GUI (Quin):** a Water folder: specular (normal strength, exponent, strength, moon glint); Gray-Scott (Du, Dv,
    dt, seed density, sets A and B feed/kill, view lo/hi); depth map (lo, hi, invert); flow (strength, scale,
    evolution); sim (map width, precision, steps/frame, warm-up steps, fade seconds, Pause, Reseed, read-outs).
    The palette colours and `moonlight.enabled` go in the Twilight folder. No model or space switch.
13. **Warm-up (Quin):** 10d's hold and fade (1000 steps, then 10 s) run on page load, after a WebGL context restore
    (the sim state is lost), on the GUI's Reseed, and when the grid is rebuilt (map width or precision).
14. **Fast warm-up (Quin, 2026-10-08):** `water.sim.instantWarmup` (default on, checkbox "fast warm-up" in the Sim
    folder) and `water.sim.warmupStepsPerFrame` (default 100, slider 1–5000). For every trigger in 13, the seed's
    first frame is drawn as usual (base colours, so the page is never blank). From the next frame, the hold runs up
    to `warmupStepsPerFrame` steps per frame (a value ≥ `warmupSteps` runs it all in one frame). They run in chunks of
    `stepsPerFrame`, with the flow advancing between chunks as it would over those frames. The fade then runs as
    usual (10 s).

## Config (`config.json`)
- `palette`: `dayWater`, `dayLand`, `moonWater`, `moonLand`, `nightWater`, `nightLand`, `letterbox`.
- `twilight`: `nightLux`, `dayLux`, `moonLux`.
- `relief`: `landExaggeration` only.
- `moonlight`: `enabled`.
- `render`: `fps`.
- `water.sim`: `mapWidth`, `latCorrection`, `precision`, `stepsPerFrame`, `warmupSteps`, `fadeSeconds`,
  `instantWarmup`, `warmupStepsPerFrame`.
- `water.grayScott`: `Du`, `Dv`, `dt`, `seedDensity`, `a`/`b` `{feed, kill}`, `view` `{channel, lo, hi}`.
- `water.depthMap`: `lo`, `hi`, `invert`. `water.flow`: `strength`, `scale`, `evolution`.
- `water.specular`: `normalStrength`, `exponent`, `strength`, `moonGlint`.

## Changes to locked decisions (`00-vision.md`)
Twilight (three stops instead of two), Relief (land only; the water's normal is the RD), Moonlight (a moon colour
stop instead of 01's two-colour mapping), Motion (rAF capped at 20 fps instead of a 5 s redraw), Night side and Day
side (RD water with glints).

## Out of scope
Real current data, Ben-Day dots (03/09), colour layers (10b), stability handling, star dimming by moonlight. The
prototype is left as it is.

## Acceptance
- The public page shows plain base colours on the water for the warm-up, then the pattern and glints fade in. No
  console errors.
- `/?gui&t=2026-03-20T12:00Z`: a sun glint near 0°, 0°; the terminator still at about ±90°.
- `/?gui&t=2026-06-21T12:00Z`: the glint near 23°N; the Arctic lit.
- At the next full moon preset, the night side under the moon takes the moon colours and the water shows a faint
  moon glint; with `moonlight.enabled` off, the night colours return and only the glint shows.
- Land relief still shades near the terminator (`/?gui&t=2026-03-20T00:40Z`, the Himalaya).
- The frame rate holds at about 20 fps with the GUI open and closed.
- Changing map width in the GUI rebuilds and warms up again; Reseed does the same.
- The long-run test in `DEV.md` passes, including the water checks.

## Build notes
- `js/water.js` holds the sim (grid, seed, param map, flow, steps, warm-up). New shaders `water-seed.frag`,
  `water-sim.frag`, `water-flow.frag`, `water-param.frag` and `noise.glsl` are Gray-Scott, depth-only versions of the
  prototype's. `sun.frag` draws land, water and glints in one pass. The prototype is unchanged.
- The render loop in `main.js` is one rAF chain that skips frames to hold `render.fps`; a frame up to 4 ms early
  still counts, so a 60 Hz display holds 20 fps rather than dropping to 15.
- Without `EXT_color_buffer_float` there's no sim: the water shows only its base colours, with no glint.
- Checked in headless Chrome (SwiftShader, 1600×900, config overridden to a 1024 grid and no warm-up for speed),
  2026-10-08: glint near 0°, 0° at the March equinox with the terminator at about ±90°; near 23°N at the June
  solstice with the Arctic lit; at the 2026-10-26 full moon the night side takes the moon colours, and with
  `moonlight.enabled` off it stays night-coloured with only a faint moon glint; Himalayan slopes lit at
  2026-03-20T00:40Z. With the real config the public page shows only base colours during the warm-up (reveal 0 at
  ~170 steps). The frame cap holds 20 fps (23 fps with the cap at 60, SwiftShader's limit). No console errors
  except the existing favicon 404. The 4096 grid's cost and the look on the gallery display are still to be judged.
- Fast warm-up with all 1000 steps in one frame, checked the same way on a 1024 grid: steps jump to 1000 on the
  second frame and the fade starts. On the 4096 grid SwiftShader (CPU) couldn't finish 1000 steps within the test's
  wait. A frame over ~2 s can trip Windows' GPU watchdog and lose the context, which would reseed and repeat, hence
  the per-frame cap (default 100); the cost per frame on the gallery GPU is still to be measured.
