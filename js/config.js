// Loads config.json (all tunable design values), falling back to built-in defaults
// if the fetch fails. Keep DEFAULTS in sync with config.json.

const DEFAULTS = {
  palette: {
    // Spec 10e: land and water each blend night -> moon -> day on one log-lux scale (twilight below).
    // Spec 03b: the day land is the land-cover classes' colours, mixed by fraction in OKLab (03a's palette).
    dayWater: '#c4c2a7',
    dayArid: '#dacda7',
    dayForest: '#cec59f',
    dayGrass: '#d4c9a2',
    dayIce: '#dfd6b7',
    moonWater: '#0e1722',
    moonLand: '#151820',
    nightWater: '#08080c',
    nightLand: '#05050b',
    letterbox: '#000000',
  },
  layout: {
    // Narrowest width/height the map stretches vertically to fill; narrower screens letterbox.
    minAspect: 1.6,
  },
  twilight: {
    // Ground illuminance in lux that reads as full night / full day. Brightness is log-scaled
    // between them, following a clear-sky illuminance model of sun altitude. ~100000 shades the
    // whole day side up to the sub-solar point; ~400 makes everything above the horizon flat day.
    nightLux: 0.001,
    dayLux: 100000,
    moonLux: 0.25, // spec 10e: the moon colour stop (about a full moon at the zenith)
  },
  moonlight: {
    enabled: true, // spec 14: moon lux adds to the sun's in the base colours
  },
  relief: {
    // Vertical exaggeration of the land that the sun and moon light (spec 04). 0 is a smooth sphere.
    // The light's altitude is taken against the tilted terrain, so relief shows most near the terminator.
    // The water's surface is the reaction-diffusion pattern instead (spec 10e).
    landExaggeration: 3,
  },
  render: {
    fps: 20, // spec 10e: frame cap, always (the water drifts every frame)
  },
  water: {
    // Spec 10e: Gray-Scott reaction-diffusion on the oceans, carried by a curl-noise flow, drawn as a wave
    // surface that the sun and moon glint off. Tuned in proto/10-rd-water/.
    sim: {
      mapWidth: 4096,     // equirectangular grid, 1024, 2048 or 4096 wide; height is half
      latCorrection: 0,   // 0 uniform on the map, 1 uniform on the globe
      precision: 'half',  // 'half' or 'float'
      stepsPerFrame: 1,
      warmupSteps: 1000,  // spec 10d: after a seed the pattern stays hidden this many steps,
      fadeSeconds: 10,    // then fades in over this long
      instantWarmup: true,      // run the hidden steps faster, from the frame after the seed is first drawn:
      warmupStepsPerFrame: 100, // up to this many per frame (>= warmupSteps runs them all in one frame)
    },
    grayScott: {
      // Diffusion in cells² per step; the reaction blends sets A and B by the depth map.
      Du: 0.2097,
      Dv: 0.105,
      dt: 1,
      seedDensity: 0.15,
      a: { feed: 0.022, kill: 0.051 },
      b: { feed: 0.046, kill: 0.063 },
      view: { channel: 'v', lo: 0, hi: 0.4 }, // the value used as wave height, mapped from lo..hi to 0..1
    },
    depthMap: { lo: 0, hi: 1, invert: false }, // depth / 8000 m, smoothstepped from lo to hi: 0 set A, 1 set B
    flow: { strength: 0.054, scale: 4, evolution: 0.065 }, // cells per step, features per radian, per 1000 steps
    specular: {
      normalStrength: 8,
      exponent: 200,
      strength: 0.15,
      moonGlint: true,
    },
  },
  stars: {
    // Spec 05: the zenith star map. Size and alpha run linearly in magnitude from the faintest
    // drawn (magLimit) to brightMag and brighter. Sizes are disc diameters in degrees of longitude,
    // so they scale with the screen. Stars fade out with the twilight, as the map brightens.
    magLimit: 6,
    brightMag: 0,
    sizeFaint: 0.08,
    sizeBright: 0.4,
    alphaFaint: 0.3,
    alphaBright: 0.9,
    saturation: 1, // 0 = white; 1 = full colour from B-V
  },
  discs: {
    // Spec 06: outlines of the sun and moon at the sub-solar and sub-lunar points. Sizes are disc
    // diameters and widths in degrees of longitude, so they scale with the screen. Both use the same line;
    // the moon also draws its phase terminator with that line, feathered by terminatorSoftness.
    // moonFill (experiment): fill the lit part instead, its edge feathered by terminatorSoftness.
    sunSize: 8,
    moonSize: 8,
    lineWidth: 0.3,
    terminatorSoftness: 0.5,
    sunColor: '#d9622b',
    moonColor: '#8a9bc4',
    moonAlpha: 1,     // opacity of everything the moon draws
    moonFill: false,
    moonOutline: true, // the moon's limb circle; off with moonFill on leaves only the lit shape
  },
};

function merge(base, over) {
  const out = structuredClone(base);
  if (!over || typeof over !== 'object') return out;
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object'
      ? merge(out[k], v)
      : v;
  }
  return out;
}

export async function loadConfig() {
  try {
    const res = await fetch('config.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return merge(DEFAULTS, await res.json());
  } catch (err) {
    console.warn('config: using built-in defaults:', err);
    return structuredClone(DEFAULTS);
  }
}

// '#rrggbb' -> [r, g, b] in 0..1
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// '#rrggbb' -> OKLab [L, a, b] (Ottosson), for colours the shaders mix perceptually (spec 03b).
export function hexToOklab(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
