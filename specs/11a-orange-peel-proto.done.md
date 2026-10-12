# 11a — Orange-peel prototype  (done)

Part of 11 (orange-peel projection). A standalone design prototype at `proto/11-orange-peel/`, following the
prototype rules in `00-vision.md` except where noted. Every decision below was confirmed by Quin (1–8 chosen in
the interview, 9–16 proposed and accepted).

## Outcome
A page that shows the live piece (sun, twilight, relief, water, stars, discs) cut into pointed gores that touch
only at the equator, like the quarter-spherical or "orange peel" reference map. Land that crosses a gore's edge
keeps going past the edge onto the background. A Tweakpane panel switches the projection and whether the gores
are fixed to the land or follow the sun, so we can judge both on the real display.

## Reference
*The Official Map of the World, showing the four quarters of the globe on the quarter-spherical or orange peel
projection*, The National Survey Co., Chester, Vermont; L. V. Crocker, topographer. Flickr photo 14533479258
(file `The_official_map_of_the_world_-_showing_the_four_quarters_of_the_globe_on_the_quarter-spherical_or_orange_peel_projection_(14533479258).jpg`).
Not committed (**confirmed**). Measured from it: four gores of 90° of longitude, centred near 165°W, 75°W, 15°E
and 105°E (seams near 120°W, 30°W, 60°E, 150°E), each gore about twice as tall as it's wide.

## Scope
In: the gore layout, three projections, land/sun anchoring, spill of land that crosses a seam, fit to screen,
the panel.
Out (11b): anything in `index.html`, `config.json` or the shared shaders; stars and discs drawn true-round in the
new projection; the halftone.

## Decisions
1. **Remap pass** (**confirmed**). The scene is drawn unchanged, with the shared shaders, into an offscreen
   2:1 equirectangular texture each frame, then remapped onto the gores. Stars and discs are warped along with
   the map, and everything is resampled once; that's accepted for judging the design.
2. **Scene code copied** (**confirmed**, an exception to "imports, never copies"). `draw()`, `drawStars()` and
   `drawDiscs()` from `js/main.js` are copied into the prototype so `js/` stays untouched. Shaders, `js/*.js`
   modules and `data/` are still imported by relative path.
3. **Projections**, a dropdown (**confirmed**), default **Nicolosi globular** (**confirmed**):
   - Nicolosi globular: meridians and parallels are circular arcs; the gore is a lens of two arcs.
   - Cassini (transverse equirectangular on the gore's central meridian): the central meridian and distances
     square to it are true, so it's the closest to flattening a real peel.
   - Interrupted sinusoidal: equal-area, sine-curve edges, sharp at the poles.
   Each gore is the same projection centred on its own meridian; the gore's edge is the meridian ±(180°/count)
   from that centre.
4. **Anchoring**, a toggle (**confirmed**):
   - **Land:** seams fixed to the Earth.
   - **Sun:** seams fixed relative to the sub-solar meridian, so land slides through the gores and jumps across
     the seams while the day/night pattern stays put.
5. **Spill** (**confirmed**): past a gore's edge, its projection carries on, and only land belonging to a
   landmass that crosses that seam is drawn there, lit like the rest of the scene. Water, and land that doesn't
   reach the seam, show the background.
6. **Background**: one flat colour, tunable (**confirmed**).
7. **Fit**: the gores keep their true shape (**confirmed**). The whole layout, spill margins included, scales
   to fit the screen; the background fills the rest.
8. **Reference** recorded above, not committed (**confirmed**).

## Defaults and details
9. **Gore count** 4 by default; the panel allows 2 to 12.
10. **Land seams** default to the reference: gore centres at 165°W, 75°W, 15°E, 105°E. A panel slider rotates them.
11. **Sun seams** default: one gore centred on the sub-solar meridian, so with four gores they're centred on
    noon, dusk, midnight and dawn. The same rotation slider shifts this (at 45° the seams themselves fall on
    noon, dusk, midnight and dawn, so at the equinoxes the terminator runs along two seams).
12. **Spill details:** land is `land.png` > 0.5. Landmasses are its 8-connected components, labelled once in
    JavaScript when the page loads, with no new data file; they wrap at ±180°. A landmass "crosses" a seam if it
    has land on the seam meridian. Spill reaches at most 20° of longitude past the edge (tunable), and a pixel
    claimed by two gores' spills goes to the gore whose edge is nearer. Antarctica crosses every seam, so it
    spills at every gore's southern tip.
13. **Gaps:** neighbouring gores touch at the equator by default; a tunable gap separates them.
14. **Panel:** projection, anchoring, rotation, gore count, gap, spill limit, background colour, margin; the time
    controls the piece's dev GUI has (speed, pause, set time, presets). Settings copy/download as JSON.
15. **Settings:** the prototype's own `settings.json` holds the gore values; the scene reads the piece's
    `../../config.json`. Changed after the build (Quin, 2026-10-09): an optional `scene` block in `settings.json`
    is merged over `config.json` at load, so the prototype can keep its own colours (or any scene value) without
    touching the piece. **Copy/Download settings** write into `scene` the values the right panel has changed from
    `config.json`; an empty block (the default) means the prototype looks like the piece.
16. **Offscreen size:** the equirectangular texture is at least as fine as the gores on screen (about the
    widest gore's px per degree), capped at 4096×2048.

## Acceptance
- `proto/11-orange-peel/` served locally shows four lit gores with no console errors.
- The equinox shows the terminator as meridians; at the June solstice the Arctic is lit in every gore.
- Land mode: the shadow moves across still gores. Sun mode: the land drifts through the gores and crosses seams
  without gaps or doubled interiors.
- Spill: e.g. with reference seams, Alaska/Chukotka, Scandinavia and the Indonesian islands that cross a seam
  continue past the edge; ocean doesn't.
- Each projection and gore count from 2 to 12 draws without gaps between interior and edge.

## Build notes
- Files: `index.html`, `main.js` (loading, the copied scene drawing, layout, render loop), `gores.js` (projections,
  mesh, landmass labels, seam flags; pure, checked in Node), `gui.js`, `settings.json`, `shaders/peel.vert|frag`.
- Each gore is one instance of a mesh projected on the CPU in float64 (1° steps, with vertex columns on the
  centre and both edges). The fragment shader antialiases the lens edge with `fwidth`, and a depth buffer orders
  interiors over spill and nearer edges over farther ones (decision 12).
- Landmasses: `land.png` gives 985 8-connected landmasses, labelled in about 110 ms at load. The seam flags are
  re-uploaded only when a seam moves to another map column.
- The right panel is the piece's own `js/gui.js` (imported, not copied), so time, presets and the scene's design
  values work as in the piece. Its edits are saved through `settings.json`'s `scene` block (decision 15).
- Added while building (prototype conveniences, no design impact): a **Render** folder (`sceneScale` multiplies the
  offscreen size from decision 16, `mipmaps` for the offscreen scene, `meshStepDeg`), and any settings key can be
  set in the URL (`?anchor=sun&projection=cassini`). `?t=` works without `?gui`.
- Checked in headless Chrome (SwiftShader): every projection, counts 2, 4 and 6, land and sun anchoring, the
  equinox (the terminator follows meridians; in sun mode it runs straight down the dawn and dusk gores) and the
  June solstice (the Arctic lit in every gore). No console errors. With the reference seams, Siberia and Australia
  spill off the Pacific gore's west edge, as on the reference map. The water pattern doesn't show in SwiftShader,
  same as the piece there; check it on a real GPU.
- **Equatorial join** (added after the build, at Quin's request, to mimic the reference): the reference's gores
  are joined between about 10°N and 10°S. Measured from the scan, its gaps above the join (≈6% of the gore spacing
  at 20°, 13% at 30°, 22% at 40°) match the plain globular gores (5%, 12%, 20%), so it isn't a second projection:
  below 10° the true gap is under 1.3% of a gore's width, and the engraver closed it. `joinDeg` (0 = off, the
  default) stretches each row within ±joinDeg sideways so the gore's edge lands exactly on its neighbour's (at most
  ~2% at 10° for all three projections); the stretch fades out linearly over `joinBlendDeg` (5), whose kink makes
  the pointed cusp. With a gap, the band bridges it. It works with every projection.
- Seen in the checks, for Quin to judge: Antarctica and the Arctic coasts spill as flat "wings" at every gore's
  tips (expected from decision 12). In Cassini and sinusoidal, the lens tips plus those wings read as arrowheads.
