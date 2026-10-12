#version 300 es
// Spec 11a: a gore of the scene. Inside its edge (|dl| ≤ half) everything shows; past the edge only land
// belonging to a landmass that crosses that seam (decision 12). Depth: 0 inside (up to 0.25 on the antialiased
// edge), then rising with the distance past the edge, so interiors win over spill and the nearer edge wins between
// two spills.
precision highp float;
precision highp int;
precision highp usampler2D;

in vec2 vGeo;
in float vLon;
flat in int vGore;

uniform sampler2D uScene;   // the piece, equirectangular, row 0 = 90°S (rendered with GL)
uniform sampler2D uLand;    // land mask, row 0 = 90°N
uniform usampler2D uLabels; // landmass per land-mask cell, same layout; 0 = water
uniform usampler2D uFlags;  // per landmass: bit j set if it has land on seam j
uniform int uCount;
uniform float uHalf;        // gore half-width, degrees of longitude
uniform float uSpill;       // how far land may spill past the edge, degrees
uniform float uJoin;        // gores are joined within ±uJoin° of the equator (their edges meet exactly there)

out vec4 fragColor;

bool crosses(ivec2 cell, int seam, ivec2 size) {
  cell.x = (cell.x % size.x + size.x) % size.x;
  cell.y = clamp(cell.y, 0, size.y - 1);
  uint l = texelFetch(uLabels, cell, 0).r;
  if (l == 0u) return false;
  int fw = textureSize(uFlags, 0).x;
  uint f = texelFetch(uFlags, ivec2(int(l) % fw, int(l) / fw), 0).r;
  return (f & (1u << uint(seam))) != 0u;
}

void main() {
  float dl = vGeo.x;
  float lat = vGeo.y;
  float aa = max(fwidth(dl), 1e-4);
  // Degrees past the gore's edge, < 0 inside. Where gores are joined the neighbour's edge lies exactly on this
  // one, so it isn't antialiased against the background: draw a pixel past it, at full cover.
  float past = abs(dl) - uHalf - (abs(lat) <= uJoin ? aa : 0.0);
  float inside = clamp(0.5 - past / aa, 0.0, 1.0);

  float u = (vLon + 180.0) / 360.0; // textures repeat in longitude
  float spill = 0.0;
  if (inside < 1.0 && past < uSpill) {
    int seam = dl > 0.0 ? vGore : (vGore + uCount - 1) % uCount; // east edge: seam i; west: seam i − 1
    ivec2 size = textureSize(uLabels, 0);
    // The 2×2 cells a linear lookup of the land mask blends.
    vec2 p = vec2(u, 0.5 - lat / 180.0) * vec2(size) - 0.5;
    ivec2 c = ivec2(floor(p));
    bool any = crosses(c, seam, size) || crosses(c + ivec2(1, 0), seam, size)
            || crosses(c + ivec2(0, 1), seam, size) || crosses(c + ivec2(1, 1), seam, size);
    if (any) {
      float land = smoothstep(0.4, 0.6, texture(uLand, vec2(u, 0.5 - lat / 180.0)).r);
      spill = land * clamp(0.5 + (uSpill - past) / aa, 0.0, 1.0);
    }
  }

  float a = max(inside, spill);
  if (a < 0.004) discard;
  // Partly covered edge pixels sit a little behind full ones, so a neighbour's full pixel always wins there.
  gl_FragDepth = past <= 0.0 ? 0.25 * (1.0 - inside) : 0.5 + 0.5 * clamp(past / (uSpill + 1.0), 0.0, 1.0);
  fragColor = vec4(texture(uScene, vec2(u, 0.5 + lat / 180.0)).rgb, a);
}
