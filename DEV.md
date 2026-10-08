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
| `/proto/10-rd-water/`  | 10a  | Reaction-diffusion on the oceans (Gray-Scott, FitzHugh-Nagumo, Brusselator), carried by a curl-noise flow. Map or screen simulation, a parameter map (latitude, depth, noise) blending two parameter sets, raw greyscale view. **Colour layers** (exploration): one independent sim per channel, each with its own seed, combined as RGB (add), CMYK (multiply) or HSL (sims drive H, S, L); sunny, night or split (sunny west of 0°, night east) palettes (10b). **Specular** mode (10c): one sim as wave height, glinting under the real sun and moon, with a Time folder (speed, set UTC, pause, now). Water and land blend night → moon → sunny by light level; **moon glint** and **moon lighting** toggle the moon's glint and its light on the globe separately. After a load, reseed or grid rebuild the pattern stays hidden for **warm-up steps**, then fades in over **fade seconds** (10d). |

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
