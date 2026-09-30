# 11 — Orange-peel projection  (idea, prototype first)

**Status: idea, not scheduled.** Needs a standalone design prototype before anything touches `index.html`.

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
