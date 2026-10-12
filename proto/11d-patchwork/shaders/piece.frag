#version 300 es
// Spec 11d: one patchwork piece: the scene looked up at the interpolated point on the sphere, kept only where the
// region grid says this region (decision 11; spec 11e: a bit per region, so regions can overlap). The edge is the
// 0.5 contour of the bilinear coverage of the region's cells, antialiased over about uSoft screen pixels. Spec 11g:
// an atlas page instead keeps everything inside its rectangle (the map carries on to the page's edge).
precision highp float;
precision highp usampler2D;

in vec3 vDir;
in vec2 vXY;

uniform sampler2D uScene;   // the piece, equirectangular, row 0 = 90°S (rendered with GL)
uniform usampler2D uLabels; // a bit per region per cell, row 0 = 90°N
uniform uint uRegion;
uniform float uSoft;        // edge width, screen px
uniform vec3 uTint;         // debug tint per region
uniform float uTintAmount;
uniform int uPage;          // 1: an atlas page, cut to uRect
uniform vec4 uRect;         // the page: minX, maxX, minY, maxY in the piece's coordinates

out vec4 fragColor;

float isRegion(ivec2 c, ivec2 size) {
  c.x = (c.x % size.x + size.x) % size.x;
  c.y = clamp(c.y, 0, size.y - 1);
  return float((texelFetch(uLabels, c, 0).r >> uRegion) & 1u);
}

// Coverage of this region at (lon, lat): the 0.5 contour of the bilinear coverage of its cells, antialiased.
float regionAlpha(float lon, float lat) {
  ivec2 size = textureSize(uLabels, 0);
  vec2 t = vec2((lon + 180.0) / 360.0 * float(size.x), (90.0 - lat) / 180.0 * float(size.y)) - 0.5;
  ivec2 i0 = ivec2(floor(t));
  vec2 f = t - floor(t);
  float c = mix(
    mix(isRegion(i0, size), isRegion(i0 + ivec2(1, 0), size), f.x),
    mix(isRegion(i0 + ivec2(0, 1), size), isRegion(i0 + ivec2(1, 1), size), f.x), f.y);
  return clamp((c - 0.5) / max(fwidth(c) * uSoft, 1e-4) + 0.5, 0.0, 1.0);
}

void main() {
  vec3 d = normalize(vDir);
  float lon = degrees(atan(d.y, d.x));
  float lat = degrees(asin(clamp(d.z, -1.0, 1.0)));

  float alpha;
  if (uPage == 1) {
    vec2 inside = min(vXY - uRect.xz, uRect.yw - vXY);
    vec2 fw = max(fwidth(vXY) * uSoft, vec2(1e-6));
    alpha = clamp(min(inside.x / fw.x, inside.y / fw.y) + 0.5, 0.0, 1.0);
  } else {
    alpha = regionAlpha(lon, lat);
  }
  if (alpha <= 0.0) discard;

  vec2 uv = vec2(fract((lon + 180.0) / 360.0), 0.5 + lat / 180.0);
  // As 11c's map.frag: where u wraps inside a pixel quad, use the derivative of the copy that doesn't wrap there.
  float u2 = fract(uv.x + 0.5);
  vec2 dx = vec2(dFdx(uv.x), dFdx(uv.y)), dy = vec2(dFdy(uv.x), dFdy(uv.y));
  if (abs(dFdx(u2)) < abs(dx.x)) dx.x = dFdx(u2);
  if (abs(dFdy(u2)) < abs(dy.x)) dy.x = dFdy(u2);
  vec3 col = textureGrad(uScene, uv, dx, dy).rgb;
  fragColor = vec4(mix(col, uTint, uTintAmount), alpha);
}
