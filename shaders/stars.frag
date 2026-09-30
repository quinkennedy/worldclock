#version 300 es
// Spec 05: one antialiased disc per star, alpha-blended over the night-side map.
precision highp float;

in vec3 vColor;
in float vAlpha;
in float vRadius;

out vec4 fragColor;

void main() {
  float r = length(gl_PointCoord - 0.5) * (2.0 * vRadius + 1.0); // px from the centre
  float cover = clamp(vRadius + 0.5 - r, 0.0, 1.0);
  fragColor = vec4(vColor, vAlpha * cover);
}
