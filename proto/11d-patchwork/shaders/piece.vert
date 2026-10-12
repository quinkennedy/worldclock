#version 300 es
// Spec 11d: one patchwork piece, from a mesh projected on the CPU in its own Chamberlin trimetric (regions.js).
precision highp float;

layout(location = 0) in vec2 aXY;  // radians at the piece's centre, the anchor at 0, y up, north up at the anchor
layout(location = 1) in vec3 aDir; // the point on the unit sphere

uniform vec2 uScale;    // clip units per layout unit, x and y
uniform vec2 uOffset;   // the anchor's place on the base map, minus the layout's centre (layout units)
uniform float uExplode; // the piece's scale about its anchor

out vec3 vDir;
out vec2 vXY; // the piece's own coordinates, for the atlas page's rectangle (spec 11g)

void main() {
  gl_Position = vec4((uOffset + uExplode * aXY) * uScale, 0.0, 1.0);
  vDir = aDir;
  vXY = aXY;
}
