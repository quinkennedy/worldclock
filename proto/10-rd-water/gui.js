// Spec 10a panel. Always visible; `g` hides it. Every edit applies on the next frame.
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';

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
  }
  pane.on('change', relayout);
  relayout();

  addEventListener('keydown', (e) => {
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement)) {
      pane.hidden = !pane.hidden;
    }
  });
}
