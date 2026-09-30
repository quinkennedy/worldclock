#version 300 es
// Fills the sim state: R = u, G = v, B = land fraction (fixed for the grid's life).
precision highp float;
precision highp int;

uniform vec2 uGrid;        // sim grid size in cells
uniform vec2 uVRange;      // equirect v at the grid's top row, and the v span it covers
uniform sampler2D uLand;
uniform int uModel;        // 0 Gray-Scott, 1 FitzHugh-Nagumo, 2 Brusselator
uniform vec4 uParams;      // set A reaction parameters (the Brusselator's rest state needs them)
uniform float uSeed;       // random per reseed
uniform float uDensity;    // Gray-Scott: fraction of seed blocks
uniform bool uClear;       // rest state only, no seeds or noise

out vec4 fragColor;

#include "noise.glsl"

void main() {
  vec2 uv = gl_FragCoord.xy / uGrid;
  float land = texture(uLand, vec2(uv.x, uVRange.x + uv.y * uVRange.y)).r;
  ivec4 cell = ivec4(ivec2(gl_FragCoord.xy), int(uSeed), 0);
  float r1 = hash4(cell) - 0.5;
  float r2 = hash4(cell + ivec4(0, 0, 0, 1)) - 0.5;
  if (uClear) {
    r1 = 0.0;
    r2 = 0.0;
  }

  vec2 s;
  if (uModel == 0) {
    ivec4 block = ivec4(ivec2(gl_FragCoord.xy) / 8, int(uSeed), 7);
    bool seeded = !uClear && hash4(block) < uDensity;
    s = seeded ? vec2(0.5, 0.25) + 0.1 * vec2(r1, r2) : vec2(1.0, 0.0);
  } else if (uModel == 1) {
    s = 0.1 * vec2(r1, r2);
  } else {
    float A = uParams.x, B = uParams.y;
    s = vec2(A, B / A) + 0.1 * vec2(r1, r2);
  }
  fragColor = vec4(s, land, 1.0);
}
