# 11e — Overlapping region shapes in the patchwork  (done)

Part of 11. Adds region modes to the 11d prototype at `proto/11d-patchwork/`. Requested by Quin on 2026-10-09:
simpler shapes than the coastline cuts, like Voronoi's, where the same area may be in two regions, as long as a
region like Africa is wholly visible in its own piece.

## Decisions
1. **Three shapes, each a mode** in the 11d regions dropdown (**confirmed**):
   - **Convex hull:** the smallest convex spherical polygon (great-circle edges) around the region.
   - **Circle:** the smallest cap around the region.
   - **Control triangle:** the piece's own three Chamberlin points, scaled about their centre until the triangle just
     holds the region (it can also shrink).
2. **What a shape holds** (**confirmed**): a continent's land as cut in coastline mode, ignoring small far-off land;
   an ocean's water as in coastline mode. Oceans grow big and overlap a lot.
3. **Overlap** (**confirmed**): every piece draws its whole shape, so an area in two shapes shows on both pieces.
   Draw order stays as 11d's decision 9 (oceans under continents, bigger under smaller).

## Defaults chosen while building (tunable, for Quin to confirm)
4. **Small land:** landmasses under 20,000 km² are left out of a continent's shape (`minIslandKm2`), so Hawaii,
   Polynesia and the Aleutians don't stretch it. Land that size or bigger is always held (Cuba, Sri Lanka,
   New Britain, Tasmania, Svalbard, Iceland).
5. **Ocean water** is only water in the world ocean (the largest connected body of water at land.png's
   resolution), so lakes and seas cut off at that resolution (Caspian, Great Lakes, Black Sea) don't stretch an
   ocean's shape.
6. **Margin:** each shape grows by 2° (`shapeMarginDeg`) beyond what it must hold.
7. **Fallbacks**, shown in the panel's **fits** read-out:
   - A hull with more than 48 edges (rings like the Southern Ocean and Antarctica, ragged oceans) becomes a polygon of
     48 supporting great circles, which still holds everything, a little looser, and keeps building fast.
   - A region not inside a hemisphere has no convex hull and is drawn as its circle. None do with the default regions.
   - No triangle holds the North or South Pacific (each spans nearly a hemisphere): they're drawn as their convex
     hulls. Pushing the triangle's edges out instead covered over half the globe, where Chamberlin folds over itself.

## Build notes
- The region grid is now a bitmask per cell (R16UI, a bit per region) for every mode, so regions can overlap; the
  11d modes set one bit. `piece.frag` tests the piece's bit.
- `regions.js`: `landmassAreas`, `worldOcean`, `shapeSources` (the points each shape holds, on a 0.25° grid),
  `shapeMasks` (fits each shape, then fills the grid with a quick reject by a bounding cap). Hulls are built in the
  gnomonic projection about the region's centre, where great circles are straight lines. The smallest cap is
  approximate (Bădoiu-Clarkson).
- Checked in Node: in each shape mode every point a shape must hold is in it (no misses), every cell is in at least
  one piece, and no mesh vertex is non-finite. Build time: hull 1.7 s, circle 0.5 s, triangle 1.0 s (with the region
  shapes). Load adds ~0.6 s for the coastline regions and the world ocean.
- Checked in headless Chrome (SwiftShader) at the March equinox, Equal Earth, explode 0.7: all three modes draw with
  no console errors; each continent sits whole in its piece, oceans overlapping underneath. Antarctica nests inside
  the Southern Ocean in hull and circle modes.
- Added after the build, at Quin's request: a **hide oceans** toggle (`hideOceans`, off by default) in the
  Patchwork folder. It draws only the continent pieces, in every region mode, and the layout refits to them.
- In triangle mode, moving a control point rebuilds every shape (about a second per change).
