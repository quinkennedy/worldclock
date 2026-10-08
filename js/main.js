// Setup, render loop and wake lock.
import * as clock from './clock.js';
import { loadConfig, hexToRgb } from './config.js';
import { sunDirection, sunPosition } from './sun.js';
import { moonPosition } from './moon.js';
import { skyMatrix, starVertices, STAR_STRIDE } from './stars.js';
import { createWater } from './water.js';
import {
  getContext, createProgram, createQuad, drawQuad, createMapTexture, createSlopeTexture, createStarBuffer,
} from './gl.js';

const FRAME_SLACK_MS = 4; // a frame this early still counts, so a 60 Hz display holds 20 fps rather than 15

const params = new URLSearchParams(location.search);
clock.initFromUrl(params);

const canvas = document.getElementById('map');

const state = {
  config: null,
  sources: null,     // shader sources, images and star vertices, kept so a lost context can be rebuilt
  gl: null,
  prog: null,
  vao: null,
  landTex: null,
  slopeTex: null,    // spec 04: terrain slopes, built once from the elevation data
  starProg: null,    // spec 05: zenith stars
  starBuf: null,     // { vao, count }
  discProg: null,    // spec 06: sun and moon discs
  water: null,       // spec 10e: the reaction-diffusion sim (js/water.js)
  fps: { value: 0 }, // measured frame rate, for the panel
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
  const w = state.sources.water;
  state.water = createWater(gl, { vert: state.sources.vert, ...w }, state.sources.elevation, state.landTex, state.vao,
    state.config.water);
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
});

// --- drawing ----------------------------------------------------------------

// frameMs: the browser's frame clock, which times the water's fade-in. Astronomy uses the sim clock.
function draw(frameMs) {
  const { gl, prog, config, water } = state;
  const u = prog.uniforms;
  const p = config.palette;
  const t = config.twilight;
  const r = config.relief;
  const sp = config.water.specular;
  const view = config.water.grayScott.view;
  const now = clock.simNow();
  const sunDir = sunDirection(now);
  const moon = moonPosition(now, sunDir);

  water.update(frameMs);

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(prog.program);
  gl.uniform2f(u.uResolution, canvas.width, canvas.height);
  gl.uniform3fv(u.uSunDir, sunDir);
  gl.uniform3fv(u.uMoonDir, moon.dir);
  gl.uniform3fv(u.uDayWater, hexToRgb(p.dayWater));
  gl.uniform3fv(u.uDayLand, hexToRgb(p.dayLand));
  gl.uniform3fv(u.uMoonWater, hexToRgb(p.moonWater));
  gl.uniform3fv(u.uMoonLand, hexToRgb(p.moonLand));
  gl.uniform3fv(u.uNightWater, hexToRgb(p.nightWater));
  gl.uniform3fv(u.uNightLand, hexToRgb(p.nightLand));
  gl.uniform3fv(u.uLetterbox, hexToRgb(p.letterbox));
  gl.uniform1f(u.uMinAspect, config.layout.minAspect);
  gl.uniform1f(u.uNightLux, t.nightLux);
  gl.uniform1f(u.uDayLux, t.dayLux);
  gl.uniform1f(u.uMoonStopLux, t.moonLux);
  gl.uniform1f(u.uLandExaggeration, r.landExaggeration);
  gl.uniform1i(u.uMoonlight, config.moonlight.enabled ? 1 : 0);
  gl.uniform1i(u.uMoonGlint, sp.moonGlint ? 1 : 0);
  gl.uniform1f(u.uMoonPhase, moon.phaseAngle);
  gl.uniform1f(u.uMoonDist, moon.distKm);
  gl.uniform1i(u.uChannel, view.channel === 'u' ? 0 : 1);
  gl.uniform1f(u.uLo, view.lo);
  gl.uniform1f(u.uHi, view.hi);
  gl.uniform1f(u.uLatCorrection, config.water.sim.latCorrection);
  gl.uniform1f(u.uNormalStrength, sp.normalStrength);
  gl.uniform1f(u.uExponent, sp.exponent);
  gl.uniform1f(u.uStrength, sp.strength);
  gl.uniform1f(u.uReveal, water.stats.reveal);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.landTex);
  gl.uniform1i(u.uLand, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.slopeTex);
  gl.uniform1i(u.uSlope, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, water.texture());
  gl.uniform1i(u.uWater, 2);

  drawQuad(gl, state.vao);
  drawStars(now, sunDir);
  drawDiscs(now, moon);
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
function drawDiscs(now, moon) {
  const { gl, discProg, config } = state;
  const u = discProg.uniforms;
  const d = config.discs;
  const sun = sunPosition(now);

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

// --- render loop: one rAF chain, capped at render.fps -------------------------
// Spec 10e: the water drifts every frame, so the page always animates, with or without the panel.

let raf = 0;
let lastFrame = 0;

function frame(frameMs) {
  raf = requestAnimationFrame(frame);
  const interval = 1000 / state.config.render.fps;
  if (lastFrame && frameMs - lastFrame < interval - FRAME_SLACK_MS) return;
  if (lastFrame) state.fps.value += (1000 / Math.max(1, frameMs - lastFrame) - state.fps.value) * 0.1;
  lastFrame = frameMs;
  draw(frameMs);
  if (state.guiVisible) state.gui.tick();
}

function run() {
  if (!raf && !state.lost) raf = requestAnimationFrame(frame);
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
}

// --- context loss -----------------------------------------------------------

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  state.lost = true;
  stop();
});

canvas.addEventListener('webglcontextrestored', () => {
  state.lost = false;
  initGL(); // a new sim, so the water warms up again
  run();
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
  if (document.visibilityState === 'visible') requestWakeLock();
});

// --- dev GUI (spec 07) -------------------------------------------------------
// Imported only with ?gui, so the public page never fetches Tweakpane.

async function loadGui() {
  const { createGui } = await import('./gui.js');
  state.gui = createGui({
    config: state.config,
    water: state.water,
    fps: state.fps,
    onVisibility(visible) { state.guiVisible = visible; },
  });
}

// --- start ------------------------------------------------------------------

async function start() {
  const [config, vert, frag, slope, starVert, starFrag, discVert, discFrag, waterSeed, waterSim, waterFlow, waterParam,
    land, elevation, stars] = await Promise.all([
    loadConfig(),
    fetchText('shaders/quad.vert'),
    fetchShader('shaders/sun.frag'),
    fetchText('shaders/slope.frag'),
    fetchShader('shaders/stars.vert'),
    fetchText('shaders/stars.frag'),
    fetchText('shaders/disc.vert'),
    fetchText('shaders/disc.frag'),
    fetchShader('shaders/water-seed.frag'),
    fetchShader('shaders/water-sim.frag'),
    fetchShader('shaders/water-flow.frag'),
    fetchShader('shaders/water-param.frag'),
    fetchBitmap('data/land.png'),
    fetchBitmap('data/elevation.webp'),
    fetchBuffer('data/stars.bin'),
  ]);
  state.config = config;
  state.sources = {
    vert, frag, slope, starVert, starFrag, discVert, discFrag, land, elevation, stars: starVertices(stars),
    water: { seed: waterSeed, sim: waterSim, flow: waterFlow, param: waterParam },
  };
  state.gl = getContext(canvas);
  initGL();

  try {
    resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    resizeObserver.observe(canvas); // Safari: no device-pixel-content-box
  }
  requestWakeLock();
  run();

  if (params.has('gui')) loadGui().catch((err) => console.error('dev GUI failed to load:', err));
}

start().catch((err) => console.error('world clock failed to start:', err));
