#version 300 es
// Parameter map: the weight (0 = set A, 1 = set B) that blends the reaction parameters, per
// equirectangular cell (row 0 = 90°N). Rebuilt only when its settings change.
precision highp float;
precision highp int;

uniform vec2 uSize;
uniform int uSource;          // 0 uniform, 1 latitude, 2 depth, 3 noise
uniform float uLo;
uniform float uHi;
uniform bool uInvert;
uniform float uNoiseScale;
uniform float uNoiseSeed;
uniform highp sampler2D uElevation; // packed 16-bit: round(metres) + 32768, R = high byte, G = low byte

out vec4 fragColor;

#include "noise.glsl"

const float MAX_DEPTH = 8000.0; // metres that count as fully deep

float height(vec2 uv) {
  ivec2 size = textureSize(uElevation, 0);
  ivec2 p = clamp(ivec2(uv * vec2(size)), ivec2(0), size - 1);
  vec2 rg = floor(texelFetch(uElevation, p, 0).rg * 255.0 + 0.5);
  return rg.x * 256.0 + rg.y - 32768.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float lat = (0.5 - uv.y) * PI;
  float lon = (uv.x - 0.5) * 2.0 * PI;

  float raw = 0.0;
  if (uSource == 1) raw = abs(lat) / (0.5 * PI);
  else if (uSource == 2) raw = clamp(-height(uv) / MAX_DEPTH, 0.0, 1.0);
  else if (uSource == 3) raw = fbm2(vec4(sphere(lat, lon) * uNoiseScale, uNoiseSeed));

  float w = 0.0;
  if (uSource != 0) {
    w = smoothstep(uLo, max(uHi, uLo + 1e-4), raw);
    if (uInvert) w = 1.0 - w;
  }
  fragColor = vec4(w, 0.0, 0.0, 1.0);
}
