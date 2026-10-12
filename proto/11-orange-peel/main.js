// Spec 11a: the piece cut into orange-peel gores. Spec 11c adds HEALPix gores and whole-world maps (maps.js). A design prototype: the scene is drawn with the piece's own
// shaders into an offscreen equirectangular texture each frame, then remapped onto the gores (decision 1).
// The gore values are in settings.json and the left panel; the scene reads the piece's ../../config.json, with any
// values in settings.json's `scene` block merged over it. The scene drawing itself is in scene.js (spec 11d).
import * as clock from '../../js/clock.js';
import { hexToRgb } from '../../js/config.js';
import { sunDirection, sunPosition } from '../../js/sun.js';
import { moonPosition } from '../../js/moon.js';
import { createProgram, createQuad } from '../../js/gl.js';
import { fetchText, fetchJson, landMask, loadSceneSources, createScene } from './scene.js';
import { goreMesh, goreCentres, labelLand, lonColumn, seamFlags, NATURAL_JOIN_DEG } from './gores.js';
import { MAPS, mapMesh } from './maps.js';
import { createPeelGui, assignDeep } from './gui.js';

const FRAME_SLACK_MS = 4; // as js/main.js
const MAX_SCENE_WIDTH = 4096; // decision 16
const FLAGS_WIDTH = 1024;
// Spec 11c: d3's projections for the whole-world maps, pinned.
const D3 = [
  'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm',
  'https://cdn.jsdelivr.net/npm/d3-geo-projection@4.0.0/+esm',
  'https://cdn.jsdelivr.net/npm/d3-geo-polygon@2.0.1/+esm',
];

// The piece's ?t= needs ?gui; the prototype always has its panel.
const params = new URLSearchParams(location.search);
params.set('gui', '');
clock.initFromUrl(params);

const canvas = document.getElementById('map');

const state = {
  config: null,      // the piece's config.json (scene)
  settings: null,    // this prototype's settings.json (gores)
  sources: null,
  gl: null,
  lost: false,
  // The piece's scene (scene.js); scene.target is the offscreen texture.
  scene: null,
  // Spec 11a.
  peelProg: null,
  mesh: null,        // { vao, count, key, maxX, maxY }
  land: null,        // { labels: Uint32Array, count, w, h } from labelLand, kept across context loss
  labelTex: null,
  flags: null,       // Uint16Array per landmass
  flagsTex: null,
  seamKey: '',
  // Spec 11c.
  d3: null,          // d3-geo, d3-geo-projection and d3-geo-polygon merged
  mapProg: null,
  map: null,         // { vao, vbo, count, key, minX, maxX, minY, maxY, centreLon }
  // Marbles: the Earth as a grid of globes.
  marbleProg: null,
  quad: null,
  fps: { value: 0 },
  stats: { scene: '', landmasses: 0, seams: '' },
  gui: null,
  guiVisible: true,
};

// --- GL setup -------------------------------------------------------------------

// Like js/gl.js's getContext, with a depth buffer for the gores (spill ordering) and MSAA for their edges.
function getContext() {
  const gl = canvas.getContext('webgl2', {
    antialias: true, depth: true, stencil: false, alpha: false, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 not available');
  return gl;
}

function uintTexture(gl, w, h, data) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  if (data instanceof Uint16Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16UI, w, h, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, data);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, w, h, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return tex;
}

function initGL() {
  const gl = state.gl;
  const s = state.sources;
  state.scene = createScene(gl, s, state.config);

  state.peelProg = createProgram(gl, s.peelVert, s.peelFrag);
  state.mapProg = createProgram(gl, s.mapVert, s.mapFrag);
  state.marbleProg = createProgram(gl, s.marblesVert, s.marblesFrag);
  state.quad = createQuad(gl);
  const { labels, count, w, h } = state.land;
  state.labelTex = count < 65536 ? uintTexture(gl, w, h, Uint16Array.from(labels)) : uintTexture(gl, w, h, labels);
  state.flags = new Uint16Array(FLAGS_WIDTH * Math.ceil((count + 1) / FLAGS_WIDTH));
  state.flagsTex = uintTexture(gl, FLAGS_WIDTH, state.flags.length / FLAGS_WIDTH, state.flags);
  state.mesh = null;
  state.map = null;
  state.seamKey = '';
}

// The gore mesh, rebuilt when the projection, count, spill, step, gap or join changes. The mesh always reaches at least
// 1° past the edge so the lens edge is antialiased from both sides.
function ensureMesh() {
  const gl = state.gl;
  const s = state.settings;
  const half = 180 / s.count;
  const extent = half + Math.max(s.spillDeg, 1);
  const key = [s.projection, s.count, s.spillDeg, s.meshStepDeg, s.gapDeg, s.joinDeg, s.joinBlendDeg].join();
  if (state.mesh?.key === key) return state.mesh;
  if (state.mesh) {
    gl.deleteVertexArray(state.mesh.vao);
    gl.deleteBuffer(state.mesh.vbo);
    gl.deleteBuffer(state.mesh.ibo);
  }
  const halfSpacing = (half + 0.5 * s.gapDeg) * Math.PI / 180;
  const m = goreMesh(s.projection, half, extent, s.meshStepDeg,
    { deg: s.joinDeg, blendDeg: s.joinBlendDeg, halfSpacing });
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, m.vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  state.mesh = { vao, vbo, ibo, count: m.indices.length, key, maxX: m.maxX, maxY: m.maxY };
  return state.mesh;
}

// Spec 11c: a whole-world map's mesh, rebuilt when the projection or the step changes (Dymaxion takes a few
// seconds).
function ensureMapMesh() {
  const gl = state.gl;
  const s = state.settings;
  const key = [s.projection, s.meshStepDeg].join();
  if (state.map?.key === key) return state.map;
  if (state.map) {
    gl.deleteVertexArray(state.map.vao);
    gl.deleteBuffer(state.map.vbo);
  }
  const t0 = performance.now();
  const m = mapMesh(state.d3, s.projection, s.meshStepDeg);
  console.log(`orange peel: ${s.projection} mesh, ${m.count / 3} triangles (${m.clipped} cells clipped) in ${
    (performance.now() - t0).toFixed(0)} ms`);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, m.vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 8);
  gl.bindVertexArray(null);
  state.map = { vao, vbo, key, count: m.count, minX: m.minX, maxX: m.maxX, minY: m.minY, maxY: m.maxY,
    centreLon: m.centreLon };
  return state.map;
}

// Decision 12: re-flag the landmasses on the seams when a seam moves to another map column.
function updateSeams(centres) {
  const { gl, land } = state;
  const half = 180 / centres.length;
  const cols = centres.map((c) => lonColumn(c + half, land.w)); // seam j: the east edge of gore j
  const key = cols.join();
  if (key === state.seamKey) return;
  state.seamKey = key;
  seamFlags(state.flags, land.labels, land.w, land.h, cols);
  gl.bindTexture(gl.TEXTURE_2D, state.flagsTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FLAGS_WIDTH, state.flags.length / FLAGS_WIDTH, gl.RED_INTEGER,
    gl.UNSIGNED_SHORT, state.flags);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  state.stats.seams = centres.map((c) => wrap(c + half).toFixed(1)).join(', ');
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

function draw(frameMs) {
  const { gl, settings: s } = state;
  const now = clock.simNow();
  const sunDir = sunDirection(now);
  const moon = moonPosition(now, sunDir);
  if (MAPS[s.projection]) {
    drawMap(frameMs, now, sunDir, moon);
    return;
  }
  if (s.projection === 'marbles') {
    drawMarbles(frameMs, now, sunDir, moon);
    return;
  }

  // Layout (decision 7): true shape, the whole layout with its spill margins fitted inside the margin.
  const mesh = ensureMesh();
  const half = 180 / s.count;
  const spacing = 2 * half * Math.PI / 180 + s.gapDeg * Math.PI / 180;
  const halfW = 0.5 * (s.count - 1) * spacing + mesh.maxX;
  const halfH = mesh.maxY;
  const W = canvas.width, H = canvas.height;
  const px = Math.min(W * (1 - 2 * s.margin) / (2 * halfW), H * (1 - 2 * s.margin) / (2 * halfH)); // px per unit

  // Decision 16: about the gores' px per degree at the equator, capped.
  renderScene(frameMs, now, sunDir, moon, px * Math.PI / 180 * 360);

  const centres = goreCentres(s.count, s.anchor === 'sun' ? s.sunFirstCentre : s.landFirstCentre,
    sunPosition(now).lon, s.anchor);
  updateSeams(centres);

  // The gores.
  const p = state.peelProg;
  const u = p.uniforms;
  gl.viewport(0, 0, W, H);
  const bg = hexToRgb(s.background);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(p.program);
  gl.uniform2f(u.uScale, 2 * px / W, 2 * px / H);
  gl.uniform1f(u.uSpacing, spacing);
  gl.uniform1i(u.uCount, s.count);
  gl.uniform1f(u.uFirstCentre, centres[0]);
  gl.uniform1f(u.uHalf, half);
  gl.uniform1f(u.uSpill, s.spillDeg);
  gl.uniform1f(u.uJoin, Math.max(s.joinDeg, NATURAL_JOIN_DEG[s.projection] ?? 0));
  const bind = (unit, tex, loc) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  };
  bind(0, state.scene.target.tex, u.uScene);
  bind(1, state.scene.landTex, u.uLand);
  bind(2, state.labelTex, u.uLabels);
  bind(3, state.flagsTex, u.uFlags);
  gl.bindVertexArray(mesh.vao);
  gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0, s.count);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
}

// The scene into the offscreen texture, about widthPx wide (decision 16).
function renderScene(frameMs, now, sunDir, moon, widthPx) {
  const gl = state.gl;
  const s = state.settings;
  state.scene.render(frameMs, now, sunDir, moon,
    Math.max(256, Math.min(MAX_SCENE_WIDTH, 2 * Math.ceil(widthPx * s.sceneScale / 2))), s.mipmaps);
  state.stats.scene = state.scene.stats.size;
}

// Spec 11c: a whole-world map, fitted inside the margin. Anchoring turns it about the poles: land, by the panel's
// centre (0 = d3's usual orientation); sun, so the sub-solar meridian sits on the map's central meridian, plus the
// panel's offset.
function drawMap(frameMs, now, sunDir, moon) {
  const { gl, settings: s } = state;
  const map = ensureMapMesh();
  const mapW = map.maxX - map.minX, mapH = map.maxY - map.minY;
  const W = canvas.width, H = canvas.height;
  const px = Math.min(W * (1 - 2 * s.margin) / mapW, H * (1 - 2 * s.margin) / mapH); // px per unit
  // Decision 16, roughly: most of these maps span about 360° across their width; 1.5× for the stretched parts.
  renderScene(frameMs, now, sunDir, moon, 1.5 * px * mapW);

  const offset = s.anchor === 'sun' ? sunPosition(now).lon + s.mapSunCentre - map.centreLon : s.mapLandCentre;
  const p = state.mapProg;
  const u = p.uniforms;
  gl.viewport(0, 0, W, H);
  const bg = hexToRgb(s.background);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(p.program);
  gl.uniform2f(u.uScale, 2 * px / W, 2 * px / H);
  gl.uniform2f(u.uCentre, (map.minX + map.maxX) / 2, (map.minY + map.maxY) / 2);
  gl.uniform1f(u.uLonOffset, offset);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.scene.target.tex);
  gl.uniform1i(u.uScene, 0);
  gl.bindVertexArray(map.vao);
  gl.drawArrays(gl.TRIANGLES, 0, map.count);
  gl.bindVertexArray(null);
  state.stats.seams = '';
}

// Marbles: `count` columns around the Earth (centred as the gores, so anchoring and first centre apply), marbleRows
// rows looking at latitudes from marbleLatDeg down to −marbleLatDeg, each globe seen from marbleDistance Earth radii.
// marbleHex: odd rows half a column east (on screen and on the Earth), in hexagonal cells. Each globe is marbleZoom ×
// its cell across, clipped to the cell. The grid is fitted inside the margin; marbleGap is the space between cells,
// as a fraction of their size.
function drawMarbles(frameMs, now, sunDir, moon) {
  const { gl, settings: s } = state;
  const cols = s.count, rows = Math.max(1, Math.round(s.marbleRows));
  const hex = !!s.marbleHex;
  const W = canvas.width, H = canvas.height;
  const g = s.marbleGap;
  // The grid's size in cells (pitch = 1 + g): a hex grid's odd rows add half a pitch to its width, its rows are
  // √3/2 pitch apart and its cells 2/√3 tall.
  const gridW = (cols - 1) * (1 + g) + (hex && rows > 1 ? 0.5 * (1 + g) : 0) + 1;
  const gridH = hex ? (rows - 1) * (1 + g) * Math.sqrt(3) / 2 + 2 / Math.sqrt(3) : (rows - 1) * (1 + g) + 1;
  const cellPx = Math.min(W * (1 - 2 * s.margin) / gridW, H * (1 - 2 * s.margin) / gridH);
  const zoom = Math.max(0.05, s.marbleZoom);
  const d = Math.max(1.001, s.marbleDistance);
  // Decision 16, roughly: the scene's px per radian at a marble's centre, where it's most magnified.
  renderScene(frameMs, now, sunDir, moon, 2 * Math.PI * (zoom * cellPx / 2) / Math.sqrt(1 - 1 / (d * d)));

  const centres = goreCentres(cols, s.anchor === 'sun' ? s.sunFirstCentre : s.landFirstCentre,
    sunPosition(now).lon, s.anchor);
  const p = state.marbleProg;
  const u = p.uniforms;
  gl.viewport(0, 0, W, H);
  const bg = hexToRgb(s.background);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(p.program);
  gl.uniform2f(u.uResolution, W, H);
  gl.uniform1f(u.uCell, cellPx);
  gl.uniform1f(u.uPitch, cellPx * (1 + g));
  gl.uniform1f(u.uZoom, zoom);
  gl.uniform1i(u.uHex, hex ? 1 : 0);
  gl.uniform1i(u.uCols, cols);
  gl.uniform1i(u.uRows, rows);
  gl.uniform1f(u.uFirstLon, centres[0]);
  gl.uniform1f(u.uMaxLat, s.marbleLatDeg);
  gl.uniform1f(u.uDistance, d);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.scene.target.tex);
  gl.uniform1i(u.uScene, 0);
  gl.bindVertexArray(state.quad);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, cols * rows);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
  state.stats.seams = '';
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
  const [config, settings, sceneSources, peelVert, peelFrag, mapVert, mapFrag, marblesVert, marblesFrag, d3Modules] =
    await Promise.all([
    fetchJson('../../config.json'),
    fetchJson('settings.json'),
    loadSceneSources(),
    fetchText('shaders/peel.vert'),
    fetchText('shaders/peel.frag'),
    fetchText('shaders/map.vert'),
    fetchText('shaders/map.frag'),
    fetchText('shaders/marbles.vert'),
    fetchText('shaders/marbles.frag'),
    Promise.all(D3.map((url) => import(url))),
  ]);
  state.d3 = Object.assign({}, ...d3Modules);
  // The prototype's own scene values (settings.scene) override the piece's config.json; kept apart from the gore
  // settings, and the panel saves them back there.
  const baseConfig = structuredClone(config);
  assignDeep(config, settings.scene ?? {});
  delete settings.scene;

  // Any settings key in the URL overrides settings.json, e.g. ?anchor=sun&projection=cassini.
  for (const [k, v] of Object.entries(settings)) {
    if (!params.has(k)) continue;
    const raw = params.get(k);
    settings[k] = typeof v === 'number' ? Number(raw) : typeof v === 'boolean' ? raw !== 'false' : raw;
  }
  state.config = config;
  state.settings = settings;
  state.sources = { ...sceneSources, peelVert, peelFrag, mapVert, mapFrag, marblesVert, marblesFrag };
  const { land } = sceneSources;

  const t0 = performance.now();
  const { labels, count } = labelLand(landMask(land), land.width, land.height);
  state.land = { labels, count, w: land.width, h: land.height };
  state.stats.landmasses = count;
  console.log(`orange peel: ${count} landmasses labelled in ${(performance.now() - t0).toFixed(0)} ms`);

  state.gl = getContext();
  initGL();

  try {
    resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    resizeObserver.observe(canvas);
  }
  run();

  state.gui = await createPeelGui({
    config, baseConfig, settings, water: state.scene.water, fps: state.fps, stats: state.stats,
    onVisibility(visible) { state.guiVisible = visible; },
  });
}

start().catch(showError);
