# 10d — RD warm-up and fade-in  (done, prototype)

Part of 10 (reaction-diffusion water). Changes the 10a/10b/10c prototype at `proto/10-rd-water/`, following the
prototype rules in `00-vision.md`. Every decision below was confirmed by Quin on 2026-10-01.

## Outcome
A fresh seed's startup artifacts (the first steps of random seed blobs spreading) are never seen. After a seed, the
sim runs hidden for a while, then its pattern fades in.

## Decisions
1. **Triggers (Quin):** page load, the **Reseed** button, and any grid rebuild (map size, model, precision, or a
   colour mode that changes the layer count). Not **Clear**, which shows at once.
2. **Hold (Quin):** the sim runs at its normal speed (steps/frame); nothing runs faster. The pattern stays hidden
   until the sim has advanced **warm-up steps** since the seed (default 100, slider 0–5000). Counted in sim steps,
   so pausing the sim pauses the hold.
3. **Hidden means base colours (Quin):** the map draws as usual with no pattern: in the colour modes (RGB, CMYK, HSL)
   the water is the palette's base colour (every layer offset d = 0); in specular mode there's no glint, so the
   water is its night → moon → sunny base colour.
4. **Fade (Quin):** after the hold, a reveal factor ramps linearly from 0 to 1 over **fade seconds** (default 5),
   timed by the browser's frame clock, not the sim clock (which can run fast). Pausing the sim doesn't pause it.
   - Colour modes: the offsets d are scaled by the reveal factor.
   - Specular: the glint (sun and moon) is scaled by the reveal factor; normal strength is unchanged.
5. **Grey mode (Quin):** a debug view; shown raw, with no hold or fade.

## Settings (`proto/10-rd-water/settings.json`)
`sim.warmupSteps` (100), `sim.fadeSeconds` (5). Both in the panel's Sim folder.

## Acceptance
- On load and on Reseed, the water shows only base colours (no pattern, no glint) for the first 100 steps, then the
  pattern fades in over about 5 s.
- Changing map width or colour mode (to a different layer count) does the same.
- Clear shows the cleared sim at once.
- Grey mode shows the pattern from the first step.
- Warm-up steps 0 skips the hold; fade seconds 0 shows the pattern at once after the hold.
- No console errors.

## Build notes
- `reveal()` in `main.js` (state set by `seed()`), the `uReveal` uniform in `shaders/display.frag`, and the two
  sliders plus a read-only **reveal** value (0–1, for checking) in the panel's Sim folder.
- Checked in headless Chrome (SwiftShader, 1024 map, specular and CMYK): reveal stays 0 until step 100, then ramps
  (0.58 about 2.6 s in) to 1; the water shows only base colours while hidden. Reseed restarts the hold; Clear shows
  at once. No console errors. Whether 100 steps is enough to hide Gray-Scott's spreading phase is still to be judged;
  at ~300 steps the seed blobs are still visibly spreading.
