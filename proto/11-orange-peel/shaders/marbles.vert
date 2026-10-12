#version 300 es
// The Earth seen as a grid of marbles: one instance per marble, a square around its cell. Columns go west to east
// around the Earth (like the gores), rows north to south. Hex: odd rows sit half a column east, on screen and on
// the Earth, in pointy-top hexagonal cells.
precision highp float;
precision highp int;

layout(location = 0) in vec2 aPos; // quad corner, −1..1

uniform vec2 uResolution;   // canvas size in device pixels
uniform float uCell;        // cell size, px: a square's side, a hexagon's flat-to-flat width
uniform float uPitch;       // distance between neighbouring cells' centres in a row, px
uniform float uZoom;        // marble diameter / cell size
uniform bool uHex;
uniform int uCols;
uniform int uRows;
uniform float uFirstLon;    // longitude of the westernmost column's centre, degrees (not wrapped)
uniform float uMaxLat;      // latitude the top row looks at (the bottom row looks at −uMaxLat), degrees

out vec2 vCell;             // the cell's flat edges at ±1, y up
flat out vec2 vCentre;      // lon, lat the marble looks at, degrees

void main() {
  int col = gl_InstanceID % uCols;
  int row = gl_InstanceID / uCols;
  float shift = uHex && uRows > 1 ? (row % 2 == 1 ? 0.25 : -0.25) : 0.0; // the grid centred
  vec2 slot = vec2(float(col) - 0.5 * float(uCols - 1) + shift, 0.5 * float(uRows - 1) - float(row));
  vec2 pitch = vec2(uPitch, uHex ? uPitch * sqrt(3.0) / 2.0 : uPitch);
  // Whichever is smaller, the marble or its cell (a hexagon reaches 2/√3 vertically), plus a couple of px of edge.
  float reach = min(uZoom, uHex ? 2.0 / sqrt(3.0) : 1.0) + 4.0 / uCell;
  vCell = aPos * reach;
  vec2 px = 0.5 * uResolution + slot * pitch + vCell * 0.5 * uCell;
  gl_Position = vec4(px / uResolution * 2.0 - 1.0, 0.0, 1.0);
  float lat = uRows > 1 ? uMaxLat * (1.0 - 2.0 * float(row) / float(uRows - 1)) : 0.0;
  float lonStep = 360.0 / float(uCols);
  vCentre = vec2(uFirstLon + (float(col) + (uHex && row % 2 == 1 ? 0.5 : 0.0)) * lonStep, lat);
}
