# 11d — Chamberlin trimetric patchwork  (done)

Part of 11. A standalone design prototype at `proto/11d-patchwork/`: the world cut into continent and ocean
pieces, each drawn in its own Chamberlin trimetric projection, laid out exploded on a world base map. Requested by
Quin on 2026-10-09. Decisions 1–5 were chosen by Quin in the interview; 6–16 were proposed and accepted the same day.

## Outcome
A page that shows the live piece (sun, twilight, relief, water, stars, discs) as a patchwork of separate pieces,
one per continent and ocean. Each piece is its region in its own Chamberlin trimetric projection, the way National
Geographic drew single-continent maps. The pieces sit near where they belong on a globe-like world map, pulled
apart so gaps show between them. A Tweakpane panel switches how the regions are cut, so the options can be judged
on the real display.

## Decisions
1. **Home** (**confirmed**): its own sub-spec and prototype folder, `proto/11d-patchwork/`, beside 11a's.
2. **Region boundaries** (**confirmed**): all three, in a panel dropdown, live-switchable, default
   **coastlines + cuts**:
   - **Coastlines + cuts:** continents are the land itself, split at conventional lines; oceans are the water,
     split by drawn lines. Continent and ocean pieces have coast-shaped edges.
   - **Polygons:** every region is a lat/lon polygon that crosses land and sea, so each piece holds coast and
     water together (like an NGS continent plate).
   - **Voronoi:** one centre per region; each point belongs to the nearest centre (great-circle edges).
3. **Layout: exploded** (**confirmed**). Pieces sit near their true positions on a **globe-like base** projection,
   not matched edge to edge, with gaps between them.
4. **Control points: published values** (**confirmed**) where they exist, from NGS's own table (Christensen 1992,
   Table 1, reprinted with NGS permission; transcribed in github.com/brsr/trimetric `invparams.py`), lon/lat:
   - Africa (wall map): (19°03′W, 24°25′N), (20°E, 35°S), (59°03′E, 24°25′N)
   - Europe (wall map): (15°E, 72°N), (8°W, 33°N), (38°E, 33°N)
   - North America (wall map): (150°W, 55°N), (92°30′W, 10°N), (35°W, 55°N)
   - South America (wall map): (80°W, 9°N), (71°W, 53°S), (35°W, 6°S)
   - Australia: (134°E, 8°S), (110°E, 32°S), (158°E, 32°S)
5. **Missing triplets** (**confirmed**): hand-picked by NGS's rule (three widely spaced points near the region's
   edges, forming a triangle that just encloses it), marked "not published" here, tunable in the panel.
   **Regions** (**confirmed**): 7 continents and 7 oceans, with the Pacific and Atlantic split at the equator:
   Africa, Europe, Asia, North America, South America, Australia (Oceania), Antarctica; North Pacific, South
   Pacific, North Atlantic, South Atlantic, Indian, Southern, Arctic. (Spec 11f later split Asia into five.)

## Defaults and details (accepted)
6. **Unpublished triplets**, first guesses to refine on screen (lon/lat, not published):
   - Asia: (100°E, 72°N), (50°E, 15°N), (145°E, 10°N)
   - Antarctica: (0°, 70°S), (120°E, 70°S), (120°W, 70°S)
   - Arctic: (0°, 75°N), (120°E, 75°N), (120°W, 75°N)
   - Southern: (0°, 62°S), (120°E, 62°S), (120°W, 62°S)
   - North Pacific: (170°W, 55°N), (135°E, 5°N), (105°W, 5°N)
   - South Pacific: (130°W, 55°S), (155°E, 5°S), (80°W, 5°S)
   - North Atlantic: (40°W, 60°N), (80°W, 5°N), (10°W, 5°N)
   - South Atlantic: (25°W, 55°S), (55°W, 5°S), (10°E, 5°S)
   - Indian: (85°E, 55°S), (45°E, 20°N), (100°E, 10°N)
7. **Base projection:** Robinson by default; a dropdown also offers Equal Earth and equirectangular.
8. **Placing a piece:** its anchor is the spherical centroid of its region, put where the base projection puts that
   point. All pieces share one scale (the base map's), times an **explode** slider (default 0.85) that shrinks each
   piece about its anchor to open the gaps. Each piece is turned so north is up at its anchor. The polar pieces
   (Arctic, Antarctica, Southern) are centred on the base's pole line with the prime meridian pointing toward the
   equator.
9. **Overlaps:** pieces can still overlap (big pieces, or explode near 1). Continents draw over oceans, and smaller
   pieces over bigger ones.
10. **One set of polygons drives all three modes.** Hand-drawn polygons, kept in `settings.json`, partition the
    sphere into the 14 regions, along conventional lines: Europe/Asia at the Urals, Ural River, Caspian, Caucasus
    and Bosporus; Africa/Asia at Suez; North/South America at the Panama–Colombia border; Asia/Oceania at
    New Guinea's 141°E border; Greenland with North America. Oceans follow the IHO limits loosely:
    Atlantic/Indian at 20°E, Indian/Pacific through Indonesia and at 147°E south of Tasmania, Atlantic/Pacific at
    Drake Passage (67°W), Southern south of 60°S, Arctic about the IHO line, north/south at the equator.
    - **Polygons** mode uses them as drawn.
    - **Coastlines + cuts**: land goes to the continent polygon it lies in; land in an ocean polygon goes to its
      landmass's majority continent (11a's landmass labels), and a landmass lying wholly in ocean polygons (e.g.
      Hawaii) goes to the nearest continent. Water goes to the ocean polygon it lies in, or the nearest one if it's
      inside a continent polygon. "Nearest" is a breadth-first search over the 2:1 grid, wrapping at ±180°.
    - **Voronoi**: the centres are the polygon regions' centroids (tunable).
11. **Region map:** one label texture (a region index per cell, from `land.png`'s 4096×2048 grid), built in
    JavaScript at load and when the mode changes. No new data file. A piece's mesh covers its region's bounding
    cap, and the fragment shader drops cells of other regions. Edges are as sharp as the label grid.
12. **Drawing:** like 11c's whole-world maps: the scene goes into an offscreen equirectangular texture, and each
    piece is a mesh projected forward on the CPU in float64 with d3's `geoChamberlin` (d3-geo-projection, same
    pinned version as 11c, which has no inverse). Each vertex carries its point on the sphere, and the shader
    looks the scene up there.
13. **Shared code with 11a:** move 11a's copied scene drawing (`drawScene`, `drawStars`, `drawDiscs` and the
    offscreen setup) out of `proto/11-orange-peel/main.js` into `proto/11-orange-peel/scene.js`, and import that
    and `maps.js`'s mesh helpers from 11d, rather than copying a second time. This is a new exception to "imports
    `../../js`, never copies": a prototype importing from another prototype.
14. **Anchoring:** land only. The regions are geographic, so there's no sun anchoring.
15. **Background:** one flat colour, tunable. The whole layout scales to fit the screen with a margin, as in 11a.
16. **Panel:** region mode, base projection, explode, a "show control points" toggle (dots and triangle edges, for
    tuning), each region's three points (lon/lat), background, margin; the piece's time controls and design values
    (its own `js/gui.js`, as 11a). Settings copy/download as JSON, with the same optional `scene` block as 11a.

## Scope
In: the 14 regions, the three region modes, Chamberlin per piece, the exploded layout, the panel.
Out: edge matching between pieces, spill, sun anchoring, anything in `index.html`, `config.json` or `js/`.

## Acceptance
- `proto/11d-patchwork/` served locally shows 14 lit pieces with no console errors, in each region mode.
- The five published continents use exactly the NGS triplets above.
- The equinox shows the terminator crossing every piece where the sun puts it; at the June solstice the Arctic
  piece is lit.
- No land or water cell is missing or claimed twice: every map cell belongs to exactly one region in each mode.

## Build notes
- Files: `index.html`, `main.js` (loading, layout, drawing, render loop), `regions.js` (region grids, shapes and
  Chamberlin meshes; pure, checked in Node), `gui.js`, `settings.json` (the regions, points and polygons live here),
  `shaders/piece.vert|frag`, `shaders/overlay.vert|frag`. Imports `scene.js`, `gores.js` (`labelLand`) and `gui.js`
  (`assignDeep`, `diffDeep`) from `proto/11-orange-peel/` (decision 13). 11a's `main.js` now uses `scene.js` too;
  checked unchanged in headless Chrome.
- **Point order:** d3's `geoChamberlin` only works with its points clockwise seen from outside the globe ("TODO order
  matters!" in its source). The wrong order jumps by about 0.5 rad near the points. Europe, North and South America
  and Africa (wall map) come in the other order in NGS's table, so `chamberlin()` in `regions.js` swaps the last two
  when the triple product is positive. The points in `settings.json` stay as published.
- **Region grids** (decision 10): polygons are scan-converted into two grids (oceans, then continents), each in list
  order, so later polygons overwrite earlier ones. The ocean polygons are therefore loose (e.g. the North Pacific
  runs to 60°W and the North Atlantic, drawn after it, cuts it back along the isthmus); only their visible edges
  follow the conventions. Cells no polygon covers take the nearest region (breadth-first search). Load: landmasses
  and the Voronoi default centres ~0.35 s; a mode change rebuilds the grid and meshes in 0.2–0.45 s.
- Checked in Node: in every mode each cell belongs to exactly one region (areas sum to the sphere); in coast mode no
  land cell is in an ocean piece and no water cell in a continent; no mesh vertex is non-finite.
- **Edges** (decision 11): the fragment shader takes the 0.5 contour of the bilinear coverage of the region's cells,
  antialiased with `fwidth` (the **edge px** slider), so edges are smooth, not blocky.
- **Placement:** pieces are at scale 1 (radians at their centre), like the base projections at scale 1. At explode
  0.85 on Robinson the big ocean pieces still overlap their continents a little; Equal Earth at about 0.7 opens
  clear gaps. Antarctica and the Southern Ocean (and in coast mode the Arctic) share the pole anchor, so the
  continent sits nested in its ocean ring.
- Checked in headless Chrome (SwiftShader, 1600×900): all three modes, the three bases, the control-point overlay,
  no console errors. March equinox at 12:00 UTC: the terminator crosses North America near 90°W and Asia near 90°E,
  and runs through the pole on the polar pieces. June solstice: the Arctic piece is lit all round, Antarctica dark.

## Seen in the checks, for Quin to judge
- With `config.json`'s palette the day water is nearly the land colour, so the pieces' coastlines barely read in
  daylight. 11a's `settings.json` has a `scene` block with teal water; 11d's is empty (decision 16).
- In coast mode, far-flung islands go to the nearest continent (decision 10), so e.g. Polynesia appears as specks
  far off Oceania's piece.
- The North and South Pacific pieces are wide (over 100° of longitude), and their Chamberlin edges curve strongly.
- Voronoi's default centres are the polygon regions' centroids. Antarctica's and the Southern Ocean's are both near
  the pole, so in Voronoi mode those two pieces split the polar cap between them, not into a continent and a ring.
