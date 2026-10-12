# 11 — Orange-peel projection  (defined, umbrella)

**Status: defined, split into sub-specs.** Interview started 2026-10-08.

## Sub-specs
- `11a-orange-peel-proto`: standalone prototype at `proto/11-orange-peel/` (done).
- `11b-orange-peel-in-piece`: whether and how the piece adopts it (a mode or a replacement), and drawing stars,
  discs and the halftone in the new projection (idea; decided after the prototype).
- `11c-more-projections`: HEALPix gores and whole-world maps (Lambert, Peirce, Guyou, Cahill butterfly,
  Cahill-Keyes, Dymaxion, Hao) in the same prototype (done).
- `11d-chamberlin-patchwork`: continents and oceans as separate pieces, each in its own Chamberlin trimetric
  projection, exploded on a world base map, in its own prototype `proto/11d-patchwork/` (done).
- `11e-overlapping-region-shapes`: region modes in the 11d prototype where each piece is a simple shape (convex
  hull, circle, control triangle) holding its whole region, overlapping its neighbours (done).
- `11f-asia-split`: Asia as five pieces in the 11d prototype (done).
- `11g-atlas-pages`: each continent as a north-up atlas page (minimal rectangle or A4) in the 11d prototype (done).
- `11h-packed-layout`: a packed base map in the 11d prototype, so pieces or pages never overlap (done).
- `11i-equal-pages`: equal-size A4 atlas pages, big continents split across several (done).
- `11j-page-groups`: whole Asia on atlas pages, its five pieces grouped (done).

## Goal (from the interview)
Not an exact copy of the reference: a mathematically clean gore projection that keeps what's appealing about it,
especially land carrying on past the gore edges. Explore gores fixed to the land vs gores that follow the sun.

## Before starting (required)
When we decide to do this, Claude must first:
1. **Interview Quin** to find the real goal behind the idea. Don't assume the notes below are the goal.
2. **Split it into sub-specs** if it's more than one small, standalone piece (principle 4 in `00-vision.md`).
3. **Have Quin verify each key decision explicitly** (list them and get a yes or a change for each), then record
   them in the spec and in `00-vision.md`. Nothing is decided by default.

## Idea
Render the map in the "orange peel" (quarter-spherical) projection, like the reference in `tools/cache/`:
*The Official Map of the World, showing the four quarters of the globe on the quarter-spherical or orange peel
projection* (National Survey Co., L. V. Crocker). It shows four pointed gores, each about 90° of longitude, from
pole to pole, touching only at the equator.
Note: `tools/cache/` is gitignored, so the reference isn't in the repo.

## Conflicts with locked decisions
- "Projection: Equirectangular" and the aspect rules in `00-vision.md` would change, or this becomes a mode.
- Everything placed on the map (terminator, relief, stars, moon, halftone) must be drawn in the new projection.

## Starting questions for the interview
- Replace equirectangular, or an alternative mode (config switch)?
- Match the reference exactly (gore count, meridians where gores split, gore shape) or take it as inspiration?
- What fills the space between gores, and how does the layout fit different screen aspects?
- Are the gores fixed to the land, or do they follow the sun?
- Should the reference image be committed, or its source recorded instead?
- Where does the prototype live, and is it published on Pages?
