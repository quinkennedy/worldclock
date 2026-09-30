#version 300 es
// Spec 01: day/night terminator with a smooth twilight gradient from a clear-sky illuminance model.
precision highp float;

uniform vec2 uResolution;   // canvas size in device pixels
uniform vec3 uSunDir;       // unit vector to the sun, Earth-fixed (x: 0°,0°  y: 0°,90°E  z: N pole)
uniform sampler2D uLand;    // land mask, equirectangular, row 0 = 90°N, col 0 = 180°W

uniform vec3 uDayWater;
uniform vec3 uDayLand;
uniform vec3 uNightWater;
uniform vec3 uNightLand;
uniform vec3 uLetterbox;

uniform float uMinAspect;   // narrowest width/height the map stretches to before letterboxing

uniform float uNightLux;    // ground illuminance that reads as full night (and the sky's floor)
uniform float uDayLux;      // ground illuminance that reads as full day

out vec4 fragColor;

const float PI = 3.14159265358979;
const float DEG = PI / 180.0;

// Approximate clear-sky ground illuminance in lux for a sun altitude in degrees, excluding
// the night floor. Physical model constants, not design values:
//  - twilight skylight falls ~0.4 decades per degree below the horizon (~400 lux at 0°,
//    ~3 lux at -6°, ~0.01 lux at -12°) and levels off above it;
//  - direct sun and daylit sky rise with sin(alt), dimmed by Kasten-Young air mass, so they
//    fade in smoothly from the horizon (~10 klux at 10°, ~50 klux at 30°, ~120 klux overhead).
float illuminance(float altDeg) {
  float k = pow(10.0, 0.4 * altDeg);
  float lux = 794.0 * k / (1.0 + k);
  if (altDeg > 0.0) {
    float s = sin(altDeg * DEG);
    float airMass = 1.0 / (s + 0.50572 * pow(altDeg + 6.07995, -1.6364));
    lux += 128000.0 * s * pow(0.8, airMass) + 25000.0 * s * pow(0.9, airMass);
  }
  return lux;
}

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

  float la = lat * DEG;
  float lo = lon * DEG;
  vec3 normal = vec3(cos(la) * cos(lo), cos(la) * sin(lo), sin(la));
  float altDeg = asin(clamp(dot(normal, uSunDir), -1.0, 1.0)) / DEG;

  // Brightness follows log illuminance, roughly as the eye perceives it.
  float lux = illuminance(altDeg) + uNightLux;
  float light = clamp(log(lux / uNightLux) / log(uDayLux / uNightLux), 0.0, 1.0);

  // u wraps at ±180° (texture uses REPEAT on s).
  vec2 uv = vec2(lon / 360.0 + 0.5, 0.5 - lat / 180.0);
  float land = texture(uLand, uv).r;

  vec3 day = mix(uDayWater, uDayLand, land);
  vec3 night = mix(uNightWater, uNightLand, land);
  fragColor = vec4(mix(night, day, light), 1.0);
}
