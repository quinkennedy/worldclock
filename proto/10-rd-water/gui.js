// Spec 10a panel. Always visible; `g` hides it. Every edit applies on the next frame.
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import { hexToRgb } from '../../js/config.js';
import * as clock from '../../js/clock.js';

// Gray-Scott feed/kill for Du 0.2097, Dv 0.105, dt 1 (checked on the CPU; all form patterns).
const GS_PRESETS = {
  spots: { feed: 0.03, kill: 0.062 },
  stripes: { feed: 0.022, kill: 0.051 },
  maze: { feed: 0.029, kill: 0.057 },
  worms: { feed: 0.046, kill: 0.063 },
  mitosis: { feed: 0.0367, kill: 0.0649 },
  coral: { feed: 0.0545, kill: 0.062 },
};

const opts = (...names) => Object.fromEntries(names.map((n) => [n, n]));

const round = (x) => Math.round(x * 10) / 10;

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const c = max - min;
  let h = 0;
  if (c > 0) {
    if (max === r) h = ((g - b) / c + 6) % 6;
    else if (max === g) h = (b - r) / c + 2;
    else h = (r - g) / c + 4;
  }
  const s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1));
  return { h: round(h * 60), s: round(s * 100), l: round(l * 100) };
}

// Layers whose base colour (every d = 0) is the water colour, for a palette's water hex.
// RGB: pure primaries at S 100, where L = 50 × channel. CMYK: standard ink split; an ink of
// amount a is its pure hue at L = 100 − 50a, and K is a grey at L = 100 × (1 − k).
export function waterLayers(water) {
  const rgb = hexToRgb(water);
  const k = 1 - Math.max(...rgb);
  const inks = rgb.map((v) => (k < 1 ? (1 - v - k) / (1 - k) : 0));
  return {
    rgb: [0, 120, 240].map((h, i) => ({ h, s: 100, l: round(50 * rgb[i]) })),
    cmyk: [...[180, 300, 60].map((h, i) => ({ h, s: 100, l: round(100 - 50 * inks[i]) })),
      { h: 0, s: 0, l: round(100 * (1 - k)) }],
    hsl: rgbToHsl(rgb),
  };
}

// A palette with no layers in settings.json uses waterLayers() of its water colour instead.
const hasLayers = (p) => Boolean(p.rgb && p.cmyk && p.hsl);

function assignDeep(to, from) {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && to[k] && typeof to[k] === 'object') assignDeep(to[k], v);
    else to[k] = v;
  }
}

function json(settings) {
  return JSON.stringify(settings, null, 2) + '\n';
}

// ctx: { settings, stats, paused, togglePause(), reseed(), clear() }.
export function createGui(ctx) {
  const { settings, stats } = ctx;
  const initial = structuredClone(settings);
  const pane = new Pane({ title: '10a · RD water' });
  Object.assign(pane.element.parentElement.style, { maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' });

  // --- Time (10c): the sim clock that places the sun and moon. The RD itself runs by steps.
  const time = pane.addFolder({ title: 'Time' });
  const t = { speedExp: 0, sign: 1, set: clock.formatUtc(clock.simNow()) };
  time.addBinding(stats, 'utc', { label: 'sim UTC', readonly: true, interval: 500 });
  const setSpeed = () => clock.setSpeed(t.sign * 10 ** t.speedExp);
  time.addBinding(t, 'speedExp', { label: 'speed', min: 0, max: 5, step: 0.01,
    format: (v) => 'x' + Math.round(10 ** v).toLocaleString('en-US') }).on('change', setSpeed);
  time.addBinding(t, 'sign', { label: 'direction', options: { '+': 1, '−': -1 } }).on('change', setSpeed);
  time.addBinding(t, 'set', { label: 'set UTC' }).on('change', ({ value }) => {
    const ms = clock.parseUtc(value);
    if (!Number.isNaN(ms)) clock.setTime(ms);
  });
  const clockPause = time.addButton({ title: 'Pause' });
  clockPause.on('click', () => clock.setPaused(!clock.isPaused()));
  time.addButton({ title: 'Now' }).on('click', () => {
    clock.resetToNow();
    Object.assign(t, { speedExp: 0, sign: 1 });
    pane.refresh();
  });
  clock.onChange(() => { clockPause.title = clock.isPaused() ? 'Play' : 'Pause'; });

  // --- Sim
  const sim = pane.addFolder({ title: 'Sim' });
  sim.addBinding(stats, 'grid', { readonly: true, interval: 500 });
  sim.addBinding(stats, 'precision', { label: 'in use', readonly: true, interval: 500 });
  sim.addBinding(stats, 'fps', { readonly: true, format: (v) => v.toFixed(0), interval: 500 });
  sim.addBinding(stats, 'steps', { readonly: true, format: (v) => v.toFixed(0), interval: 500 });
  sim.addBinding(settings.sim, 'space', { options: opts('map', 'screen') });
  const mapWidth = sim.addBinding(settings.sim, 'mapWidth', { label: 'map width', options: { 1024: 1024, 2048: 2048, 4096: 4096 } });
  const latCorr = sim.addBinding(settings.sim, 'latCorrection', { label: 'lat correction', min: 0, max: 1, step: 0.01 });
  const screenScale = sim.addBinding(settings.sim, 'screenScale', { label: 'px per cell', min: 1, max: 8, step: 0.5 });
  sim.addBinding(settings.sim, 'stepsPerFrame', { label: 'steps/frame', min: 0, max: 64, step: 1 });
  sim.addBinding(settings.sim, 'precision', { options: opts('auto', 'half', 'float') });
  const pauseBtn = sim.addButton({ title: 'Pause' });
  pauseBtn.on('click', () => { ctx.togglePause(); pauseBtn.title = ctx.paused ? 'Play' : 'Pause'; });
  sim.addButton({ title: 'Reseed' }).on('click', () => ctx.reseed());
  // Spec 10d: after a seed, hide the pattern for warm-up steps, then fade it in.
  sim.addBinding(settings.sim, 'warmupSteps', { label: 'warm-up steps', min: 0, max: 5000, step: 1 });
  sim.addBinding(settings.sim, 'fadeSeconds', { label: 'fade seconds', min: 0, max: 30, step: 0.1 });
  sim.addBinding(stats, 'reveal', { readonly: true, format: (v) => v.toFixed(2), interval: 100 });
  sim.addButton({ title: 'Clear' }).on('click', () => ctx.clear());

  // --- Model
  const model = pane.addFolder({ title: 'Model' });
  model.addBinding(settings, 'model', {
    options: { 'Gray-Scott': 'grayScott', 'FitzHugh-Nagumo': 'fitzHughNagumo', Brusselator: 'brusselator' },
  });

  const diffusion = (f, m) => {
    f.addBinding(m, 'Du', { min: 0, max: 0.24, step: 0.0001 });
    f.addBinding(m, 'Dv', { min: 0, max: 0.24, step: 0.0001 });
    f.addBinding(m, 'dt', { min: 0, max: m.dt * 4, step: m.dt / 100 });
  };
  const view = (f, v) => {
    const vf = f.addFolder({ title: 'view', expanded: false });
    vf.addBinding(v, 'channel', { options: opts('u', 'v') });
    vf.addBinding(v, 'lo', { step: 0.01 });
    vf.addBinding(v, 'hi', { step: 0.01 });
  };

  const gs = settings.grayScott;
  const gsF = model.addFolder({ title: 'Gray-Scott' });
  const ui = { presetA: 'maze', presetB: 'mitosis' };
  for (const set of ['a', 'b']) {
    const key = set === 'a' ? 'presetA' : 'presetB';
    const f = gsF.addFolder({ title: `set ${set.toUpperCase()}` });
    f.addBinding(ui, key, { label: 'preset', options: opts(...Object.keys(GS_PRESETS)) })
      .on('change', (ev) => { Object.assign(gs[set], GS_PRESETS[ev.value]); pane.refresh(); });
    f.addBinding(gs[set], 'feed', { min: 0, max: 0.1, step: 0.0001 });
    f.addBinding(gs[set], 'kill', { min: 0, max: 0.08, step: 0.0001 });
  }
  diffusion(gsF, gs);
  gsF.addBinding(gs, 'seedDensity', { label: 'seed density', min: 0, max: 1, step: 0.01 });
  view(gsF, gs.view);

  const fhn = settings.fitzHughNagumo;
  const fhnF = model.addFolder({ title: 'FitzHugh-Nagumo' });
  for (const set of ['a', 'b']) {
    const f = fhnF.addFolder({ title: `set ${set.toUpperCase()}` });
    f.addBinding(fhn[set], 'a0', { min: -1, max: 1, step: 0.001 });
    f.addBinding(fhn[set], 'a1', { min: 0, max: 2, step: 0.001 });
    f.addBinding(fhn[set], 'epsilon', { min: 0, max: 10, step: 0.01 });
  }
  diffusion(fhnF, fhn);
  view(fhnF, fhn.view);

  const br = settings.brusselator;
  const brF = model.addFolder({ title: 'Brusselator' });
  for (const set of ['a', 'b']) {
    const f = brF.addFolder({ title: `set ${set.toUpperCase()}` });
    f.addBinding(br[set], 'A', { min: 0.5, max: 10, step: 0.01 });
    f.addBinding(br[set], 'B', { min: 0, max: 30, step: 0.01 });
  }
  diffusion(brF, br);
  view(brF, br.view);

  // --- Parameter map
  const pm = settings.paramMap;
  const pmF = pane.addFolder({ title: 'Parameter map (A → B)' });
  pmF.addBinding(pm, 'source', { options: opts('uniform', 'latitude', 'depth', 'noise') });
  pmF.addBinding(pm, 'lo', { min: 0, max: 1, step: 0.01 });
  pmF.addBinding(pm, 'hi', { min: 0, max: 1, step: 0.01 });
  pmF.addBinding(pm, 'invert');
  const noiseScale = pmF.addBinding(pm, 'noiseScale', { label: 'noise scale', min: 0.5, max: 20, step: 0.1 });
  const noiseSeed = pmF.addBinding(pm, 'noiseSeed', { label: 'noise seed', min: 0, max: 100, step: 1 });

  // --- Flow
  const flow = pane.addFolder({ title: 'Flow (curl noise)' });
  flow.addBinding(settings.flow, 'strength', { label: 'cells/step', min: 0, max: 0.5, step: 0.001 });
  flow.addBinding(settings.flow, 'scale', { min: 0.5, max: 20, step: 0.1 });
  flow.addBinding(settings.flow, 'evolution', { label: 'evolve /1k steps', min: 0, max: 1, step: 0.001 });

  // --- Display
  const disp = pane.addFolder({ title: 'Display' });
  disp.addBinding(settings.display, 'invert');
  disp.addBinding(settings.display, 'land');

  // --- Colour: one RD layer per channel, each with its own seed
  const c = settings.color;
  const colF = pane.addFolder({ title: 'Colour layers' });
  colF.addBinding(c, 'mode', { options: { 'grey (1 sim)': 'grey', 'RGB add (3)': 'rgb', 'CMYK multiply (4)': 'cmyk', 'HSL (3)': 'hsl', 'specular (1)': 'specular' } });
  const palette = colF.addBinding(c, 'palette', { options: opts('sunny', 'night', 'split') });
  const rangeH = colF.addBinding(c.range, 'h', { label: '± hue °', min: 0, max: 180, step: 1 });
  const rangeS = colF.addBinding(c.range, 's', { label: '± sat', min: 0, max: 50, step: 0.5 });
  const rangeL = colF.addBinding(c.range, 'l', { label: '± light', min: 0, max: 50, step: 0.5 });
  const hslRows = (f, o, label) => {
    f.addBlade({ view: 'separator' });
    f.addBinding(o, 'h', { label: `${label} H`, min: 0, max: 360, step: 1 });
    f.addBinding(o, 's', { label: `${label} S`, min: 0, max: 100, step: 0.5 });
    f.addBinding(o, 'l', { label: `${label} L`, min: 0, max: 100, step: 0.5 });
  };
  const palF = { rgb: [], cmyk: [], hsl: [] };
  const palettes = [];
  for (const name of ['sunny', 'night']) {
    const p = c[name];
    const f = colF.addFolder({ title: name, expanded: false });
    const water = f.addBinding(p, 'water');
    f.addBinding(p, 'land');
    if (!hasLayers(p)) {
      palettes.push(f);
      continue;
    }
    water.on('change', () => { assignDeep(p, waterLayers(p.water)); pane.refresh(); });
    const rgbF = f.addFolder({ title: 'RGB layers' });
    p.rgb.forEach((o, i) => hslRows(rgbF, o, 'RGB'[i]));
    const cmykF = f.addFolder({ title: 'CMYK layers' });
    p.cmyk.forEach((o, i) => hslRows(cmykF, o, 'CMYK'[i]));
    const hslF = f.addFolder({ title: 'HSL base' });
    hslRows(hslF, p.hsl, 'base');
    palF.rgb.push(rgbF);
    palF.cmyk.push(cmykF);
    palF.hsl.push(hslF);
    palettes.push(f);
  }
  // Specular only: the moonlit target between night and sunny (no layers).
  const moonF = colF.addFolder({ title: 'moon', expanded: false });
  moonF.addBinding(c.moon, 'water');
  moonF.addBinding(c.moon, 'land');

  // --- Specular (10c): layer 0 as wave height, glinting under the real sun and moon
  const sp = settings.specular;
  const specF = pane.addFolder({ title: 'Specular' });
  specF.addBinding(sp, 'normalStrength', { label: 'normal strength', min: 0, max: 50, step: 0.1 });
  specF.addBinding(sp, 'exponent', { min: 1, max: 2000, step: 1 });
  specF.addBinding(sp, 'strength', { min: 0, max: 4, step: 0.01 });
  specF.addBinding(sp, 'moonGlint', { label: 'moon glint' });
  specF.addBinding(sp, 'moonLighting', { label: 'moon lighting' });
  specF.addBinding(settings.twilight, 'moonLux', { label: 'moon stop lux', min: 0.005, max: 5 });

  // --- Settings file
  const file = pane.addFolder({ title: 'Settings' });
  file.addButton({ title: 'Copy settings' }).on('click', () => navigator.clipboard.writeText(json(settings)));
  file.addButton({ title: 'Download settings.json' }).on('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json(settings)], { type: 'application/json' }));
    a.download = 'settings.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  file.addButton({ title: 'Reset' }).on('click', () => { assignDeep(settings, structuredClone(initial)); pane.refresh(); });

  // Show only what applies.
  function relayout() {
    const isMap = settings.sim.space === 'map';
    mapWidth.hidden = latCorr.hidden = !isMap;
    screenScale.hidden = isMap;
    gsF.hidden = settings.model !== 'grayScott';
    fhnF.hidden = settings.model !== 'fitzHughNagumo';
    brF.hidden = settings.model !== 'brusselator';
    noiseScale.hidden = noiseSeed.hidden = pm.source !== 'noise';
    const coloured = c.mode !== 'grey' && c.mode !== 'specular';
    rangeH.hidden = rangeS.hidden = c.mode !== 'hsl';
    rangeL.hidden = palette.hidden = !coloured;
    palettes.forEach((f) => { f.hidden = c.mode === 'grey'; });
    specF.hidden = moonF.hidden = c.mode !== 'specular';
    for (const [mode, folders] of Object.entries(palF)) folders.forEach((f) => { f.hidden = c.mode !== mode; });
  }
  pane.on('change', relayout);
  relayout();

  addEventListener('keydown', (e) => {
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement)) {
      pane.hidden = !pane.hidden;
    }
  });
}
