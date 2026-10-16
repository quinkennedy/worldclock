// Spec 03a panel: palettes (decision 7), blending, the elevation curve, and the scene toggle with its Time folder
// (decision 9, the time controls copied from js/gui.js). Always starts visible; `g` hides it.
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import * as clock from '../../js/clock.js';
import { solarLongitudeTime } from '../../js/sun.js';

const MAX_SPEED_EXP = 5; // x1 .. x100000, as js/gui.js
const CLASSES = ['water', 'arid', 'forest', 'grass', 'ice'];

const json = (o) => JSON.stringify(o, null, 2) + '\n';
const formatSpeed = (exp) => 'x' + Math.round(10 ** exp).toLocaleString('en-US');

// The selected palette, or the first if the name matches none.
export function currentPalette(settings) {
  return settings.palettes.find((p) => p.name === settings.palette) ?? settings.palettes[0];
}

// `name`, or `name 2`, `name 3`, … if a palette other than `self` already has it.
function uniqueName(settings, name, self) {
  const base = name.trim() || 'Palette';
  const taken = (n) => settings.palettes.some((p) => p !== self && p.name === n);
  let n = base;
  for (let i = 2; taken(n); i++) n = `${base} ${i}`;
  return n;
}

// settings: this prototype's live settings (read every frame). fps: { value }. onVisibility(visible).
// Returns { tick() }, called after each draw while the panel is visible.
export function createPaletteGui({ settings, fps, onVisibility }) {
  const initial = structuredClone(settings);
  const pane = new Pane({ title: 'Land-cover palette (03a)' });
  Object.assign(pane.element.parentElement.style, { maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' });
  let syncing = false; // true while the panel is updated from the clock, so it doesn't echo back

  // --- Palette ----------------------------------------------------------------

  const palF = pane.addFolder({ title: 'Palette' });
  let picker = null;
  let editor = null;
  const ui = { name: '' };

  // The dropdown, rebuilt when palettes are added, renamed or removed.
  function buildPicker() {
    picker?.dispose();
    settings.palette = currentPalette(settings).name;
    const options = Object.fromEntries(settings.palettes.map((p) => [p.name, p.name]));
    picker = palF.addBinding(settings, 'palette', { options, index: 0 });
    picker.on('change', () => buildEditor());
  }

  palF.addBinding(settings, 'blend', { options: { 'fraction mix': 'mix', 'dominant class': 'dominant' }, index: 1 });

  // The selected palette's colours and elevation curve, bound to the palette itself.
  function buildEditor() {
    editor?.dispose();
    const pal = currentPalette(settings);
    ui.name = pal.name;
    editor = palF.addFolder({ title: 'Colours', index: 2 });
    for (const k of CLASSES) editor.addBinding(pal, k, { view: 'color' });
    const e = pal.elevation;
    const elev = editor.addFolder({ title: 'Elevation' });
    elev.addBinding(e, 'lo', { label: 'lo m', min: -500, max: 8000, step: 10 });
    elev.addBinding(e, 'hi', { label: 'hi m', min: 0, max: 9000, step: 10 });
    elev.addBinding(e, 'exponent', { min: 0.1, max: 5, step: 0.01 });
    elev.addBinding(e, 'brightness', { min: -0.6, max: 0.6, step: 0.005 });
    elev.addBinding(e, 'saturation', { min: -1, max: 2, step: 0.01 });
    pane.refresh();
  }

  const manage = palF.addFolder({ title: 'Manage', expanded: false });
  manage.addBinding(ui, 'name');
  manage.addButton({ title: 'Save as new' }).on('click', () => {
    const copy = structuredClone(currentPalette(settings));
    copy.name = uniqueName(settings, ui.name === currentPalette(settings).name ? `${ui.name} copy` : ui.name);
    settings.palettes.push(copy);
    settings.palette = copy.name;
    buildPicker();
    buildEditor();
  });
  manage.addButton({ title: 'Rename' }).on('click', () => {
    const pal = currentPalette(settings);
    pal.name = uniqueName(settings, ui.name, pal);
    settings.palette = pal.name;
    buildPicker();
    buildEditor();
  });
  manage.addButton({ title: 'Delete' }).on('click', () => {
    if (settings.palettes.length < 2) return;
    const i = settings.palettes.indexOf(currentPalette(settings));
    settings.palettes.splice(i, 1);
    settings.palette = settings.palettes[Math.min(i, settings.palettes.length - 1)].name;
    buildPicker();
    buildEditor();
  });

  buildPicker();
  buildEditor();

  // --- Scene (decision 9) -----------------------------------------------------

  const sceneF = pane.addFolder({ title: 'Scene' });
  sceneF.addBinding(settings, 'scene', { label: 'lit by sun' });
  const time = sceneF.addFolder({ title: 'Time' });
  const t = { now: clock.formatUtc(clock.simNow()), speedExp: 0, sign: 1, set: clock.formatUtc(clock.simNow()) };
  const readout = time.addBinding(t, 'now', { label: 'sim UTC', readonly: true, interval: 0 });
  const setSpeed = () => { if (!syncing) clock.setSpeed(t.sign * 10 ** t.speedExp); };
  time.addBinding(t, 'speedExp', { label: 'speed', min: 0, max: MAX_SPEED_EXP, step: 0.01, format: formatSpeed })
    .on('change', setSpeed);
  time.addBinding(t, 'sign', { label: 'direction', options: { '+': 1, '−': -1 } }).on('change', setSpeed);
  time.addBinding(t, 'set', { label: 'set UTC' }).on('change', ({ value }) => {
    if (syncing) return;
    const ms = clock.parseUtc(value);
    if (Number.isNaN(ms)) syncFromClock();
    else clock.setTime(ms);
  });
  const playPause = time.addButton({ title: 'Pause' });
  playPause.on('click', () => clock.setPaused(!clock.isPaused()));
  time.addButton({ title: 'Now' }).on('click', () => clock.resetToNow());
  const simYear = () => new Date(clock.simNow()).getUTCFullYear();
  const seasons = [['March equinox', 0], ['June solstice', 90], ['September equinox', 180], ['December solstice', 270]];
  for (const [title, deg] of seasons) {
    time.addButton({ title }).on('click', () => {
      clock.setSpeed(1);
      clock.setTime(solarLongitudeTime(simYear(), deg));
    });
  }
  const relayout = () => { time.hidden = !settings.scene; };
  sceneF.on('change', relayout);
  relayout();

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

  // --- Settings ---------------------------------------------------------------

  const file = pane.addFolder({ title: 'Settings' });
  file.addBinding(fps, 'value', { label: 'fps', readonly: true, format: (v) => v.toFixed(0), interval: 500 });
  const copyBtn = file.addButton({ title: 'Copy settings' });
  copyBtn.on('click', async () => {
    try {
      await navigator.clipboard.writeText(json(settings));
      copyBtn.title = 'Copied';
    } catch (err) {
      console.warn('palette: copy failed:', err);
      copyBtn.title = 'Copy failed';
    }
    setTimeout(() => { copyBtn.title = 'Copy settings'; }, 1500);
  });
  file.addButton({ title: 'Download settings.json' }).on('click', () => {
    const url = URL.createObjectURL(new Blob([json(settings)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'settings.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  file.addButton({ title: 'Reset' }).on('click', () => {
    Object.assign(settings, structuredClone(initial));
    buildPicker();
    buildEditor();
    relayout();
  });

  // --- Visibility -------------------------------------------------------------

  function setVisible(visible) {
    pane.hidden = !visible;
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
