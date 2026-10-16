# Developing and testing

## Run it locally

The site is plain static files, so there's nothing to build or install. Serve the folder over HTTP:

```
npx serve .
```

Then open the URL it prints (usually http://localhost:3000). This needs [Node.js](https://nodejs.org/).

Don't open `index.html` straight from disk (`file://`), because the browser won't load the textures that way.
Other static servers work too. On Windows, `python -m http.server` may send `.js` files as `text/plain`,
which Firefox rejects with `NS_ERROR_CORRUPTED_CONTENT`. Use `npx serve .` there.

## Test URLs

The plain page runs in real time and has no controls. Add `?gui` for developer options:

| URL                                   | What you should see |
|---------------------------------------|---------------------|
| `/`                                   | The live day/night map at 20 fps. The water shows plain colours for about half a second (the warm-up, 100 steps per frame after the first frame), then its drifting pattern and sun glint fade in over 10 s. With **fast warm-up** off, the plain colours last ~50 s. |
| `/?gui&t=2026-03-20T12:00Z`           | March equinox, paused: the terminator is nearly vertical at about ±90° longitude; after the warm-up, the sun glints on the water around 0°, 0°. |
| `/?gui&t=2026-06-21T12:00Z`           | June solstice, paused: the Arctic is fully lit and Antarctica fully dark. |
| `/?gui&t=2026-03-20T00:40Z`           | Just after sunrise over the Himalaya: east-facing slopes lit, west-facing slopes dark. |
| `/?gui&t=2026-01-15T00:00Z`           | Orion's belt overhead in the mid-Atlantic, at about 1°S, 30°W. The constellation is mirror-imaged, as on a celestial globe. |
| `/?gui&t=2026-10-26T04:13Z`           | Full moon: the night side under the moon (about 17°N, 69°W) takes the moon colours, with a faint moon glint on the water. Untick **moonlight** (Twilight) and it goes back to night colours, glint only. |
| `/?gui&t=2026-10-18T00:00Z`           | The moon just under half lit (43.8%), lit side facing west, at about 25.6°S 97.3°W; the sun disc splits across ±180°. The panel's "moon" line shows the lit % and position. |
| `/?t=2026-06-21T12:00Z`               | `?t=` without `?gui` is ignored, so this shows live time. |

`?t=` takes any ISO date/time, read as UTC when it has no zone. With `?gui`, the `g` key shows or
hides the dev panel. Without `?gui`, no key does anything and Tweakpane is never downloaded.

## Dev panel (`?gui`)

- **Time:** the current sim time (UTC); a log speed slider from x1 to x100000 with a +/− direction;
  a UTC text field (type a date/time, press Enter to jump there); Pause/Play; **Now** returns to live
  time at x1.
- **Presets:** the equinoxes and solstices of the sim time's UTC year, and the next full or new moon
  after the sim time (press again to step to the one after). A preset resets the speed to +x1
  and keeps the pause state.
- **Design:** one folder per spec. Edits redraw at once. **Copy config** puts the values on the
  clipboard as JSON, **Download config** saves `config.json`, and **Reset** goes back to the values
  loaded at startup. Nothing is saved between reloads.

- **Design → Water:** the reaction-diffusion water (spec 10e): specular look, Gray-Scott, depth map, flow and sim.
  The sim runs on frames, not the clock, so the clock's pause and speed don't touch it; it has its own Pause and
  **Reseed** (which runs the warm-up again). Its read-outs show the grid, fps, steps and reveal (0 while hidden).

The page always draws at `render.fps` (20), with or without the panel.

## Long-run test

The piece has to run unattended for weeks, so repeat this test on the gallery machine (or one like it)
after any change to `js/` or `shaders/`, and before installing. Short headless checks can't cover it.

1. Set up the machine as it will be installed: same browser, OS power plan, monitor and resolution.
2. Open the public URL (no `?gui`), full screen, and leave it running for at least 24 hours, ideally a few days.
3. At the start, after about an hour and at the end, note the tab's memory and the GPU process's memory
   (Chrome: Shift+Esc opens its Task Manager).

It passes if:

- **Memory:** both figures stay roughly flat after the first hour, with no steady climb.
- **Water:** at the end the oceans still show a drifting pattern with glints: it hasn't died out to plain colour,
  filled up solid, frozen in place, or grown blotches or seams. Note the frame rate the machine holds (`?gui`, Water →
  Sim → fps) and whether it runs hot or loud.
- **Sleep:** the screen never sleeps, dims or shows a screensaver. The page holds a Screen Wake Lock, but only
  while its tab is visible, so the OS power settings still matter.
- **Correct time:** at the end, the terminator matches the real time. Compare it with timeanddate.com's day/night map.
- **Recovery:** after the display is turned off and on, the machine sleeps and wakes, or the monitor is unplugged and
  replugged, the map comes back at the correct time and the wake lock returns. If the WebGL context was lost, the
  water warms up again before the pattern returns.
- **Warm-up frames:** on load (and after Reseed), the fast warm-up frames (100 steps each) take well under 2 s each,
  and the page doesn't lose its WebGL context there. Note how long the warm-up lasts.

Record the date, machine, browser and results below.

| Date | Machine / browser | Duration | Memory start → end | Result |
|------|-------------------|----------|--------------------|--------|
|      |                   |          |                    |        |

## Design prototypes

Each prototype is a self-contained page in `proto/NN-name/`, published with the site but not linked from it. It
imports the piece's shared code and data, has its own Tweakpane panel (always shown; `g` hides it) and keeps its
defaults in its own `settings.json`. To change them, press **Download settings.json** and replace that file.
Prototypes never change `config.json` or the public page.

| URL                    | Spec | What it's for |
|------------------------|------|---------------|
| `/proto/03a-landcover-palette/` | 03a | The map in flat land-cover colours (water, arid, forest, grass, ice). **palette** dropdown of named palettes; **blend**: fraction mix (soft class borders, mixed in OKLab) or dominant class (crisp). **Colours**: the selected palette's 5 colours and its **Elevation** curve (**lo m**/**hi m**, **exponent**, **brightness** = OKLab lightness added at hi, **saturation** = chroma change at hi; land only). **Manage**: type a **name**, then **Save as new**, **Rename** or **Delete**. **Scene → lit by sun** puts the piece's sun, twilight, relief and night/moon colours (from `config.json`) over the palette, with a Time folder. Any scalar settings key works in the URL, e.g. `?palette=Atlas&blend=dominant&scene=true&t=2026-03-20T12:00Z`. |
| `/proto/10-rd-water/`  | 10a  | Reaction-diffusion on the oceans (Gray-Scott, FitzHugh-Nagumo, Brusselator), carried by a curl-noise flow. Map or screen simulation, a parameter map (latitude, depth, noise) blending two parameter sets, raw greyscale view. **Colour layers** (exploration): one independent sim per channel, each with its own seed, combined as RGB (add), CMYK (multiply) or HSL (sims drive H, S, L); sunny, night or split (sunny west of 0°, night east) palettes (10b). **Specular** mode (10c): one sim as wave height, glinting under the real sun and moon, with a Time folder (speed, set UTC, pause, now). Water and land blend night → moon → sunny by light level; **moon glint** and **moon lighting** toggle the moon's glint and its light on the globe separately. After a load, reseed or grid rebuild the pattern stays hidden for **warm-up steps**, then fades in over **fade seconds** (10d). |
| `/proto/11-orange-peel/` | 11a | The live piece cut into orange-peel gores that touch at the equator. Left panel: **projection**: gores (Nicolosi globular, Cassini, interrupted sinusoidal, HEALPix) or whole-world maps (11c: Lambert azimuthal equal-area, Peirce quincuncial, Guyou, Cahill butterfly, Cahill-Keyes, Dymaxion, a Hao approximation; no gores or spill, and a **turn °** slider in place of the first centre; Dymaxion takes a few seconds to build), **anchor** (gores fixed to the land, or following the sun so the land drifts through them), the westernmost gore's **first centre** (Earth longitude, or degrees from the sub-solar meridian in sun mode), **count** (2–12), **gap**, **join ±°** (gores joined within that many degrees of the equator, like the reference; 0 off) with its **join blend °**, and **max spill** (land of a landmass that crosses a seam continues up to this far past the gore's edge). Right panel: the piece's own dev panel (time, presets, design values from `config.json`). Its edits are saved into the prototype's `settings.json` (`scene` block, merged over `config.json`) by the left panel's **Download settings.json**, never into `config.json`. Any settings key also works in the URL, e.g. `?anchor=sun&projection=cassini&t=2026-03-20T12:00Z`. |
| `/proto/11d-patchwork/` | 11d | The live piece as a patchwork of 18 pieces (11 continents, Asia split in five by 11f; 7 oceans), each in its own Chamberlin trimetric projection, exploded on a world base map. Left panel: **regions** (coastlines + cuts: continents are the land, oceans the water; polygons: hand-drawn plates holding coast and sea; Voronoi: nearest centre; 11e: **convex hulls**, **circles** or **control triangles**, simple overlapping shapes each holding its whole continent or ocean, with **shape margin °**, **ignore land under km²** and a **fits** read-out of any fallback), **base map** (Robinson, Equal Earth, equirectangular, or 11h's **Packed (from Robinson)**: pieces or pages moved apart so none overlap at any explode, with a **pack gap** slider), **explode** (each piece's scale about its anchor; lower opens the gaps), **polar from \|lat\|** (pieces whose centroid is this far from the equator sit on the pole), **edge px**, **hide oceans** (only the continents, refitted to the screen); **Atlas pages** (11g): **page** off, minimal rectangle, A4 (portrait or landscape) or 11i's **equal A4 pages** (one size for all, **page long side °**; continents too big are split into several pages, each its own map, overlapping by **split overlap °**; **whole Asia on pages**, 11j, on by default, treats Asia's five parts as one continent for pages), each continent drawn as a north-up page with the map running to its edge, and **page margin °**; **Tuning**: **control points** (each piece's three points and its triangle), **region tint** (colours the pieces to tell them apart); **Regions**: every piece's three points (lon/lat; NGS's published ones are marked) and, in Voronoi mode, its centre. Right panel and saving as 11a. Any scalar settings key works in the URL, e.g. `?regionMode=voronoi&base=equalEarth&tint=0.6&showPoints=true`. Building the regions takes 0.2–1.7 s when the mode changes (hulls are the slowest). In SwiftShader the water stays black for its ~10 s fade-in. |

## Changing the look

Design values (colours, the twilight's lux range, relief exaggeration, star size and brightness, sun and moon discs and so on) live in `config.json`. Edit it and reload,
or tune them live in the dev panel (`?gui`), press **Download config** and replace the repo's `config.json`
with the download. Commit that file to change the public page. The twilight's lux range is config-only.

## Regenerating data

`data/` holds committed files, so the site never builds them. The scripts in `tools/` regenerate
them (formats and sources are in `specs/02-data-prep.done.md`). They need Python 3.12 or later:

```
pip install -r tools/requirements.txt
python tools/make_land.py        # data/land.png + data/landcover.webp
python tools/make_elevation.py   # data/elevation.webp
python tools/make_stars.py       # data/stars.bin
```

Raw downloads are cached in `tools/cache/` (gitignored). The scripts download ETOPO 2022 (also used by
`make_land.py` for the Antarctic ice shelves) and the star catalogue themselves. `make_land.py` also needs the MODIS MCD12C1 v061 `.hdf`, which requires a free NASA Earthdata login:
download the latest year from https://search.earthdata.nasa.gov/ (search `MCD12C1`) into `tools/cache/`.

## Deployment

GitHub Pages serves the repo root as-is. `.nojekyll` turns off Jekyll, so files are published unchanged.
Use relative paths (`data/land.png`, not `/data/land.png`), or they break on a project Pages site.

## More detail

`specs/` has one spec per feature. Start with `specs/00-vision.md`.
