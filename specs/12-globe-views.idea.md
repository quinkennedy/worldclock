# 12 — Globe views  (idea, prototype first)

**Status: idea, not scheduled.** Needs a standalone design prototype before anything touches `index.html`.

## Before starting (required)
When we decide to do this, Claude must first:
1. **Interview Quin** to find the real goal behind the idea. Don't assume the notes below are the goal.
2. **Split it into sub-specs** if it's more than one small, standalone piece (principle 4 in `00-vision.md`).
   This one very likely splits (e.g. the globe renderer, then the centring modes, then multi-globe layouts).
3. **Have Quin verify each key decision explicitly** (list them and get a yes or a change for each), then record
   them in the spec and in `00-vision.md`. Nothing is decided by default.

## Idea
Render the lit globe itself instead of (or beside) the unwrapped map, in several views:
- Fixed.
- Centred on the current location.
- Centred on the current longitude.
- Centred on the sun (sub-solar point), or on the moon (sub-lunar point).
- Centred on the sun's or the moon's longitude (equator level, or another fixed latitude).
- Side-by-side views (two globes) and side-by-side-by-side views (three).

## Conflicts with locked decisions
- The goal in `00-vision.md` is a globe *unwrapped* onto a flat map, and the projection is locked to
  equirectangular. Globe views change that, or become a mode.
- Moon centring needs the sub-lunar point, which is 06 (not built).

## Starting questions for the interview
- Replace the map, a mode, or combined with it (e.g. a globe beside the map)?
- "Current location": from a config value, or the browser's geolocation (a permission prompt on an unattended display)?
  "Current longitude": of what, the location or local noon?
- Projection of the globe: orthographic (seen from far away), perspective, something else? Tilt? Atmosphere rim?
- Multi-globe layouts: what does each globe show (e.g. day side and night side, sun and moon)?
- What surrounds the globe(s): black, stars, paper? How does this fit the aspect rules?
- How are modes chosen: config only, dev GUI, or does the piece cycle through them?
- Where does the prototype live, and is it published on Pages?
