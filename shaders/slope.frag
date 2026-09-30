#version 300 es
// Spec 04: one-off pass at load. Turns 02's packed elevation into terrain slopes, written to a
// filterable RG16F texture of the same size: R = dh/d(east), G = dh/d(north), metres per metre.
// The packed heights can't be filtered linearly, so this is the only place they're read (texelFetch).
precision highp float;
precision highp int;

uniform highp sampler2D uElevation; // packed 16-bit: round(metres) + 32768, R = high byte, G = low byte

out vec4 fragColor;

const float PI = 3.14159265358979;
const float EARTH_RADIUS = 6371000.0; // metres

float height(ivec2 p, ivec2 size) {
  p.x = (p.x + size.x) % size.x;           // wraps at ±180°
  p.y = clamp(p.y, 0, size.y - 1);          // clamps at the poles
  vec2 rg = floor(texelFetch(uElevation, p, 0).rg * 255.0 + 0.5);
  return rg.x * 256.0 + rg.y - 32768.0;
}

void main() {
  ivec2 size = textureSize(uElevation, 0);
  ivec2 p = ivec2(gl_FragCoord.xy); // row 0 = 90°N, the same as the source

  // Texel spacing on the ground. East-west shrinks with cos(lat), which corrects the
  // east-west gradient by 1/cos(lat) so relief near the poles isn't stretched.
  float lat = (0.5 - (float(p.y) + 0.5) / float(size.y)) * PI;
  float dy = PI * EARTH_RADIUS / float(size.y);
  float dx = 2.0 * PI * EARTH_RADIUS * cos(lat) / float(size.x);

  float east = (height(p + ivec2(1, 0), size) - height(p - ivec2(1, 0), size)) / (2.0 * dx);
  float north = (height(p - ivec2(0, 1), size) - height(p + ivec2(0, 1), size)) / (2.0 * dy);
  fragColor = vec4(east, north, 0.0, 1.0);
}
