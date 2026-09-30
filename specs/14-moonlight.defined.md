# 14 — Moonlight

## Outcome
The moon lights the night side with its real, physically computed illuminance. Over a month the night side
brightens toward full moon and goes dark at new moon.

## Decisions (confirmed by Quin)
- **Strictly physical.** Moon illuminance comes from its phase, distance and altitude. No gain or tint in `config.json`.
- **Same blend.** Moon lux is added to the sun's lux (and the night floor) and goes through 01's `daylight()` mapping,
  so moonlit ground uses the same night-to-day colour blend.
- **Relief.** Moon altitude is taken against the terrain normal, like 04 does for the sun.
- **Stars dim under moonlight** (05).
- **GUI toggle.** `moonlight.enabled` in `config.json`, with a checkbox in the GUI, so it can be judged by eye
  against the moonless look.

## Model
- Moon magnitude from the phase angle (Krisciunas & Schaefer 1991: V = −12.73 + 0.026|φ| + 4×10⁻⁹φ⁴, with |φ| in
  degrees), scaled by the Earth–moon distance.
- Dimmed by air mass for the moon's altitude above the local terrain normal, using the Kasten-Young formula
  `twilight.glsl` already uses. No twilight term: almost no moonlight scatters past the moon's horizon.
- Physical constants stay in the shader, as with the sun's.
- Expected values at the zenith: full moon ~0.27 lux (~30% of the way to day on the current 0.001–100,000 lux scale),
  quarter ~0.025 lux (~18%), crescent at ~150° phase angle ~0.001 lux (about the night floor).
- On the day side it adds nothing visible.

## Depends on
06 (moon position, phase, distance). Touches 01 (twilight), 04 (relief) and 05 (stars).

## Open questions
- How stars dim: a uniform fade from the total lux (what 05 does with the sun now), or a physical limiting magnitude
  from the moonlit sky's brightness, so faint stars vanish first (roughly mag 6 → 4 at full moon)?
- Default for `moonlight.enabled` on the public page, once it's been seen.
- If the shared sRGB blend reads as a muddy second daytime, whether to revisit the "same blend" decision.

## Acceptance
- With the GUI at a full-moon preset, the night side is lit, strongest at the sub-lunar point. At the new-moon preset
  it matches the toggle-off look.
- Zenith moon lux matches the expected values above within 20% at full and quarter moon (checked in the GUI read-out).
- The moonlit edge follows the moon's horizon, and relief shading faces the moon.
- Toggling `moonlight.enabled` off reproduces the moonless look exactly.
