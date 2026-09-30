#version 300 es
// Curl-noise flow on the sphere, written to a small equirectangular texture (row 0 = 90°N).
// R = east, G = north velocity, in sim cells per step.
precision highp float;
precision highp int;

uniform vec2 uSize;       // flow texture size
uniform float uScale;     // noise features per radian (roughly)
uniform float uTime;      // noise evolution coordinate
uniform float uStrength;  // cells per step

out vec4 fragColor;

#include "noise.glsl"

float psi(vec3 p) {
  return fbm2(vec4(p * uScale, uTime));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float lat = (0.5 - uv.y) * PI;
  float lon = (uv.x - 0.5) * 2.0 * PI;
  vec3 p = sphere(lat, lon);
  vec3 east = vec3(-sin(lon), cos(lon), 0.0);
  vec3 north = vec3(-sin(lat) * cos(lon), -sin(lat) * sin(lon), cos(lat));

  // Tangent gradient of the stream function; the flow is up x gradient, so it's divergence-free.
  const float E = 0.01;
  float gE = (psi(p + E * east) - psi(p - E * east)) / (2.0 * E);
  float gN = (psi(p + E * north) - psi(p - E * north)) / (2.0 * E);
  vec2 vel = vec2(-gN, gE) / max(uScale, 1e-3);
  fragColor = vec4(vel * uStrength, 0.0, 1.0);
}
