#version 300 es
// Raw greyscale view of one RD channel over a flat land colour, in the piece's layout.
precision highp float;

uniform vec2 uResolution;
uniform float uMinAspect;
uniform sampler2D uState;
uniform sampler2D uLand;
uniform vec2 uVRange;     // equirect v at the grid's top row, and the v span it covers
uniform int uChannel;     // 0 u, 1 v
uniform float uLo;
uniform float uHi;
uniform bool uInvert;
uniform vec3 uLandColor;
uniform vec3 uLetterbox;

out vec4 fragColor;

void main() {
  // Same layout as shaders/sun.frag: full longitude fills the width; poles crop, stretch or letterbox.
  float aspect = uResolution.x / uResolution.y;
  float pxPerDegX = uResolution.x / 360.0;
  float pxPerDegY = max(pxPerDegX, uResolution.x / (max(aspect, uMinAspect) * 180.0));
  vec2 deg = (gl_FragCoord.xy - 0.5 * uResolution) / vec2(pxPerDegX, pxPerDegY);
  if (abs(deg.y) > 90.0) {
    fragColor = vec4(uLetterbox, 1.0);
    return;
  }
  vec2 eq = vec2(deg.x / 360.0 + 0.5, 0.5 - deg.y / 180.0);
  vec2 g = vec2(eq.x, (eq.y - uVRange.x) / uVRange.y);

  vec4 s = texture(uState, g);
  float t = clamp(((uChannel == 0 ? s.r : s.g) - uLo) / (uHi - uLo), 0.0, 1.0);
  if (uInvert) t = 1.0 - t;
  float land = texture(uLand, eq).r;
  fragColor = vec4(mix(vec3(t), uLandColor, smoothstep(0.4, 0.6, land)), 1.0);
}
