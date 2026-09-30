# 08 — Anti-solar sky  (idea)

**Status: idea, not scheduled.** It's an alternative to, or variation on, 05's zenith star map. If it's adopted,
it changes the locked "Stars: true zenith sky" decision in `00-vision.md`.

## Idea
Instead of each point showing the star directly overhead, render the half of the sky that faces away from the sun:
the night sky as a whole, centred on the night side.

## What 05 already does
05's night side already shows exactly this hemisphere. A point is in night when its "up" points away from the sun,
and 05 draws the star along that "up". So the stars on the night side are the anti-solar hemisphere, centred on the
anti-solar point (the middle of the shadow). The fully dark region (sun below −18°) shows the stars more than
108° from the sun, and twilight fades out the rest. Over a year the sky drifts about 1°/day against the shadow as
the sun moves along the ecliptic, which is 05's "constellations move relative to the terminator".

So the idea has to change something else. Candidates:

1. **Orientation.** Show the sky as seen looking up from the ground, not from above the globe. 05's map is mirror-imaged,
   like a celestial globe, so Orion reads backwards. Flipping east-west about the anti-solar meridian makes
   constellations read correctly. Stars are then no longer overhead where they're drawn (except on that meridian), and
   they drift about 1°/day east against the shadow instead of west.
2. **Scale / projection.** Map the whole hemisphere (90° around the anti-solar direction) into the fully dark region
   (about 72° around the anti-solar point), so no stars are lost to twilight. Or use another radius, larger or
   smaller, to make constellations bigger or smaller. Stars would then follow the shadow, not the ground.
3. **Local geometry.** Draw the hemisphere with an azimuthal projection around the anti-solar point, measured on the
   globe, so constellations near the poles aren't stretched by the equirectangular map.

## Tension with the vision
Principle 1 says positions are real. Option 1 is still a true picture of the sky, just seen from the other side.
Options 2 and 3 keep the sky's true arrangement but no longer place each star over a real place on Earth.

## Open questions
- Which of 1–3 (or a combination) is meant, or is it something else?
- Is it a replacement for 05, or a mode alongside it (a config switch, not a query string)?
- Should the day side stay empty, as in 05?

## Acceptance
To be written once the open questions are answered.
