// Spec 07: the developer panel. main.js imports this only with ?gui, so the public page
// never fetches Tweakpane. `g` shows or hides the panel.
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import * as clock from './clock.js';
import { solarLongitudeTime, sunDirection } from './sun.js';
import { nextMoonPhase, moonPosition } from './moon.js';

const MAX_SPEED_EXP = 5; // x1 .. x100000

// Spec 06 check: lit percentage and sub-lunar point, to compare with a reference such as timeanddate.com.
function formatMoon(utcMs) {
  const m = moonPosition(utcMs, sunDirection(utcMs));
  const lat = `${Math.abs(m.lat).toFixed(1)}°${m.lat < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(m.lon).toFixed(1)}°${m.lon < 0 ? 'W' : 'E'}`;
  return `${(m.illuminated * 100).toFixed(1)}% lit, ${lat} ${lon}`;
}

function formatSpeed(exp) {
  return 'x' + Math.round(10 ** exp).toLocaleString('en-US');
}

// Copies every leaf of `from` onto `to` in place, so bindings to `to`'s objects stay valid.
function assignDeep(to, from) {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && to[k] && typeof to[k] === 'object') assignDeep(to[k], v);
    else to[k] = v;
  }
}

function configJson(config) {
  return JSON.stringify(config, null, 2) + '\n';
}

// config: the live config object that draw() reads (bound in place); edits show on the next frame.
// water: js/water.js's sim ({ stats, paused, reseed() }). fps: { value }, the measured frame rate.
// onVisibility(visible): the panel was shown or hidden.
// Returns { tick() }, to be called after each draw while the panel is visible.
export function createGui({ config, water, fps, onVisibility }) {
  const initial = structuredClone(config);
  const pane = new Pane({ title: 'World Clock' });
  // Scroll rather than run off short screens.
  Object.assign(pane.element.parentElement.style, { maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' });
  let syncing = false; // true while the panel is updated from the clock, so it doesn't echo back

  // --- Time -----------------------------------------------------------------

  const time = pane.addFolder({ title: 'Time' });
  const t = {
    now: clock.formatUtc(clock.simNow()),
    speedExp: 0,
    sign: 1,
    set: clock.formatUtc(clock.simNow()),
    moon: formatMoon(clock.simNow()),
  };

  const readout = time.addBinding(t, 'now', { label: 'sim UTC', readonly: true, interval: 0 });
  const moonReadout = time.addBinding(t, 'moon', { label: 'moon', readonly: true, interval: 0 });

  const setSpeed = () => { if (!syncing) clock.setSpeed(t.sign * 10 ** t.speedExp); };
  time.addBinding(t, 'speedExp', { label: 'speed', min: 0, max: MAX_SPEED_EXP, step: 0.01, format: formatSpeed })
    .on('change', setSpeed);
  time.addBinding(t, 'sign', { label: 'direction', options: { '+': 1, '−': -1 } })
    .on('change', setSpeed);

  time.addBinding(t, 'set', { label: 'set UTC' }).on('change', ({ value }) => {
    if (syncing) return;
    const ms = clock.parseUtc(value);
    if (Number.isNaN(ms)) syncFromClock(); // put back the current time
    else clock.setTime(ms);
  });

  const playPause = time.addButton({ title: 'Pause' });
  playPause.on('click', () => clock.setPaused(!clock.isPaused()));
  time.addButton({ title: 'Now' }).on('click', () => clock.resetToNow());

  // --- Presets --------------------------------------------------------------

  const presets = pane.addFolder({ title: 'Presets' });
  const simYear = () => new Date(clock.simNow()).getUTCFullYear();
  // Presets reset the speed to +x1 and keep the pause state.
  const jumpTo = (ms) => {
    clock.setSpeed(1);
    clock.setTime(ms);
  };
  const seasons = [
    ['March equinox', 0],
    ['June solstice', 90],
    ['September equinox', 180],
    ['December solstice', 270],
  ];
  for (const [title, deg] of seasons) {
    presets.addButton({ title }).on('click', () => jumpTo(solarLongitudeTime(simYear(), deg)));
  }
  presets.addButton({ title: 'Next full moon' }).on('click', () => jumpTo(nextMoonPhase(clock.simNow(), 0.5)));
  presets.addButton({ title: 'Next new moon' }).on('click', () => jumpTo(nextMoonPhase(clock.simNow(), 0)));

  // --- Design: one folder per spec. twilight.nightLux/dayLux are config-only. ---

  const design = pane.addFolder({ title: 'Design' });

  const twilight = design.addFolder({ title: 'Twilight' });
  for (const key of ['dayWater', 'dayLand', 'moonWater', 'moonLand', 'nightWater', 'nightLand', 'letterbox']) {
    twilight.addBinding(config.palette, key, { view: 'color' });
  }
  twilight.addBinding(config.moonlight, 'enabled', { label: 'moonlight' });
  twilight.addBinding(config.layout, 'minAspect', { min: 1, max: 2, step: 0.01 });

  const relief = design.addFolder({ title: 'Relief' });
  relief.addBinding(config.relief, 'landExaggeration', { label: 'land', min: 0, max: 100, step: 0.5 });

  const stars = design.addFolder({ title: 'Stars' });
  stars.addBinding(config.stars, 'magLimit', { label: 'faintest mag', min: 1, max: 8, step: 0.1 });
  stars.addBinding(config.stars, 'brightMag', { label: 'brightest mag', min: -1.5, max: 3, step: 0.1 });
  stars.addBinding(config.stars, 'sizeFaint', { label: 'size faint °', min: 0, max: 2, step: 0.01 });
  stars.addBinding(config.stars, 'sizeBright', { label: 'size bright °', min: 0, max: 2, step: 0.01 });
  stars.addBinding(config.stars, 'alphaFaint', { label: 'alpha faint', min: 0, max: 1, step: 0.01 });
  stars.addBinding(config.stars, 'alphaBright', { label: 'alpha bright', min: 0, max: 1, step: 0.01 });
  stars.addBinding(config.stars, 'saturation', { label: 'colour', min: 0, max: 1, step: 0.01 });

  const discs = design.addFolder({ title: 'Discs' });
  discs.addBinding(config.discs, 'sunSize', { label: 'sun size °', min: 0.5, max: 30, step: 0.1 });
  discs.addBinding(config.discs, 'moonSize', { label: 'moon size °', min: 0.5, max: 30, step: 0.1 });
  discs.addBinding(config.discs, 'lineWidth', { label: 'line °', min: 0.02, max: 2, step: 0.01 });
  discs.addBinding(config.discs, 'terminatorSoftness', { label: 'terminator soft °', min: 0, max: 3, step: 0.01 });
  discs.addBinding(config.discs, 'sunColor', { label: 'sun', view: 'color' });
  discs.addBinding(config.discs, 'moonColor', { label: 'moon', view: 'color' });
  discs.addBinding(config.discs, 'moonAlpha', { label: 'moon alpha', min: 0, max: 1, step: 0.01 });
  discs.addBinding(config.discs, 'moonFill', { label: 'moon fill' });
  discs.addBinding(config.discs, 'moonOutline', { label: 'moon outline' });

  // Spec 10e: the reaction-diffusion water. Ranges follow the 10a prototype's panel.
  const w = config.water;
  const waterF = design.addFolder({ title: 'Water' });

  const spec = waterF.addFolder({ title: 'Specular' });
  spec.addBinding(w.specular, 'normalStrength', { label: 'normal strength', min: 0, max: 50, step: 0.1 });
  spec.addBinding(w.specular, 'exponent', { min: 1, max: 2000, step: 1 });
  spec.addBinding(w.specular, 'strength', { min: 0, max: 4, step: 0.01 });
  spec.addBinding(w.specular, 'moonGlint', { label: 'moon glint' });

  const gs = waterF.addFolder({ title: 'Gray-Scott', expanded: false });
  gs.addBinding(w.grayScott, 'Du', { min: 0, max: 0.24, step: 0.0001 });
  gs.addBinding(w.grayScott, 'Dv', { min: 0, max: 0.24, step: 0.0001 });
  gs.addBinding(w.grayScott, 'dt', { min: 0, max: 4, step: 0.01 });
  gs.addBinding(w.grayScott, 'seedDensity', { label: 'seed density', min: 0, max: 1, step: 0.01 });
  for (const set of ['a', 'b']) {
    gs.addBinding(w.grayScott[set], 'feed', { label: `feed ${set.toUpperCase()}`, min: 0, max: 0.1, step: 0.0001 });
    gs.addBinding(w.grayScott[set], 'kill', { label: `kill ${set.toUpperCase()}`, min: 0, max: 0.08, step: 0.0001 });
  }
  gs.addBinding(w.grayScott.view, 'lo', { label: 'height lo', step: 0.01 });
  gs.addBinding(w.grayScott.view, 'hi', { label: 'height hi', step: 0.01 });

  const depth = waterF.addFolder({ title: 'Depth map (A → B)', expanded: false });
  depth.addBinding(w.depthMap, 'lo', { min: 0, max: 1, step: 0.01 });
  depth.addBinding(w.depthMap, 'hi', { min: 0, max: 1, step: 0.01 });
  depth.addBinding(w.depthMap, 'invert');

  const flow = waterF.addFolder({ title: 'Flow', expanded: false });
  flow.addBinding(w.flow, 'strength', { label: 'cells/step', min: 0, max: 0.5, step: 0.001 });
  flow.addBinding(w.flow, 'scale', { min: 0.5, max: 20, step: 0.1 });
  flow.addBinding(w.flow, 'evolution', { label: 'evolve /1k steps', min: 0, max: 1, step: 0.001 });

  const sim = waterF.addFolder({ title: 'Sim', expanded: false });
  sim.addBinding(water.stats, 'grid', { readonly: true, interval: 500 });
  sim.addBinding(water.stats, 'precision', { label: 'in use', readonly: true, interval: 500 });
  sim.addBinding(fps, 'value', { label: 'fps', readonly: true, format: (v) => v.toFixed(0), interval: 500 });
  sim.addBinding(water.stats, 'steps', { readonly: true, format: (v) => v.toFixed(0), interval: 500 });
  sim.addBinding(water.stats, 'reveal', { readonly: true, format: (v) => v.toFixed(2), interval: 100 });
  sim.addBinding(w.sim, 'mapWidth', { label: 'map width', options: { 1024: 1024, 2048: 2048, 4096: 4096 } });
  sim.addBinding(w.sim, 'precision', { options: { half: 'half', float: 'float' } });
  sim.addBinding(w.sim, 'stepsPerFrame', { label: 'steps/frame', min: 0, max: 16, step: 1 });
  sim.addBinding(w.sim, 'warmupSteps', { label: 'warm-up steps', min: 0, max: 5000, step: 1 });
  sim.addBinding(w.sim, 'fadeSeconds', { label: 'fade seconds', min: 0, max: 30, step: 0.1 });
  sim.addBinding(w.sim, 'instantWarmup', { label: 'fast warm-up' });
  sim.addBinding(w.sim, 'warmupStepsPerFrame', { label: 'warm-up steps/frame', min: 1, max: 5000, step: 1 });
  const simPause = sim.addButton({ title: 'Pause' });
  simPause.on('click', () => {
    water.paused = !water.paused;
    simPause.title = water.paused ? 'Play' : 'Pause';
  });
  sim.addButton({ title: 'Reseed' }).on('click', () => water.reseed());

  const copyBtn = design.addButton({ title: 'Copy config' });
  copyBtn.on('click', async () => {
    try {
      await navigator.clipboard.writeText(configJson(config));
      copyBtn.title = 'Copied';
    } catch (err) {
      console.warn('gui: copy failed:', err);
      copyBtn.title = 'Copy failed';
    }
    setTimeout(() => { copyBtn.title = 'Copy config'; }, 1500);
  });

  design.addButton({ title: 'Download config' }).on('click', () => {
    const url = URL.createObjectURL(new Blob([configJson(config)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  design.addButton({ title: 'Reset' }).on('click', () => {
    assignDeep(config, structuredClone(initial));
    syncing = true;
    pane.refresh();
    syncing = false;
  });

  // --- Clock -> panel -------------------------------------------------------

  function syncFromClock() {
    const speed = clock.getSpeed();
    const exp = Math.log10(Math.abs(speed));
    if (Math.abs(exp - t.speedExp) > 1e-9) t.speedExp = exp;
    t.sign = speed < 0 ? -1 : 1;
    t.set = clock.formatUtc(clock.simNow());
    playPause.title = clock.isPaused() ? 'Play' : 'Pause';
    syncing = true;
    pane.refresh();
    syncing = false;
  }
  clock.onChange(syncFromClock);
  syncFromClock();

  // --- Visibility ------------------------------------------------------------

  function setVisible(visible) {
    pane.hidden = !visible;
    document.body.style.cursor = visible ? 'auto' : ''; // the public page hides the cursor
    onVisibility(visible);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'g' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    setVisible(pane.hidden);
  });

  setVisible(true);

  return {
    tick() {
      const now = clock.simNow();
      t.now = clock.formatUtc(now);
      t.moon = formatMoon(now);
      readout.refresh();
      moonReadout.refresh();
    },
  };
}
