// The piece's scene drawn into an offscreen equirectangular texture, for the projection prototypes (11a decision 1).
// Moved out of main.js by spec 11d (decision 13) so 11d imports it instead of copying it a second time. The drawing
// is copied from js/main.js's draw(), drawStars() and drawDiscs() (11a decision 2), drawing into the offscreen
// framebuffer at w×h (2:1, so the whole map with no letterbox) instead of the canvas.
import { hexToRgb } from '../../js/config.js';
import { sunPosition } from '../../js/sun.js';
import { skyMatrix, starVertices, STAR_STRIDE } from '../../js/stars.js';
import { createWater } from '../../js/water.js';
import {
  createProgram, createQuad, drawQuad, createMapTexture, createSlopeTexture, createStarBuffer,
} from '../../js/gl.js';

// Paths are relative to a page in proto/<name>/.
const ROOT = '../../';

// --- loading ------------------------------------------------------------------

export async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

export async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

// Shader source with each `#include "file"` line replaced by that file (relative to the shader).
export async function fetchShader(url) {
  const dir = url.slice(0, url.lastIndexOf('/') + 1);
  const lines = await Promise.all((await fetchText(url)).split('\n').map((line) => {
    const m = line.match(/^\s*#include\s+"([^"]+)"/);
    return m ? fetchText(dir + m[1]) : line;
  }));
  return lines.join('\n');
}

export async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

export async function fetchBitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}

// Land mask > 0.5 as bytes, row 0 = 90°N.
export function landMask(bitmap) {
  const { width: w, height: h } = bitmap;
  const ctx = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = rgba[i * 4] >= 128 ? 1 : 0;
  return mask;
}

// Everything the scene needs, fetched in parallel. `land` is the land.png bitmap.
export async function loadSceneSources() {
  const [vert, frag, slope, starVert, starFrag, discVert, discFrag, waterSeed, waterSim, waterFlow, waterParam,
    land, elevation, stars] = await Promise.all([
    fetchText(`${ROOT}shaders/quad.vert`),
    fetchShader(`${ROOT}shaders/sun.frag`),
    fetchText(`${ROOT}shaders/slope.frag`),
    fetchShader(`${ROOT}shaders/stars.vert`),
    fetchText(`${ROOT}shaders/stars.frag`),
    fetchText(`${ROOT}shaders/disc.vert`),
    fetchText(`${ROOT}shaders/disc.frag`),
    fetchShader(`${ROOT}shaders/water-seed.frag`),
    fetchShader(`${ROOT}shaders/water-sim.frag`),
    fetchShader(`${ROOT}shaders/water-flow.frag`),
    fetchShader(`${ROOT}shaders/water-param.frag`),
    fetchBitmap(`${ROOT}data/land.png`),
    fetchBitmap(`${ROOT}data/elevation.webp`),
    fetchBuffer(`${ROOT}data/stars.bin`),
  ]);
  return {
    vert, frag, slope, starVert, starFrag, discVert, discFrag, land, elevation, stars: starVertices(stars),
    water: { seed: waterSeed, sim: waterSim, flow: waterFlow, param: waterParam },
  };
}

// --- the scene ------------------------------------------------------------------

// The scene's GL objects for one context; call again after context loss. config is read live every frame.
// Returns { landTex, water, target, stats, render(frameMs, now, sunDir, moon, w, mip) }; after render, target is
// { tex, fbo, w, h, mip } (RGBA8, 2:1, repeating in longitude, row 0 = 90°S as GL draws it).
export function createScene(gl, s, config) {
  const prog = createProgram(gl, s.vert, s.frag);
  const vao = createQuad(gl);
  const landTex = createMapTexture(gl, s.land);
  const slopeTex = createSlopeTexture(gl, s.elevation, s.vert, s.slope, vao);
  const starProg = createProgram(gl, s.starVert, s.starFrag);
  const starBuf = createStarBuffer(gl, s.stars, STAR_STRIDE);
  const discProg = createProgram(gl, s.discVert, s.discFrag);
  const water = createWater(gl, { vert: s.vert, ...s.water }, s.elevation, landTex, vao, config.water);
  const scene = { landTex, water, target: null, stats: { size: '' }, render };

  // The offscreen texture, created again only when its size or mipmapping changes.
  function ensureTarget(w, mip) {
    const t = scene.target;
    if (t && t.w === w && t.mip === mip) return;
    if (t) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
    const h = w / 2;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    scene.target = { tex, fbo, w, h, mip };
    scene.stats.size = `${w}×${h}`;
  }

  // The scene into the offscreen texture, w px wide (even).
  function render(frameMs, now, sunDir, moon, w, mip) {
    ensureTarget(w, mip);
    water.update(frameMs);
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.target.fbo);
    drawScene(now, sunDir, moon, scene.target.w, scene.target.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (mip) {
      gl.bindTexture(gl.TEXTURE_2D, scene.target.tex);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  }

  function drawScene(now, sunDir, moon, w, h) {
    const u = prog.uniforms;
    const p = config.palette;
    const t = config.twilight;
    const r = config.relief;
    const sp = config.water.specular;
    const view = config.water.grayScott.view;

    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.program);
    gl.uniform2f(u.uResolution, w, h);
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
    gl.bindTexture(gl.TEXTURE_2D, landTex);
    gl.uniform1i(u.uLand, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, slopeTex);
    gl.uniform1i(u.uSlope, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, water.texture());
    gl.uniform1i(u.uWater, 2);

    drawQuad(gl, vao);
    drawStars(now, sunDir, w, h);
    drawDiscs(now, moon, w, h);
  }

  function drawStars(now, sunDir, w, h) {
    const u = starProg.uniforms;
    const st = config.stars;

    gl.useProgram(starProg.program);
    gl.uniformMatrix3fv(u.uSky, false, skyMatrix(now));
    gl.uniform3fv(u.uSunDir, sunDir);
    gl.uniform2f(u.uResolution, w, h);
    gl.uniform1f(u.uMinAspect, config.layout.minAspect);
    gl.uniform1f(u.uNightLux, config.twilight.nightLux);
    gl.uniform1f(u.uDayLux, config.twilight.dayLux);
    gl.uniform1f(u.uMagLimit, st.magLimit);
    gl.uniform1f(u.uBrightMag, st.brightMag);
    gl.uniform1f(u.uSizeFaint, st.sizeFaint);
    gl.uniform1f(u.uSizeBright, st.sizeBright);
    gl.uniform1f(u.uAlphaFaint, st.alphaFaint);
    gl.uniform1f(u.uAlphaBright, st.alphaBright);
    gl.uniform1f(u.uSaturation, st.saturation);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(starBuf.vao);
    gl.drawArraysInstanced(gl.POINTS, 0, starBuf.count, 3);
    gl.disable(gl.BLEND);
  }

  function drawDiscs(now, moon, w, h) {
    const u = discProg.uniforms;
    const d = config.discs;
    const sun = sunPosition(now);

    gl.useProgram(discProg.program);
    gl.uniform2f(u.uResolution, w, h);
    gl.uniform1f(u.uMinAspect, config.layout.minAspect);
    gl.uniform1f(u.uLineWidth, d.lineWidth);
    gl.uniform1f(u.uSoftness, d.terminatorSoftness);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(vao);

    gl.uniform2f(u.uCentre, sun.lon, sun.lat);
    gl.uniform1f(u.uDiameter, d.sunSize);
    gl.uniform3fv(u.uColor, hexToRgb(d.sunColor));
    gl.uniform1i(u.uTerminator, 0);
    gl.uniform1i(u.uFill, 0);
    gl.uniform1i(u.uOutline, 1);
    gl.uniform1f(u.uAlpha, 1);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 3);

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

  return scene;
}
