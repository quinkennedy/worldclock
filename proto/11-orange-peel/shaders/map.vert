#version 300 es
// Spec 11c: a whole-world map, from a mesh projected on the CPU (maps.js).
precision highp float;

layout(location = 0) in vec2 aXY;  // projected position, projection units, y up
layout(location = 1) in vec3 aDir; // the point on the unit sphere, the map's central meridian at longitude 0

uniform vec2 uScale;  // clip units per projection unit, x and y
uniform vec2 uCentre; // the middle of the map's bounds, projection units

out vec3 vDir;

void main() {
  gl_Position = vec4((aXY - uCentre) * uScale, 0.0, 1.0);
  vDir = aDir;
}
