#version 300 es
// One marble: the unit sphere seen in perspective from uDistance Earth radii, north up, the scene looked up where
// each pixel's ray meets it. The disc's edge is the horizon, so a nearer eye shows less of the Earth. The marble is
// uZoom × its cell across and clipped to the cell.
precision highp float;

in vec2 vCell;
flat in vec2 vCentre;

uniform sampler2D uScene;   // the piece, equirectangular, row 0 = 90°S (rendered with GL)
uniform float uDistance;    // eye distance from the Earth's centre, Earth radii (> 1)
uniform float uZoom;
uniform bool uHex;

out vec4 fragColor;

void main() {
  // Coverage: inside the disc and inside the cell, each antialiased.
  vec2 local = vCell / uZoom; // the disc's edge at length 1
  float r = length(local);
  float disc = clamp(0.5 + (1.0 - r) / max(fwidth(r), 1e-5), 0.0, 1.0);
  vec2 a = abs(vCell);
  float edge = uHex ? max(a.x, 0.5 * a.x + 0.5 * sqrt(3.0) * a.y) : max(a.x, a.y);
  float cell = clamp(0.5 + (1.0 - edge) / max(fwidth(edge), 1e-5), 0.0, 1.0);
  float alpha = disc * cell;

  // Eye on +z looking at the origin; the disc's edge is the tangent ray, tan = 1/√(d² − 1).
  float d = uDistance;
  vec3 v = normalize(vec3(min(r, 1.0) / max(r, 1e-6) * local / sqrt(d * d - 1.0), -1.0));
  float b = d * v.z;                                  // dot(eye, v)
  float s = -b - sqrt(max(b * b - (d * d - 1.0), 0.0));
  vec3 q = vec3(0.0, 0.0, d) + s * v;                 // x east, y north, z towards the eye

  // Into Earth coordinates (x to lon 0, z north), about the marble's centre at lon 0; its longitude added after.
  float phi = radians(vCentre.y);
  vec3 east = vec3(0.0, 1.0, 0.0);
  vec3 north = vec3(-sin(phi), 0.0, cos(phi));
  vec3 out_ = vec3(cos(phi), 0.0, sin(phi));
  vec3 w = q.x * east + q.y * north + q.z * out_;
  float lon = degrees(atan(w.y, w.x)) + vCentre.x;
  float lat = degrees(asin(clamp(w.z, -1.0, 1.0)));
  vec2 uv = vec2(fract((lon + 180.0) / 360.0), 0.5 + lat / 180.0);
  // As map.frag: the derivative of the copy of u that doesn't wrap inside this pixel quad.
  float u2 = fract(uv.x + 0.5);
  vec2 dx = vec2(dFdx(uv.x), dFdx(uv.y)), dy = vec2(dFdy(uv.x), dFdy(uv.y));
  if (abs(dFdx(u2)) < abs(dx.x)) dx.x = dFdx(u2);
  if (abs(dFdy(u2)) < abs(dy.x)) dy.x = dFdy(u2);
  vec3 rgb = textureGrad(uScene, uv, dx, dy).rgb;
  if (alpha <= 0.0) discard; // after the derivatives, which need the whole pixel quad
  fragColor = vec4(rgb, alpha);
}
