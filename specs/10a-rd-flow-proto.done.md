# 10a — RD + fake flow prototype  (done)

Part of 10 (reaction-diffusion water). A standalone design prototype at `proto/10-rd-water/`, following the
prototype rules in `00-vision.md`. Every decision below was confirmed by Quin.

## Outcome
A page where reaction-diffusion runs on the oceans, masked by the land, and is carried along by a slowly
evolving fake flow, with every parameter live in a Tweakpane panel. It's for finding a pattern and drift that
read as living water.

## Scope
In: RD models, the parameter map, the flow, map vs screen simulation, a raw greyscale view.
Out (later sub-specs): real current data, Ben-Day dots, several colour layers, sun/twilight lighting,
long-run stability handling.

## Decisions
1. **Models**, selectable. Switching reseeds.
   - Gray-Scott with presets (spots, stripes, maze, worms, mitosis, coral) plus free feed/kill.
   - FitzHugh-Nagumo: `u' = Du∇²u + u − u³ − v`, `v' = Dv∇²v + ε(u − a1·v − a0)`.
   - Brusselator: `u' = Du∇²u + A − (B+1)u + u²v`, `v' = Dv∇²v + Bu − u²v`.
   All use explicit Euler: diffusion rates are in cells² per step (5-point Laplacian, stable up to 0.25) and the
   reaction is scaled by a per-model `dt`. The pattern size goes as √(D/dt).
2. **Parameter map.** The reaction parameters blend between two sets, A and B, by a weight from a source:
   uniform (all A), latitude, ocean depth (`elevation.webp`) or low-frequency noise. The raw value is remapped
   with `lo`/`hi` (smoothstep) and can be inverted.
3. **Simulation space**, toggled:
   - **Map:** equirectangular grid, 1024, 2048 or 4096 wide, wraps in longitude. `latCorrection` (0–1) samples
     east-west neighbours `1/cos(lat)` cells apart: 0 makes the pattern uniform on the map; 1 makes it uniform on
     the globe, so it stretches east-west toward the poles on the map, like the land does.
   - **Screen:** a grid over the visible map at screen resolution divided by a scale (px per cell). Uniform on
     screen, not tied to the geography. Rebuilt (and reseeded) on resize.
4. **Land** from `land.png` (> 0.5 is land). Coasts are no-flux: a land neighbour counts as the cell's own value.
   Land is drawn a flat colour.
5. **Flow:** curl noise (divergence-free) from a 4D value-noise stream function on the sphere, evolving with the
   step count. Strength (cells per step), scale and evolution rate. Semi-Lagrangian advection each step.
6. **Display:** raw greyscale of `u` or `v` between `lo` and `hi` (per model), optionally inverted; the same
   layout and aspect rules as the piece.
7. **Controls:** steps per frame, pause, reseed, clear. No automatic stability handling.
8. **Precision:** ping-pong float render targets, created once per grid and reused. `auto` uses half floats,
   except for the Brusselator, which needs 32-bit float (a CPU check showed its pattern never forms at half
   precision). `half` and `float` can be forced.
9. **Settings** live in `proto/10-rd-water/settings.json`; the panel copies or downloads a replacement.

## Acceptance
- `proto/10-rd-water/` served locally shows a moving pattern on the oceans, none on land, with no console errors.
- Each model and each Gray-Scott preset forms a pattern from a reseed.
- Map and screen modes both work; the pattern wraps across ±180° without a seam.
- Flow strength 0 stops the drift; raising it carries the pattern along.

## Build notes
- Checked in headless Chrome (SwiftShader): every model forms a pattern, map and screen modes work, the depth map
  splits spots (deep) from maze (shelves), letterboxing matches the piece, and there are no console errors.
  Speed and the look on the real display are still to be judged by Quin.
- At `latCorrection` 1 the pattern above ~80° becomes wide horizontal bands (neighbours sit far apart there).
  That's the globe-true behaviour; lower the correction if it reads badly.
