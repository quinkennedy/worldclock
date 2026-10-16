# 03a — Land-cover palette prototype  (done)

Part of 03 (land-cover CMYK halftone). A standalone design prototype at `proto/03a-landcover-palette/`, following
the prototype rules in `00-vision.md`. Every decision below was confirmed by Quin.

## Outcome
A page that colours the map by land cover with flat palette colours, so palettes can be tried and compared before
any styling. Each land colour can also be lightened, darkened, saturated or desaturated with elevation.

## Scope
In: palette colours per class, class blending, an elevation curve, named palettes, an optional view of the piece's
lighting over the palette.
Out: halftone, Ben-Day dots, CMYK screens and any other styling (03, 09); new land-cover data (no sub-classes); the
reaction-diffusion water, stars and discs.

## Decisions
1. **Home:** sub-spec 03a of 03, at `proto/03a-landcover-palette/`. Halftone and dots stay out.
2. **Classes:** the existing 5 (water, arid, forest, ice, grass/tundra) from `data/land.png` and
   `data/landcover.webp`, unchanged. No new data.
3. **Blending:** toggle in the panel between a fraction-weighted mix and the dominant class only.
4. **Colour space:** classes mix in OKLab; the elevation curve adjusts OKLCH lightness and chroma.
5. **Elevation:** one curve for all land classes, from `data/elevation.webp`: a range `lo`..`hi` in metres
   (default 0–4000 m), a brightness amount (± OKLab lightness at `hi`), a saturation amount (± fraction of chroma at
   `hi`) and an exponent shaping the curve between them. Water isn't adjusted.
6. **Water:** one flat palette colour.
7. **Palettes:** named presets in `proto/03a-landcover-palette/settings.json`, picked from a dropdown. Each palette
   has 5 colours (water, arid, forest, grass, ice) and its own elevation curve. Save as new, rename, delete, and copy
   or download the settings JSON.
8. **Starter palettes:** the piece's current warm grey, muted paper, atlas/natural, CMYK-ish inks, duotone.
9. **Lighting:** by default a flat full-day map (no sun, no relief). A **scene** toggle lights it as the piece
   does: the sun and moon from the sim clock, the twilight model, land relief from the slopes, and the night and moon
   colour stops, twilight lux values, relief exaggeration and moonlight toggle from `config.json`. The palette's
   colours are the day stop. A Time folder (sim UTC, speed, direction, set UTC, pause, now, equinox and solstice
   presets) shows with the scene. No reaction-diffusion water, stars or discs; in scene mode the water is its flat
   colour through the twilight model, with no glint.

## Acceptance
- `proto/03a-landcover-palette/` served locally shows the map coloured by land cover, with no console errors.
- Each starter palette reads clearly differently; Sahara arid, Amazon forest, Greenland and Antarctica ice, Arctic
  Canada grass/tundra.
- Mix vs dominant visibly softens or hardens the class borders.
- Raising the brightness or saturation amount changes the Himalaya, Andes and Tibet, not the lowlands or water.
- Scene on: the terminator, twilight and relief appear over the palette; the March equinox preset puts the
  terminator near ±90° longitude.
- Save as new, rename and delete update the dropdown; downloaded settings reload as saved.

## Build notes
- The coastline is the piece's (land fraction smoothstepped 0.4–0.6); the class mix (or dominant class) is taken
  over the land classes' shares of the land in the cell, so coasts never blend toward the water colour by class.
- Elevation is unpacked once at load into a filterable R16F texture (`shaders/elevation.frag`), like 04's slopes.
  Without `EXT_color_buffer_float` the curve does nothing.
- OKLab results are clamped to the sRGB gamut per channel (no hue-preserving gamut mapping), so large saturation
  amounts on vivid colours can shift hue slightly.
- Checked in headless Chrome (SwiftShader): every starter palette, mix and dominant, scene at the March equinox
  (terminator near ±90°), and save as new / rename / delete / reset in the panel, with no console errors. The
  starter palettes' look on the real display is still to be judged by Quin.
