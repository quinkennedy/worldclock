# 10 — Reaction-diffusion water  (defined, umbrella)

**Status: defined.** The goal is set; the work is split into sub-specs `10a`, `10b`, … (see the sub-spec naming
rule in `00-vision.md`). Each sub-spec still needs its own interview and explicit confirmation before it's `ready`.

## Goal (confirmed)
A **living texture** on the oceans. The water drifts slowly, enough to see if you watch for about a minute,
while the rest of the piece stays almost still. The drift speed is a free design value, not tied to astronomy.

## Sub-specs
| #   | Sub-spec | Status |
|-----|----------|--------|
| 10a | RD + fake flow prototype (`proto/10-rd-water/`) | done |
| —   | Real ocean-current data steering the pattern | not written |
| 10b | Several RD systems, one per colour layer, combined | defined (prototype built) |
| 10c | Grey RD driving specular highlights under the real sun and moon | done (prototype) |
| —   | RD drawn through a Ben-Day dot renderer (09 / 03) | not written |
| —   | Long-run stability (health check, reseeding) | not written |
| —   | Lighting: RD under the sun, twilight and night | not written |

## Still open (for later sub-specs)
- Simulation space for the piece: map (lat/lon) or screen. 10a has both, to compare.
- Current data: dataset, climatology vs snapshot, resolution, size budget (a new data source for 02).
- Day vs night, and how RD fades through twilight.
- Long-run stability after weeks unattended.
- GPU cost on the gallery machine.
