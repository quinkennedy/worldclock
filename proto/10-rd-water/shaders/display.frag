#version 300 es
// One or more RD layers over a flat land colour, in the piece's layout. Grey shows layer 0 raw. The colour
// modes turn each layer's normalised value into a signed offset d (-1..1) and apply it in HSL:
//   rgb:  three layers, each a fixed H and S with L = base ± range.l; the colours add.
//   cmyk: four layers, the same per-layer colours; the colours multiply (inks on white).
//   hsl:  three layers drive H, S and L of one base colour by ± range.
// Spec 10c, specular: layer 0 is wave height. The water is seen from straight above, lit by the real sun and
// moon; its base colour blends night -> moon -> sunny on a log-lux scale, and Blinn-Phong glints go on top.
precision highp float;

uniform vec2 uResolution;
uniform float uMinAspect;
uniform sampler2D uState0;
uniform sampler2D uState1;
uniform sampler2D uState2;
uniform sampler2D uState3;
uniform sampler2D uLand;
uniform vec2 uVRange;     // equirect v at the grid's top row, and the v span it covers
uniform int uChannel;     // 0 u, 1 v
uniform float uLo;
uniform float uHi;
uniform bool uInvert;
uniform vec3 uLandColor;  // grey mode
uniform vec3 uLetterbox;

uniform int uMode;        // 0 grey, 1 rgb, 2 cmyk, 3 hsl, 4 specular
uniform int uPalette;     // 0 sunny, 1 night, 2 split (sunny west of 0°, night east)
uniform vec3 uRange;      // ± H degrees, ± S and ± L in HSL percent
uniform float uReveal;    // spec 10d: 0 hides the pattern after a seed (base colours, no glint), 1 shows it
// Palettes, 0 sunny and 1 night. HSL colours: H in degrees, S and L in percent.
uniform vec3 uRgb0[3];
uniform vec3 uRgb1[3];
uniform vec3 uCmyk0[4];
uniform vec3 uCmyk1[4];
uniform vec3 uHsl0;
uniform vec3 uHsl1;
uniform vec3 uLand0;
uniform vec3 uLand1;
uniform vec3 uWater0;
uniform vec3 uWater1;
uniform vec3 uLand2;      // specular only: the moon target
uniform vec3 uWater2;

// Specular (10c). Directions are Earth-fixed unit vectors (x: 0°,0°  y: 0°,90°E  z: N pole).
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform bool uMoonGlint;    // the moon's own glint
uniform bool uMoonLighting; // moon lux in the base colour
uniform float uMoonPhase;     // Sun–Moon–Earth angle, degrees (0 full)
uniform float uMoonDist;      // km
uniform float uLatCorrection; // the sim's east-west spacing, so slopes match the pattern
uniform float uNormalStrength;
uniform float uExponent;
uniform float uStrength;
uniform float uNightLux;
uniform float uDayLux;
uniform float uMoonStopLux;   // lux at which the base colour is fully the moon target

out vec4 fragColor;

#include "../../../shaders/twilight.glsl"

// 01's daylight() for a lux value rather than a sun altitude.
float daylightLux(float lux) {
  return clamp(log((lux + uNightLux) / uNightLux) / log(uDayLux / uNightLux), 0.0, 1.0);
}

// Night -> moon -> sun on one log-lux scale: night at 0 lux, the moon target at uMoonStopLux, the sun target at
// uDayLux. Sun twilight passes through the moon target too.
vec3 lightBlend(vec3 night, vec3 moon, vec3 sun, float lux) {
  float k = log((lux + uNightLux) / uNightLux);
  float kMoon = log((uMoonStopLux + uNightLux) / uNightLux);
  float kDay = log(uDayLux / uNightLux);
  return k < kMoon ? mix(night, moon, clamp(k / kMoon, 0.0, 1.0))
                   : mix(moon, sun, clamp((k - kMoon) / (kDay - kMoon), 0.0, 1.0));
}

// Kasten-Young air mass for an altitude in degrees above 0.
float airMass(float altDeg) {
  return 1.0 / (sin(altDeg * DEG) + 0.50572 * pow(altDeg + 6.07995, -1.6364));
}

// Direct-beam sun lux (no skylight): the glint is a reflection of the disc. Same terms as illuminance().
float sunBeamLux(float altDeg) {
  if (altDeg <= 0.0) return 0.0;
  float s = sin(altDeg * DEG);
  return 128000.0 * s * pow(0.8, airMass(altDeg));
}

// Spec 14's moon: Krisciunas & Schaefer magnitude from phase angle, scaled by distance, to lux on a surface
// facing the moon, dimmed by air mass. No twilight term. Physical constants, not design values.
float moonLux(float altDeg) {
  if (altDeg <= 0.0) return 0.0;
  float phi = uMoonPhase;
  float v = -12.73 + 0.026 * phi + 4e-9 * phi * phi * phi * phi + 5.0 * log(uMoonDist / 384400.0) / log(10.0);
  float lux = 2.54e-6 * pow(10.0, -0.4 * v);
  return lux * sin(altDeg * DEG) * pow(0.8, airMass(altDeg));
}

// Colour of direct light after extinction along its path: hue only, normalised to the brightest channel.
vec3 beamColour(float altDeg) {
  const vec3 TAU = vec3(0.10, 0.17, 0.35); // Rayleigh plus a light aerosol term, per air mass
  vec3 t = exp(-TAU * airMass(max(altDeg, 0.0)));
  return t / max(max(t.r, t.g), t.b);
}

vec3 hsl2rgb(vec3 hsl) {
  float h = mod(hsl.x, 360.0) / 60.0;
  float s = clamp(hsl.y / 100.0, 0.0, 1.0);
  float l = clamp(hsl.z / 100.0, 0.0, 1.0);
  vec3 hue = clamp(abs(mod(h + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  return l + c * (hue - 0.5);
}

// Layer value normalised by the view range, 0..1.
float level(vec4 s) {
  float t = clamp(((uChannel == 0 ? s.r : s.g) - uLo) / (uHi - uLo), 0.0, 1.0);
  return uInvert ? 1.0 - t : t;
}

vec3 layerColour(vec3 hsl, float d) {
  return hsl2rgb(vec3(hsl.xy, hsl.z + d * uRange.z));
}

void main() {
  // Same layout as shaders/sun.frag: full longitude fills the width; poles crop, stretch or letterbox.
  float aspect = uResolution.x / uResolution.y;
  float pxPerDegX = uResolution.x / 360.0;
  float pxPerDegY = max(pxPerDegX, uResolution.x / (max(aspect, uMinAspect) * 180.0));
  vec2 deg = (gl_FragCoord.xy - 0.5 * uResolution) / vec2(pxPerDegX, pxPerDegY);
  if (abs(deg.y) > 90.0) {
    fragColor = vec4(uLetterbox, 1.0);
    return;
  }
  vec2 eq = vec2(deg.x / 360.0 + 0.5, 0.5 - deg.y / 180.0);
  vec2 g = vec2(eq.x, (eq.y - uVRange.x) / uVRange.y);
  float land = smoothstep(0.4, 0.6, texture(uLand, eq).r);

  if (uMode == 4) {
    float lat = deg.y * DEG, lon = deg.x * DEG;
    vec3 up = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
    vec3 east = vec3(-sin(lon), cos(lon), 0.0);
    vec3 north = vec3(-sin(lat) * cos(lon), -sin(lat) * sin(lon), cos(lat));
    float sunAlt = asin(clamp(dot(up, uSunDir), -1.0, 1.0)) / DEG;
    float moonAlt = asin(clamp(dot(up, uMoonDir), -1.0, 1.0)) / DEG;
    float mLux = moonLux(moonAlt);

    // Base: the smooth sphere's total light, night -> moon -> sunny.
    float lux = illuminance(sunAlt) + (uMoonLighting ? mLux : 0.0);
    vec3 water = lightBlend(uWater1, uWater2, uWater0, lux);
    vec3 ground = lightBlend(uLand1, uLand2, uLand0, lux);
    if (land > 0.999) {
      fragColor = vec4(ground, 1.0);
      return;
    }

    // Wave height slopes per sim cell, east neighbours spaced as the sim spaces them.
    vec2 cell = 1.0 / vec2(textureSize(uState0, 0));
    float ew = min(mix(1.0, 1.0 / max(cos(lat), 1e-3), uLatCorrection), 0.25 / cell.x);
    float dE = level(texture(uState0, g + vec2(ew * cell.x, 0.0))) - level(texture(uState0, g - vec2(ew * cell.x, 0.0)));
    float dN = level(texture(uState0, g - vec2(0.0, cell.y))) - level(texture(uState0, g + vec2(0.0, cell.y)));
    vec3 n = normalize(up - 0.5 * uNormalStrength * (dE * east + dN * north));

    // Seen from straight above: Blinn-Phong with the half vector between the light and up.
    float sunSpec = pow(max(dot(n, normalize(uSunDir + up)), 0.0), uExponent);
    float moonSpec = pow(max(dot(n, normalize(uMoonDir + up)), 0.0), uExponent);
    vec3 glint = uReveal * uStrength * (sunSpec * daylightLux(sunBeamLux(sunAlt)) * beamColour(sunAlt)
                            + (uMoonGlint ? moonSpec * daylightLux(mLux) : 0.0) * beamColour(moonAlt));
    fragColor = vec4(mix(clamp(water + glint, 0.0, 1.0), ground, land), 1.0);
    return;
  }

  vec4 t = vec4(level(texture(uState0, g)), level(texture(uState1, g)),
                level(texture(uState2, g)), level(texture(uState3, g)));
  if (uMode == 0) {
    fragColor = vec4(mix(vec3(t.x), uLandColor, land), 1.0);
    return;
  }
  vec4 d = uReveal * (2.0 * t - 1.0);
  bool night = uPalette == 1 || (uPalette == 2 && deg.x >= 0.0);

  vec3 col;
  if (uMode == 1) {
    col = vec3(0.0);
    for (int i = 0; i < 3; i++) col += layerColour(night ? uRgb1[i] : uRgb0[i], d[i]);
  } else if (uMode == 2) {
    col = vec3(1.0);
    for (int i = 0; i < 4; i++) col *= layerColour(night ? uCmyk1[i] : uCmyk0[i], d[i]);
  } else {
    col = hsl2rgb((night ? uHsl1 : uHsl0) + d.xyz * uRange);
  }
  fragColor = vec4(mix(clamp(col, 0.0, 1.0), night ? uLand1 : uLand0, land), 1.0);
}
