#version 300 es
// Spec 11c: a whole-world map: the scene looked up at the interpolated point on the sphere.
precision highp float;

in vec3 vDir;

uniform sampler2D uScene;   // the piece, equirectangular, row 0 = 90°S (rendered with GL)
uniform float uLonOffset;   // degrees added to the mesh's longitudes (anchoring and rotation)

out vec4 fragColor;

void main() {
  vec3 d = normalize(vDir);
  float lon = degrees(atan(d.y, d.x)) + uLonOffset;
  float lat = degrees(asin(clamp(d.z, -1.0, 1.0)));
  vec2 uv = vec2(fract((lon + 180.0) / 360.0), 0.5 + lat / 180.0);
  // Where u wraps from 1 to 0 inside a pixel quad, take the derivative of the copy that doesn't wrap there, so the
  // mipmap level stays right across the date line.
  float u2 = fract(uv.x + 0.5);
  vec2 dx = vec2(dFdx(uv.x), dFdx(uv.y)), dy = vec2(dFdy(uv.x), dFdy(uv.y));
  if (abs(dFdx(u2)) < abs(dx.x)) dx.x = dFdx(u2);
  if (abs(dFdy(u2)) < abs(dy.x)) dy.x = dFdy(u2);
  fragColor = vec4(textureGrad(uScene, uv, dx, dy).rgb, 1.0);
}
