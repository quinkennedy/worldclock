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
| `/`                                   | The live day/night map, updated every 5 s. |
| `/?gui&t=2026-03-20T12:00Z`           | March equinox, paused: the terminator is nearly vertical at about ±90° longitude. |
| `/?gui&t=2026-06-21T12:00Z`           | June solstice, paused: the Arctic is fully lit and Antarctica fully dark. |
| `/?t=2026-06-21T12:00Z`               | `?t=` without `?gui` is ignored, so this shows live time. |

`?t=` takes any ISO date/time in UTC. With `?gui`, the `g` key will show or hide the dev panel
once it's built (spec 07). Without `?gui`, no key does anything.

## Long-run test

The piece has to run unattended for weeks, so repeat this test on the gallery machine (or one like it)
after any change to `js/` or `shaders/`, and before installing. Short headless checks can't cover it.

1. Set up the machine as it will be installed: same browser, OS power plan, monitor and resolution.
2. Open the public URL (no `?gui`), full screen, and leave it running for at least 24 hours, ideally a few days.
3. At the start, after about an hour and at the end, note the tab's memory and the GPU process's memory
   (Chrome: Shift+Esc opens its Task Manager).

It passes if:

- **Memory:** both figures stay roughly flat after the first hour, with no steady climb.
- **Sleep:** the screen never sleeps, dims or shows a screensaver. The page holds a Screen Wake Lock, but only
  while its tab is visible, so the OS power settings still matter.
- **Correct time:** at the end, the terminator matches the real time. Compare it with timeanddate.com's day/night map.
- **Recovery:** after the display is turned off and on, the machine sleeps and wakes, or the monitor is unplugged and
  replugged, the map comes back at the correct time within about 5 s and the wake lock returns.

Record the date, machine, browser and results below.

| Date | Machine / browser | Duration | Memory start → end | Result |
|------|-------------------|----------|--------------------|--------|
|      |                   |          |                    |        |

## Changing the look

Design values (colours, the twilight's lux range and so on) live in `config.json`. Edit it and reload.
The dev panel will be able to download a new `config.json`. Commit that file to change the public page.

## Regenerating data

`data/` holds committed textures, so the site never builds them. To regenerate the land mask
(needs Python with Pillow):

```
python tools/make_land_mask.py
```

## Deployment

GitHub Pages serves the repo root as-is. `.nojekyll` turns off Jekyll, so files are published unchanged.
Use relative paths (`data/land.png`, not `/data/land.png`), or they break on a project Pages site.

## More detail

`specs/` has one spec per feature. Start with `specs/00-vision.md`.
