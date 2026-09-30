// Spec 01's twilight model, shared by sun.frag and stars.vert. main.js pastes this file in place of
// an `#include "twilight.glsl"` line.

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

// 0 = full night, 1 = full day. Brightness follows log illuminance, roughly as the eye perceives it.
float daylight(float altDeg, float nightLux, float dayLux) {
  float lux = illuminance(altDeg) + nightLux;
  return clamp(log(lux / nightLux) / log(dayLux / nightLux), 0.0, 1.0);
}
