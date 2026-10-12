// Spec 11a: gore geometry and landmass labels. Pure functions, no GL, so they can be checked in Node.
// Angles in radians unless a name says Deg. A gore is centred on longitude 0 here: dl is the longitude from its
// centre, lat the latitude; x, y are on a unit sphere's scale (the equator is x = dl in every projection).

const A = Math.PI / 2;
const RAD = Math.PI / 180;

export const PROJECTIONS = {
  // Meridians and parallels are circular arcs; the central meridian, the equator and the circle at ±90°
  // are divided evenly.
  globular(dl, lat) {
    const l = Math.abs(dl), p = Math.abs(lat);
    let x, y;
    if (l < 1e-12) {
      x = 0;
      y = p;
    } else if (p < 1e-12) {
      x = l;
      y = 0;
    } else if (A - p < 1e-12) {
      x = 0;
      y = A;
    } else {
      // Meridian: circle through both poles and (l, 0), centre (cx, 0): x² − 2·cx·x + y² = A².
      // Parallel: circle through (0, p) and (±A·cos p, A·sin p), centre (0, cy).
      // Subtracting them gives the line y = A·sin p + (cx/cy)·x; the meridian's root on the side of dl.
      const cx = (l * l - A * A) / (2 * l);
      const cy = (A * A - p * p) / (Math.PI * Math.sin(p) - 2 * p);
      const k = cx / cy;
      const s = A * Math.sin(p);
      const b = cx - s * k;
      const c = A * A * Math.cos(p) ** 2;
      const d = Math.sqrt(b * b + (1 + k * k) * c);
      x = b < 0 ? c / (d - b) : (b + d) / (1 + k * k); // the positive root, without cancellation
      y = s + k * x;
    }
    return [Math.sign(dl) * x, Math.sign(lat) * y];
  },

  // Transverse equirectangular on the central meridian: it and distances square to it are true.
  cassini(dl, lat) {
    return [Math.asin(Math.cos(lat) * Math.sin(dl)), Math.atan2(Math.sin(lat), Math.cos(lat) * Math.cos(dl))];
  },

  // Equal-area; each gore of the interrupted sinusoidal.
  sinusoidal(dl, lat) {
    return [dl * Math.cos(lat), lat];
  },

  // HEALPix (spec 11c), equal-area: a cylindrical equatorial band (|sin lat| ≤ 2/3), where neighbouring gores
  // touch along their whole edge, and a triangle over each gore towards each pole. Each gore is one of its lobes;
  // the triangles are π/4 tall for any gore count, which keeps it equal-area.
  healpix(dl, lat) {
    const s = Math.sin(lat);
    if (Math.abs(s) <= 2 / 3) return [dl, (3 * Math.PI / 8) * s];
    const sigma = Math.sqrt(3 * (1 - Math.abs(s)));
    return [dl * sigma, Math.sign(lat) * (Math.PI / 4) * (2 - sigma)];
  },
};

// Latitude (degrees) within which a projection's neighbouring gores touch along their edge by construction.
export const NATURAL_JOIN_DEG = { healpix: Math.asin(2 / 3) / RAD };

// Sorted, de-duplicated values from lo to hi every step, plus the extras.
function stops(lo, hi, step, extras) {
  const v = [...extras];
  for (let i = 0; lo + i * step < hi; i++) v.push(lo + i * step);
  v.push(hi);
  v.sort((a, b) => a - b);
  return v.filter((x, i) => i === 0 || x - v[i - 1] > 1e-9);
}

// How much of the equatorial join applies at a latitude (degrees): 1 within ±joinDeg, falling linearly to 0 over
// blendDeg beyond it. The kink where it starts to fall is the point where neighbouring gores part.
export function joinWeight(latDeg, joinDeg, blendDeg) {
  const over = Math.abs(latDeg) - joinDeg;
  if (joinDeg <= 0 || over >= blendDeg) return 0;
  return over <= 0 ? 1 : 1 - over / blendDeg;
}

// One gore's mesh out to extentDeg either side of its centre, with vertex columns on the centre and on the
// edges (±halfDeg) so the lens edge falls between rows of triangles, not across them.
// join (optional): { deg, blendDeg, halfSpacing }. Like the reference map, gores are joined within ±deg of the
// equator: each row is stretched sideways so the gore's edge lands on halfSpacing (half the distance between gore
// centres), where its neighbour's edge lands too, and the stretch fades out over blendDeg.
// Returns { vertices: Float32Array [x, y, dlDeg, latDeg]…, indices: Uint32Array, maxX, maxY }.
export function goreMesh(projection, halfDeg, extentDeg, stepDeg, join = null) {
  const project = PROJECTIONS[projection];
  const cols = stops(-extentDeg, extentDeg, stepDeg, [-halfDeg, 0, halfDeg].filter((d) => Math.abs(d) <= extentDeg));
  const joinRows = join && join.deg > 0
    ? [join.deg, join.deg + join.blendDeg].filter((d) => d < 90).flatMap((d) => [-d, d]) : [];
  const rows = stops(-90, 90, stepDeg, [0, ...joinRows]);
  const vertices = new Float32Array(cols.length * rows.length * 4);
  let maxX = 0, maxY = 0, n = 0;
  for (const lat of rows) {
    const w = join ? joinWeight(lat, join.deg, join.blendDeg) : 0;
    const edge = project(halfDeg * RAD, lat * RAD)[0];
    const stretch = w > 0 && edge > 1e-9 ? 1 + w * (join.halfSpacing / edge - 1) : 1;
    for (const dl of cols) {
      const [x, y] = project(dl * RAD, lat * RAD);
      maxX = Math.max(maxX, Math.abs(stretch * x));
      maxY = Math.max(maxY, Math.abs(y));
      vertices.set([stretch * x, y, dl, lat], n);
      n += 4;
    }
  }
  const nc = cols.length;
  const indices = new Uint32Array((nc - 1) * (rows.length - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < nc - 1; c++) {
      const i = r * nc + c;
      indices.set([i, i + 1, i + nc, i + 1, i + nc + 1, i + nc], k);
      k += 6;
    }
  }
  return { vertices, indices, maxX, maxY };
}

// Longitudes of the gores' centres, west to east, in degrees (not wrapped). firstDeg: the westernmost gore's
// centre, in Earth longitude (land) or relative to the sub-solar meridian (sun).
export function goreCentres(count, firstDeg, sunLonDeg, anchor) {
  const base = firstDeg + (anchor === 'sun' ? sunLonDeg : 0);
  return Array.from({ length: count }, (_, i) => base + (i * 360) / count);
}

// Spec 11a decision 12: 8-connected landmasses of the land mask (> 0.5), wrapping east-west.
// mask: Uint8Array w×h, row 0 = 90°N, non-zero = land. Returns { labels: Uint32Array (0 = water, 1.. = landmass),
// count }.
export function labelLand(mask, w, h) {
  const labels = new Uint32Array(w * h);
  const stack = new Int32Array(w * h);
  let count = 0;
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = ++count;
    labels[start] = id;
    let top = 0;
    stack[top++] = start;
    while (top) {
      const i = stack[--top];
      const y = (i / w) | 0;
      const x = i - y * w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const j = ny * w + ((x + dx + w) % w);
          if (mask[j] && !labels[j]) {
            labels[j] = id;
            stack[top++] = j;
          }
        }
      }
    }
  }
  return { labels, count };
}

// Map column holding a longitude (degrees, any wrap).
export function lonColumn(lonDeg, w) {
  const u = ((((lonDeg + 180) / 360) % 1) + 1) % 1;
  return Math.min(w - 1, Math.floor(u * w));
}

// Fills flags (one per landmass) with bit j set when that landmass has land on seam j's column.
export function seamFlags(flags, labels, w, h, seamColumns) {
  flags.fill(0);
  seamColumns.forEach((col, j) => {
    for (let y = 0; y < h; y++) {
      const l = labels[y * w + col];
      if (l) flags[l] |= 1 << j;
    }
  });
}
