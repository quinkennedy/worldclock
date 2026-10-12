// Spec 11a panels (11c: more projections). Right: the piece's own dev panel (js/gui.js: time, presets, the scene's design values from
// config.json). Left: the gores, from settings.json. Both always start visible; `g` hides them together.
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import { createGui } from '../../js/gui.js';
import { MAPS } from './maps.js';

// Projection dropdown: label → settings value. Gores (11a, HEALPix from 11c), then whole-world maps (11c).
const PROJECTION_OPTIONS = {
  'Nicolosi globular (gores)': 'globular',
  'Cassini (gores)': 'cassini',
  'Interrupted sinusoidal (gores)': 'sinusoidal',
  'HEALPix (gores)': 'healpix',
  'Marbles (grid of globes)': 'marbles',
  ...Object.fromEntries(Object.entries(MAPS).map(([k, m]) => [m.label, k])),
};

const json = (o) => JSON.stringify(o, null, 2) + '\n';

// Copies every leaf of `from` onto `to` in place, so bindings to `to` stay valid.
export function assignDeep(to, from) {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && to[k] && typeof to[k] === 'object') assignDeep(to[k], v);
    else to[k] = v;
  }
}

// The leaves of `obj` that differ from `base`, as a nested object (empty if none).
export function diffDeep(obj, base) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const b = base?.[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const d = diffDeep(v, b);
      if (Object.keys(d).length) out[k] = d;
    } else if (JSON.stringify(v) !== JSON.stringify(b)) {
      out[k] = v;
    }
  }
  return out;
}

// settings: this prototype's live settings (read every frame). config: the live scene config, which the right panel
// edits; baseConfig: the piece's config.json as loaded. Saved settings carry the scene values that differ from
// config.json in `scene`. stats: { scene, landmasses, seams } read-outs.
// Returns { tick() }, called after each draw while the panels are visible.
export async function createPeelGui({ config, baseConfig, settings, water, fps, stats, onVisibility }) {
  const initial = structuredClone(settings);
  const settingsJson = () => json({ ...settings, scene: diffDeep(config, baseConfig) });
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed', left: '8px', top: '8px', width: '280px', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
  });
  document.body.append(container);
  const pane = new Pane({ title: 'Orange peel (11a)', container });

  const gores = pane.addFolder({ title: 'Gores' });
  gores.addBinding(settings, 'projection', { options: PROJECTION_OPTIONS });
  gores.addBinding(settings, 'anchor', { options: { land: 'land', sun: 'sun' } });
  const landRot = gores.addBinding(settings, 'landFirstCentre', { label: 'first centre °', min: -360, max: 360, step: 0.5 });
  const sunRot = gores.addBinding(settings, 'sunFirstCentre', { label: 'first centre ° (sun)', min: -360, max: 360, step: 0.5 });
  const mapLandRot = gores.addBinding(settings, 'mapLandCentre', { label: 'turn °', min: -180, max: 180, step: 0.5 });
  const mapSunRot = gores.addBinding(settings, 'mapSunCentre', { label: 'turn ° (sun)', min: -180, max: 180, step: 0.5 });
  const countBinding = gores.addBinding(settings, 'count', { min: 2, max: 12, step: 1 });
  const goreOnly = [
    gores.addBinding(settings, 'gapDeg', { label: 'gap °', min: 0, max: 30, step: 0.1 }),
    gores.addBinding(settings, 'joinDeg', { label: 'join ±° (0 off)', min: 0, max: 30, step: 0.5 }),
    gores.addBinding(settings, 'joinBlendDeg', { label: 'join blend °', min: 0, max: 30, step: 0.5 }),
  ];

  const spill = pane.addFolder({ title: 'Spill' });
  goreOnly.push(spill);
  spill.addBinding(settings, 'spillDeg', { label: 'max spill °', min: 0, max: 45, step: 0.5 });

  const marbles = pane.addFolder({ title: 'Marbles' });
  marbles.addBinding(settings, 'marbleRows', { label: 'rows N/S', min: 1, max: 9, step: 1 });
  marbles.addBinding(settings, 'marbleLatDeg', { label: 'top row lat °', min: 0, max: 90, step: 0.5 });
  marbles.addBinding(settings, 'marbleDistance', { label: 'distance (radii)', min: 1.05, max: 30, step: 0.05 });
  marbles.addBinding(settings, 'marbleHex', { label: 'hex grid' });
  marbles.addBinding(settings, 'marbleZoom', { label: 'zoom (clip to cell)', min: 0.25, max: 4, step: 0.01 });
  marbles.addBinding(settings, 'marbleGap', { label: 'gap (× cell)', min: 0, max: 1, step: 0.01 });

  const look = pane.addFolder({ title: 'Layout' });
  look.addBinding(settings, 'background', { view: 'color' });
  look.addBinding(settings, 'margin', { min: 0, max: 0.2, step: 0.005 });

  const tech = pane.addFolder({ title: 'Render', expanded: false });
  tech.addBinding(settings, 'sceneScale', { label: 'scene px scale', min: 0.25, max: 3, step: 0.05 });
  tech.addBinding(settings, 'mipmaps');
  tech.addBinding(settings, 'meshStepDeg', { label: 'mesh step °', min: 0.25, max: 5, step: 0.25 });
  tech.addBinding(stats, 'scene', { readonly: true, interval: 500 });
  tech.addBinding(stats, 'landmasses', { readonly: true, format: (v) => v.toFixed(0), interval: 1000 });
  tech.addBinding(stats, 'seams', { label: 'seams °', readonly: true, interval: 250 });

  const file = pane.addFolder({ title: 'Settings' });
  file.addButton({ title: 'Copy settings' }).on('click', () => navigator.clipboard.writeText(settingsJson()));
  file.addButton({ title: 'Download settings.json' }).on('click', () => {
    const url = URL.createObjectURL(new Blob([settingsJson()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'settings.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  file.addButton({ title: 'Reset' }).on('click', () => { assignDeep(settings, structuredClone(initial)); pane.refresh(); });

  // Show the rotation that applies to the current anchoring, and the gore controls only for gores (spec 11c: the
  // whole-world maps have no gores or spill).
  function relayout() {
    const map = settings.projection in MAPS;
    const marble = settings.projection === 'marbles';
    landRot.hidden = map || settings.anchor !== 'land';
    sunRot.hidden = map || settings.anchor !== 'sun';
    mapLandRot.hidden = !map || settings.anchor !== 'land';
    mapSunRot.hidden = !map || settings.anchor !== 'sun';
    for (const b of goreOnly) b.hidden = map || marble;
    countBinding.hidden = map;
    marbles.hidden = !marble;
  }
  pane.on('change', relayout);
  relayout();

  const piece = createGui({
    config, water, fps,
    onVisibility(visible) {
      pane.hidden = !visible;
      document.body.style.cursor = '';
      onVisibility(visible);
    },
  });
  return { tick: () => piece.tick() };
}
