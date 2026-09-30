# 07 — Dev GUI & time control

**Status: done.** Outstanding: the long-run test in `DEV.md` (the clock and render loop changed).

## Outcome
A developer-only Tweakpane panel for exploring design variables and scrubbing time.
The public page (without `?gui`) never loads it and always runs in real time.

## Loading and toggle
- `?gui` in the URL dynamically `import()`s Tweakpane (v4, pinned version, jsDelivr ESM build) and shows the panel.
- Once loaded, the `g` key shows or hides it. Without `?gui`, no key does anything.

## Sim clock (`js/clock.js`, always loaded; the only source of time)
- State: `anchorSim` (ms UTC), `anchorReal` (performance.now()), `speed`, `paused`.
- `simNow() = anchorSim + (paused ? 0 : (perfNow - anchorReal) * speed)`.
- Changing speed, pausing or setting a time re-anchors, so there are no jumps.
- All astronomy reads `simNow()`. Nothing else calls `Date.now()`.
- `?t=<ISO>` sets the start time and pauses, but **only together with `?gui`**. The public page ignores it.
  (clock.js is built in spec 01, so `?gui&t=` works there before the panel exists.)

## Render loop
- Live (speed x1, not paused, GUI hidden): redraw every 5 s.
- Otherwise: `requestAnimationFrame` every frame. Also redraw at once on any param change.

## Time panel
- Speed: a log slider from x1 to x100000, plus a +/- sign for reversing time.
- Date/time: a UTC text field (ISO). Applying it re-anchors.
- Pause/Play, and **Now** (reset to live: the real time at x1).
- Presets: March equinox, June solstice, September equinox, December solstice, next full moon, next new moon.
- A read-out of the current sim time in UTC (inside the panel only; it never appears on the canvas).

## Design panel
- One folder per spec (Twilight, Halftone, Relief, Stars, Moon), each added when its spec lands.
  `twilight.nightLux`/`dayLux` are config-only and don't appear in the panel.
- Every tunable value lives in `config.json` (repo root). `js/config.js` fetches it at startup, falls back to
  built-in defaults if the fetch fails, and exports the result. The GUI binds to a live copy.
- **Copy config** button: copies the current values as JSON to the clipboard.
- **Download config** button: saves `config.json`. Replace the repo file with it to commit new defaults.
- **Reset** button: goes back to the values loaded at startup.

## Out of scope
Persisting to localStorage or URL, and saving presets.

## Acceptance
- The page without `?gui` makes no network request for Tweakpane and ignores `?t=`.
- A downloaded `config.json`, committed, reproduces the tuned look exactly on the public page.
- Setting x100000 then pressing **Now** returns to live time within 1 s of the real time.
- Changing speed mid-run causes no visible jump in the terminator.
