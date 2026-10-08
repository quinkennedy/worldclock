#version 300 es
// Spec 10e (from 10a): one Gray-Scott step with advection. State: R = u, G = v, B = land fraction.
// Equirectangular grid, row 0 = 90°N. x wraps at ±180°; the poles are no-flux.
precision highp float;
precision highp int;

uniform sampler2D uState;
uniform sampler2D uFlow;     // east/north cells per step, equirectangular
uniform sampler2D uParam;    // R = weight between sets A and B, equirectangular
uniform vec2 uGrid;
uniform float uLatCorrection;// 0 uniform on the map, 1 uniform on the globe
uniform vec2 uParamsA;       // feed, kill
uniform vec2 uParamsB;
uniform vec2 uDiffusion;     // Du, Dv in cells² per step
uniform float uDt;           // reaction step

out vec4 fragColor;

const float PI = 3.14159265358979;

void main() {
  vec2 uv = gl_FragCoord.xy / uGrid;
  vec4 c = texelFetch(uState, ivec2(gl_FragCoord.xy), 0);
  if (c.b > 0.5) {
    fragColor = vec4(1.0, 0.0, c.b, 1.0); // land holds the rest state
    return;
  }

  // East-west neighbours sit 1/cos(lat) cells apart, so a step is the same ground distance both ways.
  float lat = (0.5 - uv.y) * PI;
  float ew = min(mix(1.0, 1.0 / max(cos(lat), 1e-3), uLatCorrection), 0.25 * uGrid.x);

  // Semi-Lagrangian advection: take the value from upstream.
  vec2 vel = texture(uFlow, uv).rg;
  vec4 up = texture(uState, uv - vec2(vel.x * ew, -vel.y) / uGrid);
  vec2 a = up.b > 0.5 ? c.rg : up.rg;

  // 5-point Laplacian. A land neighbour counts as this cell's value, so no flux crosses the coast.
  vec2 dx = vec2(ew / uGrid.x, 0.0);
  vec2 dy = vec2(0.0, 1.0 / uGrid.y);
  vec4 n0 = texture(uState, uv + dx);
  vec4 n1 = texture(uState, uv - dx);
  vec4 n2 = texture(uState, uv + dy);
  vec4 n3 = texture(uState, uv - dy);
  vec2 lap = (n0.b > 0.5 ? a : n0.rg) + (n1.b > 0.5 ? a : n1.rg)
           + (n2.b > 0.5 ? a : n2.rg) + (n3.b > 0.5 ? a : n3.rg) - 4.0 * a;

  vec2 p = mix(uParamsA, uParamsB, texture(uParam, uv).r);
  float uvv = a.x * a.y * a.y;
  vec2 r = vec2(-uvv + p.x * (1.0 - a.x), uvv - (p.x + p.y) * a.y);
  fragColor = vec4(clamp(a + uDiffusion * lap + uDt * r, 0.0, 1.0), c.b, 1.0);
}
