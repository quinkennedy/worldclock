# 10b — RD colour layers  (defined, prototype built ahead of spec)

Part of 10 (reaction-diffusion water). Extends the 10a prototype at `proto/10-rd-water/`, following the prototype
rules in `00-vision.md`. The code was built before this spec was written; this spec records it. Decisions marked
**(Quin)** came from Quin's request; the rest are Claude's placeholders and still need a yes or a change.

## Outcome
See how the RD water reads in colour, in a "sunny" and a "night" colouring, when each colour channel is its own RD
system. The layers overlap and combine into one colour, so the water gets a multi-coloured, printed look.

## Decisions
1. **One RD sim per channel, each with its own random seed (Quin).** All layers use the same model, parameters,
   parameter map and flow, so only their seeds differ. *(Same params and shared flow: not confirmed; open.)*
2. **Combination modes (Quin):**
   - **RGB, additive:** 3 layers, each a colour with fixed H and S; the colours add.
   - **CMYK, subtractive:** 4 layers, same colours; the colours multiply (inks on white).
   - **HSL (Quin, confirmed 2026-09-30):** 3 layers drive the H, S and L of one base colour.
   - **Grey:** 1 layer, the raw 10a view (kept for comparison).
3. **Modulation (Quin):** each layer's lightness is its base L ± 10 (HSL percent), driven by that layer's RD value.
   The RD value is normalised by the model's view `lo`/`hi` to 0–1 and mapped to −1…+1. For HSL mode, H, S and L
   each have their own ± range (defaults ±10° and ±10). The range is a slider.
4. **Palettes (Quin: sunny and night):** each has a water colour, a land colour and per-layer HSL values for every
   mode. A **split** view shows sunny west of 0° and night east, for comparison. *(Split: confirmed by Quin,
   2026-09-30.)*
5. **Water colour picker (Quin):** setting a palette's water colour fills in all its layers so that each mode's base
   colour (every layer at 0) is exactly that colour:
   - RGB: pure primaries at S 100, L = 50 × channel value.
   - CMYK: standard ink split; an ink of amount *a* is its pure hue at L = 100 − 50*a*; K is a grey at
     L = 100 × (1 − k).
   - HSL: the colour converted to HSL.
   Layers can still be edited by hand afterwards; they're overwritten only when the water colour changes.
   A palette saved without `rgb`, `cmyk` and `hsl` (Quin, 2026-10-01) uses these derived layers instead: the colour
   modes still run, and the panel shows only its water and land.
6. **Defaults (placeholders):** sunny water `#3d8fcc`, land `#b5aa88`; night water `#0f1f47`, land `#16181f`.

## Known issues
- An exact decomposition often puts a layer at L 0 or 100 (blue water has no yellow ink, so Y sits at white; night
  RGB sits near black). That layer's ±10 is then clipped on one side. A "headroom" option was offered, not decided.
- With Gray-Scott, most water sits at the low end of the view range, so the base colour appears as base −10 and only
  the pattern reaches +10.
- Cost scales with the layer count: 3–4 sims at a 4096 map is ~3–4× the GPU time and ~128 MB of VRAM per layer.

## Open questions
- Same parameters for every layer, or per-layer parameters? Shared flow, or a flow per layer? (Not confirmed.)
- Headroom: keep layers away from L 0/100, or accept the clipping?
- Does colour layering survive into the piece at all, or does 10c (grey RD as specular highlights) replace it?
  For now both stay in the prototype for comparison (Quin).

## Acceptance
- Every mode forms a pattern in every layer from a reseed; switching mode reseeds without errors.
- Sunny, night and split all draw; changing the water colour updates the layers and the base colour matches it.
- Checked in headless Chrome (SwiftShader, 1024 map): all four modes render, no console errors.
