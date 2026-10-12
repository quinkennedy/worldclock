# 11b — Orange-peel projection in the piece  (idea)

Part of 11. Not scheduled: it waits on what the 11a prototype shows.

## Before starting (required)
Interview Quin and have each key decision confirmed, as in `00-vision.md`.

## Open questions
- A config switch (mode) beside equirectangular, or a replacement? Either way the locked Projection and Aspect
  decisions change.
- Move the projection into the shaders (a shared include for `sun.frag`, stars and discs) so stars and discs stay
  round and sharp, instead of 11a's remap pass?
- How the halftone (03) sits on the gores: it's fixed to the screen, so it should work unchanged.
- Spill data: keep labelling landmasses at load time, or commit a prepared label texture (02's tools)?
