# 10 — Reaction-diffusion water  (idea, prototype first)

**Status: idea, not scheduled.** Needs a standalone design prototype before anything touches `index.html`.

## Before starting (required)
When we decide to do this, Claude must first:
1. **Interview Quin** to find the real goal behind the idea. Don't assume the notes below are the goal.
2. **Split it into sub-specs** if it's more than one small, standalone piece (principle 4 in `00-vision.md`).
   This one very likely splits (e.g. the RD simulation, current data, the colour-layer combine, the dot render).
3. **Have Quin verify each key decision explicitly** (list them and get a yes or a change for each), then record
   them in the spec and in `00-vision.md`. Nothing is decided by default.

## Idea
Render water with a reaction-diffusion (RD) system. Variations to explore:
- Ocean current data steering or advecting the pattern.
- Several RD systems, one per colour layer, combined to make the ocean.
- An RD system whose output is drawn through a Ben-Day dot renderer (see 09 / 03).

## Things the interview must resolve
- Motion: the piece is otherwise almost still. How fast may the water move, and is its motion tied to real time?
- Long-run stability: RD patterns can die out or blow up. It has to look alive after weeks unattended.
- Simulation space: on the map (lat/lon, with pole stretching) or on screen? How does it interact with the
  screen-space dot rule?
- Current data: which dataset, climatology vs a fixed snapshot, resolution, and the size budget. It would be a new
  data source for 02 and needs a locked decision.
- Day vs night: does RD show on both sides, and how does it fade through twilight?
- GPU cost and leaks: ping-pong framebuffers, reused, one timer chain (see `CLAUDE.md`).
- Where does the prototype live, and is it published on Pages?
