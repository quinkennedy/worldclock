#version 300 es
// Spec 03a: the map in flat land-cover colours. Land classes mix by fraction in OKLab (or the dominant class wins),
// then one elevation curve adjusts OKLCH lightness and chroma. Optionally lit as the piece lights it (scene): the
// palette is the day stop of ../../../shaders/sun.frag's night -> moon -> day blend, with land relief. No water sim.
precision highp float;

uniform vec2 uResolution;   // canvas size in device pixels
uniform float uMinAspect;   // narrowest width/height the map stretches to before letterboxing
uniform vec3 uLetterbox;

uniform sampler2D uLand;    // land fraction, equirectangular, row 0 = 90°N, col 0 = 180°W
uniform sampler2D uCover;   // R arid, G forest, B ice fractions of the cell; grass = land − R − G − B
uniform sampler2D uElev;    // metres, same layout
uniform sampler2D uSlope;   // terrain slopes, same layout: R = dh/d(east), G = dh/d(north), m/m

// The palette, in OKLab.
uniform vec3 uWater;
uniform vec3 uArid;
uniform vec3 uForest;
uniform vec3 uGrass;
uniform vec3 uIce;
uniform bool uDominant;     // the largest land class only, instead of the fraction mix

// Elevation curve: t = ((h − lo) / (hi − lo))^exponent, clamped to 0..1.
uniform float uElevLo;
uniform float uElevHi;
uniform float uElevExponent;
uniform float uBrightness;  // OKLab L added at t = 1
uniform float uSaturation;  // chroma × (1 + saturation) at t = 1

// Scene lighting, as sun.frag.
uniform bool uScene;
uniform vec3 uSunDir;       // unit vector to the sun, Earth-fixed (x: 0°,0°  y: 0°,90°E  z: N pole)
uniform vec3 uMoonDir;
uniform vec3 uMoonWater;
uniform vec3 uMoonLand;
uniform vec3 uNightWater;
uniform vec3 uNightLand;
uniform float uNightLux;
uniform float uDayLux;
uniform float uMoonStopLux;
uniform float uLandExaggeration;
uniform bool uMoonlight;
uniform float uMoonPhase;   // Sun–Moon–Earth angle, degrees (0 full)
uniform float uMoonDist;    // km

out vec4 fragColor;

#include "../../../shaders/twilight.glsl"

// Copied from sun.frag.
vec3 lightBlend(vec3 night, vec3 moon, vec3 day, float lux) {
  float k = log((lux + uNightLux) / uNightLux);
  float kMoon = log((uMoonStopLux + uNightLux) / uNightLux);
  float kDay = log(uDayLux / uNightLux);
  return k < kMoon ? mix(night, moon, clamp(k / kMoon, 0.0, 1.0))
                   : mix(moon, day, clamp((k - kMoon) / (kDay - kMoon), 0.0, 1.0));
}

float airMass(float altDeg) {
  return 1.0 / (sin(altDeg * DEG) + 0.50572 * pow(altDeg + 6.07995, -1.6364));
}

float moonLux(float altDeg) {
  if (altDeg <= 0.0) return 0.0;
  float phi = uMoonPhase;
  float v = -12.73 + 0.026 * phi + 4e-9 * phi * phi * phi * phi + 5.0 * log(uMoonDist / 384400.0) / log(10.0);
  return 2.54e-6 * pow(10.0, -0.4 * v) * sin(altDeg * DEG) * pow(0.8, airMass(altDeg));
}

float altitude(vec3 n, vec3 dir) {
  return asin(clamp(dot(n, dir), -1.0, 1.0)) / DEG;
}

// OKLab -> sRGB (Ottosson), gamut-clamped.
vec3 oklabToSrgb(vec3 c) {
  vec3 lms = vec3(
    c.x + 0.3963377774 * c.y + 0.2158037573 * c.z,
    c.x - 0.1055613458 * c.y - 0.0638541728 * c.z,
    c.x - 0.0894841775 * c.y - 1.2914855480 * c.z);
  lms = lms * lms * lms;
  vec3 lin = clamp(vec3(
     4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,
    -1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,
    -0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z), 0.0, 1.0);
  return mix(12.92 * lin, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, lin));
}

void main() {
  // Layout as sun.frag: full longitude fills the width; wider than 2:1 crops the poles, 2:1 down to uMinAspect
  // stretches, narrower letterboxes.
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
  vec2 uv = vec2(lon / 360.0 + 0.5, 0.5 - lat / 180.0);
  float landFrac = texture(uLand, uv).r;
  float land = smoothstep(0.4, 0.6, landFrac); // the piece's coastline

  // Land classes as shares of the land in the cell.
  vec3 cover = texture(uCover, uv).rgb;
  vec4 f = vec4(cover, max(landFrac - cover.r - cover.g - cover.b, 0.0)); // arid, forest, ice, grass
  f /= max(f.r + f.g + f.b + f.a, 1e-4);
  if (uDominant) {
    float m = max(max(f.r, f.g), max(f.b, f.a));
    f = f.r == m ? vec4(1, 0, 0, 0) : f.g == m ? vec4(0, 1, 0, 0) : f.b == m ? vec4(0, 0, 1, 0) : vec4(0, 0, 0, 1);
  }
  vec3 lab = f.r * uArid + f.g * uForest + f.b * uIce + f.a * uGrass;

  float t = pow(clamp((texture(uElev, uv).r - uElevLo) / max(uElevHi - uElevLo, 1.0), 0.0, 1.0), uElevExponent);
  lab.x += uBrightness * t;
  lab.yz *= max(1.0 + uSaturation * t, 0.0);

  vec3 dayLand = oklabToSrgb(lab);
  vec3 dayWater = oklabToSrgb(uWater);
  if (!uScene) {
    fragColor = vec4(mix(dayWater, dayLand, land), 1.0);
    return;
  }

  float la = lat * DEG;
  float lo = lon * DEG;
  vec3 up = vec3(cos(la) * cos(lo), cos(la) * sin(lo), sin(la));
  vec3 east = vec3(-sin(lo), cos(lo), 0.0);
  vec3 north = vec3(-sin(la) * cos(lo), -sin(la) * sin(lo), cos(la));

  vec2 slope = texture(uSlope, uv).rg * uLandExaggeration;
  vec3 terrain = normalize(up - slope.x * east - slope.y * north);
  float landLux = illuminance(altitude(terrain, uSunDir))
                + (uMoonlight ? moonLux(altitude(terrain, uMoonDir)) : 0.0);
  float waterLux = illuminance(altitude(up, uSunDir)) + (uMoonlight ? moonLux(altitude(up, uMoonDir)) : 0.0);
  vec3 ground = lightBlend(uNightLand, uMoonLand, dayLand, landLux);
  vec3 water = lightBlend(uNightWater, uMoonWater, dayWater, waterLux);
  fragColor = vec4(mix(water, ground, land), 1.0);
}
