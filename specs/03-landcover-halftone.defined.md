# 03 — Land-cover CMYK halftone  (later)

## Outcome
The day side looks like a comic-book print: cyan, magenta, yellow (and optionally black) dot screens at
classic angles (C 15°, M 75°, Y 0°, K 45°) overprinted on off-white paper.

## Scope
- Each of the 5 classes has a CMYK ink recipe (e.g. water mostly C, forest C+Y, arid Y+M-lite, ice
  almost no ink, grass Y+C-lite). The exact recipes get tuned on the real display.
- Ink per screen = sum over classes of (class fraction x recipe), from 02's `land.png` + `landcover.webp`, so borders blend.
- Dot radius per screen = ink amount x lighting (from 01, and 04 once it exists).
- Dots are fixed in **screen space**, so the grid doesn't swim as the terminator moves.
- Dot pitch is tunable via URL. The default is chosen for viewing across a room.
- Toward the terminator, dots shrink to nothing. The night side shows no dots, only 01's faint tint.

## Open questions
- Should the K (black) screen be used for shadow/relief, or left out?
- Should dots be anti-aliased or hard-edged?
