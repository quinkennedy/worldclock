#version 300 es
// Spec 11d: the control-point overlay (dots and triangle edges), placed like the pieces (piece.vert).
precision highp float;

layout(location = 0) in vec2 aXY;

uniform vec2 uScale;
uniform vec2 uOffset;
uniform float uExplode;
uniform float uPointSize;

void main() {
  gl_Position = vec4((uOffset + uExplode * aXY) * uScale, 0.0, 1.0);
  gl_PointSize = uPointSize;
}
