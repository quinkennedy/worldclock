# 11j — Whole Asia on atlas pages  (done)

Part of 11. In the 11d prototype (`proto/11d-patchwork/`), atlas pages (11g, 11i) can treat Asia as one continent
again, though the pieces keep 11f's five parts. Requested by Quin on 2026-10-12: equal A4 pages, packed, with Asia
as one continent, split only if the page size makes it necessary.

## Decisions
1. **Groups** (chosen while building): `settings.groups` lists regions that get pages as one continent. One group
   ships: **Asia**, of the five 11f parts, with 11d's whole-Asia control points (100°E 72°N, 50°E 15°N, 145°E 10°N;
   not published). A group's land is its members' land together (as 11e: small islands left out), anchored on its
   centroid; with equal pages it splits like any other continent (11i).
2. **A toggle, on by default:** **whole Asia on pages** (`pageGroups`) in the Atlas pages folder. It applies to every
   page kind (minimal, A4, equal). Pieces (pages off) always use the five parts.

## Build notes
- `main.js`: `pageGroups()` builds the group units; `ensurePages` now takes a unit (a continent or a group) instead
  of a region. `regions.js` exports `centroidOf`.
- Whole Asia's land is 108° × 97° (with the 3° margin) in its projection. Equal pages: 4 at 85° (the default), 2 from
  100° to 130°, 1 at 150°.
- Checked in headless Chrome, packed, explode 1: 85° gives 4 Asia pages (west/east, north/south) among 15 in all;
  120° gives 2. No console errors.
- Seen: on big pages (120°) the corners reach far from the page's centre, so the polar water's texture shows smeared
  near the North Pole on the Europe and Asia pages.
