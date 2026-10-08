#version 300 es
// Spec 01: day/night terminator with a smooth twilight gradient from a clear-sky illuminance model.
// Spec 04: land relief. The sun's (and moon's) altitude on land is taken against the terrain normal.
// Spec 10e: the water is a reaction-diffusion surface seen from straight above; the real sun and moon glint off it.
// Land and water blend night -> moon -> day on one log-lux scale.
precision highp float;

uniform vec2 uResolution;   // canvas size in device pixels
uniform vec3 uSunDir;       // unit vector to the sun, Earth-fixed (x: 0°,0°  y: 0°,90°E  z: N pole)
uniform vec3 uMoonDir;      // unit vector to the moon, same frame
uniform sampler2D uLand;    // land mask, equirectangular, row 0 = 90°N, col 0 = 180°W
uniform sampler2D uSlope;   // terrain slopes, same layout: R = dh/d(east), G = dh/d(north), m/m
uniform sampler2D uWater;   // RD state, same layout: R = u, G = v

uniform vec3 uDayWater;
uniform vec3 uDayLand;
uniform vec3 uMoonWater;
uniform vec3 uMoonLand;
uniform vec3 uNightWater;
uniform vec3 uNightLand;
uniform vec3 uLetterbox;

uniform float uMinAspect;   // narrowest width/height the map stretches to before letterboxing

uniform float uNightLux;    // ground illuminance that reads as full night (and the sky's floor)
uniform float uDayLux;      // ground illuminance that reads as full day
uniform float uMoonStopLux; // ground illuminance at which the colour is fully the moon target

uniform float uLandExaggeration; // vertical exaggeration of land relief

// Spec 14's moon, as built in 10c.
uniform bool uMoonlight;    // moon lux in the base colours
uniform bool uMoonGlint;    // the moon's own glint on the water
uniform float uMoonPhase;   // Sun–Moon–Earth angle, degrees (0 full)
uniform float uMoonDist;    // km

// Spec 10e: the water's surface.
uniform int uChannel;       // RD value used as wave height: 0 u, 1 v
uniform float uLo;          // RD values mapped to height 0..1
uniform float uHi;
uniform float uLatCorrection; // the sim's east-west spacing, so slopes match the pattern
uniform float uNormalStrength;
uniform float uExponent;
uniform float uStrength;
uniform float uReveal;      // spec 10d: 0 hides the pattern after a seed (no glint), 1 shows it

out vec4 fragColor;

#include "twilight.glsl"

// Night -> moon -> day on one log-lux scale: night at 0 lux, the moon target at uMoonStopLux, the day target at
// uDayLux. Sun twilight passes through the moon target too.
vec3 lightBlend(vec3 night, vec3 moon, vec3 day, float lux) {
  float k = log((lux + uNightLux) / uNightLux);
  float kMoon = log((uMoonStopLux + uNightLux) / uNightLux);
  float kDay = log(uDayLux / uNightLux);
  return k < kMoon ? mix(night, moon, clamp(k / kMoon, 0.0, 1.0))
                   : mix(moon, day, clamp((k - kMoon) / (kDay - kMoon), 0.0, 1.0));
}

// 01's daylight() for a lux value rather than a sun altitude.
float daylightLux(float lux) {
  return clamp(log((lux + uNightLux) / uNightLux) / log(uDayLux / uNightLux), 0.0, 1.0);
}

// Kasten-Young air mass for an altitude in degrees above 0.
float airMass(float altDeg) {
  return 1.0 / (sin(altDeg * DEG) + 0.50572 * pow(altDeg + 6.07995, -1.6364));
}

// Direct-beam sun lux (no skylight): the glint is a reflection of the disc. Same terms as illuminance().
float sunBeamLux(float altDeg) {
  if (altDeg <= 0.0) return 0.0;
  return 128000.0 * sin(altDeg * DEG) * pow(0.8, airMass(altDeg));
}

// Spec 14: Krisciunas & Schaefer magnitude from phase angle, scaled by distance, to lux on a surface facing the
// moon, dimmed by air mass. No twilight term. Physical constants, not design values.
float moonLux(float altDeg) {
  if (altDeg <= 0.0) return 0.0;
  float phi = uMoonPhase;
  float v = -12.73 + 0.026 * phi + 4e-9 * phi * phi * phi * phi + 5.0 * log(uMoonDist / 384400.0) / log(10.0);
  return 2.54e-6 * pow(10.0, -0.4 * v) * sin(altDeg * DEG) * pow(0.8, airMass(altDeg));
}

// Colour of direct light after extinction along its path: hue only, normalised to the brightest channel.
vec3 beamColour(float altDeg) {
  const vec3 TAU = vec3(0.10, 0.17, 0.35); // Rayleigh plus a light aerosol term, per air mass
  vec3 t = exp(-TAU * airMass(max(altDeg, 0.0)));
  return t / max(max(t.r, t.g), t.b);
}

float altitude(vec3 n, vec3 dir) {
  return asin(clamp(dot(n, dir), -1.0, 1.0)) / DEG;
}

// RD value as wave height, 0..1.
float height(vec2 uv) {
  vec4 s = texture(uWater, uv);
  return clamp(((uChannel == 0 ? s.r : s.g) - uLo) / (uHi - uLo), 0.0, 1.0);
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

  // u wraps at ±180° (textures use REPEAT on s).
  vec2 uv = vec2(lon / 360.0 + 0.5, 0.5 - lat / 180.0);
  float land = smoothstep(0.4, 0.6, texture(uLand, uv).r);

  float la = lat * DEG;
  float lo = lon * DEG;
  vec3 up = vec3(cos(la) * cos(lo), cos(la) * sin(lo), sin(la));
  vec3 east = vec3(-sin(lo), cos(lo), 0.0);
  vec3 north = vec3(-sin(la) * cos(lo), -sin(la) * sin(lo), cos(la));

  // Land: the sun and moon against the terrain normal, tilted by the exaggerated slope.
  vec2 slope = texture(uSlope, uv).rg * uLandExaggeration;
  vec3 terrain = normalize(up - slope.x * east - slope.y * north);
  float landLux = illuminance(altitude(terrain, uSunDir))
                + (uMoonlight ? moonLux(altitude(terrain, uMoonDir)) : 0.0);
  vec3 ground = lightBlend(uNightLand, uMoonLand, uDayLand, landLux);
  if (land > 0.999) {
    fragColor = vec4(ground, 1.0);
    return;
  }

  // Water: the smooth sphere's light picks the base colour.
  float sunAlt = altitude(up, uSunDir);
  float moonAlt = altitude(up, uMoonDir);
  float mLux = moonLux(moonAlt);
  vec3 water = lightBlend(uNightWater, uMoonWater, uDayWater, illuminance(sunAlt) + (uMoonlight ? mLux : 0.0));

  // Wave slopes per sim cell, east neighbours spaced as the sim spaces them.
  vec2 cell = 1.0 / vec2(textureSize(uWater, 0));
  float ew = min(mix(1.0, 1.0 / max(cos(la), 1e-3), uLatCorrection), 0.25 / cell.x);
  float dE = height(uv + vec2(ew * cell.x, 0.0)) - height(uv - vec2(ew * cell.x, 0.0));
  float dN = height(uv - vec2(0.0, cell.y)) - height(uv + vec2(0.0, cell.y));
  vec3 n = normalize(up - 0.5 * uNormalStrength * (dE * east + dN * north));

  // Seen from straight above: Blinn-Phong with the half vector between the light and up.
  float sunSpec = pow(max(dot(n, normalize(uSunDir + up)), 0.0), uExponent);
  float moonSpec = pow(max(dot(n, normalize(uMoonDir + up)), 0.0), uExponent);
  vec3 glint = uReveal * uStrength * (sunSpec * daylightLux(sunBeamLux(sunAlt)) * beamColour(sunAlt)
                          + (uMoonGlint ? moonSpec * daylightLux(mLux) : 0.0) * beamColour(moonAlt));
  fragColor = vec4(mix(clamp(water + glint, 0.0, 1.0), ground, land), 1.0);
}
