#version 300 es
// Spec 06: a thin antialiased outline, plus (moon only) a soft line along the terminator or, with uFill,
// a fill over the lit part, alpha-blended over the map. Where the sun and moon overlap, both show.
precision highp float;

in vec2 vLocal;
flat in float vRadius;
flat in float vLineWidth;
flat in float vSoftness;
flat in vec2 vLitDir;

uniform vec3 uColor;
uniform bool uTerminator;   // draw the phase (moon)
uniform bool uFill;         // phase as a fill over the lit part, not a terminator line
uniform bool uOutline;      // draw the limb circle
uniform float uCosPhase;    // cos of the Sun–Moon–Earth angle: 1 full, −1 new
uniform float uAlpha;       // opacity of the whole disc

out vec4 fragColor;

void main() {
  float r = length(vLocal);
  float halfW = 0.5 * vLineWidth;
  float alpha = uOutline ? clamp(halfW + 0.5 - abs(r - vRadius), 0.0, 1.0) : 0.0;

  if (uTerminator && r < vRadius) {
    // Unit-disc coordinates: u towards the sun, v across. The terminator is the visible half of the
    // ellipse u = −cos(phase)·√(1 − v²): it bulges away from the sun when gibbous, towards it when crescent.
    vec2 q = vLocal / vRadius;
    float u = dot(q, vLitDir);
    float v = dot(q, vec2(-vLitDir.y, vLitDir.x));
    float s = sqrt(max(1.0 - v * v, 1e-6));
    float f = u + uCosPhase * s; // > 0 on the lit side
    float dist = f / length(vec2(1.0, -uCosPhase * v / s)) * vRadius; // signed px, first-order
    if (uFill) {
      float lit = smoothstep(-0.5 - 0.5 * vSoftness, 0.5 + 0.5 * vSoftness, dist);
      alpha = max(alpha, lit * clamp(vRadius + 0.5 - r, 0.0, 1.0));
    } else {
      alpha = max(alpha, 1.0 - smoothstep(halfW - 0.5, halfW + 0.5 + vSoftness, abs(dist)));
    }
  }

  alpha *= uAlpha;
  if (alpha <= 0.0) discard;
  fragColor = vec4(uColor, alpha);
}
