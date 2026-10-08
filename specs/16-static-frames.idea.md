# 16 — Static sun, moon or constellation  (idea, prototype first)

**Status: idea, not scheduled.** Needs a standalone design prototype before anything touches `index.html`.

## Before starting (required)
When we decide to do this, Claude must first:
1. **Interview Quin** to find the real goal behind the idea. Don't assume the notes below are the goal.
2. **Split it into sub-specs** if it's more than one small, standalone piece (principle 4 in `00-vision.md`).
3. **Have Quin verify each key decision explicitly** (list them and get a yes or a change for each), then record
   them in the spec and in `00-vision.md`. Nothing is decided by default.

## Idea
Investigate changing the frame of reference: instead of the land staying fixed while the shadow moves, hold one sky
object still on the screen and let the Earth move under it. Three candidates:
- **Sun static.** The day side stays put; the land scrolls east to west under it, once per solar day.
- **Moon static.** The sub-lunar point stays put; the land scrolls once per lunar day (about 24 h 50 min), and the
  sun and shadow drift slowly against it, through the phases, over a month.
- **A constellation static** (or the star field as a whole). The stars stay put; the land scrolls once per sidereal
  day (about 23 h 56 min), and the sun drifts about 1°/day along the ecliptic across the star field over a year.

## Geometry notes
- **Longitude only vs full rotation.** In the equirectangular map, holding an object's *longitude* still is a pure
  horizontal scroll (wrap at ±180°), which is cheap and keeps every locked rule about the map. Holding its
  *latitude* too is not a translation: the sun's declination swings ±23.44° over a year and the moon's about ±28.6°
  over a month, so pinning it to one screen point means rotating the sphere before unwrapping (an oblique
  equirectangular), which moves the poles and bends the land.
- **Constellations are the easy case.** Stars sit at fixed RA/dec (05 already precesses J2000 to date; the drift is
  negligible over weeks), so a static star field is exactly a horizontal scroll by GMST. Nothing bends.
- **Sun static** in longitude only: the terminator stays in place horizontally but still tilts with the seasons.
  The equation of time still applies (scroll by the sub-solar longitude, not by clock UTC).
- **Moon static** in longitude only: the moon's sub-lunar longitude doesn't advance at a steady rate, so the land
  scrolls at a slightly uneven speed; the moon disc (06) still bobs north and south over the month.
- **Which constellation, and where on screen.** A named constellation (e.g. Orion) centred, or the star field
  anchored by a fixed RA at screen centre?

## Related and tensions
- `00-vision.md` locks "Projection: Equirectangular. Land fixed, shadow moves west to east." A moving land changes
  this, or this becomes a mode.
- 12 (globe views) already lists views centred on the sun, the moon, or their longitudes. This is the same frame
  question for the flat map; the two may share decisions, or one may absorb the other.
- 08 (anti-solar sky) asks about the stars' drift against the shadow, which a sun-static frame would show directly.
- The water sim (10e) runs on a map-fixed grid; scrolling should be a render offset, not a sim change. Its flow
  noise and the land relief (04) must stay fixed to the ground.
- The screen-space-dots rule (03/09) still holds: dots stay fixed to the screen while the land scrolls under them.
- Principle 1: positions stay real; only the camera changes. Real-time motion on the public page is still the
  Earth's actual speed, just seen from a different frame.
- The time-source, `highp`, longitude-wrap and long-run leak rules in `CLAUDE.md` apply.

## Starting questions for the interview
- What is the feeling or point: the Earth turning under the sky, the moon's month made visible, the sun's year
  against the stars, something else?
- Which of sun, moon or constellation, or all three as options to compare?
- Longitude only (horizontal scroll), or full rotation so the object sits at one fixed screen point?
- Where on screen is the static object: centre, or another fixed position?
- For a constellation: which one, or the whole star field at a fixed RA?
- Replace the land-fixed map, a mode alongside it (config switch), or does the piece cycle between frames?
- Does anything else change with the frame (e.g. the discs, the stars on the day side)?
- Where does the prototype live (e.g. `proto/16-static-frames/`), and is it published on Pages?

## Acceptance
To be written once the open questions are answered.
