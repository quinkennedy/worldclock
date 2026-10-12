# 11g — Atlas pages  (done)

Part of 11. A layout option in the 11d prototype (`proto/11d-patchwork/`): each continent as if it were a page out
of an atlas. Requested by Quin on 2026-10-09.

## Decisions
1. **Pages on the base map** (**confirmed**): each continent is drawn as its own page, placed where its piece would
   be in the exploded layout (same base map, explode and fit). Oceans aren't drawn.
2. **The map carries on to the page's edge** (**confirmed**): the continent's Chamberlin projection fills the whole
   page, neighbouring land and sea included, whatever the region mode.
3. **North-up rectangles, a dropdown** (**confirmed**): **off**, **minimal rectangle** (the tightest north-up
   rectangle around the continent, plus a margin), or **A4** (1:√2, landscape when the minimal rectangle is wider
   than tall, else portrait, grown around the same centre).

## Defaults chosen while building (tunable, for Quin to confirm)
4. The rectangle frames the continent's land as in 11e: its coastline-mode land, landmasses under `minIslandKm2`
   (20,000 km²) left out, so far islands don't stretch the page.
5. **Page margin** 3° (`pageMarginDeg`) around that land.
6. No frame line or page colour: the page's edge is where the map stops, against the background.

## Build notes
- `regions.js`: `piecePlacer` (split out of `pieceMesh`), `pageRect`, `pageMesh`. A page's mesh is every 1° cell
  within 100° of the control triangle's centre whose centre lands on or near the page; the fragment shader cuts it to
  the rectangle with an antialiased edge. The 100° limit keeps out the far side, where Chamberlin folds over.
- Checked in Node: no holes in any page (a 60×60 sample of each rectangle is all covered); A4 pages come out at
  exactly 1.414 or 0.707. North America, South America and Southwest Asia are portrait; the rest landscape.
- Checked in headless Chrome: both kinds draw, lit as the piece, no console errors. At explode 0.8 the Asian pages
  overlap and leave a gap between them; 0.6 separates all pages.
