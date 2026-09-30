#version 300 es
// Spec 06: a screen-aligned square around one disc (sun or moon), on the shared full-screen quad.
// Drawn as 3 instances, shifted by −360°, 0 and +360°, so a disc straddling ±180° isn't cut off.
precision highp float;

in vec2 aPos;               // quad corner, −1..1

uniform vec2 uResolution;   // canvas size in device pixels
uniform float uMinAspect;
uniform vec2 uCentre;       // disc centre: lon, lat in degrees
uniform float uDiameter;    // degrees of longitude
uniform float uLineWidth;   // degrees of longitude
uniform float uSoftness;    // terminator feather, degrees of longitude
uniform vec2 uLitEN;        // direction to the sun at the centre: local (east, north), unit

out vec2 vLocal;            // px from the disc centre
flat out float vRadius;     // px
flat out float vLineWidth;  // px
flat out float vSoftness;   // px
flat out vec2 vLitDir;      // on screen, unit

const float DEG = 3.14159265358979 / 180.0;

void main() {
  // Same map as sun.frag: full longitude fills the width; latitude stretches up to uMinAspect.
  float aspect = uResolution.x / uResolution.y;
  float pxPerDegX = uResolution.x / 360.0;
  float pxPerDegY = max(pxPerDegX, uResolution.x / (max(aspect, uMinAspect) * 180.0));

  // Round on screen, sized by longitude so it scales with the map, not the stretch.
  vRadius = 0.5 * uDiameter * pxPerDegX;
  vLineWidth = uLineWidth * pxPerDegX;
  vSoftness = uSoftness * pxPerDegX;
  float pad = vRadius + 0.5 * vLineWidth + vSoftness + 1.0;
  vLocal = aPos * pad;

  // A step east covers 1/cos(lat) degrees of longitude on the map.
  float cosLat = max(cos(uCentre.y * DEG), 1e-3);
  vLitDir = normalize(vec2(uLitEN.x / cosLat * pxPerDegX, uLitEN.y * pxPerDegY) + 1e-9);

  float lon = uCentre.x + 360.0 * float(gl_InstanceID - 1);
  vec2 px = vec2(lon * pxPerDegX, uCentre.y * pxPerDegY) + vLocal;
  gl_Position = vec4(px / (0.5 * uResolution), 0.0, 1.0);
}
