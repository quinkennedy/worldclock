// Spec 11d: the piece as a patchwork of continents and oceans, each in its own Chamberlin trimetric projection,
// exploded on a world base map. A design prototype: the scene is drawn into an offscreen equirectangular texture
// (11a's scene.js, decision 13), and each piece is a mesh that looks the scene up on the sphere and keeps only its
// own region's cells. The patchwork values are in settings.json and the left panel; the scene reads the piece's
// ../../config.json, with any values in settings.json's `scene` block merged over it (as 11a).
import * as clock from '../../js/clock.js';
import { hexToRgb } from '../../js/config.js';
import { sunDirection } from '../../js/sun.js';
import { moonPosition } from '../../js/moon.js';
import { createProgram } from '../../js/gl.js';
import { fetchText, fetchJson, landMask, loadSceneSources, createScene } from '../11-orange-peel/scene.js';
import { labelLand } from '../11-orange-peel/gores.js';
import { assignDeep } from '../11-orange-peel/gui.js';
import {
  regionLabels, regionShapes, pieceAnchor, pieceMesh, greatCircle, baseProjection, labelsToMasks, SHAPE_MODES,
  landmassAreas, worldOcean, shapeSources, shapeMasks, piecePlacer, pageRect, pageMesh, BASES, packRects, equalPages,
  centroidOf,
} from './regions.js';
import { createPatchworkGui } from './gui.js';

const FRAME_SLACK_MS = 4; // as js/main.js
const MAX_SCENE_WIDTH = 4096; // as 11a's decision 16
const ARC_SEGMENTS = 32;      // per control-triangle edge in the overlay
// Pinned, as 11c (decision 12).
const D3 = [
  'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm',
  'https://cdn.jsdelivr.net/npm/d3-geo-projection@4.0.0/+esm',
];

// The piece's ?t= needs ?gui; the prototype always has its panel.
const params = new URLSearchParams(location.search);
params.set('gui', '');
clock.initFromUrl(params);

const canvas = document.getElementById('map');

const state = {
  config: null,
  settings: null,
  sources: null,
  gl: null,
  lost: false,
  d3: null,
  scene: null,        // scene.js
  pieceProg: null,
  overlayProg: null,
  // CPU side, kept across context loss.
  mask: null,         // land > 0.5 per cell
  land: null,         // { labels, count } from 11a's labelLand
  w: 0, h: 0,
  defaultCentres: null, // centroids of the polygon regions: Voronoi's default centres (decision 10)
  coast: null,        // coast-mode labels: what the spec 11e shapes are fitted to
  areas: null,        // km² per landmass
  ocean: null,        // world-ocean water per cell
  sources: null,      // { key, pts } per region, from shapeSources
  regions: null,      // { key, masks, shapes, version }
  // GL side.
  labelTex: null,
  labelKey: '',
  pieces: [],         // per region: { key, vao, vbo, count, bounds, overlay: { vao, vbo, lines, points } }
  pages: [],          // per continent (spec 11g): { key, list: [{ vao, vbo, count, rect, anchor, overlay }] }
  fps: { value: 0 },
  stats: { scene: '', regions: '', notes: '' },
  gui: null,
  guiVisible: true,
};

// --- regions (decisions 10 and 11) -----------------------------------------------------

const centreOf = (i) => state.settings.regions[i].centre ?? state.defaultCentres[i];

// Each region's land (continents, small islands left out) or world-ocean water (oceans), as points: what the spec
// 11e shapes hold and what the spec 11g pages frame.
function ensureSources() {
  const s = state.settings;
  if (state.sources?.key !== s.minIslandKm2) {
    state.sources = { key: s.minIslandKm2, pts: shapeSources(state.coast, s.regions, state.mask, state.land,
      state.areas, state.ocean, state.w, state.h, s.minIslandKm2) };
  }
  return state.sources.pts;
}

function ensureRegions() {
  const s = state.settings;
  const shaped = SHAPE_MODES.includes(s.regionMode);
  const centres = s.regionMode === 'voronoi' ? s.regions.map((_, i) => centreOf(i)) : null;
  const key = [s.regionMode, s.meshStepDeg, JSON.stringify(centres),
    shaped ? [s.shapeMarginDeg, s.minIslandKm2] : '',
    s.regionMode === 'triangle' ? JSON.stringify(s.regions.map((r) => r.points)) : ''].join();
  if (state.regions?.key === key) return state.regions;
  const t0 = performance.now();
  let masks;
  state.stats.notes = '';
  if (shaped) {
    // Spec 11e: shapes fitted to the coast-mode regions' land (or world-ocean water), overlapping.
    const fit = shapeMasks(s.regionMode, ensureSources(), s.regions, state.w, state.h, s.shapeMarginDeg);
    masks = fit.masks;
    state.stats.notes = fit.fits.map((f, i) => (f?.note ? `${s.regions[i].name}: ${f.note}` : '')).filter(Boolean)
      .join('; ');
  } else {
    masks = labelsToMasks(regionLabels(s.regionMode, s.regions, state.mask, state.land, state.w, state.h, centres));
  }
  const shapes = regionShapes(masks, s.regions.length, state.w, state.h, s.meshStepDeg);
  state.regions = { key, masks, shapes, version: (state.regions?.version ?? 0) + 1 };
  state.stats.regions = `${(performance.now() - t0).toFixed(0)} ms`;
  return state.regions;
}

function ensureLabelTex() {
  const { gl, regions } = state;
  const key = String(regions.version);
  if (state.labelKey === key) return;
  state.labelKey = key;
  gl.bindTexture(gl.TEXTURE_2D, state.labelTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, state.w, state.h, gl.RED_INTEGER, gl.UNSIGNED_INT, regions.masks);
}

// --- pieces (decisions 8 and 12) ----------------------------------------------------------

function deletePiece(p) {
  const gl = state.gl;
  gl.deleteVertexArray(p.vao);
  gl.deleteBuffer(p.vbo);
  gl.deleteVertexArray(p.overlay.vao);
  gl.deleteBuffer(p.overlay.vbo);
}

function vertexArray(data, layout) {
  const gl = state.gl;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const stride = layout.reduce((a, n) => a + n, 0) * 4;
  let offset = 0;
  layout.forEach((n, loc) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, offset);
    offset += n * 4;
  });
  gl.bindVertexArray(null);
  return { vao, vbo };
}

// The mesh of region i, rebuilt when its points, the regions or the polar threshold change.
function ensurePiece(i) {
  const s = state.settings;
  const r = s.regions[i];
  const shape = state.regions.shapes[i];
  const key = [state.regions.version, JSON.stringify(r.points), s.polarLat].join();
  const old = state.pieces[i];
  if (old?.key === key) return old;
  if (old) deletePiece(old);
  const anchorInfo = pieceAnchor(shape.centroid, s.polarLat);
  const m = pieceMesh(state.d3, r.points, shape, anchorInfo);
  const piece = {
    key, ...vertexArray(m.vertices, [2, 3]), count: m.count, anchor: anchorInfo.anchor, anchorInfo, area: shape.area,
    bounds: [m.minX, m.maxX, m.minY, m.maxY], overlay: controlOverlay(r.points, m.place),
  };
  state.pieces[i] = piece;
  return piece;
}

// The control-point overlay: the three points, then the triangle's great-circle edges, in the piece's coordinates.
function controlOverlay(points, place) {
  const pts = points.map(([lon, lat]) => place(lon, lat));
  const lines = [];
  for (let k = 0; k < 3; k++) {
    for (const [lon, lat] of greatCircle(points[k], points[(k + 1) % 3], ARC_SEGMENTS)) lines.push(...place(lon, lat));
  }
  return { ...vertexArray(new Float32Array([...pts.flat(), ...lines]), [2]), points: 3, arcs: ARC_SEGMENTS + 1 };
}

// Spec 11g: continent i's atlas pages: each a rectangle in its own projection and a mesh of the map around it (the
// map carries on to the page's edge). One page, except with spec 11i's equal pages, where a continent too big for the
// page size is split into several, each its own map. Rebuilt with the piece or when the page settings change.
// unit: what gets pages: a continent ({ id, key, points, anchorInfo, pts }), or a group of them (spec 11j).
function ensurePages(unit) {
  const s = state.settings;
  const { points, anchorInfo, pts } = unit;
  const key = [unit.key, s.page, s.pageMarginDeg, s.minIslandKm2, s.meshStepDeg, s.pageSizeDeg, s.pageOverlapDeg]
    .join();
  const old = state.pages[unit.id];
  if (old?.key === key) return old.list;
  for (const p of old?.list ?? []) {
    state.gl.deleteVertexArray(p.vao);
    state.gl.deleteBuffer(p.vbo);
    state.gl.deleteVertexArray(p.overlay.vao);
    state.gl.deleteBuffer(p.overlay.vbo);
  }
  const place = piecePlacer(state.d3, points, anchorInfo);
  const specs = s.page === 'equal'
    ? equalPages(state.d3, points, anchorInfo, place, pts, s.pageSizeDeg, s.pageOverlapDeg, s.pageMarginDeg,
      s.polarLat)
    : [{ points, anchorInfo, rect: pageRect(place, pts, s.page, s.pageMarginDeg) }];
  const list = specs.map((p) => {
    const pl = p.points === points ? place : piecePlacer(state.d3, p.points, p.anchorInfo);
    const m = pageMesh(pl, p.points, p.rect, s.meshStepDeg);
    return { ...vertexArray(m.vertices, [2, 3]), count: m.count, rect: p.rect, anchor: p.anchorInfo.anchor,
      overlay: controlOverlay(p.points, pl) };
  });
  state.pages[unit.id] = { key, list };
  return list;
}

// Spec 11j: with pageGroups, each group in settings.groups (e.g. Asia's five parts) gets pages as one continent: its
// members' land together, the group's own control points, anchored on the land's centroid. Returns
// { members: Set of region indices, units: [{ id, key, points, anchorInfo, pts, i, area }] }.
function pageGroups() {
  const s = state.settings;
  const members = new Set();
  const units = [];
  if (!s.pageGroups) return { members, units };
  const sources = ensureSources();
  for (const g of s.groups ?? []) {
    const idx = g.members.map((name) => s.regions.findIndex((r) => r.name === name)).filter((k) => k >= 0);
    if (!idx.length) continue;
    idx.forEach((k) => members.add(k));
    const pts = idx.flatMap((k) => sources[k]);
    const anchorInfo = pieceAnchor(centroidOf(pts), s.polarLat);
    units.push({ id: `group:${g.name}`, key: [JSON.stringify(g.points), JSON.stringify(g.members), s.polarLat,
      s.minIslandKm2].join(), points: g.points, anchorInfo, pts, i: idx[0],
    area: idx.reduce((a, k) => a + (state.regions.shapes[k]?.area ?? 0), 0) });
  }
  return { members, units };
}

// --- GL setup -------------------------------------------------------------------

function getContext() {
  const gl = canvas.getContext('webgl2', {
    antialias: true, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 not available');
  return gl;
}

function initGL() {
  const gl = state.gl;
  const s = state.sources;
  state.scene = createScene(gl, s, state.config);
  state.pieceProg = createProgram(gl, s.pieceVert, s.pieceFrag);
  state.overlayProg = createProgram(gl, s.overlayVert, s.overlayFrag);
  state.labelTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, state.labelTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32UI, state.w, state.h); // a bit per region
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  state.labelKey = '';
  state.pieces = [];
  state.pages = [];
}

// --- sizing ---------------------------------------------------------------------

let cssW = 0, cssH = 0, devW = 0, devH = 0;

function applySize() {
  const w = devW || Math.round(cssW * devicePixelRatio);
  const h = devH || Math.round(cssH * devicePixelRatio);
  if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
    canvas.width = w;
    canvas.height = h;
  }
}

const resizeObserver = new ResizeObserver(([entry]) => {
  cssW = entry.contentRect.width;
  cssH = entry.contentRect.height;
  const dev = entry.devicePixelContentBoxSize?.[0];
  devW = dev ? dev.inlineSize : 0;
  devH = dev ? dev.blockSize : 0;
  applySize();
});

// --- drawing --------------------------------------------------------------------

// Debug tint per region: hues spread by the golden ratio; continents brighter than oceans.
function tintColour(i, kind) {
  const hue = (i * 0.618034) % 1;
  const v = kind === 'continent' ? 0.95 : 0.6, sat = kind === 'continent' ? 0.55 : 0.35;
  const f = (n) => {
    const k = (n + hue * 6) % 6;
    return v - v * sat * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

function draw(frameMs) {
  const { gl, settings: s } = state;
  const now = clock.simNow();
  const sunDir = sunDirection(now);
  const moon = moonPosition(now, sunDir);

  ensureRegions();
  ensureLabelTex();
  const base = baseProjection(state.d3, s.base);

  // Layout (decisions 3, 8 and 15): each anchor on the base map (y up), pieces scaled by explode about it, the whole
  // fitted inside the margin. With hideOceans, only the continents are drawn, and the fit is to them. Spec 11g: with
  // atlas pages, each continent is its page instead (no oceans).
  const pages = s.page !== 'none';
  const groups = pages ? pageGroups() : { members: new Set(), units: [] };
  const placed = s.regions.flatMap((r, i) => {
    if ((s.hideOceans || pages) && r.kind === 'ocean') return [];
    const piece = ensurePiece(i);
    const at = (anchor) => {
      const [bx, by] = base(anchor);
      return { x: bx, y: -by };
    };
    if (!pages) return [{ i, piece, page: null, kind: r.kind, ...at(piece.anchor), bounds: piece.bounds }];
    if (groups.members.has(i)) return [];
    const unit = { id: i, key: piece.key, points: r.points, anchorInfo: piece.anchorInfo, pts: ensureSources()[i] };
    return ensurePages(unit).map((page) => ({ i, piece, page, kind: r.kind, ...at(page.anchor), bounds: page.rect }));
  });
  for (const unit of groups.units) {
    for (const page of ensurePages(unit)) {
      const [bx, by] = base(page.anchor);
      placed.push({ i: unit.i, piece: { area: unit.area }, page, kind: 'continent', x: bx, y: -by, bounds: page.rect });
    }
  }
  // Spec 11h: the packed base moves the pieces (or pages) apart so none overlap at this explode, with packGap (a
  // fraction of the base map's width) between them.
  if (BASES[s.base].pack) {
    const gap = s.packGap * 2 * Math.abs(base([180, 0])[0]);
    const pos = packRects(placed.map((q) => ({ x: q.x, y: q.y, b: q.bounds.map((v) => v * s.explode) })), gap);
    placed.forEach((q, k) => { [q.x, q.y] = pos[k]; });
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const { bounds: b, x, y } of placed) {
    minX = Math.min(minX, x + s.explode * b[0]);
    maxX = Math.max(maxX, x + s.explode * b[1]);
    minY = Math.min(minY, y + s.explode * b[2]);
    maxY = Math.max(maxY, y + s.explode * b[3]);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const W = canvas.width, H = canvas.height;
  const px = Math.min(W * (1 - 2 * s.margin) / (maxX - minX), H * (1 - 2 * s.margin) / (maxY - minY));

  // The scene: about the pieces' px per radian times 2π across, capped (as 11a's decision 16).
  const sceneW = Math.max(256, Math.min(MAX_SCENE_WIDTH, 2 * Math.ceil(px * s.explode * Math.PI * s.sceneScale)));
  state.scene.render(frameMs, now, sunDir, moon, sceneW, s.mipmaps);
  state.stats.scene = state.scene.stats.size;

  // Decision 9: oceans under continents, bigger pieces under smaller ones.
  placed.sort((a, b) => (a.kind === b.kind ? b.piece.area - a.piece.area : a.kind === 'ocean' ? -1 : 1));

  gl.viewport(0, 0, W, H);
  const bg = hexToRgb(s.background);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const p = state.pieceProg;
  const u = p.uniforms;
  gl.useProgram(p.program);
  gl.uniform2f(u.uScale, 2 * px / W, 2 * px / H);
  gl.uniform1f(u.uExplode, s.explode);
  gl.uniform1f(u.uSoft, s.edgeSoftness);
  gl.uniform1f(u.uTintAmount, s.tint);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.scene.target.tex);
  gl.uniform1i(u.uScene, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.labelTex);
  gl.uniform1i(u.uLabels, 1);
  gl.uniform1i(u.uPage, pages ? 1 : 0);
  for (const { i, piece, page, kind, x, y } of placed) {
    gl.uniform2f(u.uOffset, x - cx, y - cy);
    gl.uniform1ui(u.uRegion, i);
    gl.uniform3fv(u.uTint, tintColour(i, kind));
    const mesh = page ?? piece;
    if (page) gl.uniform4fv(u.uRect, page.rect);
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  if (s.showPoints) {
    const o = state.overlayProg;
    const ou = o.uniforms;
    gl.useProgram(o.program);
    gl.uniform2f(ou.uScale, 2 * px / W, 2 * px / H);
    gl.uniform1f(ou.uExplode, s.explode);
    gl.uniform1f(ou.uPointSize, 6 * devicePixelRatio);
    gl.uniform3fv(ou.uColor, hexToRgb(s.pointColor));
    for (const { piece, page, x, y } of placed) {
      const ov = (page ?? piece).overlay;
      gl.uniform2f(ou.uOffset, x - cx, y - cy);
      gl.bindVertexArray(ov.vao);
      gl.drawArrays(gl.POINTS, 0, ov.points);
      for (let k = 0; k < 3; k++) gl.drawArrays(gl.LINE_STRIP, ov.points + k * ov.arcs, ov.arcs);
    }
  }
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
}

// --- render loop: one rAF chain, capped at render.fps ---------------------------

let raf = 0;
let lastFrame = 0;

function frame(frameMs) {
  raf = requestAnimationFrame(frame);
  const interval = 1000 / state.config.render.fps;
  if (lastFrame && frameMs - lastFrame < interval - FRAME_SLACK_MS) return;
  if (lastFrame) state.fps.value += (1000 / Math.max(1, frameMs - lastFrame) - state.fps.value) * 0.1;
  lastFrame = frameMs;
  draw(frameMs);
  if (state.guiVisible) state.gui?.tick();
}

function run() {
  if (!raf && !state.lost) raf = requestAnimationFrame(frame);
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
}

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  state.lost = true;
  stop();
});

canvas.addEventListener('webglcontextrestored', () => {
  state.lost = false;
  initGL();
  run();
});

// --- start ----------------------------------------------------------------------

function showError(err) {
  console.error(err);
  document.getElementById('error').textContent = String(err?.message ?? err);
}

async function start() {
  const [config, settings, sceneSources, pieceVert, pieceFrag, overlayVert, overlayFrag, d3Modules] =
    await Promise.all([
      fetchJson('../../config.json'),
      fetchJson('settings.json'),
      loadSceneSources(),
      fetchText('shaders/piece.vert'),
      fetchText('shaders/piece.frag'),
      fetchText('shaders/overlay.vert'),
      fetchText('shaders/overlay.frag'),
      Promise.all(D3.map((url) => import(url))),
    ]);
  state.d3 = Object.assign({}, ...d3Modules);
  const baseConfig = structuredClone(config);
  assignDeep(config, settings.scene ?? {});
  delete settings.scene;

  // Any scalar settings key in the URL overrides settings.json, e.g. ?regionMode=voronoi&base=equalEarth.
  for (const [k, v] of Object.entries(settings)) {
    if (!params.has(k) || (v && typeof v === 'object')) continue;
    const raw = params.get(k);
    settings[k] = typeof v === 'number' ? Number(raw) : typeof v === 'boolean' ? raw !== 'false' : raw;
  }
  state.config = config;
  state.settings = settings;
  state.sources = { ...sceneSources, pieceVert, pieceFrag, overlayVert, overlayFrag };

  const { land } = sceneSources;
  state.w = land.width;
  state.h = land.height;
  const t0 = performance.now();
  state.mask = landMask(land);
  state.land = labelLand(state.mask, state.w, state.h);
  const polygons = labelsToMasks(regionLabels('polygons', settings.regions, state.mask, state.land, state.w, state.h));
  state.defaultCentres = regionShapes(polygons, settings.regions.length, state.w, state.h, 1).map((sh) => sh.centroid);
  // Spec 11e's inputs: the coast-mode regions, landmass areas and the world ocean.
  state.coast = regionLabels('coast', settings.regions, state.mask, state.land, state.w, state.h);
  state.areas = landmassAreas(state.land, state.w, state.h);
  state.ocean = worldOcean(labelLand(state.mask.map((v) => 1 - v), state.w, state.h), state.w, state.h);
  console.log(`patchwork: landmasses, polygon centroids, coast regions and the world ocean in ${
    (performance.now() - t0).toFixed(0)} ms`);

  state.gl = getContext();
  initGL();

  try {
    resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    resizeObserver.observe(canvas);
  }
  run();

  state.gui = await createPatchworkGui({
    config, baseConfig, settings, water: state.scene.water, fps: state.fps, stats: state.stats,
    defaultCentre: (i) => state.defaultCentres[i],
    onVisibility(visible) { state.guiVisible = visible; },
  });
}

start().catch(showError);
