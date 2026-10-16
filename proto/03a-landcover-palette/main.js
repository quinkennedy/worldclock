// Spec 03a: the map in flat land-cover palette colours, with an elevation curve, optionally lit as the piece lights it.
// A design prototype: palettes live in settings.json and the panel; the scene's night and moon stops, twilight,
// relief and moonlight values are read from the piece's ../../config.json and not edited here.
import * as clock from '../../js/clock.js';
import { hexToRgb } from '../../js/config.js';
import { sunDirection } from '../../js/sun.js';
import { moonPosition } from '../../js/moon.js';
import {
  getContext, createProgram, createQuad, drawQuad, createMapTexture, createSlopeTexture,
} from '../../js/gl.js';
import { createPaletteGui, currentPalette } from './gui.js';

const FRAME_SLACK_MS = 4; // as js/main.js

// ?t= needs ?gui in the piece; the prototype always has its panel.
const params = new URLSearchParams(location.search);
params.set('gui', '');
clock.initFromUrl(params);

const canvas = document.getElementById('map');

const state = {
  config: null,      // the piece's config.json (scene stops, layout, fps)
  settings: null,    // this prototype's settings.json (palettes)
  sources: null,     // shader sources and images, kept so a lost context can be rebuilt
  gl: null,
  prog: null,
  vao: null,
  landTex: null,
  coverTex: null,
  elevTex: null,
  slopeTex: null,
  fps: { value: 0 },
  lost: false,
  gui: null,
  guiVisible: true,
};

// --- loading --------------------------------------------------------------------

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

// --- colour ---------------------------------------------------------------------

// '#rrggbb' -> OKLab [L, a, b] (Ottosson).
function hexToOklab(hex) {
  const lin = hexToRgb(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

// --- GL setup -------------------------------------------------------------------

// landcover.webp: RGB fractions, filtered linearly; wraps in longitude, clamps at the poles, mipmapped.
function createCoverTexture(gl, image) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

// Elevation in metres as a filterable R16F texture, unpacked once on the GPU (like js/gl.js's createSlopeTexture).
// Without EXT_color_buffer_float the map is flat (0 m) and the elevation curve does nothing.
function createElevationTexture(gl, elevationImage, vertSrc, fragSrc, vao) {
  const elev = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, elev);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (!gl.getExtension('EXT_color_buffer_float')) {
    console.warn('palette: EXT_color_buffer_float unavailable, no elevation curve');
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1, 1, 0, gl.RED, gl.HALF_FLOAT, new Uint16Array(1));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return elev;
  }
  const { width, height } = elevationImage;
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, width, height, 0, gl.RED, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const packed = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, packed);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, elevationImage);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const prog = createProgram(gl, vertSrc, fragSrc);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, elev, 0);
  gl.viewport(0, 0, width, height);
  gl.useProgram(prog.program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, packed);
  gl.uniform1i(prog.uniforms.uElevation, 0);
  drawQuad(gl, vao);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(packed);
  gl.deleteProgram(prog.program);

  gl.bindTexture(gl.TEXTURE_2D, elev);
  gl.generateMipmap(gl.TEXTURE_2D);
  return elev;
}

function initGL() {
  const { gl, sources: s } = state;
  state.prog = createProgram(gl, s.vert, s.frag);
  state.vao = createQuad(gl);
  state.landTex = createMapTexture(gl, s.land);
  state.coverTex = createCoverTexture(gl, s.cover);
  state.elevTex = createElevationTexture(gl, s.elevation, s.vert, s.elevFrag, state.vao);
  state.slopeTex = createSlopeTexture(gl, s.elevation, s.vert, s.slope, state.vao);
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

function draw() {
  const { gl, prog, config, settings } = state;
  const u = prog.uniforms;
  const pal = currentPalette(settings);
  const e = pal.elevation;
  const p = config.palette;
  const t = config.twilight;
  const now = clock.simNow();
  const sunDir = sunDirection(now);
  const moon = moonPosition(now, sunDir);

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(prog.program);
  gl.uniform2f(u.uResolution, canvas.width, canvas.height);
  gl.uniform1f(u.uMinAspect, config.layout.minAspect);
  gl.uniform3fv(u.uLetterbox, hexToRgb(p.letterbox));

  gl.uniform3fv(u.uWater, hexToOklab(pal.water));
  gl.uniform3fv(u.uArid, hexToOklab(pal.arid));
  gl.uniform3fv(u.uForest, hexToOklab(pal.forest));
  gl.uniform3fv(u.uGrass, hexToOklab(pal.grass));
  gl.uniform3fv(u.uIce, hexToOklab(pal.ice));
  gl.uniform1i(u.uDominant, settings.blend === 'dominant' ? 1 : 0);
  gl.uniform1f(u.uElevLo, e.lo);
  gl.uniform1f(u.uElevHi, e.hi);
  gl.uniform1f(u.uElevExponent, e.exponent);
  gl.uniform1f(u.uBrightness, e.brightness);
  gl.uniform1f(u.uSaturation, e.saturation);

  gl.uniform1i(u.uScene, settings.scene ? 1 : 0);
  gl.uniform3fv(u.uSunDir, sunDir);
  gl.uniform3fv(u.uMoonDir, moon.dir);
  gl.uniform3fv(u.uMoonWater, hexToRgb(p.moonWater));
  gl.uniform3fv(u.uMoonLand, hexToRgb(p.moonLand));
  gl.uniform3fv(u.uNightWater, hexToRgb(p.nightWater));
  gl.uniform3fv(u.uNightLand, hexToRgb(p.nightLand));
  gl.uniform1f(u.uNightLux, t.nightLux);
  gl.uniform1f(u.uDayLux, t.dayLux);
  gl.uniform1f(u.uMoonStopLux, t.moonLux);
  gl.uniform1f(u.uLandExaggeration, config.relief.landExaggeration);
  gl.uniform1i(u.uMoonlight, config.moonlight.enabled ? 1 : 0);
  gl.uniform1f(u.uMoonPhase, moon.phaseAngle);
  gl.uniform1f(u.uMoonDist, moon.distKm);

  const bind = (unit, tex, loc) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  };
  bind(0, state.landTex, u.uLand);
  bind(1, state.coverTex, u.uCover);
  bind(2, state.elevTex, u.uElev);
  bind(3, state.slopeTex, u.uSlope);
  drawQuad(gl, state.vao);
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
  draw();
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
  const [config, settings, vert, frag, elevFrag, slope, land, cover, elevation] = await Promise.all([
    fetchText('../../config.json').then(JSON.parse),
    fetchText('settings.json').then(JSON.parse),
    fetchText('../../shaders/quad.vert'),
    fetchShader('shaders/palette.frag'),
    fetchText('shaders/elevation.frag'),
    fetchText('../../shaders/slope.frag'),
    fetchBitmap('../../data/land.png'),
    fetchBitmap('../../data/landcover.webp'),
    fetchBitmap('../../data/elevation.webp'),
  ]);

  // Any scalar settings key in the URL overrides settings.json, e.g. ?palette=Atlas&blend=dominant&scene=true.
  for (const [k, v] of Object.entries(settings)) {
    if (!params.has(k) || (v && typeof v === 'object')) continue;
    const raw = params.get(k);
    settings[k] = typeof v === 'number' ? Number(raw) : typeof v === 'boolean' ? raw !== 'false' : raw;
  }
  state.config = config;
  state.settings = settings;
  state.sources = { vert, frag, elevFrag, slope, land, cover, elevation };
  state.gl = getContext(canvas);
  initGL();

  try {
    resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    resizeObserver.observe(canvas);
  }
  run();

  state.gui = createPaletteGui({
    settings, fps: state.fps,
    onVisibility(visible) { state.guiVisible = visible; },
  });
}

start().catch(showError);
