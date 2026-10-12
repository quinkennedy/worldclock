// Spec 11d panels (decision 16). Right: the piece's own dev panel (js/gui.js: time, presets, the scene's design
// values). Left: the patchwork, from settings.json. Both always start visible; `g` hides them together.
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import { createGui } from '../../js/gui.js';
import { diffDeep } from '../11-orange-peel/gui.js';
import { MODES, BASES, SHAPE_MODES } from './regions.js';

const json = (o) => JSON.stringify(o, null, 2) + '\n';
const options = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v.label ?? v, k]));

// A { lon, lat } view of a [lon, lat] array for Tweakpane, writing back in place.
function lonLat(get, set) {
  return {
    get lon() { return get()[0]; },
    set lon(v) { set([v, get()[1]]); },
    get lat() { return get()[1]; },
    set lat(v) { set([get()[0], v]); },
  };
}

// settings: this prototype's live settings (read every frame). config / baseConfig: as 11a. defaultCentre(i): region
// i's Voronoi centre when its own is null. Returns { tick() }, called after each draw while the panels are visible.
export async function createPatchworkGui({ config, baseConfig, settings, water, fps, stats, defaultCentre,
  onVisibility }) {
  const initial = structuredClone(settings);
  const settingsJson = () => json({ ...settings, scene: diffDeep(config, baseConfig) });
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed', left: '8px', top: '8px', width: '300px', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto',
  });
  document.body.append(container);
  const pane = new Pane({ title: 'Chamberlin patchwork (11d)', container });

  const patch = pane.addFolder({ title: 'Patchwork' });
  patch.addBinding(settings, 'regionMode', { label: 'regions', options: options(MODES) });
  patch.addBinding(settings, 'base', { label: 'base map', options: options(BASES) });
  patch.addBinding(settings, 'explode', { min: 0.3, max: 1.3, step: 0.005 });
  // Spec 11h: the gap the packed base map keeps between pieces or pages.
  const packGap = patch.addBinding(settings, 'packGap', { label: 'pack gap', min: 0, max: 0.05, step: 0.001 });
  patch.addBinding(settings, 'polarLat', { label: 'polar from |lat|', min: 45, max: 90, step: 0.5 });
  patch.addBinding(settings, 'edgeSoftness', { label: 'edge px', min: 0.25, max: 6, step: 0.05 });
  patch.addBinding(settings, 'hideOceans', { label: 'hide oceans' });
  // Spec 11g: each continent as an atlas page.
  const atlas = pane.addFolder({ title: 'Atlas pages' });
  atlas.addBinding(settings, 'page', {
    options: {
      off: 'none', 'minimal rectangle': 'minimal', 'A4 (portrait or landscape)': 'a4', 'equal A4 pages': 'equal',
    },
  });
  // Spec 11i: equal pages: one A4 size for all; big continents split into several pages, each its own map.
  const equalOnly = [
    atlas.addBinding(settings, 'pageSizeDeg', { label: 'page long side °', min: 30, max: 150, step: 1 }),
    atlas.addBinding(settings, 'pageOverlapDeg', { label: 'split overlap °', min: 0, max: 15, step: 0.5 }),
  ];
  atlas.addBinding(settings, 'pageMarginDeg', { label: 'page margin °', min: 0, max: 15, step: 0.25 });
  // Spec 11j: groups (Asia's five parts) get pages as one continent.
  atlas.addBinding(settings, 'pageGroups', { label: 'whole Asia on pages' });
  // Spec 11e: the overlapping shapes.
  const shapeOnly = [
    patch.addBinding(settings, 'shapeMarginDeg', { label: 'shape margin °', min: 0, max: 15, step: 0.25 }),
    patch.addBinding(settings, 'minIslandKm2', { label: 'ignore land under km²', min: 0, max: 200000, step: 1000 }),
    patch.addBinding(stats, 'notes', { label: 'fits', readonly: true, multiline: true, rows: 3, interval: 500 }),
  ];

  const debug = pane.addFolder({ title: 'Tuning' });
  debug.addBinding(settings, 'showPoints', { label: 'control points' });
  debug.addBinding(settings, 'pointColor', { label: 'point colour', view: 'color' });
  debug.addBinding(settings, 'tint', { label: 'region tint', min: 0, max: 1, step: 0.01 });

  // One folder per region: its three points and its Voronoi centre.
  const regionsFolder = pane.addFolder({ title: 'Regions', expanded: false });
  const centreBindings = [];
  settings.regions.forEach((r, i) => {
    const f = regionsFolder.addFolder({ title: `${r.name}${r.source === 'not published' ? '' : ' (NGS)'}`,
      expanded: false });
    for (let k = 0; k < 3; k++) {
      const p = lonLat(() => r.points[k], (v) => { r.points[k] = v; });
      f.addBinding(p, 'lon', { label: `p${k + 1} lon`, min: -180, max: 180, step: 0.25 });
      f.addBinding(p, 'lat', { label: `p${k + 1} lat`, min: -90, max: 90, step: 0.25 });
    }
    const c = lonLat(() => r.centre ?? defaultCentre(i), (v) => { r.centre = v; });
    centreBindings.push(
      f.addBinding(c, 'lon', { label: 'voronoi lon', min: -180, max: 180, step: 0.25 }),
      f.addBinding(c, 'lat', { label: 'voronoi lat', min: -90, max: 90, step: 0.25 }),
    );
  });

  const look = pane.addFolder({ title: 'Layout' });
  look.addBinding(settings, 'background', { view: 'color' });
  look.addBinding(settings, 'margin', { min: 0, max: 0.2, step: 0.005 });

  const tech = pane.addFolder({ title: 'Render', expanded: false });
  tech.addBinding(settings, 'sceneScale', { label: 'scene px scale', min: 0.25, max: 3, step: 0.05 });
  tech.addBinding(settings, 'mipmaps');
  tech.addBinding(settings, 'meshStepDeg', { label: 'mesh step °', min: 0.25, max: 5, step: 0.25 });
  tech.addBinding(stats, 'scene', { readonly: true, interval: 500 });
  tech.addBinding(stats, 'regions', { label: 'regions built', readonly: true, interval: 500 });

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
  // In place, so the region bindings keep their arrays.
  file.addButton({ title: 'Reset' }).on('click', () => {
    const init = structuredClone(initial);
    for (const [k, v] of Object.entries(init)) if (k !== 'regions') settings[k] = v;
    init.regions.forEach((r, i) => Object.assign(settings.regions[i], r));
    pane.refresh();
  });

  // The Voronoi centres matter only in Voronoi mode, the shape controls only in the shape modes.
  function relayout() {
    for (const b of centreBindings) b.hidden = settings.regionMode !== 'voronoi';
    for (const b of shapeOnly) b.hidden = !SHAPE_MODES.includes(settings.regionMode);
    packGap.hidden = !BASES[settings.base].pack;
    for (const b of equalOnly) b.hidden = settings.page !== 'equal';
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
