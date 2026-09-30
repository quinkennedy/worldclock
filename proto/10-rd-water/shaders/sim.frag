#version 300 es
// One reaction-diffusion step with advection. State: R = u, G = v, B = land fraction.
// Grid row 0 = the top of the covered range (north). x wraps at ±180°; the top and bottom are no-flux.
precision highp float;
precision highp int;

uniform sampler2D uState;
uniform sampler2D uFlow;     // east/north cells per step, equirectangular
uniform sampler2D uParam;    // R = weight between sets A and B, equirectangular
uniform vec2 uGrid;
uniform vec2 uVRange;        // equirect v at the grid's top row, and the v span it covers
uniform float uLatCorrection;// 0 uniform on the map, 1 uniform on the globe
uniform int uModel;          // 0 Gray-Scott, 1 FitzHugh-Nagumo, 2 Brusselator
uniform vec4 uParamsA;
uniform vec4 uParamsB;
uniform vec2 uDiffusion;     // Du, Dv in cells² per step
uniform float uDt;           // reaction step
uniform vec2 uRest;          // what land cells hold

out vec4 fragColor;

const float PI = 3.14159265358979;

void main() {
  vec2 uv = gl_FragCoord.xy / uGrid;
  vec2 eq = vec2(uv.x, uVRange.x + uv.y * uVRange.y);
  vec4 c = texelFetch(uState, ivec2(gl_FragCoord.xy), 0);
  if (c.b > 0.5) {
    fragColor = vec4(uRest, c.b, 1.0);
    return;
  }

  // East-west neighbours sit 1/cos(lat) cells apart, so a step is the same ground distance both ways.
  float lat = (0.5 - eq.y) * PI;
  float ew = min(mix(1.0, 1.0 / max(cos(lat), 1e-3), uLatCorrection), 0.25 * uGrid.x);

  // Semi-Lagrangian advection: take the value from upstream.
  vec2 vel = texture(uFlow, eq).rg;
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

  vec4 p = mix(uParamsA, uParamsB, texture(uParam, eq).r);
  float u = a.x, v = a.y;
  vec2 r;
  if (uModel == 0) {        // Gray-Scott: p = (feed, kill)
    float uvv = u * v * v;
    r = vec2(-uvv + p.x * (1.0 - u), uvv - (p.x + p.y) * v);
  } else if (uModel == 1) { // FitzHugh-Nagumo: p = (a0, a1, epsilon)
    r = vec2(u - u * u * u - v, p.z * (u - p.y * v - p.x));
  } else {                  // Brusselator: p = (A, B)
    float uuv = u * u * v;
    r = vec2(p.x - (p.y + 1.0) * u + uuv, p.y * u - uuv);
  }

  vec2 next = a + uDiffusion * lap + uDt * r;
  next = uModel == 0 ? clamp(next, 0.0, 1.0) : clamp(next, -50.0, 50.0);
  fragColor = vec4(next, c.b, 1.0);
}
