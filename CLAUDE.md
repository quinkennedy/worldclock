# World Clock

An ambient art piece for a gallery/public space. A simulated sun lights a globe, and that
globe is unwrapped in real time onto an equirectangular map. People read it only as day and
night: no text, numbers or UI. It's hosted as a static GitHub Pages site and runs unattended for weeks on one monitor.

## Specs (source of truth)
`specs/00-vision.md` holds the goal and locked decisions. Each other spec is small and standalone, named
`NN-name.<stage>.md`. The stage suffix is one of:
- `idea`: rough. Before work starts, interview the user for the real goal, split it into small sub-specs if needed,
  and get explicit confirmation of every key decision (each idea spec spells this out).
- `defined`: outcome and scope are clear, but open questions remain.
- `ready`: every key decision confirmed by the user; can be built as written.
- `done`: built.

When a spec changes stage, rename the file (`git mv`) and update its row in the `00-vision.md` spec map. The number
never changes; refer to specs by number ("spec 05") in prose.
Done: 01, 02, 04, 05, 07 (long-run test pending for 01, 04, 05, 07). The next spec isn't chosen yet, so ask. Don't
start other specs unless asked.
Every spec that touches `js/` or `shaders/` needs the long-run test in `DEV.md` before it's considered shipped.
If a decision isn't in a spec, ask; don't invent it. Record new decisions in `00-vision.md`.

## Folder structure (planned)
```
index.html          entry point, served as-is by GitHub Pages
.nojekyll           turns off Jekyll so Pages publishes files unchanged
README.md           public-facing description of the piece
DEV.md              human dev/tester guide (run with `npx serve .`, test URLs)
config.json         all tunable design values (committed; the GUI downloads replacements)
js/main.js          setup, render loop (5 s live / rAF otherwise), wake lock
js/clock.js         sim clock: the ONLY source of time (speed, pause, set; ?t= only with ?gui)
js/config.js        loads config.json, with built-in fallback defaults
js/gui.js           Tweakpane dev panel, dynamically imported only with ?gui
js/sun.js           NOAA solar position (pure functions, UTC ms in)
js/moon.js          lunar phases for the GUI presets (Meeus); spec 06 adds the sub-lunar point
js/stars.js         GMST, precession to date, B-V colours for the zenith stars (spec 05)
js/gl.js            WebGL setup, full-screen quad
shaders/            shaders (lighting, stars, later halftone/moon); twilight.glsl is shared via #include
data/               committed shader-ready textures (land mask, later elevation, land cover, stars)
tools/              offline data-prep scripts (spec 02); never run by the site
specs/              one spec per feature
```

## Constraints
- Static files only: no build step, server, API keys or bundler. Plain ES modules; pinned CDN libraries only if unavoidable.
- Imagery is generative (shaders + data). No photos or painted textures.
- The public page runs in real time. Speed-up and set-time exist only in the dev GUI (`?gui`, key `g`).

## Common mistakes to avoid
- **Time source:** all astronomy uses `clock.simNow()` (UTC ms). Never call `Date.now()` directly or use local time.
- **Hard-coded design values:** every tunable number or colour goes in `config.json`, never inline in shaders or JS.
- **Absolute paths:** `/data/x.png` breaks on project Pages sites. Use relative paths.
- **Terminator sign errors:** test with `?t=` at the equinox (vertical line at about ±90° lon) and the June solstice (Arctic lit).
- **Solar vs clock noon:** apply the equation of time (up to ±16 min). The sub-solar point isn't 0° at 12:00 UTC.
- **Sidereal vs solar time:** stars rotate with GMST, not with the sun. Don't reuse the sun's hour angle.
- **Screen-space dots:** the halftone grid is fixed to the screen, not to lat/lon, or it swims and shimmers.
- **Precision:** use `highp` float in shaders. Pass angles in radians. Wrap longitudes at ±180°.
- **Long-running leaks:** reuse the GL buffers/textures, keep one timer chain, never recreate the context per frame.
- **Aspect:** full longitude always fills the width. Wider than 2:1: crop the poles. 2:1 to 16:10: stretch vertically. Narrower: stretch to 16:10, then letterbox. Never crop longitude.
- **DPI/resize:** size the canvas by `devicePixelRatio` and handle resize and WebGL context loss.
- **file://:** textures won't load when the page is opened from disk. Serve it with `python -m http.server`.
- **Adding text:** nothing is drawn on the canvas, by design. Debug info lives only in the Tweakpane panel.
- **Leaking the GUI:** without `?gui`, Tweakpane must not be fetched, `g` must do nothing and `?t=` is ignored.
