// Loads config.json (all tunable design values), falling back to built-in defaults
// if the fetch fails. Keep DEFAULTS in sync with config.json.

const DEFAULTS = {
  palette: {
    dayWater: '#ece6d8',
    dayLand: '#dcd2bc',
    nightWater: '#0a0d16',
    nightLand: '#141926',
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
  },
  relief: {
    // Vertical exaggeration of the terrain that the sun lights (spec 04). 0 is a smooth sphere.
    // The sun's altitude is taken against the tilted terrain, so relief shows most near the terminator.
    landExaggeration: 3,
    seaExaggeration: 0.5, // the seafloor (bathymetry); coasts blend the two by land fraction
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
