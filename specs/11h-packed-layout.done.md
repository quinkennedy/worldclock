# 11h — Packed layout  (done)

Part of 11. A base-map option in the 11d prototype (`proto/11d-patchwork/`) that keeps the pieces or pages in about
the same arrangement as on the base map, but lets explode go as large as wanted without overlaps. Requested by Quin
on 2026-10-09.

## Decisions
1. **Pack by moving** (**confirmed**): a **Packed (from Robinson)** entry in the base-map dropdown. Every piece
   starts at its Robinson spot and is moved as little as possible so that, at the current explode, no two overlap.
   Each pair keeps how it sits on the base map: apart along the axis where it's already more separated relative to
   its size, in the same order (left/right or below/above). The layout then refits to the screen, so at explode 1
   everything is full size and as big on screen as the arrangement allows.
2. **Pages and pieces** (**confirmed**): with atlas pages it packs the page rectangles; without, each piece's
   bounding rectangle (so irregular pieces get uneven gaps).
3. **A tunable gap** (**confirmed**): **pack gap** (`packGap`), a fraction of the base map's width, default 0.01.

## Build notes
- `regions.js`: `packRects`. A least-squares problem with one linear constraint per pair (on the chosen axis), solved
  by repeatedly pushing each overlapping pair apart along its axis, the move split by area so smaller rectangles
  move more. A pair is only pushed while it also overlaps across the other axis, so rectangles already apart
  diagonally aren't spread for nothing. Up to 400 passes; it runs every frame (under 2 ms for 18 rectangles).
- Checked in Node: A4 pages at explode 0.6 (6 overlaps before) and 1 (19 before), pieces with oceans at 0.6 (14) and
  1 (41): no overlaps after, with the gap kept. Checked in headless Chrome: packed A4 pages at explode 1 and packed
  pieces, no console errors.
- Seen, for Quin to judge: with pieces, nesting is lost: Antarctica's rectangle overlaps the Southern Ocean ring's,
  so it's pushed out beside it (likewise the Arctic). Exempting nested pairs would keep it.
