// Spec 10e: Gray-Scott reaction-diffusion on the oceans, carried by a curl-noise flow (from proto/10-rd-water/,
// specs 10a and 10d). An equirectangular grid of ping-pong float targets, created once per grid size and reused.
// The sim steps on rendered frames, not the sim clock: its drift is a design value, not astronomy.
import { createProgram, drawQuad } from './gl.js';

const FLOW_SIZE = [512, 256];
const PARAM_SIZE = [1024, 512];

function target(gl, w, h, internal, format, type) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, ok, w, h };
}

function freeTarget(gl, t) {
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

// sources: { vert, seed, sim, flow, param } shader sources; elevation: 02's packed image; landTex: the land mask.
// settings: config.water, read live each frame. Returns { update(now), texture(), reseed(), paused, stats }.
// Without float render targets there's no sim: texture() is a flat 1x1 and the water shows only its base colours.
export function createWater(gl, sources, elevation, landTex, vao, settings) {
  const stats = { grid: '', precision: '', steps: 0, reveal: 0 };
  const api = { stats, paused: false, update() {}, reseed() {}, texture: () => flat };

  const flat = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, flat);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 255]));

  if (!gl.getExtension('EXT_color_buffer_float')) {
    console.warn('water: EXT_color_buffer_float unavailable, drawing without the pattern');
    stats.grid = 'none';
    return api;
  }
  const floatLinear = !!gl.getExtension('OES_texture_float_linear');

  const progs = {
    seed: createProgram(gl, sources.vert, sources.seed),
    sim: createProgram(gl, sources.vert, sources.sim),
    flow: createProgram(gl, sources.vert, sources.flow),
    param: createProgram(gl, sources.vert, sources.param),
  };

  // Packed heights for the depth map: exact bytes, read only with texelFetch.
  const elevTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, elevTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, elevation);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const flow = target(gl, ...FLOW_SIZE, gl.RG16F, gl.RG, gl.HALF_FLOAT);
  const param = target(gl, ...PARAM_SIZE, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  let grid = null;      // { w, h, precision, key, targets: [a, b], read }
  let paramKey = '';
  let flowTime = 0;
  let warmup = false;   // spec 10d: hide the pattern after a seed, then fade it in
  let fadeStart = 0;
  let framesSinceSeed = 0; // instantWarmup waits for one drawn frame, so the page never sits blank

  function pass(prog, t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, t.w, t.h);
    gl.useProgram(prog.program);
    return prog.uniforms;
  }

  function bindTex(unit, tex, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  function seed() {
    for (const t of grid.targets) {
      const u = pass(progs.seed, t);
      gl.uniform2f(u.uGrid, grid.w, grid.h);
      bindTex(0, landTex, u.uLand);
      gl.uniform1f(u.uSeed, Math.floor(Math.random() * 100000));
      gl.uniform1f(u.uDensity, settings.grayScott.seedDensity);
      drawQuad(gl, vao);
    }
    stats.steps = 0;
    warmup = true;
    fadeStart = 0;
    framesSinceSeed = 0;
  }

  // Rebuilds the ping-pong pair when the grid changes, and reseeds.
  function ensureGrid() {
    const s = settings.sim;
    const precision = s.precision === 'float' && floatLinear ? 'float' : 'half';
    const w = s.mapWidth;
    const h = w / 2;
    const key = `${w}:${precision}`;
    if (grid && grid.key === key) return;
    if (grid) grid.targets.forEach((t) => freeTarget(gl, t));
    const half = precision === 'half';
    const make = () => target(gl, w, h, half ? gl.RGBA16F : gl.RGBA32F, gl.RGBA, half ? gl.HALF_FLOAT : gl.FLOAT);
    grid = { w, h, precision, key, targets: [make(), make()], read: 0 };
    if (!grid.targets[0].ok) console.error(`water: ${precision} render target incomplete`);
    stats.grid = `${w} × ${h}`;
    stats.precision = precision;
    seed();
  }

  function updateParamMap() {
    const d = settings.depthMap;
    const key = `${d.lo}:${d.hi}:${d.invert}`;
    if (key === paramKey) return;
    paramKey = key;
    const u = pass(progs.param, param);
    gl.uniform2f(u.uSize, ...PARAM_SIZE);
    gl.uniform1f(u.uLo, d.lo);
    gl.uniform1f(u.uHi, d.hi);
    gl.uniform1i(u.uInvert, d.invert ? 1 : 0);
    bindTex(0, elevTex, u.uElevation);
    drawQuad(gl, vao);
  }

  function updateFlow() {
    const f = settings.flow;
    const u = pass(progs.flow, flow);
    gl.uniform2f(u.uSize, ...FLOW_SIZE);
    gl.uniform1f(u.uScale, f.scale);
    gl.uniform1f(u.uTime, flowTime);
    gl.uniform1f(u.uStrength, f.strength);
    drawQuad(gl, vao);
  }

  function step(n) {
    const gs = settings.grayScott;
    const prog = progs.sim;
    const u = prog.uniforms;
    gl.useProgram(prog.program);
    gl.uniform2f(u.uGrid, grid.w, grid.h);
    gl.uniform1f(u.uLatCorrection, settings.sim.latCorrection);
    gl.uniform2f(u.uParamsA, gs.a.feed, gs.a.kill);
    gl.uniform2f(u.uParamsB, gs.b.feed, gs.b.kill);
    gl.uniform2f(u.uDiffusion, gs.Du, gs.Dv);
    gl.uniform1f(u.uDt, gs.dt);
    bindTex(1, flow.tex, u.uFlow);
    bindTex(2, param.tex, u.uParam);
    gl.viewport(0, 0, grid.w, grid.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.uState, 0);
    for (let i = 0; i < n; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, grid.targets[1 - grid.read].fbo);
      gl.bindTexture(gl.TEXTURE_2D, grid.targets[grid.read].tex);
      drawQuad(gl, vao);
      grid.read = 1 - grid.read;
    }
    stats.steps += n;
  }

  // Spec 10d: 0 until warmupSteps have run since the seed, then 0 -> 1 over fadeSeconds of frame time.
  function reveal(now) {
    if (!warmup) return 1;
    const s = settings.sim;
    if (stats.steps < s.warmupSteps) return 0;
    if (!fadeStart) fadeStart = now;
    const r = s.fadeSeconds > 0 ? (now - fadeStart) / (s.fadeSeconds * 1000) : 1;
    if (r >= 1) warmup = false;
    return Math.min(r, 1);
  }

  // now: the frame clock (performance.now ms), which times the fade. Leaves the default framebuffer bound.
  api.update = (now) => {
    ensureGrid();
    updateParamMap();
    if (!api.paused) {
      const s = settings.sim;
      const n = s.stepsPerFrame;
      // From the frame after a seed is drawn, instantWarmup runs the hold faster: up to warmupStepsPerFrame
      // steps per frame, in chunks of a normal frame's steps so the flow evolves as it would have.
      const fast = s.instantWarmup && warmup && framesSinceSeed > 0 && stats.steps < s.warmupSteps && n > 0;
      const frames = fast
        ? Math.max(1, Math.ceil(Math.min(s.warmupStepsPerFrame, s.warmupSteps - stats.steps) / n)) : 1;
      for (let i = 0; i < frames; i++) {
        flowTime += settings.flow.evolution * n / 1000;
        updateFlow();
        step(n);
      }
    }
    framesSinceSeed++;
    stats.reveal = reveal(now);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  api.reseed = () => { if (grid) seed(); };
  api.texture = () => (grid ? grid.targets[grid.read].tex : flat);
  return api;
}
