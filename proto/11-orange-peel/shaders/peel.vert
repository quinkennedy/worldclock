#version 300 es
// Spec 11a: one gore per instance, from a mesh projected on the CPU around longitude 0.
precision highp float;
precision highp int;

layout(location = 0) in vec2 aXY;  // projected position, unit sphere, gore centred at 0
layout(location = 1) in vec2 aGeo; // dl (degrees from the gore's centre), lat (degrees)

uniform vec2 uScale;       // clip units per unit of the projection, x and y
uniform float uSpacing;    // distance between gore centres on screen, projection units
uniform int uCount;
uniform float uFirstCentre; // longitude of the westernmost gore's centre, degrees (not wrapped)

out vec2 vGeo;
out float vLon;            // absolute longitude, degrees (not wrapped)
flat out int vGore;

void main() {
  int i = gl_InstanceID;
  float slot = float(i) - 0.5 * float(uCount - 1);
  gl_Position = vec4(vec2(aXY.x + slot * uSpacing, aXY.y) * uScale, 0.0, 1.0);
  vGeo = aGeo;
  vLon = uFirstCentre + float(i) * 360.0 / float(uCount) + aGeo.x;
  vGore = i;
}
