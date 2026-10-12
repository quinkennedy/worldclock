# 11i — Equal atlas pages  (done)

Part of 11. A third page kind in 11g's atlas pages (`proto/11d-patchwork/`): every page the same A4 size, so every
continent at the same scale. Requested by Quin on 2026-10-09.

## Decisions
1. **One page size, a slider** (**confirmed**): **page long side °** (`pageSizeDeg`), default 85°. Measured with the
   default 3° margin: at 85° only Africa and North America need two pages each (13 pages in all); 70° gives 17, 63°
   gives 25, 55° gives 27; at 120° nothing splits (11).
2. **Small continents grow** (**confirmed**): a continent that fits one page gets a full-size page centred on it, so
   it shows more of the map around it (neighbouring pages then show some of the same places).
3. **Each split page is its own map** (**confirmed**): like separate regional plates, re-projected with its own
   Chamberlin points; edges between a continent's pages don't line up exactly.
4. **Split pages overlap a little** (**confirmed**): **split overlap °** (`pageOverlapDeg`), default 3°: tiles are
   sized so each page still shows at least that much of its neighbour.
5. **A new page kind** (**confirmed**): **equal A4 pages** in the page dropdown, beside minimal and A4.

## Defaults chosen while building (for Quin to confirm)
6. **How a continent splits:** its minimal rectangle (in its own projection, 3° margin) is cut into a grid of equal
   tiles, the fewest that fit (each tile ≤ page minus the overlap on both sides), trying both orientations; all a
   continent's pages share that orientation. Tiles without land are dropped.
7. **A split page's map:** its control points are an equilateral triangle around the centroid of the tile's land,
   one point due north, at 0.85 of the distance to its farthest land; it's anchored on that centroid (north up, or
   on the pole if the centroid is within 15° of it), and the page is centred on the tile's land in that projection.
   Each page is placed on the base map at its own anchor, so Africa's north page sits above its south one.

## Build notes
- `regions.js`: `equalPages`, `triangleAround`. `main.js`: a continent now has a list of pages (`ensurePages`); each
  page has its own mesh and control-point overlay (shown with **control points**).
- Checked in Node: at 85°, 13 pages (Africa north/south, North America west/east), all 85 × 60.1° (landscape) or
  60.1 × 85° (portrait); at 63°, 25 pages, Africa in 6. Every page mesh is non-empty.
- Checked in headless Chrome with the packed base map at explode 1: 85° and 63° both draw, all pages the same size
  and none overlapping, no console errors.
- Seen, for Quin to judge: at 63°, Antarctica is only just too big for a page, so its two pages (both anchored on the
  pole) show nearly the same map.
