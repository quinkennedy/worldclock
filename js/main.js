// Setup, render loop and wake lock.
import * as clock from './clock.js';
import { loadConfig, hexToRgb } from './config.js';
import { sunDirection, sunPosition } from './sun.js';
import { moonPosition } from './moon.js';
import { skyMatrix, starVertices, STAR_STRIDE } from './stars.js';
import {
  getContext, createProgram, createQuad, drawQuad, createMapTexture, createSlopeTexture, createStarBuffer,
} from './gl.js';

const LIVE_INTERVAL_MS = 5000; // at 4K the terminator moves ~1 px every 22 s

const params = new URLSearchParams(location.search);
clock.initFromUrl(params);

const canvas = document.getElementById('map');

const state = {
  config: null,
  sources: null,     // { vert, frag, slope, starVert, starFrag, discVert, discFrag, land, elevation, stars } kept so a lost context can be rebuilt
  gl: null,
  prog: null,
  vao: null,
  landTex: null,
  slopeTex: null,    // spec 04: terrain slopes, built once from the elevation data
  starProg: null,    // spec 05: zenith stars
  starBuf: null,     // { vao, count }
  discProg: null,    // spec 06: sun and moon discs
  lost: false,
  gui: null,         // spec 07's panel, only with ?gui
  guiVisible: false,
};

async function fetchText(url) {
  const res = await fetch(url);
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

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

async function fetchBitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  // Data texture: no colour management, no premultiply.
  return createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}

function initGL() {
  const gl = state.gl;
  state.prog = createProgram(gl, state.sources.vert, state.sources.frag);
  state.vao = createQuad(gl);
  state.landTex = createMapTexture(gl, state.sources.land);
  state.slopeTex = createSlopeTexture(gl, state.sources.elevation, state.sources.vert, state.sources.slope, state.vao);
  state.starProg = createProgram(gl, state.sources.starVert, state.sources.starFrag);
  state.starBuf = createStarBuffer(gl, state.sources.stars, STAR_STRIDE);
  state.discProg = createProgram(gl, state.sources.discVert, state.sources.discFrag);
}

// --- sizing -----------------------------------------------------------------

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
  requestRedraw();
});

// --- drawing ----------------------------------------------------------------

function draw() {
  const { gl, prog, config } = state;
  if (!gl || state.lost) return;
  const u = prog.uniforms;
  const p = config.palette;
  const t = config.twilight;
  const r = config.relief;
  const now = clock.simNow();
  const sunDir = sunDirection(now);

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(prog.program);
  gl.uniform2f(u.uResolution, canvas.width, canvas.height);
  gl.uniform3fv(u.uSunDir, sunDir);
  gl.uniform3fv(u.uDayWater, hexToRgb(p.dayWater));
  gl.uniform3fv(u.uDayLand, hexToRgb(p.dayLand));
  gl.uniform3fv(u.uNightWater, hexToRgb(p.nightWater));
  gl.uniform3fv(u.uNightLand, hexToRgb(p.nightLand));
  gl.uniform3fv(u.uLetterbox, hexToRgb(p.letterbox));
  gl.uniform1f(u.uMinAspect, config.layout.minAspect);
  gl.uniform1f(u.uNightLux, t.nightLux);
  gl.uniform1f(u.uDayLux, t.dayLux);
  gl.uniform1f(u.uLandExaggeration, r.landExaggeration);
  gl.uniform1f(u.uSeaExaggeration, r.seaExaggeration);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.landTex);
  gl.uniform1i(u.uLand, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.slopeTex);
  gl.uniform1i(u.uSlope, 1);

  drawQuad(gl, state.vao);
  drawStars(now, sunDir);
  drawDiscs(now, sunDir);
}

// Spec 05: stars alpha-blended over the map. They fade out with the twilight, so the day side gets none.
function drawStars(now, sunDir) {
  const { gl, starProg, starBuf, config } = state;
  const u = starProg.uniforms;
  const s = config.stars;

  gl.useProgram(starProg.program);
  gl.uniformMatrix3fv(u.uSky, false, skyMatrix(now));
  gl.uniform3fv(u.uSunDir, sunDir);
  gl.uniform2f(u.uResolution, canvas.width, canvas.height);
  gl.uniform1f(u.uMinAspect, config.layout.minAspect);
  gl.uniform1f(u.uNightLux, config.twilight.nightLux);
  gl.uniform1f(u.uDayLux, config.twilight.dayLux);
  gl.uniform1f(u.uMagLimit, s.magLimit);
  gl.uniform1f(u.uBrightMag, s.brightMag);
  gl.uniform1f(u.uSizeFaint, s.sizeFaint);
  gl.uniform1f(u.uSizeBright, s.sizeBright);
  gl.uniform1f(u.uAlphaFaint, s.alphaFaint);
  gl.uniform1f(u.uAlphaBright, s.alphaBright);
  gl.uniform1f(u.uSaturation, s.saturation);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(starBuf.vao);
  gl.drawArraysInstanced(gl.POINTS, 0, starBuf.count, 3); // copies at −360°, 0, +360°
  gl.disable(gl.BLEND);
}

// Spec 06: outlines of the sun and moon over everything, the moon with its phase. Where they overlap
// both sets of lines show.
function drawDiscs(now, sunDir) {
  const { gl, discProg, config } = state;
  const u = discProg.uniforms;
  const d = config.discs;
  const sun = sunPosition(now);
  const moon = moonPosition(now, sunDir);

  gl.useProgram(discProg.program);
  gl.uniform2f(u.uResolution, canvas.width, canvas.height);
  gl.uniform1f(u.uMinAspect, config.layout.minAspect);
  gl.uniform1f(u.uLineWidth, d.lineWidth);
  gl.uniform1f(u.uSoftness, d.terminatorSoftness);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(state.vao);

  gl.uniform2f(u.uCentre, sun.lon, sun.lat);
  gl.uniform1f(u.uDiameter, d.sunSize);
  gl.uniform3fv(u.uColor, hexToRgb(d.sunColor));
  gl.uniform1i(u.uTerminator, 0);
  gl.uniform1i(u.uFill, 0);
  gl.uniform1i(u.uOutline, 1);
  gl.uniform1f(u.uAlpha, 1);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 3); // copies at −360°, 0, +360°

  gl.uniform2f(u.uCentre, moon.lon, moon.lat);
  gl.uniform1f(u.uDiameter, d.moonSize);
  gl.uniform3fv(u.uColor, hexToRgb(d.moonColor));
  gl.uniform1i(u.uTerminator, 1);
  gl.uniform1i(u.uFill, d.moonFill ? 1 : 0);
  gl.uniform1i(u.uOutline, d.moonOutline ? 1 : 0);
  gl.uniform1f(u.uAlpha, d.moonAlpha);
  gl.uniform1f(u.uCosPhase, Math.cos(moon.phaseAngle * Math.PI / 180));
  gl.uniform2f(u.uLitEN, Math.sin(moon.litBearing), Math.cos(moon.litBearing));
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 3);

  gl.disable(gl.BLEND);
}

// --- render loop: one timer chain -------------------------------------------
// Live (x1, running, GUI hidden): redraw every 5 s. Otherwise every animation frame.

let timer = 0;
let raf = 0;

function cancel() {
  clearTimeout(timer);
  cancelAnimationFrame(raf);
  timer = raf = 0;
}

function schedule() {
  cancel();
  if (state.lost) return;
  if (clock.isRealRate() && !state.guiVisible) timer = setTimeout(frame, LIVE_INTERVAL_MS);
  else raf = requestAnimationFrame(frame);
}

function frame() {
  timer = raf = 0;
  draw();
  if (state.guiVisible) state.gui.tick();
  schedule();
}

// Draw on the next frame, then carry on with the normal cadence.
export function requestRedraw() {
  if (state.lost || !state.gl) return;
  cancel();
  raf = requestAnimationFrame(frame);
}

clock.onChange(requestRedraw);

// --- context loss -----------------------------------------------------------

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  state.lost = true;
  cancel();
});

canvas.addEventListener('webglcontextrestored', () => {
  state.lost = false;
  initGL();
  requestRedraw();
});

// --- wake lock --------------------------------------------------------------

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    await navigator.wakeLock.request('screen');
  } catch (err) {
    console.warn('wake lock unavailable:', err);
  }
}

// The lock is released whenever the page is hidden; take it again on return.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    requestWakeLock();
    requestRedraw();
  }
});

// --- dev GUI (spec 07) -------------------------------------------------------
// Imported only with ?gui, so the public page never fetches Tweakpane.

async function loadGui() {
  const { createGui } = await import('./gui.js');
  state.gui = createGui({
    config: state.config,
    requestRedraw,
    onVisibility(visible) {
      state.guiVisible = visible;
      requestRedraw(); // switches between the live 5 s cadence and every frame
    },
  });
}

// --- start ------------------------------------------------------------------

async function start() {
  const [config, vert, frag, slope, starVert, starFrag, discVert, discFrag, land, elevation, stars] = await Promise.all([
    loadConfig(),
    fetchText('shaders/quad.vert'),
    fetchShader('shaders/sun.frag'),
    fetchText('shaders/slope.frag'),
    fetchShader('shaders/stars.vert'),
    fetchText('shaders/stars.frag'),
    fetchText('shaders/disc.vert'),
    fetchText('shaders/disc.frag'),
    fetchBitmap('data/land.png'),
    fetchBitmap('data/elevation.webp'),
    fetchBuffer('data/stars.bin'),
  ]);
  state.config = config;
  state.sources = {
    vert, frag, slope, starVert, starFrag, discVert, discFrag, land, elevation, stars: starVertices(stars),
  };
  state.gl = getContext(canvas);
  initGL();

  try {
    resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    resizeObserver.observe(canvas); // Safari: no device-pixel-content-box
  }
  requestWakeLock();
  requestRedraw();

  if (params.has('gui')) loadGui().catch((err) => console.error('dev GUI failed to load:', err));
}

start().catch((err) => console.error('world clock failed to start:', err));
