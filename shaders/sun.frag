#version 300 es
// Spec 01: day/night terminator with soft civil / nautical / astronomical twilight bands.
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

uniform float uSoftness;    // degrees, half-width of each band edge blend
uniform float uCivil;       // brightness inside each band, 0 = night, 1 = day
uniform float uNautical;
uniform float uAstronomical;

out vec4 fragColor;

const float PI = 3.14159265358979;
const float DEG = PI / 180.0;

float edge(float altDeg, float at) {
  return smoothstep(at - uSoftness, at + uSoftness, altDeg);
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

  // Stepped bands with soft edges: night < -18 < astro < -12 < nautical < -6 < civil < 0 < day.
  float light = uAstronomical * edge(altDeg, -18.0)
              + (uNautical - uAstronomical) * edge(altDeg, -12.0)
              + (uCivil - uNautical) * edge(altDeg, -6.0)
              + (1.0 - uCivil) * edge(altDeg, 0.0);

  // u wraps at ±180° (texture uses REPEAT on s).
  vec2 uv = vec2(lon / 360.0 + 0.5, 0.5 - lat / 180.0);
  float land = texture(uLand, uv).r;

  vec3 day = mix(uDayWater, uDayLand, land);
  vec3 night = mix(uNightWater, uNightLand, land);
  fragColor = vec4(mix(night, day, light), 1.0);
}
