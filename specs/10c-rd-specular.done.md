# 10c — RD as specular highlights  (done, prototype)

Part of 10 (reaction-diffusion water). A new display mode in the 10a/10b prototype at `proto/10-rd-water/`,
following the prototype rules in `00-vision.md`. Every decision below was confirmed by Quin in the interview on
2026-09-30.

## Outcome
The single greyscale RD field (not 10b's one sim per colour channel) becomes the water's surface. The real sun, and
the real moon at night, glint off it, so the pattern reads as light on moving water rather than ink.

## Decisions
1. **Where (Quin):** a new `specular` display mode on the same page as 10a/10b, reusing the sim, flow and panel.
   10b's colour modes stay for comparison. It uses one sim (like grey mode).
2. **View direction (Quin):** every point is seen from straight above (the local zenith), like a satellite over
   each spot. On flat water the sun glint gathers around the sub-solar point and moves with the real sun; the RD
   ripples break it into sparkles farther out.
3. **RD as height (Quin):** the RD value, normalised by the model's view `lo`/`hi`, is wave height. Its gradient
   tilts the water normal, as 04 does for relief, with a **normal strength** slider. The gradient is
   taken per sim cell with central differences (east spacing by the grid's latitude correction), sampled from the
   sim texture in the display pass.
4. **Highlight feel (Quin):** tunable, anywhere from crisp sparkles to a broad sheen. Blinn-Phong:
   `pow(max(N·H, 0), exponent)` with H = normalize(L + up), and **exponent** and **strength** sliders.
5. **Base water (Quin; revised 2026-10-01):** three colour targets, night → moon → sunny (10b's sunny and night
   pickers, plus a specular-only **moon** palette with water and land). The smooth sphere's total lux (01's
   `illuminance()` from `twilight.glsl`, plus moon lux when moon lighting is on) picks the colour on one log-lux
   scale: night at 0 lux, the moon target at **moon stop lux** (slider, default 0.25, full moon at the zenith), the
   sunny target at `dayLux`, linear in `log((lux + nightLux) / nightLux)` between stops. Sun twilight passes through
   the moon target too, with or without a moon (Quin chose one gradient over separate sun and moon drivers). Land
   blends the same way with its own three colours. Uses the smooth sphere, not the RD normal.
6. **Brightness (Quin):** glint = specular term × `daylight()` of that light's own lux, so it uses the same log
   mapping as the rest of the piece. A full-moon glint shows at roughly 30% of a sun glint; a crescent's is almost
   nothing.
7. **Glint colour (Quin): physical approximation.** The light's colour comes from atmospheric extinction along its
   path: per-channel transmittance `exp(−τ · airMass)` with Kasten-Young air mass at the light's altitude, so it
   reddens toward the horizon. τ (R, G, B) ≈ 0.10, 0.17, 0.35 (Rayleigh plus a light aerosol term);
   physical constants stay in the shader, as with 01. The colour is normalised to its brightest channel, so it
   sets hue only and brightness comes from item 6. No glint once the light is below the horizon.
8. **Moonlight (Quin):** 14's model is implemented in the prototype: moon magnitude from phase angle (Krisciunas &
   Schaefer) and distance, dimmed by air mass. Moon lux adds to the sun's for the base-water blend and drives its
   own glint, with the same colour model at the moon's altitude (moonlight is sunlight; no tint). Two checkboxes
   (Quin, 2026-10-01): **moon glint** (its glint) and **moon lighting** (its lux in the base colour), so the glint
   can show without moonlight on the globe. The moon's position and phase come from `js/moon.js`.
9. **Sun and time (Quin):** `js/sun.js` and `js/moon.js`, driven by `js/clock.js` `simNow()`. The panel gets a Time
   folder with speed, pause, set time and "now" (the prototype isn't the public page, so these are always shown).
10. **Compositing (Quin):** glints are added on top of the base colour in sRGB and clamped. No glint on land; seafloor relief
    (04) is not used.

## Settings (`proto/10-rd-water/settings.json`)
`specular`: `normalStrength`, `exponent`, `strength`, `moonGlint`, `moonLighting` (bools). `twilight`: `nightLux`,
`dayLux` (copied from `config.json`'s values as defaults), `moonLux` (the moon stop, 0.25). `color.moon`: `water`,
`land` (Quin's values: `#0e1722`, `#151820`). `time`: none stored; the clock starts at now.

## Acceptance
- With the clock at an equinox noon UTC, a glint patch sits near 0°, 0° (offset by the equation of time) and moves
  west as time runs.
- At the June solstice the glint sits near 23.4°N.
- Toward the terminator the glint reddens and fades; beyond it there's none from the sun.
- At full moon the night side shows a dimmer, moonlit glint near the sub-lunar point; with moon glint off, or at new
  moon, it's gone. With moon lighting off and moon glint on, the base stays night-coloured and only the glint shows.
- At full moon with moon lighting on, the water and land under the moon move toward the moon targets.
- Normal strength 0 gives a smooth glint with no RD structure; raising it breaks it into the pattern.
- No console errors; the sim and time controls keep working in every mode.

## Build notes
- `specular` mode in `shaders/display.frag` (it `#include`s `../../../shaders/twilight.glsl`), uniforms in
  `main.js`, and Time and Specular folders in `gui.js`. The Time folder's **Now** also resets the speed to x1.
- **Sun glint lux is the direct beam only** (`128000·sin(alt)·0.8^airMass`, the direct term of `illuminance()`),
  not the full illuminance with skylight. A reflection is of the disc, and this fades smoothly to 0 at the horizon;
  the full value would jump to ~400 lux there and cut the glint off hard. (Implementation reading of decision 6.)
- Moon lux: `2.54e-6 · 10^(−0.4V)` lux for magnitude V, times sin(alt)·0.8^airMass: ~0.25 lux at the zenith at full
  moon, ~0.023 at quarter, matching 14's expected values.
- Checked in headless Chrome (SwiftShader, 1024 map, Gray-Scott maze): the glint sits near 0°, 0° at the 2026 March
  equinox noon UTC, near 23°N at the June solstice, over the east Pacific at 20:00 UTC, and reddens toward the
  terminator. At the 2026-10-26 04:13 UTC full moon, the night water is moonlit and shows faint glints around the
  sub-lunar point (16.7°N, 68.9°W). No console errors. How it looks on the real display is still to be judged.
- 2026-10-01 (moon targets and split toggles): checked in headless Chrome at the same full moon with lighting+glint,
  glint only, and neither; the moonlit hemisphere takes the moon colours only with lighting on. No console errors.
