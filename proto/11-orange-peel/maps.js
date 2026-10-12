// Spec 11c: whole-world projections (no gores), from d3-geo, d3-geo-projection and d3-geo-polygon. Pure functions;
// `d3` is those three modules merged into one object (the CDN builds in the browser, the npm packages in Node).
// Each map is drawn as a mesh of lon/lat cells projected forward on the CPU in float64; no inverse is needed, so
// it works for projections whose d3 inverse is missing or broken (Cahill-Keyes).
//
// A cell must not straddle one of the projection's cuts, or its triangles would stretch across the map:
// - `align`: the cuts lie on meridians that are multiples of align degrees in the grid's frame: the Earth, or with
//   `frame` (a d3 rotation, or 'projection' for the projection's own) the frame that rotation takes the Earth to.
//   The grid has a line on each cut.
// - `polyhedral`: the cuts are face edges. Cells whose projected edge midpoints don't lie between their corners are
//   clipped to the faces with the projection's own spherical clip (preclip), and the pieces drawn separately.
// A corner on a cut projects to either side of it. Each cell (or clipped piece) projects its corners itself, and
// takes the first of the corner and versions of it nudged towards the piece's centre that lands next to the
// centre's own projection. Corners off the cuts keep their exact position, so neighbouring cells meet exactly.

// Nudges, as fractions of the way to the piece's centre: 1e-3 is about 5e-4° on a 1° cell, past d3's clipping
// tolerance (1e-6 rad). The larger ones are for thin pieces where faces meet; they only move the map's outline.
const NUDGES = [0, 1e-6, 1e-3, 1e-2, 0.05, 0.25];
// Extra grid lines at step/2, step/4, … step/2^GRADE either side of a map's `grade` meridians and parallels, so
// cells shrink towards the points where Peirce and Guyou fold (and the grid stays a plain grid: no cracks).
const GRADE = 6;
const RAD = Math.PI / 180;

export const MAPS = {
  lambert: { label: 'Lambert azimuthal equal-area', make: (d3) => d3.geoAzimuthalEqualArea(), align: 90,
    frame: [0, 90] }, // the centre on the grid's north pole, so the antipode (the whole rim) is its south pole
  peirce: { label: 'Peirce quincuncial', make: (d3) => d3.geoPeirceQuincuncial(), align: 45,
    grade: { lons: [-180, -90, 0, 90, 180], lats: [0] } },
  guyou: { label: 'Guyou', make: (d3) => d3.geoGuyou(), align: 90,
    grade: { lons: [-180, 0, 180], lats: [-45, 0, 45] } },
  butterfly: { label: 'Cahill butterfly', make: (d3) => d3.geoPolyhedralButterfly(), polyhedral: true },
  cahillKeyes: { label: 'Cahill-Keyes', make: (d3) => d3.geoCahillKeyes(), polyhedral: true },
  dymaxion: { label: 'Dymaxion (Airocean)', make: (d3) => d3.geoAirocean(), polyhedral: true },
  // Hao Xiaoguang's map has no published formula we could find. This look-alike is the planisphere R package's:
  // a Hufnagel equal-area projection turned so the poles sit on the vertical axis. Not the real projection.
  hao: {
    label: 'Hao (approximation)',
    make: (d3) => d3.geoHufnagel().a(0.8).b(0.35).psiMax(50).ratio(1.6).rotate([110, -200, 90]).angle(90),
    frame: 'projection', align: 90,
  },
};

const toVec = ([lon, lat]) => {
  const l = lon * RAD, p = lat * RAD;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};
const toLonLat = ([x, y, z]) => [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD]; // any length

// Grid lines from lo to hi every step, plus graded lines either side of each of `at`.
function graded(lo, hi, step, at) {
  const v = [];
  for (let x = lo; x < hi - 1e-9; x += step) v.push(x);
  for (const m of at) {
    for (let k = 1; k <= GRADE; k++) v.push(m - step / 2 ** k, m + step / 2 ** k);
  }
  v.push(hi);
  v.sort((a, b) => a - b);
  return v.filter((x, i) => x >= lo && x <= hi && (i === 0 || x - v[i - 1] > 1e-9));
}

// Triangles (index triples) of a simple polygon, by ear clipping. pts: [[x, y], …], either winding; repeated and
// collinear points are dropped.
function earClip(pts) {
  const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  let idx = pts.map((_, i) => i).filter((i, k, all) => {
    const q = pts[all[(k + all.length - 1) % all.length]];
    return Math.abs(pts[i][0] - q[0]) > 1e-9 || Math.abs(pts[i][1] - q[1]) > 1e-9;
  });
  let total = 0;
  for (let k = 0; k < idx.length; k++) {
    const a = pts[idx[k]], b = pts[idx[(k + 1) % idx.length]];
    total += a[0] * b[1] - b[0] * a[1];
  }
  const sign = Math.sign(total) || 1;
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    const n = idx.length;
    let clipped = false;
    for (let k = 0; k < n; k++) {
      const [i, j, l] = [idx[(k + n - 1) % n], idx[k], idx[(k + 1) % n]];
      const s = sign * area(pts[i], pts[j], pts[l]);
      if (s < -1e-12) continue; // reflex
      if (s <= 1e-12) { idx.splice(k, 1); clipped = true; break; } // collinear: drop the point
      const inside = idx.some((m) => m !== i && m !== j && m !== l
        && sign * area(pts[i], pts[j], pts[m]) > 0 && sign * area(pts[j], pts[l], pts[m]) > 0
        && sign * area(pts[l], pts[i], pts[m]) > 0);
      if (inside) continue;
      tris.push([i, j, l]);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push(idx);
  return tris;
}

// The mesh of one map, cells of stepDeg. Returns { vertices: Float32Array [x, y, dx, dy, dz]… (unindexed
// triangles; x right, y up, in the projection's units; d the point on the unit sphere, Earth frame, in the
// projection's usual orientation), count (vertices), minX, maxX, minY, maxY, clipped (cells), centreLon (the
// longitude d3 puts in the middle, before any oblique turn) }.
export function mapMesh(d3, name, stepDeg) {
  const def = MAPS[name];
  const p = def.make(d3).scale(1).translate([0, 0]).precision(0);
  const rot = d3.geoRotation(p.rotate());
  const out = [];
  let clipped = 0;

  const emit = (pts) => { // pts: [[x, y, dx, dy, dz], …], a convex ring (or a triangle); fan-triangulated
    for (let i = 1; i < pts.length - 1; i++) out.push(...pts[0], ...pts[i], ...pts[i + 1]);
  };
  // The point lonLat projected for the piece centred on `towards` (both lon/lat; pc: its projection), as
  // [x, y, dx, dy, dz]. The exact point unless a nudged one lands clearly nearer the centre.
  const vertex = (lonLat, towards, pc) => {
    const v = toVec(lonLat), c = toVec(towards);
    const dist = (xy) => Math.hypot(xy[0] - pc[0], xy[1] - pc[1]);
    const at = (t) => p(toLonLat(v.map((x, i) => x + t * (c[i] - x))));
    let xy = p(lonLat);
    if (dist(xy) > 1.5 * Math.min(dist(at(NUDGES[2])), dist(at(NUDGES.at(-1))))) {
      xy = NUDGES.slice(1).map(at).reduce((a, b) => (dist(b) < dist(a) ? b : a));
    }
    return [xy[0], -xy[1], ...v];
  };

  const rows = Math.round(180 / stepDeg), cols = Math.round(360 / stepDeg);
  const dLat = 180 / rows, dLon = 360 / cols;

  if (!def.polyhedral) {
    const step = def.align / Math.ceil(def.align / Math.min(dLon, def.align)); // a grid line on every cut
    const lons = graded(-180, 180, step, def.grade?.lons ?? []);
    const lats = graded(-90, 90, dLat, def.grade?.lats ?? []);
    const f = def.frame === 'projection' ? rot : def.frame ? d3.geoRotation(def.frame) : null;
    const frame = f ? (q) => f.invert(q) : (q) => q;
    for (let r = 0; r < lats.length - 1; r++) {
      const lat0 = lats[r], lat1 = lats[r + 1];
      for (let c = 0; c < lons.length - 1; c++) {
        const lon0 = lons[c], lon1 = lons[c + 1];
        const centre = frame([(lon0 + lon1) / 2, (lat0 + lat1) / 2]);
        const pc = p(centre);
        emit([[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0]].map((q) => vertex(frame(q), centre, pc)));
      }
    }
  } else {
    // Corners and edge midpoints projected once and shared; a cell straddles a face edge if a midpoint is off.
    const corner = [], midLat = [], midLon = []; // midLat: on the meridian edges; midLon: on the parallel edges
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const lon = -180 + c * dLon, lat = -90 + r * dLat;
        corner.push(p([lon, lat]));
        midLat.push(r < rows ? p([lon, lat + dLat / 2]) : null);
        midLon.push(c < cols ? p([lon + dLon / 2, lat]) : null);
      }
    }
    const at = (r, c) => corner[r * (cols + 1) + c];
    const straight = (a, b, m) => {
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const len = Math.hypot(ex, ey);
      return Math.hypot(m[0] - (a[0] + b[0]) / 2, m[1] - (a[1] + b[1]) / 2) <= 0.2 * len + 1e-9;
    };
    // The projection's rotation and spherical clip on an identity projection: it outputs the clipped rings in
    // rotated degrees (y down), which the rotation's inverse takes back to the Earth.
    const clip = d3.geoProjection((x, y) => [x, y]).scale(1 / RAD).translate([0, 0])
      .rotate(p.rotate()).preclip(p.preclip()).precision(0);
    let ring, rings;
    const sink = clip.stream({
      polygonStart() {}, polygonEnd() {}, sphere() {},
      lineStart() { ring = []; },
      lineEnd() { if (ring.length > 2) rings.push(ring); },
      point(x, y) { ring.push(rot.invert([x, -y])); },
    });
    for (let r = 0; r < rows; r++) {
      const lat0 = -90 + r * dLat, lat1 = lat0 + dLat;
      for (let c = 0; c < cols; c++) {
        const lon0 = -180 + c * dLon, lon1 = lon0 + dLon;
        const q = [[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0]];
        const xy = [at(r, c), at(r + 1, c), at(r + 1, c + 1), at(r, c + 1)];
        const k = r * (cols + 1) + c;
        const mids = [midLat[k], midLon[k + cols + 1], midLat[k + 1], midLon[k]];
        const whole = mids.every((m, i) => straight(xy[i], xy[(i + 1) % 4], m));
        if (whole) {
          emit(q.map((g, i) => [xy[i][0], -xy[i][1], ...toVec(g)]));
          continue;
        }
        clipped++;
        rings = [];
        d3.geoStream({ type: 'Polygon', coordinates: [[...q, q[0]]] }, sink);
        for (const g of rings) {
          // A piece can be concave where a face corner pokes into the cell, so cut it into triangles, and pick
          // each triangle's sides of the cuts by its own centre, which is always inside the piece.
          const flat = g.map(([lon, lat]) => [lon - 360 * Math.round((lon - (lon0 + lon1) / 2) / 360), lat]);
          for (const tri of earClip(flat)) {
            const pts = tri.map((i) => g[i]);
            const centre = toLonLat(pts.map(toVec).reduce((a, v) => a.map((x, i) => x + v[i]), [0, 0, 0]));
            const pc = p(centre);
            emit(pts.map((pt) => vertex(pt, centre, pc)));
          }
        }
      }
    }
  }

  const vertices = Float32Array.from(out);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < vertices.length; i += 5) {
    minX = Math.min(minX, vertices[i]);
    maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    maxY = Math.max(maxY, vertices[i + 1]);
  }
  return { vertices, count: vertices.length / 5, minX, maxX, minY, maxY, clipped, centreLon: -p.rotate()[0] };
}
