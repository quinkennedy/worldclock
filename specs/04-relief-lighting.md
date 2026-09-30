# 04 — Relief lit by the sun

**Status: done.** Outstanding: the long-run test in `DEV.md`. Exaggeration defaults chosen on the display: land 3, sea 0.5.

## Outcome
Mountains are shaded by the *actual* sun at each point, so they cast long shadows near dusk and almost none at noon.
This is the "simulated globe, unwrapped" at its most visible.

## Scope
- In the shader, perturb the sphere normal using elevation gradients (from 02's `elevation.webp`: packed
  16-bit, so read with `texelFetch` and filter manually; it includes bathymetry).
- The sun's altitude is taken against the terrain normal instead of the sphere's, and feeds 01's whole illuminance
  model (direct sun, daylit sky and twilight). So slopes facing away from a low sun drop into twilight, and the
  terminator follows the terrain locally. The result feeds dot size in 03.
- The seafloor is shaded too, with its own exaggeration. Coasts blend the land and sea values by land fraction.
- Vertical exaggeration: `relief.landExaggeration` and `relief.seaExaggeration` in `config.json`, with sliders in the
  GUI's Relief folder. No query string. Pick the defaults on the real display.
- Correct the east-west gradient by 1/cos(lat) so relief near the poles isn't distorted.

## Implementation
- `shaders/slope.frag` runs once at load (and again after a context loss). It reads the packed heights with
  `texelFetch`, takes central differences in metres per metre (east spacing shrinks with cos(lat), which gives the
  1/cos(lat) correction), and writes an RG16F texture (R = dh/d(east), G = dh/d(north)). That texture is mipmapped
  and filtered by hardware, so the per-frame shader does one lookup and applies the exaggeration live.
- Rendering to RG16F needs `EXT_color_buffer_float` (standard on desktop WebGL2). Without it the map draws flat, with
  a console warning.
- The per-frame normal is `normalize(up − k·(slopeE·east + slopeN·north))`, with k mixed from the two exaggerations.

## Out of scope (for now)
Cast shadows (ray-marching along the terrain). Consider them only if Lambert shading feels too flat.

## Acceptance
- With `?gui&t=2026-03-20T00:40Z` (about 20 min after sunrise over the Himalaya, sun ~4° up), west-facing slopes are
  dark and east-facing slopes are lit. Checked headless: over 78–92°E, 26–34°N, brightness vs dh/d(east) correlates at
  r = −0.82 (east-facing mean 205/255, west-facing 27/255).
