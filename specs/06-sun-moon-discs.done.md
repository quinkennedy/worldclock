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

## Decisions (confirmed by Quin)
- **Same line everywhere.** One line width for both discs, day or night side; the moon's line isn't heavier at night.
- **Lines just cross.** Where the discs overlap, both outlines draw in full; neither hides the other.
- **Phase as a soft terminator line.** A feathered line along the visible half of the terminator ellipse, limb to
  limb, in the moon's colour. No fill.
- Defaults are starting points, to be picked by eye in the GUI: diameters 8° of longitude each, line 0.3°,
  terminator feather 0.5°, sun `#d9622b`, moon `#8a9bc4`.

## Implementation
- `js/moon.js`: `moonEquatorial()` (Meeus ch. 47, terms ≥ 0.002°) and `moonPosition()`, which gives the sub-lunar
  point, distance, phase angle, lit fraction and the bearing of the sun from the sub-lunar point (14 uses the same).
  Checked against Meeus example 47.a (0.003°) and the USNO API (position within 0.01°, lit % within 0.5).
- `shaders/disc.vert` / `disc.frag`: one screen-aligned square per disc, drawn as 3 instances (−360°, 0, +360°).
  Discs are round on screen and sized in degrees of longitude, like the stars. The lit direction is the bearing to
  the sun converted to map directions (east scaled by 1/cos lat).
- GUI: a Discs folder, and a read-only "moon" line (lit %, sub-lunar point) in the Time folder for spot checks.

## Acceptance
- The phase matches a reference (e.g. timeanddate.com) at 4 spot dates, and the moon's position is within 1°.
- The sun disc is centred on the sub-solar point (checked at the equinox and the June solstice).
- Both discs wrap cleanly across ±180°.
