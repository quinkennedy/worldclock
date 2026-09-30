# 06 — Sun & moon discs

## Outcome
Soft outlines of the sun at the sub-solar point and the moon at the sub-lunar point. The moon shows its real phase.
Both are always visible, on the day or night side.

## Scope
- Moon position: a low-precision lunar ephemeris (Meeus, ch. 47, truncated terms; better than 0.5°).
  Sun position: `js/sun.js` as it is.
- Moon phase from the sun-moon elongation. The lit limb faces the sun.
- Stylised size, about the size of a large coin on the display. Each disc has its own scale in `config.json`,
  exposed in the GUI (Discs folder).
- Outline plus, for the moon, a soft terminator. Not a filled photo.
- Both are drawn with the same thin line (the moon uses it on the day side so it doesn't compete with the halftone;
  the sun is always on the day side). Sun and moon have different outline colours, both in `config.json`.
- Discs wrap across ±180° longitude.
- The moon's position and phase are shared with 14 (moonlight).

## Notes
- The real sun and moon look nearly the same size in the sky. With coin-sized discs, the moon overlaps the sun at
  most new moons (it passes 0–5° from the sun), not only at real eclipses. Accepted: the scales are tunable.

## Open questions
- Default scale for each disc, and the two outline colours (pick by eye in the GUI).
- Line weight, and whether the moon's line is heavier on the night side.
- Draw order where the discs overlap.

## Acceptance
- The phase matches a reference (e.g. timeanddate.com) at 4 spot dates, and the moon's position is within 1°.
- The sun disc is centred on the sub-solar point (checked at the equinox and the June solstice).
- Both discs wrap cleanly across ±180°.
