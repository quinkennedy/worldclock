// Spec 10a: reaction-diffusion on the oceans, carried by a curl-noise flow. A design prototype:
// everything tunable is in settings.json and the panel.
import { getContext, createProgram, createQuad, drawQuad, createMapTexture } from '../../js/gl.js';
import { hexToRgb } from '../../js/config.js';
import * as clock from '../../js/clock.js';
import { sunDirection } from '../../js/sun.js';
import { moonPosition } from '../../js/moon.js';
import { createGui, waterLayers } from './gui.js';

const FLOW_SIZE = [512, 256];
const PARAM_SIZE = [1024, 512];
const MODELS = { grayScott: 0, fitzHughNagumo: 1, brusselator: 2 };
const SOURCES = { uniform: 0, latitude: 1, depth: 2, noise: 3 };
// Colour modes: how many independent sims (layers) each runs, and its display id.
const COLOR_MODES = { grey: [1, 0], rgb: [3, 1], cmyk: [4, 2], hsl: [3, 3], specular: [1, 4] };
const PALETTES = { sunny: 0, night: 1, split: 2 };

const canvas = document.getElementById('map');

const state = {
  settings: null,
  sources: null,   // shader sources and images, kept so a lost context can be rebuilt
  gl: null,
  lost: false,
  ext: { floatLinear: false },
  vao: null,
  progs: null,     // { sim, seed, flow, param, display }
  landTex: null,
  elevTex: null,
  flow: null,      // { tex, fbo }
  param: null,     // { tex, fbo }
  grid: null,      // { w, h, vRange, precision, key, layers: [{ targets: [a, b], read }] }
  paramKey: '',
  flowTime: 0,
  steps: 0,
  paused: false,
  stats: { grid: '', precision: '', fps: 0, steps: 0, reveal: 1, utc: '' },
  warmup: false,  // spec 10d: hide the pattern after a seed, then fade it in
  fadeStart: 0,
};

// --- loading ------------------------------------------------------------------

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// Shader source with each `#include "file"` line replaced by that file (relative to the shader).
async function fetchShader(url) {
  const dir = url.slice(0, url.lastIndexOf('/') + 1);
  const lines = await Promise.all((await fetchText(url)).split('\n').map((line) => {
    const m = line.match(/^\s*#include\s+"([^"]+)"/);
    return m ? fetchText(dir + m[1]) : line;
  }));
  return lines.join('\n');
}

async function fetchBitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}

// --- GL resources -----------------------------------------------------------------

function target(gl, w, h, internal, format, type, filter, wrapS) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, ok, w, h };
}

function freeTarget(gl, t) {
  if (!t) return;
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

function initGL() {
  const gl = state.gl;
  const s = state.sources;
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable');
  state.ext.floatLinear = !!gl.getExtension('OES_texture_float_linear');

  state.vao = createQuad(gl);
  state.progs = {
    sim: createProgram(gl, s.vert, s.sim),
    seed: createProgram(gl, s.vert, s.seed),
    flow: createProgram(gl, s.vert, s.flow),
    param: createProgram(gl, s.vert, s.param),
    display: createProgram(gl, s.vert, s.display),
  };
  state.landTex = createMapTexture(gl, s.land);

  // Packed heights: exact bytes, read only with texelFetch.
  state.elevTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, state.elevTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, s.elevation);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  state.flow = target(gl, ...FLOW_SIZE, gl.RG16F, gl.RG, gl.HALF_FLOAT, gl.LINEAR, gl.REPEAT);
  state.param = target(gl, ...PARAM_SIZE, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, gl.REPEAT);
  state.grid = null;
  state.paramKey = '';
}

// --- sim grid -----------------------------------------------------------------

// The part of the equirectangular map on screen, as in shaders/display.frag.
function visibleMap() {
  const { width: w, height: h } = canvas;
  const aspect = w / h;
  const pxPerDegX = w / 360;
  const pxPerDegY = Math.max(pxPerDegX, w / (Math.max(aspect, state.settings.layout.minAspect) * 180));
  const halfLat = Math.min(90, h / 2 / pxPerDegY);
  return { w, h: 2 * halfLat * pxPerDegY, v0: 0.5 - halfLat / 180, span: halfLat / 90 };
}

function resolvePrecision() {
  const s = state.settings;
  let p = s.sim.precision === 'auto' ? (s.model === 'brusselator' ? 'float' : 'half') : s.sim.precision;
  if (p === 'float' && !state.ext.floatLinear) p = 'half'; // 32-bit float can't be filtered here
  return p;
}

function gridSpec() {
  const sim = state.settings.sim;
  const precision = resolvePrecision();
  let w, h, vRange;
  if (sim.space === 'screen') {
    const m = visibleMap();
    w = Math.max(8, Math.ceil(m.w / sim.screenScale));
    h = Math.max(4, Math.ceil(m.h / sim.screenScale));
    vRange = [m.v0, m.span];
  } else {
    w = sim.mapWidth;
    h = w / 2;
    vRange = [0, 1];
  }
  const layers = COLOR_MODES[state.settings.color.mode][0];
  return { w, h, vRange, precision, layers, key: `${w}x${h}:${vRange}:${precision}:${state.settings.model}:${layers}` };
}

// Rebuilds the ping-pong pairs (one per colour layer) when the grid changes, and reseeds.
function ensureGrid() {
  const gl = state.gl;
  const spec = gridSpec();
  if (state.grid && state.grid.key === spec.key) return;
  if (state.grid) state.grid.layers.forEach((l) => l.targets.forEach((t) => freeTarget(gl, t)));
  const half = spec.precision === 'half';
  const make = () => target(gl, spec.w, spec.h, half ? gl.RGBA16F : gl.RGBA32F, gl.RGBA,
    half ? gl.HALF_FLOAT : gl.FLOAT, gl.LINEAR, gl.REPEAT);
  const layers = Array.from({ length: spec.layers }, () => ({ targets: [make(), make()], read: 0 }));
  if (!layers[0].targets[0].ok) console.error(`sim: ${spec.precision} render target incomplete`);
  state.grid = { ...spec, layers };
  state.stats.grid = `${spec.w} × ${spec.h}${spec.layers > 1 ? ` × ${spec.layers}` : ''}`;
  state.stats.precision = spec.precision;
  seed(false);
}

function modelParams(name, set) {
  const m = state.settings[name];
  const p = m[set];
  if (name === 'grayScott') return [p.feed, p.kill, 0, 0];
  if (name === 'fitzHughNagumo') return [p.a0, p.a1, p.epsilon, 0];
  return [p.A, p.B, 0, 0];
}

function restState() {
  const name = state.settings.model;
  if (name === 'grayScott') return [1, 0];
  if (name === 'fitzHughNagumo') return [0, 0];
  const [A, B] = modelParams(name, 'a');
  return [A, B / A];
}

function pass(prog, t) {
  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
  gl.viewport(0, 0, t ? t.w : canvas.width, t ? t.h : canvas.height);
  gl.useProgram(prog.program);
  return prog.uniforms;
}

function bindTex(unit, tex, loc) {
  const gl = state.gl;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(loc, unit);
}

function seed(clear) {
  const gl = state.gl;
  const g = state.grid;
  const s = state.settings;
  for (const t of g.layers.flatMap((l) => l.targets)) {
    const u = pass(state.progs.seed, t);
    gl.uniform2f(u.uGrid, g.w, g.h);
    gl.uniform2f(u.uVRange, ...g.vRange);
    bindTex(0, state.landTex, u.uLand);
    gl.uniform1i(u.uModel, MODELS[s.model]);
    gl.uniform4fv(u.uParams, modelParams(s.model, 'a'));
    gl.uniform1f(u.uSeed, Math.floor(Math.random() * 100000));
    gl.uniform1f(u.uDensity, s.grayScott.seedDensity);
    gl.uniform1i(u.uClear, clear ? 1 : 0);
    drawQuad(gl, state.vao);
  }
  state.steps = 0;
  state.warmup = !clear;
  state.fadeStart = 0;
}

// Spec 10d: 0 until warmupSteps have run since the seed, then 0 → 1 over fadeSeconds of frame time.
function reveal(now) {
  if (!state.warmup) return 1;
  const sim = state.settings.sim;
  if (state.steps < sim.warmupSteps) return 0;
  if (!state.fadeStart) state.fadeStart = now;
  const r = sim.fadeSeconds > 0 ? (now - state.fadeStart) / (sim.fadeSeconds * 1000) : 1;
  if (r >= 1) state.warmup = false;
  return Math.min(r, 1);
}

// --- passes -------------------------------------------------------------------

function updateParamMap() {
  const pm = state.settings.paramMap;
  const key = JSON.stringify(pm);
  if (key === state.paramKey) return;
  state.paramKey = key;
  const gl = state.gl;
  const u = pass(state.progs.param, state.param);
  gl.uniform2f(u.uSize, ...PARAM_SIZE);
  gl.uniform1i(u.uSource, SOURCES[pm.source]);
  gl.uniform1f(u.uLo, pm.lo);
  gl.uniform1f(u.uHi, pm.hi);
  gl.uniform1i(u.uInvert, pm.invert ? 1 : 0);
  gl.uniform1f(u.uNoiseScale, pm.noiseScale);
  gl.uniform1f(u.uNoiseSeed, pm.noiseSeed);
  bindTex(0, state.elevTex, u.uElevation);
  drawQuad(gl, state.vao);
}

function updateFlow() {
  const gl = state.gl;
  const f = state.settings.flow;
  const u = pass(state.progs.flow, state.flow);
  gl.uniform2f(u.uSize, ...FLOW_SIZE);
  gl.uniform1f(u.uScale, f.scale);
  gl.uniform1f(u.uTime, state.flowTime);
  gl.uniform1f(u.uStrength, f.strength);
  drawQuad(gl, state.vao);
}

function step(n) {
  const gl = state.gl;
  const g = state.grid;
  const s = state.settings;
  const m = s[s.model];
  const prog = state.progs.sim;
  gl.useProgram(prog.program);
  const u = prog.uniforms;
  gl.uniform2f(u.uGrid, g.w, g.h);
  gl.uniform2f(u.uVRange, ...g.vRange);
  gl.uniform1f(u.uLatCorrection, s.sim.space === 'map' ? s.sim.latCorrection : 0);
  gl.uniform1i(u.uModel, MODELS[s.model]);
  gl.uniform4fv(u.uParamsA, modelParams(s.model, 'a'));
  gl.uniform4fv(u.uParamsB, modelParams(s.model, 'b'));
  gl.uniform2f(u.uDiffusion, m.Du, m.Dv);
  gl.uniform1f(u.uDt, m.dt);
  gl.uniform2fv(u.uRest, restState());
  bindTex(1, state.flow.tex, u.uFlow);
  bindTex(2, state.param.tex, u.uParam);
  gl.viewport(0, 0, g.w, g.h);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(u.uState, 0);
  for (const l of g.layers) {
    for (let i = 0; i < n; i++) {
      const src = l.targets[l.read];
      const dst = l.targets[1 - l.read];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      drawQuad(gl, state.vao);
      l.read = 1 - l.read;
    }
  }
  state.steps += n;
}

function display() {
  const gl = state.gl;
  const s = state.settings;
  const view = s[s.model].view;
  const c = s.color;
  const u = pass(state.progs.display, null);
  gl.uniform2f(u.uResolution, canvas.width, canvas.height);
  gl.uniform1f(u.uMinAspect, s.layout.minAspect);
  const layers = state.grid.layers;
  for (let i = 0; i < 4; i++) {
    const l = layers[Math.min(i, layers.length - 1)];
    bindTex(1 + i, l.targets[l.read].tex, u[`uState${i}`]);
  }
  bindTex(0, state.landTex, u.uLand);
  gl.uniform1i(u.uMode, COLOR_MODES[c.mode][1]);
  gl.uniform1f(u.uReveal, state.stats.reveal);
  gl.uniform1i(u.uPalette, PALETTES[c.palette]);
  gl.uniform3f(u.uRange, c.range.h, c.range.s, c.range.l);
  for (const [i, name] of ['sunny', 'night'].entries()) {
    const p = c[name];
    const layers = p.rgb && p.cmyk && p.hsl ? p : waterLayers(p.water);
    const hsl = (a) => a.flatMap((x) => [x.h, x.s, x.l]);
    gl.uniform3fv(u[`uRgb${i}[0]`], hsl(layers.rgb));
    gl.uniform3fv(u[`uCmyk${i}[0]`], hsl(layers.cmyk));
    gl.uniform3f(u[`uHsl${i}`], layers.hsl.h, layers.hsl.s, layers.hsl.l);
    gl.uniform3fv(u[`uLand${i}`], hexToRgb(p.land));
    gl.uniform3fv(u[`uWater${i}`], hexToRgb(p.water));
  }
  gl.uniform3fv(u.uLand2, hexToRgb(c.moon.land));
  gl.uniform3fv(u.uWater2, hexToRgb(c.moon.water));

  // Spec 10c: the real sun and moon at the sim time.
  const now = clock.simNow();
  const sunDir = sunDirection(now);
  const moon = moonPosition(now, sunDir);
  const sp = s.specular;
  gl.uniform3fv(u.uSunDir, sunDir);
  gl.uniform3fv(u.uMoonDir, moon.dir);
  gl.uniform1i(u.uMoonGlint, sp.moonGlint ? 1 : 0);
  gl.uniform1i(u.uMoonLighting, sp.moonLighting ? 1 : 0);
  gl.uniform1f(u.uMoonPhase, moon.phaseAngle);
  gl.uniform1f(u.uMoonDist, moon.distKm);
  gl.uniform1f(u.uLatCorrection, s.sim.space === 'map' ? s.sim.latCorrection : 0);
  gl.uniform1f(u.uNormalStrength, sp.normalStrength);
  gl.uniform1f(u.uExponent, sp.exponent);
  gl.uniform1f(u.uStrength, sp.strength);
  gl.uniform1f(u.uNightLux, s.twilight.nightLux);
  gl.uniform1f(u.uDayLux, s.twilight.dayLux);
  gl.uniform1f(u.uMoonStopLux, s.twilight.moonLux);
  state.stats.utc = clock.formatUtc(now);
  gl.uniform2f(u.uVRange, ...state.grid.vRange);
  gl.uniform1i(u.uChannel, view.channel === 'u' ? 0 : 1);
  gl.uniform1f(u.uLo, view.lo);
  gl.uniform1f(u.uHi, view.hi);
  gl.uniform1i(u.uInvert, s.display.invert ? 1 : 0);
  gl.uniform3fv(u.uLandColor, hexToRgb(s.display.land));
  gl.uniform3fv(u.uLetterbox, hexToRgb(s.display.letterbox));
  drawQuad(gl, state.vao);
}

// --- loop: one rAF chain ------------------------------------------------------

let raf = 0;
let lastFrame = 0;

function frame(now) {
  raf = 0;
  if (state.lost) return;
  if (lastFrame) state.stats.fps += (1000 / Math.max(1, now - lastFrame) - state.stats.fps) * 0.1;
  lastFrame = now;

  ensureGrid();
  updateParamMap();
  if (!state.paused) {
    const n = state.settings.sim.stepsPerFrame;
    state.flowTime += state.settings.flow.evolution * n / 1000;
    updateFlow();
    step(n);
  }
  state.stats.reveal = reveal(now);
  display();
  state.stats.steps = state.steps;
  raf = requestAnimationFrame(frame);
}

function run() {
  if (!raf && !state.lost) raf = requestAnimationFrame(frame);
}

// --- sizing and context loss ----------------------------------------------------

const resizeObserver = new ResizeObserver(([entry]) => {
  const dev = entry.devicePixelContentBoxSize?.[0];
  const w = dev ? dev.inlineSize : Math.round(entry.contentRect.width * devicePixelRatio);
  const h = dev ? dev.blockSize : Math.round(entry.contentRect.height * devicePixelRatio);
  if (w > 0 && h > 0) {
    canvas.width = w;
    canvas.height = h;
  }
});

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  state.lost = true;
  cancelAnimationFrame(raf);
  raf = 0;
});

canvas.addEventListener('webglcontextrestored', () => {
  state.lost = false;
  initGL();
  run();
});

// --- start ----------------------------------------------------------------------

async function start() {
  const [settings, vert, sim, seedSrc, flow, param, displaySrc, land, elevation] = await Promise.all([
    fetchText('settings.json').then(JSON.parse),
    fetchText('../../shaders/quad.vert'),
    fetchShader('shaders/sim.frag'),
    fetchShader('shaders/seed.frag'),
    fetchShader('shaders/flow.frag'),
    fetchShader('shaders/param.frag'),
    fetchShader('shaders/display.frag'),
    fetchBitmap('../../data/land.png'),
    fetchBitmap('../../data/elevation.webp'),
  ]);
  state.settings = settings;
  state.sources = { vert, sim, seed: seedSrc, flow, param, display: displaySrc, land, elevation };
  state.gl = getContext(canvas);
  initGL();

  try {
    resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    resizeObserver.observe(canvas); // Safari: no device-pixel-content-box
  }

  createGui({
    settings,
    stats: state.stats,
    get paused() { return state.paused; },
    togglePause() { state.paused = !state.paused; },
    reseed() { if (state.grid) seed(false); },
    clear() { if (state.grid) seed(true); },
  });
  run();
}

start().catch((err) => {
  console.error('10a prototype failed to start:', err);
  document.getElementById('error').textContent = String(err.message || err);
});
