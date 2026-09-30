#version 300 es
// Spec 05: zenith stars. Each star is a point drawn where it is overhead: lat = Dec, lon = RA − GMST.
// Drawn as 3 instances, shifted by −360°, 0 and +360°, so stars straddling ±180° aren't cut off.
precision highp float;

layout(location = 0) in vec3 aDir;    // J2000 equatorial unit vector
layout(location = 1) in vec3 aColor;  // sRGB from B−V, brightest channel = 1
layout(location = 2) in float aMag;   // visual magnitude

uniform mat3 uSky;          // J2000 equatorial -> Earth-fixed (precession to date, then GMST)
uniform vec3 uSunDir;       // unit vector to the sun, Earth-fixed
uniform vec2 uResolution;   // canvas size in device pixels
uniform float uMinAspect;
uniform float uNightLux;
uniform float uDayLux;

uniform float uMagLimit;    // faintest star drawn
uniform float uBrightMag;   // stars this bright or brighter get the full size and alpha
uniform float uSizeFaint;   // disc diameters, in degrees of longitude
uniform float uSizeBright;
uniform float uAlphaFaint;
uniform float uAlphaBright;
uniform float uSaturation;  // 0 = white, 1 = full B−V colour

out vec3 vColor;
out float vAlpha;
out float vRadius;          // disc radius in device pixels

#include "twilight.glsl"

const float MIN_PX = 1.5;   // smaller discs are drawn at this size and dimmed by area, so they don't flicker

void main() {
  vec3 d = normalize(uSky * aDir);

  // Stars belong to the sky, so they fade with the smooth sphere's twilight, not the terrain's.
  float altDeg = asin(clamp(dot(d, uSunDir), -1.0, 1.0)) / DEG;
  float night = 1.0 - daylight(altDeg, uNightLux, uDayLux);
  float t = clamp((uMagLimit - aMag) / max(uMagLimit - uBrightMag, 0.1), 0.0, 1.0);
  float alpha = night * mix(uAlphaFaint, uAlphaBright, t);

  if (aMag > uMagLimit || alpha < 1e-3) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // outside clip space: culled
    gl_PointSize = 1.0;
    return;
  }

  // Same map as sun.frag: full longitude fills the width; latitude stretches up to uMinAspect.
  float aspect = uResolution.x / uResolution.y;
  float pxPerDegX = uResolution.x / 360.0;
  float pxPerDegY = max(pxPerDegX, uResolution.x / (max(aspect, uMinAspect) * 180.0));
  float lat = asin(clamp(d.z, -1.0, 1.0)) / DEG;
  float lon = atan(d.y, d.x) / DEG + 360.0 * float(gl_InstanceID - 1);
  gl_Position = vec4(lon / 180.0, lat * pxPerDegY / (0.5 * uResolution.y), 0.0, 1.0);

  // Round discs in screen space, sized by longitude so they scale with the map, not the stretch.
  float diam = mix(uSizeFaint, uSizeBright, t) * pxPerDegX;
  if (diam < MIN_PX) {
    alpha *= diam * diam / (MIN_PX * MIN_PX);
    diam = MIN_PX;
  }
  gl_PointSize = diam + 1.0; // 1 px fringe for antialiasing
  vRadius = 0.5 * diam;
  vColor = mix(vec3(1.0), aColor, uSaturation);
  vAlpha = alpha;
}
