# 15 — Sunset & sunrise colour  (idea, prototype first)

**Status: idea, not scheduled.** Needs a standalone design prototype before anything touches `index.html`.

## Before starting (required)
When we decide to do this, Claude must first:
1. **Interview Quin** to find the real goal behind the idea. Don't assume the notes below are the goal.
2. **Split it into sub-specs** if it's more than one small, standalone piece (principle 4 in `00-vision.md`).
3. **Have Quin verify each key decision explicitly** (list them and get a yes or a change for each), then record
   them in the spec and in `00-vision.md`. Nothing is decided by default.

## Idea
Colour the twilight band along the terminator like a sunset, with a noise function varying the colour along it
(and perhaps across it), so it reads as patchy, cloud-lit sky rather than a clean gradient. Possibly the same on
the sunrise side, with a different palette or kind of variation, so dawn and dusk look different.

## Geometry notes
- **Which side is which.** The sun moves west across the map, so the western edge of the day side is sunrise
  (local morning) and the eastern edge is sunset (local evening). The sign of the local solar hour angle, already
  available where 01 computes sun altitude, tells them apart; it flips at the sub-solar and anti-solar meridians,
  well away from the terminator except near the poles in summer/winter.
- **Polar regions.** Near the solstices the terminator runs close to the poles, where morning and evening meet
  (e.g. midnight sun grazing the horizon). The palette switch needs a smooth blend there, not a seam.
- **Band width.** Band position would come from sun altitude (e.g. a range such as +6° to −12°), so it stays
  physically placed even though the colour is stylised.

## Related and tensions
- `00-vision.md` locks twilight as "one smooth gradient from a clear-sky illuminance model, no stepped bands",
  with night/day colours blended in sRGB. Colour on top of that gradient changes or extends this decision.
- Principle 1 (physically true, visually stylised): noise is stylisation; its placement should stay tied to the
  real sun altitude. Real cloud data is out of scope (no APIs, static files only).
- 04 relief lighting drives the twilight model from the terrain normal. Does the colour follow relief-lit
  altitude or the smooth sphere (as 05's star fade does)?
- 03 / 09 (Ben-Day dots on the day side): is sunset colour a smooth tint, or another ink/dot layer?
- 14 moonlight feeds the same lux mapping; sunset colour should probably ignore moonlight.
- The screen-space-dots rule, `highp`, longitude wrap at ±180° and the long-run leak rules in `CLAUDE.md` apply.

## Starting questions for the interview
- What is the feeling: a painterly sunset glow, cloud streaks, a graphic print colour, something else?
- Noise fixed to the ground (lat/lon), fixed to the terminator (moves with the sun), or evolving over time like
  weather? At real-time speed, how fast should it change, if at all?
- What kind of noise: smooth value/simplex, fbm clouds, streaks stretched along the terminator, domain-warped?
- Does noise vary hue, brightness, band width (a ragged edge), or several of these?
- Sunrise vs sunset: different palettes only, or also different noise character (e.g. crisp dawn, hazy dusk)?
- Does the colour sit on land and water alike, or differ by surface?
- Does seasonal or latitude variation matter (long polar twilights, short tropical ones)?
- Which palette(s) to try first, and how many should the prototype compare?
- Where does the prototype live (e.g. a separate `proto/` page), and is it published on Pages?
- Which settings go into `config.json` and the dev GUI once it's adopted?

## Acceptance
To be written once the open questions are answered.
