#version 300 es
// Spec 10e (from 10a): fills the Gray-Scott state. R = u, G = v, B = land fraction (fixed for the grid's life).
// Row 0 = 90°N, the same as the map textures.
precision highp float;
precision highp int;

uniform vec2 uGrid;        // sim grid size in cells
uniform sampler2D uLand;
uniform float uSeed;       // random per reseed
uniform float uDensity;    // fraction of 8x8-cell seed blocks

out vec4 fragColor;

#include "noise.glsl"

void main() {
  vec2 uv = gl_FragCoord.xy / uGrid;
  float land = texture(uLand, uv).r;
  ivec4 cell = ivec4(ivec2(gl_FragCoord.xy), int(uSeed), 0);
  float r1 = hash4(cell) - 0.5;
  float r2 = hash4(cell + ivec4(0, 0, 0, 1)) - 0.5;
  ivec4 block = ivec4(ivec2(gl_FragCoord.xy) / 8, int(uSeed), 7);
  bool seeded = hash4(block) < uDensity;
  vec2 s = seeded ? vec2(0.5, 0.25) + 0.1 * vec2(r1, r2) : vec2(1.0, 0.0);
  fragColor = vec4(s, land, 1.0);
}
