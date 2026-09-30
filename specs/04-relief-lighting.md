# 04 — Relief lit by the sun  (later)

## Outcome
Mountains are shaded by the *actual* sun at each point, so they cast long shadows near dusk and almost none at noon.
This is the "simulated globe, unwrapped" at its most visible.

## Scope
- In the shader, perturb the sphere normal using elevation gradients (from 02's texture).
- Lambert shading from the per-pixel sun direction (01). The result feeds dot size in 03.
- Vertical exaggeration via `?relief=<n>`. Pick the default on the real display.
- Correct the east-west gradient by 1/cos(lat) so relief near the poles isn't distorted.

## Out of scope (for now)
Cast shadows (ray-marching along the terrain). Consider them only if Lambert shading feels too flat.

## Acceptance
- With `?t=` set just after local sunrise over the Himalaya, west-facing slopes are dark and east-facing slopes are lit.
