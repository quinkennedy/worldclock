// Spec 11d: the regions (which map cell belongs to which piece) and each piece's Chamberlin trimetric mesh. Pure
// functions, checked in Node; `d3` is d3-geo and d3-geo-projection merged into one object.
//
// Grids are land.png's: w×h cells, row 0 = 90°N, column 0 = 180°W, cell centres at half steps. A label grid holds a
// region index (0…n−1) per cell, or NONE. A mask grid (Uint32, since spec 11f) holds a bit per region, so regions
// can overlap (spec 11e); the exclusive modes give one bit per cell.

export const NONE = 255;
const RAD = Math.PI / 180;

export const MODES = {
  coast: 'Coastlines + cuts', polygons: 'Polygons', voronoi: 'Voronoi',
  // Spec 11e: simple overlapping shapes, each holding all of its region's land (or ocean).
  hull: 'Convex hulls (overlap)', cap: 'Circles (overlap)', triangle: 'Control triangles (overlap)',
};
export const SHAPE_MODES = ['hull', 'cap', 'triangle'];
const EARTH_KM = 6371;

const toVec = (lon, lat) => {
  const l = lon * RAD, p = lat * RAD;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};
const toLonLat = ([x, y, z]) => [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD];
const cellLat = (y, h) => 90 - (y + 0.5) * 180 / h;
const cellLon = (x, w) => -180 + (x + 0.5) * 360 / w;

// --- polygons -------------------------------------------------------------------

// Draws polygons ([[lon, lat], …], even-odd, longitudes may run past ±180 and wrap) into `labels` with the given
// values, in order, so later ones overwrite earlier ones. A cell is inside when its centre is.
export function rasterPolygons(labels, w, h, polygons, values) {
  const xs = [];
  polygons.forEach((poly, k) => {
    const value = values[k];
    for (let y = 0; y < h; y++) {
      const lat = cellLat(y, h);
      xs.length = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [x0, y0] = poly[j], [x1, y1] = poly[i];
        if ((y0 > lat) !== (y1 > lat)) xs.push(x0 + (lat - y0) / (y1 - y0) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        // Columns whose centre lon is in [xs[i], xs[i+1]).
        const c0 = Math.ceil((xs[i] + 180) * w / 360 - 0.5);
        const c1 = Math.ceil((xs[i + 1] + 180) * w / 360 - 0.5);
        for (let c = c0; c < c1 && c < c0 + w; c++) labels[y * w + (((c % w) + w) % w)] = value;
      }
    }
  });
  return labels;
}

// Every NONE cell takes the label of the nearest labelled cell: a breadth-first search over the grid (4-neighbours,
// wrapping at ±180°), from all labelled cells at once. Returns a new grid.
export function fillNearest(labels, w, h) {
  const out = Uint8Array.from(labels);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  for (let i = 0; i < out.length; i++) if (out[i] !== NONE) queue[tail++] = i;
  if (!tail) return out;
  while (head < tail) {
    const i = queue[head++];
    const y = (i / w) | 0, x = i - y * w;
    const v = out[i];
    const n0 = y * w + (x + 1) % w, n1 = y * w + (x + w - 1) % w;
    if (out[n0] === NONE) { out[n0] = v; queue[tail++] = n0; }
    if (out[n1] === NONE) { out[n1] = v; queue[tail++] = n1; }
    if (y > 0 && out[i - w] === NONE) { out[i - w] = v; queue[tail++] = i - w; }
    if (y < h - 1 && out[i + w] === NONE) { out[i + w] = v; queue[tail++] = i + w; }
  }
  return out;
}

// --- region labels (decision 10) ------------------------------------------------------

// The region grid for a mode. regions: settings' list ({ kind: 'continent'|'ocean', polygon, centre }). mask: land
// > 0.5 per cell; land: { labels, count } from 11a's labelLand. centres: [lon, lat] per region, for Voronoi.
export function regionLabels(mode, regions, mask, land, w, h, centres) {
  if (mode === 'voronoi') return voronoiLabels(centres, w, h);
  const ids = (kind) => regions.map((r, i) => (r.kind === kind ? i : -1)).filter((i) => i >= 0);
  const oceans = ids('ocean'), continents = ids('continent');
  const raster = (list) => rasterPolygons(new Uint8Array(w * h).fill(NONE), w, h,
    list.map((i) => regions[i].polygon), list);
  const oceanRaw = raster(oceans);
  const contRaw = raster(continents);

  if (mode === 'polygons') {
    for (let i = 0; i < contRaw.length; i++) if (contRaw[i] === NONE) contRaw[i] = oceanRaw[i];
    return fillNearest(contRaw, w, h);
  }

  // Coastlines + cuts. Water: the ocean polygon it's in, else the nearest. Land: the continent polygon it's in,
  // else its landmass's majority continent, else the nearest continent.
  const ocean = fillNearest(oceanRaw, w, h);
  const contNear = fillNearest(contRaw, w, h);
  const n = regions.length;
  const votes = new Uint32Array((land.count + 1) * n);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] && contRaw[i] !== NONE) votes[land.labels[i] * n + contRaw[i]]++;
  }
  const majority = new Uint8Array(land.count + 1).fill(NONE);
  for (let m = 1; m <= land.count; m++) {
    let best = 0;
    for (let r = 0; r < n; r++) {
      if (votes[m * n + r] > best) { best = votes[m * n + r]; majority[m] = r; }
    }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) {
    if (!mask[i]) out[i] = ocean[i];
    else if (contRaw[i] !== NONE) out[i] = contRaw[i];
    else out[i] = majority[land.labels[i]] !== NONE ? majority[land.labels[i]] : contNear[i];
  }
  return out;
}

// Each cell to the nearest centre (largest dot product).
function voronoiLabels(centres, w, h) {
  const c = centres.map(([lon, lat]) => toVec(lon, lat));
  const cosLon = new Float64Array(w), sinLon = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    cosLon[x] = Math.cos(cellLon(x, w) * RAD);
    sinLon[x] = Math.sin(cellLon(x, w) * RAD);
  }
  const out = new Uint8Array(w * h);
  const a = new Float64Array(c.length), b = new Float64Array(c.length), z = new Float64Array(c.length);
  for (let y = 0; y < h; y++) {
    const p = cellLat(y, h) * RAD, cp = Math.cos(p), sp = Math.sin(p);
    for (let k = 0; k < c.length; k++) {
      a[k] = c[k][0] * cp;
      b[k] = c[k][1] * cp;
      z[k] = c[k][2] * sp;
    }
    for (let x = 0; x < w; x++) {
      let best = -2, bi = 0;
      for (let k = 0; k < c.length; k++) {
        const d = a[k] * cosLon[x] + b[k] * sinLon[x] + z[k];
        if (d > best) { best = d; bi = k; }
      }
      out[y * w + x] = bi;
    }
  }
  return out;
}

// --- region shapes ------------------------------------------------------------------

// One bit per cell from a label grid.
export function labelsToMasks(labels) {
  const masks = new Uint32Array(labels.length);
  for (let i = 0; i < labels.length; i++) if (labels[i] !== NONE) masks[i] = 2 ** labels[i];
  return masks;
}

// Per region: area (steradians), centroid ([lon, lat], area-weighted, from the summed unit vectors) and the cells
// of a coarse step° grid it touches (Uint8Array, (180/step)×(360/step), row 0 = 90°N). masks: a mask grid.
export function regionShapes(masks, n, w, h, step) {
  const cw = Math.round(360 / step), ch = Math.round(180 / step);
  const shapes = Array.from({ length: n }, () => ({ area: 0, sum: [0, 0, 0], coarse: new Uint8Array(cw * ch) }));
  const cellArea = (2 * Math.PI / w) * (Math.PI / h);
  const cosLon = new Float64Array(w), sinLon = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    cosLon[x] = Math.cos(cellLon(x, w) * RAD);
    sinLon[x] = Math.sin(cellLon(x, w) * RAD);
  }
  for (let y = 0; y < h; y++) {
    const p = cellLat(y, h) * RAD, cp = Math.cos(p), sp = Math.sin(p);
    const cy = Math.min(ch - 1, Math.floor(y * ch / h));
    const a = cp * cellArea;
    for (let x = 0; x < w; x++) {
      let m = masks[y * w + x];
      if (!m) continue;
      const cx = cy * cw + Math.min(cw - 1, Math.floor(x * cw / w));
      for (let r = 0; m && r < n; r++, m >>>= 1) {
        if (!(m & 1)) continue;
        const s = shapes[r];
        s.area += a;
        s.sum[0] += a * cp * cosLon[x];
        s.sum[1] += a * cp * sinLon[x];
        s.sum[2] += a * sp;
        s.coarse[cx] = 1;
      }
    }
  }
  for (const s of shapes) {
    s.centroid = toLonLat(s.sum);
    delete s.sum;
    s.cw = cw;
    s.ch = ch;
  }
  return shapes;
}

// --- overlapping shapes (spec 11e) ---------------------------------------------------------

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const angleTo = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
const sumVecs = (pts) => norm(pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]));
// The centroid of unit vectors, as [lon, lat].
export const centroidOf = (pts) => toLonLat(sumVecs(pts));
const subsample = (pts, n) => pts.filter((_, k) => k % Math.ceil(pts.length / n) === 0);

// Area of each landmass (11a's labels), km².
export function landmassAreas(land, w, h) {
  const area = new Float64Array(land.count + 1);
  const cellKm2 = (2 * Math.PI / w) * (Math.PI / h) * EARTH_KM * EARTH_KM;
  for (let y = 0; y < h; y++) {
    const a = Math.cos(cellLat(y, h) * RAD) * cellKm2;
    for (let x = 0; x < w; x++) area[land.labels[y * w + x]] += a;
  }
  area[0] = 0;
  return area;
}

// The world ocean: water cells in the largest 8-connected body of water, so lakes and closed seas are left out.
// water: 11a's labelLand run on the inverted land mask.
export function worldOcean(water, w, h) {
  const counts = new Uint32Array(water.count + 1);
  for (let i = 0; i < water.labels.length; i++) counts[water.labels[i]]++;
  let best = 1;
  for (let k = 2; k <= water.count; k++) if (counts[k] > counts[best]) best = k;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = water.labels[i] === best ? 1 : 0;
  return out;
}

// The points each shape must hold, per region, as unit vectors of the step° grid cells holding any: a continent's
// land in coast mode (landmasses under minIslandKm2 left out), an ocean's world-ocean water in coast mode.
export function shapeSources(coast, regions, mask, land, areas, ocean, w, h, minIslandKm2, step = 0.25) {
  const cw = Math.round(360 / step), ch = Math.round(180 / step);
  const marks = regions.map(() => new Uint8Array(cw * ch));
  for (let y = 0; y < h; y++) {
    const cy = Math.min(ch - 1, Math.floor(y * ch / h));
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = coast[i];
      const keep = regions[r].kind === 'continent' ? mask[i] && areas[land.labels[i]] >= minIslandKm2 : ocean[i];
      if (keep) marks[r][cy * cw + Math.min(cw - 1, Math.floor(x * cw / w))] = 1;
    }
  }
  return marks.map((m) => {
    const pts = [];
    for (let k = 0; k < m.length; k++) {
      if (!m[k]) continue;
      const cy = (k / cw) | 0, cx = k - cy * cw;
      pts.push(toVec(-180 + (cx + 0.5) * step, 90 - (cy + 0.5) * step));
    }
    return pts;
  });
}

// The smallest cap holding pts, approximately (Badoiu-Clarkson: step towards the farthest point, shrinking steps).
function enclosingCap(pts, start) {
  let c = start;
  for (let k = 1; k <= 2000; k++) {
    let far = pts[0], fd = 2;
    for (const p of pts) {
      const d = dot(p, c);
      if (d < fd) { fd = d; far = p; }
    }
    c = norm(c.map((v, j) => v + (far[j] - v) / (k + 1)));
  }
  let r = 0;
  for (const p of pts) r = Math.max(r, angleTo(p, c));
  return { centre: c, radius: r };
}

// Most edges a hull keeps; past this it becomes a polygon of MAX_EDGES supporting great circles (it still holds every
// point, a little looser). Rings like the Southern Ocean would otherwise keep every point as a vertex.
const MAX_EDGES = 48;

// Spherical convex hull of pts, through the gnomonic projection about `centre` (great circles map to straight
// lines). Returns { verts, normals } (inward edge normals: p is inside when dot(p, n) ≥ 0 for every n), or null if a
// point is within 1° of the centre's horizon.
function sphericalHull(pts, centre) {
  const e1 = norm(cross(Math.abs(centre[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], centre));
  const e2 = cross(centre, e1);
  const flat = [];
  for (const p of pts) {
    const d = dot(p, centre);
    if (d < Math.sin(RAD)) return null;
    flat.push([dot(p, e1) / d, dot(p, e2) / d]);
  }
  flat.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  const hull = chain(flat).concat(chain(flat.slice().reverse()));
  const verts = hull.map(([x, y]) => norm([0, 1, 2].map((j) => centre[j] + x * e1[j] + y * e2[j])));
  if (hull.length <= MAX_EDGES) return { verts, normals: edgeNormals(verts, centre) };
  // Supporting lines a·x + b·y = h in MAX_EDGES directions: on the sphere, great circles with normal h·c − a·e1 − b·e2.
  const normals = [];
  for (let k = 0; k < MAX_EDGES; k++) {
    const a = Math.cos(2 * Math.PI * k / MAX_EDGES), b = Math.sin(2 * Math.PI * k / MAX_EDGES);
    let hMax = -Infinity;
    for (const [x, y] of hull) hMax = Math.max(hMax, a * x + b * y);
    normals.push(norm([0, 1, 2].map((j) => hMax * centre[j] - a * e1[j] - b * e2[j])));
  }
  return { verts, normals };
}

// Inward normals of a convex spherical polygon's edges (p is inside when dot(p, n) ≥ 0 for every n).
function edgeNormals(verts, inside) {
  return verts.map((v, k) => {
    const n = norm(cross(v, verts[(k + 1) % verts.length]));
    return dot(n, inside) >= 0 ? n : n.map((x) => -x);
  });
}

// Fits one region's shape to its points. Returns { kind: 'cap', centre, cosR } or { kind: 'poly', normals, sinMargin,
// bound: { centre, cosR } (a quick reject) }, with `note` set when it had to fall back.
function fitShape(mode, pts, points, margin) {
  if (!pts.length) return null;
  const mean = sumVecs(pts);
  let hull = sphericalHull(pts, mean);
  if (!hull) hull = sphericalHull(pts, enclosingCap(subsample(pts, 4000), mean).centre);
  // The hull's vertices stand in for all the points where they can (a convex shape holds the hull iff it holds them).
  const key = hull?.verts ?? subsample(pts, 4000);
  const cap = enclosingCap(key, mean);
  const bound = (verts) => {
    let r = 0;
    for (const v of verts) r = Math.max(r, angleTo(v, cap.centre));
    return { centre: cap.centre, cosR: Math.cos(Math.min(Math.PI, r + 2 * margin)) };
  };
  let note = '';
  if (mode === 'hull' && !hull) note = 'not inside a hemisphere: drawn as a circle';
  if (mode === 'cap' || (mode === 'hull' && !hull)) {
    return { kind: 'cap', centre: cap.centre, cosR: Math.cos(Math.min(Math.PI, cap.radius + margin)), note };
  }
  if (mode === 'hull') {
    return { kind: 'poly', normals: hull.normals, sinMargin: Math.sin(margin), bound: bound(hull.verts), note };
  }
  // Triangle: the control triangle scaled about its centre g (vertices g + t·(A − g), renormalised), with the smallest
  // t that holds every point (so it can also shrink), by bisection. A region no triangle holds (the Pacific halves
  // span nearly a hemisphere) falls back to its convex hull, or its circle: pushing the triangle's edges out instead
  // covered over half the globe, where Chamberlin folds over itself.
  const tri = points.map(([lon, lat]) => toVec(lon, lat));
  const g = sumVecs(tri);
  const at = (t) => tri.map((a) => norm(a.map((v, j) => g[j] + t * (v - g[j]))));
  const holds = (t) => {
    const ns = edgeNormals(at(t), g);
    return key.every((p) => ns.every((n) => dot(p, n) >= 0));
  };
  let lo = 0.02, hi = 1;
  while (!holds(hi) && hi < 64) { lo = hi; hi *= 2; }
  if (!holds(hi)) {
    if (hull) {
      return { kind: 'poly', normals: hull.normals, sinMargin: Math.sin(margin), bound: bound(hull.verts),
        note: 'no triangle holds it: drawn as its convex hull' };
    }
    return { kind: 'cap', centre: cap.centre, cosR: Math.cos(Math.min(Math.PI, cap.radius + margin)),
      note: 'no triangle holds it: drawn as a circle' };
  }
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (holds(mid)) hi = mid; else lo = mid;
  }
  const verts = at(hi);
  return { kind: 'poly', normals: edgeNormals(verts, g), sinMargin: Math.sin(margin), bound: bound([...verts, ...key]),
    scale: hi, note };
}

// The mask grid for a shape mode: each region's shape, grown by marginDeg, overlapping freely. sources: from
// shapeSources. Returns { masks, fits }.
export function shapeMasks(mode, sources, regions, w, h, marginDeg) {
  // The grid's cells lie up to ~0.18° from the 0.25° source cells' centres; grow by that too.
  const margin = (marginDeg + 0.2) * RAD;
  const fits = sources.map((pts, r) => fitShape(mode, pts, regions[r].points, margin));
  const masks = new Uint32Array(w * h);
  const cosLon = new Float64Array(w), sinLon = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    cosLon[x] = Math.cos(cellLon(x, w) * RAD);
    sinLon[x] = Math.sin(cellLon(x, w) * RAD);
  }
  fits.forEach((f, r) => {
    if (!f) return;
    const b = f.kind === 'cap' ? f : f.bound;
    const c = b.centre;
    const cLat = Math.asin(c[2]) / RAD, rDeg = Math.acos(b.cosR) / RAD;
    const bit = 2 ** r;
    for (let y = 0; y < h; y++) {
      const lat = cellLat(y, h);
      if (Math.abs(lat - cLat) > rDeg + 0.5) continue;
      const cp = Math.cos(lat * RAD), sp = Math.sin(lat * RAD);
      for (let x = 0; x < w; x++) {
        const p0 = cp * cosLon[x], p1 = cp * sinLon[x];
        if (p0 * c[0] + p1 * c[1] + sp * c[2] < b.cosR) continue;
        if (f.kind === 'poly') {
          let inside = true;
          for (const n of f.normals) {
            if (p0 * n[0] + p1 * n[1] + sp * n[2] < -f.sinMargin) { inside = false; break; }
          }
          if (!inside) continue;
        }
        masks[y * w + x] = (masks[y * w + x] | bit) >>> 0;
      }
    }
  });
  return { masks, fits };
}

// --- Chamberlin pieces (decisions 8 and 12) ---------------------------------------------

// d3's Chamberlin only works with its three points in one winding (clockwise seen from outside the globe); in the
// other it jumps near the points. Swaps the last two if needed. Returns a projection at scale 1 (radians at the
// centre), translate 0, d3's y down.
export function chamberlin(d3, points) {
  const [a, b, c] = points.map(([lon, lat]) => toVec(lon, lat));
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0])
    + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const p = det > 0 ? [points[0], points[2], points[1]] : points;
  return d3.geoChamberlin(...p.map((q) => [...q])).scale(1).translate([0, 0]);
}

// The anchor (decision 8): [lon, lat] that sits on the base map, and whether the piece is polar (anchored on the
// pole, the prime meridian pointing to the equator).
export function pieceAnchor(centroid, polarLat) {
  if (Math.abs(centroid[1]) >= polarLat) return { anchor: [0, Math.sign(centroid[1]) * 90], polar: true };
  return { anchor: centroid, polar: false };
}

// A piece's projection: (lon, lat) → [x, y] in radians at the piece's centre, the anchor at 0, y up, turned so north
// is up at the anchor (decision 8).
export function piecePlacer(d3, points, anchorInfo) {
  const proj = chamberlin(d3, points);
  const { anchor, polar } = anchorInfo;
  const a = proj(anchor);
  let dir;
  if (polar) {
    // Towards the equator along the prime meridian: up on the south pole, down on the north.
    const s = Math.sign(anchor[1]);
    const q = proj([0, anchor[1] - s * 1]);
    dir = [q[0] - a[0], -(q[1] - a[1])];
    if (s > 0) dir = [-dir[0], -dir[1]];
  } else {
    const q = proj([anchor[0], anchor[1] + 0.1]);
    dir = [q[0] - a[0], -(q[1] - a[1])];
  }
  // Turn dir onto +y.
  const ang = Math.atan2(dir[0], dir[1]);
  const cr = Math.cos(ang), sr = Math.sin(ang);
  const place = (lon, lat) => {
    const p = proj([lon, lat]);
    const x = p[0] - a[0], y = -(p[1] - a[1]);
    return [x * cr - y * sr, x * sr + y * cr];
  };
  return place;
}

// A piece's mesh: the coarse cells its region touches, grown by one cell so the soft edge has room, each projected
// at its corners. Vertices are [x, y, dirX, dirY, dirZ]: x, y from piecePlacer; dir is the point on the unit sphere.
// Also returns the bounds and the placer, for the control-point overlay.
export function pieceMesh(d3, points, shape, anchorInfo) {
  const place = piecePlacer(d3, points, anchorInfo);
  const { coarse, cw, ch } = shape;
  const grown = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (!coarse[y * cw + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= ch) continue;
        for (let dx = -1; dx <= 1; dx++) grown[ny * cw + (x + dx + cw) % cw] = 1;
      }
    }
  }
  return { ...cellMesh(place, grown, cw, ch), place };
}

// The mesh of the cells set in `cells` (a cw×ch grid, row 0 = 90°N), each projected by `place` at its corners.
function cellMesh(place, cells, cw, ch) {
  const step = 360 / cw;
  // Corner (i, j): lon -180 + i·step, lat 90 − j·step; projected once each.
  const corners = new Map();
  const corner = (i, j) => {
    const key = j * (cw + 1) + i;
    let v = corners.get(key);
    if (!v) {
      const lon = -180 + i * step, lat = 90 - j * step;
      const [x, y] = place(lon, lat);
      v = [x, y, ...toVec(lon, lat)];
      corners.set(key, v);
    }
    return v;
  };
  const out = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, skipped = 0;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      if (!cells[j * cw + i]) continue;
      const c = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)];
      if (c.some((v) => !Number.isFinite(v[0]) || !Number.isFinite(v[1]))) { skipped++; continue; }
      for (const k of [0, 1, 2, 0, 2, 3]) out.push(...c[k]);
      for (const v of c) {
        minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
        minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
      }
    }
  }
  return { vertices: new Float32Array(out), count: out.length / 5, minX, maxX, minY, maxY, skipped };
}

// --- atlas pages (spec 11g) -----------------------------------------------------------

const A4 = Math.SQRT2;

// A continent's page, in its piece's coordinates (piecePlacer): the north-up rectangle around its land (unit vectors,
// e.g. from shapeSources) plus marginDeg, then for 'a4' grown to 1:√2, landscape if the land is wider than tall,
// around the same centre. Returns [minX, maxX, minY, maxY].
export function pageRect(place, pts, kind, marginDeg) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    const [x, y] = place(...toLonLat(p));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const m = marginDeg * RAD;
  let w = maxX - minX + 2 * m, h = maxY - minY + 2 * m;
  if (kind === 'a4') {
    if (w >= h) {
      if (w / h > A4) h = w / A4; else w = h * A4;
    } else if (h / w > A4) w = h / A4; else h = w * A4;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return [cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2];
}

// A page's mesh: every coarse cell (step°) within maxDeg of the control triangle's centre that lands on or near the
// page. The fragment shader cuts it to the rectangle; maxDeg keeps out the far side, where Chamberlin folds over.
export function pageMesh(place, points, rect, step, maxDeg = 100) {
  const cw = Math.round(360 / step), ch = Math.round(180 / step);
  const g = sumVecs(points.map(([lon, lat]) => toVec(lon, lat)));
  const cosMax = Math.cos(maxDeg * RAD);
  const pad = 2 * step * RAD;
  const cells = new Uint8Array(cw * ch);
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const lon = -180 + (i + 0.5) * step, lat = 90 - (j + 0.5) * step;
      if (dot(toVec(lon, lat), g) < cosMax) continue;
      const [x, y] = place(lon, lat);
      if (x >= rect[0] - pad && x <= rect[1] + pad && y >= rect[2] - pad && y <= rect[3] + pad) cells[j * cw + i] = 1;
    }
  }
  return cellMesh(place, cells, cw, ch);
}

// Points along the great circle from a to b ([lon, lat]), n segments, as [lon, lat].
export function greatCircle(a, b, n) {
  const va = toVec(...a), vb = toVec(...b);
  const omega = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const s0 = omega ? Math.sin((1 - t) * omega) / Math.sin(omega) : 1 - t;
    const s1 = omega ? Math.sin(t * omega) / Math.sin(omega) : t;
    pts.push(toLonLat([0, 1, 2].map((i) => s0 * va[i] + s1 * vb[i])));
  }
  return pts;
}

// Base map projections (decision 7), at scale 1, translate 0, d3's y down.
export const BASES = {
  robinson: { label: 'Robinson', make: (d3) => d3.geoRobinson() },
  equalEarth: { label: 'Equal Earth', make: (d3) => d3.geoEqualEarth() },
  equirectangular: { label: 'Equirectangular', make: (d3) => d3.geoEquirectangular() },
  // Spec 11h: start from Robinson, then move the pieces apart so none overlap (packRects).
  packed: { label: 'Packed (from Robinson)', make: (d3) => d3.geoRobinson(), pack: true },
};

export function baseProjection(d3, key) {
  return BASES[key].make(d3).scale(1).translate([0, 0]);
}

// --- equal pages (spec 11i) -------------------------------------------------------------

// Three control points around c (unit vector): an equilateral triangle at angular radius rho, one point due north.
function triangleAround(c, rho) {
  const [lon, lat] = toLonLat(c);
  const p = lat * RAD, l = lon * RAD;
  return [0, 120, 240].map((bearing) => {
    const b = bearing * RAD;
    const p2 = Math.asin(Math.sin(p) * Math.cos(rho) + Math.cos(p) * Math.sin(rho) * Math.cos(b));
    const l2 = l + Math.atan2(Math.sin(b) * Math.sin(rho) * Math.cos(p), Math.cos(rho) - Math.sin(p) * Math.sin(p2));
    return [((l2 / RAD + 540) % 360) - 180, p2 / RAD];
  });
}

// A continent as equal A4 pages, longDeg on the long side. place: its piece's projection; pts: its land (unit
// vectors). If its minimal rectangle (plus marginDeg) fits one page, that's one page with the piece's own points,
// centred on it. Otherwise the rectangle is cut into the fewest equal tiles (either orientation) that leave
// overlapDeg of each neighbour on the page, and each tile with land is its own page: its own Chamberlin points
// (triangleAround the tile's land, at 0.85 of its farthest point), anchored on that land's centroid, the page centred
// on it. Returns [{ points, anchorInfo, rect }].
export function equalPages(d3, points, anchorInfo, place, pts, longDeg, overlapDeg, marginDeg, polarLat) {
  const r = pageRect(place, pts, 'minimal', marginDeg);
  const w = r[1] - r[0], h = r[3] - r[2];
  const L = longDeg * RAD, S = L / A4, o = overlapDeg * RAD;
  const grid = (pw, ph) => {
    const cols = w <= pw ? 1 : Math.ceil(w / Math.max(1e-6, pw - 2 * o));
    const rows = h <= ph ? 1 : Math.ceil(h / Math.max(1e-6, ph - 2 * o));
    return { cols, rows, pw, ph };
  };
  const land = grid(L, S), port = grid(S, L);
  const n = (g) => g.cols * g.rows;
  const g = n(land) < n(port) || (n(land) === n(port) && w >= h) ? land : port;
  const pageAt = (cx, cy) => [cx - g.pw / 2, cx + g.pw / 2, cy - g.ph / 2, cy + g.ph / 2];
  if (n(g) === 1) return [{ points, anchorInfo, rect: pageAt((r[0] + r[1]) / 2, (r[2] + r[3]) / 2) }];

  const tiles = Array.from({ length: n(g) }, () => []);
  for (const p of pts) {
    const [x, y] = place(...toLonLat(p));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const cx = Math.min(g.cols - 1, Math.max(0, Math.floor((x - r[0]) / w * g.cols)));
    const cy = Math.min(g.rows - 1, Math.max(0, Math.floor((y - r[2]) / h * g.rows)));
    tiles[cy * g.cols + cx].push(p);
  }
  return tiles.filter((t) => t.length).map((t) => {
    const c = sumVecs(t);
    let rho = 0;
    for (const p of t) rho = Math.max(rho, angleTo(p, c));
    const tri = triangleAround(c, Math.max(2 * RAD, 0.85 * rho));
    const info = pieceAnchor(toLonLat(c), polarLat);
    const tp = piecePlacer(d3, tri, info);
    const b = pageRect(tp, t, 'minimal', 0);
    return { points: tri, anchorInfo: info, rect: pageAt((b[0] + b[1]) / 2, (b[2] + b[3]) / 2) };
  });
}

// --- packing (spec 11h) -----------------------------------------------------------------

// Moves rectangles apart so no two overlap (with `gap` between them), as little as possible, keeping how each pair
// sits on the base map: each pair stays apart along the axis where it's already more separated relative to its size,
// in the same order (left/right or below/above). That's a least-squares problem with linear constraints; it's solved
// by repeatedly pushing each overlapping pair apart, splitting the move by size so small rectangles move more.
// rects: [{ x, y, b: [minX, maxX, minY, maxY] }] (b relative to x, y). Returns [[x, y], …].
export function packRects(rects, gap, iterations = 400) {
  const n = rects.length;
  const pos = rects.map((r) => [r.x, r.y]);
  const area = rects.map((r) => Math.max(1e-9, (r.b[1] - r.b[0]) * (r.b[3] - r.b[2])));
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = rects[i], b = rects[j];
      // Centres of the rectangles (not the anchors), and how far apart they are relative to their half sizes.
      const ax = a.x + (a.b[0] + a.b[1]) / 2, ay = a.y + (a.b[2] + a.b[3]) / 2;
      const bx = b.x + (b.b[0] + b.b[1]) / 2, by = b.y + (b.b[2] + b.b[3]) / 2;
      const rx = Math.abs(bx - ax) / ((a.b[1] - a.b[0] + b.b[1] - b.b[0]) / 2);
      const ry = Math.abs(by - ay) / ((a.b[3] - a.b[2] + b.b[3] - b.b[2]) / 2);
      const axis = rx >= ry ? 0 : 1;
      const lo = (axis === 0 ? ax <= bx : ay <= by) ? i : j; // the one on the left (or below)
      const hi = lo === i ? j : i;
      // pos[hi][axis] − pos[lo][axis] ≥ need.
      const need = rects[lo].b[2 * axis + 1] - rects[hi].b[2 * axis] + gap;
      // Movers split by size: the bigger rectangle moves less.
      const wLo = area[hi] / (area[lo] + area[hi]);
      pairs.push({ axis, lo, hi, need, wLo });
    }
  }
  for (let it = 0; it < iterations; it++) {
    let worst = 0;
    for (const c of pairs) {
      const short = c.need - (pos[c.hi][c.axis] - pos[c.lo][c.axis]);
      if (short <= 0) continue;
      // Only while they also overlap across the other axis; otherwise they're already apart.
      const o = 1 - c.axis, A = rects[c.lo].b, B = rects[c.hi].b;
      if (pos[c.lo][o] + A[2 * o + 1] + gap <= pos[c.hi][o] + B[2 * o]
        || pos[c.hi][o] + B[2 * o + 1] + gap <= pos[c.lo][o] + A[2 * o]) continue;
      worst = Math.max(worst, short);
      pos[c.lo][c.axis] -= short * c.wLo;
      pos[c.hi][c.axis] += short * (1 - c.wLo);
    }
    if (worst < 1e-9) break;
  }
  return pos;
}
