# 05 — Night sky: zenith stars  (later)

## Outcome
On the night side, each point shows the star that is directly overhead there. The sky drifts across
the map once per sidereal day (about 4 min faster than the sun), so over months the constellations
visibly move relative to the terminator.

## Scope
- Zenith at (lat, lon) = celestial (Dec = lat, RA = lon + GMST). Compute GMST in JS and pass it as a uniform.
- Stars from 02's catalogue, drawn as points with size/brightness from magnitude.
- Fades in with the twilight bands from 01: none in day, full in astronomical night.
- Drawn over the night-side land/water tint and kept subtle, so the tint still reads.

## Open questions
- Should constellation lines be drawn? (The default is no, per "no labels".)
- Should the Milky Way appear as a faint band?

## Acceptance
- Orion's belt is overhead at about (lat -1°, lon = 83.8° - GMST) at the given `?t=`.
