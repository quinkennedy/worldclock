// Spec 07: the developer panel. main.js imports this only with ?gui, so the public page
// never fetches Tweakpane. `g` shows or hides the panel.
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import * as clock from './clock.js';
import { solarLongitudeTime } from './sun.js';
import { nextMoonPhase } from './moon.js';

const MAX_SPEED_EXP = 5; // x1 .. x100000

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

// config: the live config object that draw() reads (bound in place).
// requestRedraw(): draw at once. onVisibility(visible): the panel was shown or hidden.
// Returns { tick() }, to be called after each draw while the panel is visible.
export function createGui({ config, requestRedraw, onVisibility }) {
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
  };

  const readout = time.addBinding(t, 'now', { label: 'sim UTC', readonly: true, interval: 0 });

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
  for (const key of ['dayWater', 'dayLand', 'nightWater', 'nightLand', 'letterbox']) {
    twilight.addBinding(config.palette, key, { view: 'color' });
  }
  twilight.addBinding(config.layout, 'minAspect', { min: 1, max: 2, step: 0.01 });

  const relief = design.addFolder({ title: 'Relief' });
  relief.addBinding(config.relief, 'landExaggeration', { label: 'land', min: 0, max: 100, step: 0.5 });
  relief.addBinding(config.relief, 'seaExaggeration', { label: 'sea', min: 0, max: 100, step: 0.5 });

  design.on('change', () => requestRedraw());

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
    requestRedraw();
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
      t.now = clock.formatUtc(clock.simNow());
      readout.refresh();
    },
  };
}
