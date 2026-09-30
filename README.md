# World Clock

**Live:** https://www.quinkennedy.com/worldclock/

An ambient artwork that shows where it is day and night on Earth right now.

A simulated sun lights a globe, and the globe is unwrapped onto a flat map in real time. The
lit side reads as pale paper and the dark side as deep blue-black, with a gradient between them
that follows how light actually fades through dusk. The shadow drifts slowly west to east as
the Earth turns and tilts with the seasons. There are no labels, numbers or controls. The map
is only day and night, and it's always true.

## How it's made

- **Real sun position.** The sub-solar point is computed from the current UTC time with NOAA's
  solar-position algorithm, including the Earth's tilt and the equation of time.
- **Physically based twilight.** A clear-sky model estimates how much light reaches the ground
  at each sun altitude, from full daylight through sunset to starlight. Brightness follows
  that light level on a log scale, roughly as the eye perceives it.
- **Sunlit relief.** Mountains and the seafloor are lit by the real sun angle at each point, from
  NOAA elevation data, so ranges throw long shade near dawn and dusk and flatten out at noon.
- **Generative imagery.** Everything is drawn by a WebGL shader from data. There are no photographs.
- **Static and self-contained.** Plain HTML, JavaScript and GLSL, served as-is by GitHub Pages.
  No build step, server or accounts.

It's made to run unattended for weeks on a single gallery monitor.

## Data sources

- **Land and land cover:** NASA MODIS MCD12C1 v061 (Friedl & Sulla-Menashe, NASA EOSDIS LP DAAC,
  [doi:10.5067/MODIS/MCD12C1.061](https://doi.org/10.5067/MODIS/MCD12C1.061)).
- **Elevation:** NOAA NCEI ETOPO 2022 Global Relief Model
  ([doi:10.25921/fd45-gt74](https://doi.org/10.25921/fd45-gt74)).
- **Stars:** Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren 1991), via
  [CDS V/50](https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50).
