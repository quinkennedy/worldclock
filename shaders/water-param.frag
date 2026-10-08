#version 300 es
// Spec 10e (from 10a): the weight (0 = set A, 1 = set B) that blends Gray-Scott's feed and kill, from ocean depth,
// per equirectangular cell (row 0 = 90°N). Rebuilt only when its settings change.
precision highp float;
precision highp int;

uniform float uLo;
uniform float uHi;
uniform bool uInvert;
uniform highp sampler2D uElevation; // packed 16-bit: round(metres) + 32768, R = high byte, G = low byte
uniform vec2 uSize;

out vec4 fragColor;

const float MAX_DEPTH = 8000.0; // metres that count as fully deep

float height(vec2 uv) {
  ivec2 size = textureSize(uElevation, 0);
  ivec2 p = clamp(ivec2(uv * vec2(size)), ivec2(0), size - 1);
  vec2 rg = floor(texelFetch(uElevation, p, 0).rg * 255.0 + 0.5);
  return rg.x * 256.0 + rg.y - 32768.0;
}

void main() {
  float raw = clamp(-height(gl_FragCoord.xy / uSize) / MAX_DEPTH, 0.0, 1.0);
  float w = smoothstep(uLo, max(uHi, uLo + 1e-4), raw);
  fragColor = vec4(uInvert ? 1.0 - w : w, 0.0, 0.0, 1.0);
}
