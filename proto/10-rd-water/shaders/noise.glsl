// Smooth 4D value noise (quintic fade, pcg4d hash), range 0..1. Shared via #include.

const float PI = 3.14159265358979;

uvec4 pcg4d(uvec4 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  v ^= v >> 16u;
  v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
  return v;
}

float hash4(ivec4 p) {
  return float(pcg4d(uvec4(p)).x) / 4294967295.0;
}

float vnoise(vec4 p) {
  vec4 i = floor(p);
  vec4 f = p - i;
  vec4 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float s = 0.0;
  for (int c = 0; c < 16; c++) {
    ivec4 o = ivec4(c & 1, (c >> 1) & 1, (c >> 2) & 1, (c >> 3) & 1);
    vec4 w = mix(1.0 - u, u, vec4(o));
    s += hash4(ivec4(i) + o) * w.x * w.y * w.z * w.w;
  }
  return s;
}

// Two octaves, still 0..1.
float fbm2(vec4 p) {
  return (vnoise(p) * 2.0 + vnoise(p * 2.03 + 17.0)) / 3.0;
}

// Unit vector for a latitude/longitude in radians (x: 0°,0°  y: 0°,90°E  z: N pole).
vec3 sphere(float lat, float lon) {
  return vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
}
