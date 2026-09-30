// Setup, render loop and wake lock.
import * as clock from './clock.js';
import { loadConfig, hexToRgb } from './config.js';
import { sunDirection } from './sun.js';
import { getContext, createProgram, createQuad, drawQuad, createMapTexture } from './gl.js';

const LIVE_INTERVAL_MS = 5000; // at 4K the terminator moves ~1 px every 22 s

const params = new URLSearchParams(location.search);
clock.initFromUrl(params);

const canvas = document.getElementById('map');

const state = {
  config: null,
  sources: null,     // { vert, frag, land } kept so a lost context can be rebuilt
  gl: null,
  prog: null,
  vao: null,
  landTex: null,
  lost: false,
  guiVisible: false, // set by spec 07's panel
};

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
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

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(prog.program);
  gl.uniform2f(u.uResolution, canvas.width, canvas.height);
  gl.uniform3fv(u.uSunDir, sunDirection(clock.simNow()));
  gl.uniform3fv(u.uDayWater, hexToRgb(p.dayWater));
  gl.uniform3fv(u.uDayLand, hexToRgb(p.dayLand));
  gl.uniform3fv(u.uNightWater, hexToRgb(p.nightWater));
  gl.uniform3fv(u.uNightLand, hexToRgb(p.nightLand));
  gl.uniform3fv(u.uLetterbox, hexToRgb(p.letterbox));
  gl.uniform1f(u.uMinAspect, config.layout.minAspect);
  gl.uniform1f(u.uSoftness, t.softness);
  gl.uniform1f(u.uCivil, t.civil);
  gl.uniform1f(u.uNautical, t.nautical);
  gl.uniform1f(u.uAstronomical, t.astronomical);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.landTex);
  gl.uniform1i(u.uLand, 0);

  drawQuad(gl, state.vao);
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

// --- start ------------------------------------------------------------------

async function start() {
  const [config, vert, frag, land] = await Promise.all([
    loadConfig(),
    fetchText('shaders/quad.vert'),
    fetchText('shaders/sun.frag'),
    fetchBitmap('data/land.png'),
  ]);
  state.config = config;
  state.sources = { vert, frag, land };
  state.gl = getContext(canvas);
  initGL();

  try {
    resizeObserver.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    resizeObserver.observe(canvas); // Safari: no device-pixel-content-box
  }
  requestWakeLock();
  requestRedraw();
}

start().catch((err) => console.error('world clock failed to start:', err));
