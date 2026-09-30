#version 300 es
// Spec 01: day/night terminator with a smooth twilight gradient from a clear-sky illuminance model.
// Spec 04: relief. The sun's altitude is taken against the terrain normal, not the sphere's.
precision highp float;

uniform vec2 uResolution;   // canvas size in device pixels
uniform vec3 uSunDir;       // unit vector to the sun, Earth-fixed (x: 0°,0°  y: 0°,90°E  z: N pole)
uniform sampler2D uLand;    // land mask, equirectangular, row 0 = 90°N, col 0 = 180°W
uniform sampler2D uSlope;   // terrain slopes, same layout: R = dh/d(east), G = dh/d(north), m/m

uniform vec3 uDayWater;
uniform vec3 uDayLand;
uniform vec3 uNightWater;
uniform vec3 uNightLand;
uniform vec3 uLetterbox;

uniform float uMinAspect;   // narrowest width/height the map stretches to before letterboxing

uniform float uNightLux;    // ground illuminance that reads as full night (and the sky's floor)
uniform float uDayLux;      // ground illuminance that reads as full day

uniform float uLandExaggeration; // vertical exaggeration of land relief
uniform float uSeaExaggeration;  // vertical exaggeration of the seafloor (bathymetry)

out vec4 fragColor;

#include "twilight.glsl"

void main() {
  // Full longitude always fills the width. Wider than 2:1: square pixels, poles cropped.
  // 2:1 down to uMinAspect: stretched vertically to fill. Narrower: held at uMinAspect, letterboxed.
  float aspect = uResolution.x / uResolution.y;
  float pxPerDegX = uResolution.x / 360.0;
  float pxPerDegY = max(pxPerDegX, uResolution.x / (max(aspect, uMinAspect) * 180.0));
  vec2 deg = (gl_FragCoord.xy - 0.5 * uResolution) / vec2(pxPerDegX, pxPerDegY);
  float lon = deg.x;
  float lat = deg.y;
  if (abs(lat) > 90.0) {
    fragColor = vec4(uLetterbox, 1.0);
    return;
  }

  // u wraps at ±180° (textures use REPEAT on s).
  vec2 uv = vec2(lon / 360.0 + 0.5, 0.5 - lat / 180.0);
  float land = texture(uLand, uv).r;

  // Tilt the sphere normal by the exaggerated slope, in the local east/north/up frame.
  // Coasts blend the two exaggerations by land fraction.
  float la = lat * DEG;
  float lo = lon * DEG;
  vec3 up = vec3(cos(la) * cos(lo), cos(la) * sin(lo), sin(la));
  vec3 east = vec3(-sin(lo), cos(lo), 0.0);
  vec3 north = vec3(-sin(la) * cos(lo), -sin(la) * sin(lo), cos(la));
  vec2 slope = texture(uSlope, uv).rg * mix(uSeaExaggeration, uLandExaggeration, land);
  vec3 normal = normalize(up - slope.x * east - slope.y * north);
  float altDeg = asin(clamp(dot(normal, uSunDir), -1.0, 1.0)) / DEG;

  float light = daylight(altDeg, uNightLux, uDayLux);

  vec3 day = mix(uDayWater, uDayLand, land);
  vec3 night = mix(uNightWater, uNightLand, land);
  fragColor = vec4(mix(night, day, light), 1.0);
}
