// Lunar phases (Meeus, Astronomical Algorithms, ch. 49) and the moon's position (ch. 47).
// Pure functions, UTC ms in. Phases are accurate to well under a minute. Dynamical time is treated
// as UTC (ΔT is about a minute, ~0.01° of lunar motion).
import { gmst } from './stars.js';

const RAD = Math.PI / 180;
const DAY = 86400000;
const JD_UNIX_EPOCH = 2440587.5;
const SYNODIC_DAYS = 29.530588861;

// Periodic terms for new (phase 0) and full (phase 0.5) moon: [coefficient, E power, M, M', F, Ω].
const NEW_TERMS = [
  [-0.40720, 0, 0, 1, 0, 0], [0.17241, 1, 1, 0, 0, 0], [0.01608, 0, 0, 2, 0, 0],
  [0.01039, 0, 0, 0, 2, 0], [0.00739, 1, -1, 1, 0, 0], [-0.00514, 1, 1, 1, 0, 0],
  [0.00208, 2, 2, 0, 0, 0], [-0.00111, 0, 0, 1, -2, 0], [-0.00057, 0, 0, 1, 2, 0],
  [0.00056, 1, 1, 2, 0, 0], [-0.00042, 0, 0, 3, 0, 0], [0.00042, 1, 1, 0, 2, 0],
  [0.00038, 1, 1, 0, -2, 0], [-0.00024, 1, -1, 2, 0, 0], [-0.00017, 0, 0, 0, 0, 1],
  [-0.00007, 0, 2, 1, 0, 0], [0.00004, 0, 0, 2, -2, 0], [0.00004, 0, 3, 0, 0, 0],
  [0.00003, 0, 1, 1, -2, 0], [0.00003, 0, 0, 2, 2, 0], [-0.00003, 0, 1, 1, 2, 0],
  [0.00003, 0, -1, 1, 2, 0], [-0.00002, 0, -1, 1, -2, 0], [-0.00002, 0, 1, 3, 0, 0],
  [0.00002, 0, 0, 4, 0, 0],
];
const FULL_TERMS = [
  [-0.40614, 0, 0, 1, 0, 0], [0.17302, 1, 1, 0, 0, 0], [0.01614, 0, 0, 2, 0, 0],
  [0.01043, 0, 0, 0, 2, 0], [0.00734, 1, -1, 1, 0, 0], [-0.00515, 1, 1, 1, 0, 0],
  [0.00209, 2, 2, 0, 0, 0], [-0.00111, 0, 0, 1, -2, 0], [-0.00057, 0, 0, 1, 2, 0],
  [0.00056, 1, 1, 2, 0, 0], [-0.00042, 0, 0, 3, 0, 0], [0.00042, 1, 1, 0, 2, 0],
  [0.00038, 1, 1, 0, -2, 0], [-0.00024, 1, -1, 2, 0, 0], [-0.00017, 0, 0, 0, 0, 1],
  [-0.00007, 0, 2, 1, 0, 0], [0.00004, 0, 0, 2, -2, 0], [0.00004, 0, 3, 0, 0, 0],
  [0.00003, 0, 1, 1, -2, 0], [0.00003, 0, 0, 2, 2, 0], [-0.00003, 0, 1, 1, 2, 0],
  [0.00003, 0, -1, 1, 2, 0], [-0.00002, 0, -1, 1, -2, 0], [-0.00002, 0, 1, 3, 0, 0],
  [0.00002, 0, 0, 4, 0, 0],
];

// Planetary arguments common to all phases: [coefficient, A0, rate per lunation, T² term].
const PLANETARY = [
  [0.000325, 299.77, 0.107408, -0.009173], [0.000165, 251.88, 0.016321, 0],
  [0.000164, 251.83, 26.651886, 0], [0.000126, 349.42, 36.412478, 0],
  [0.000110, 84.66, 18.206239, 0], [0.000062, 141.74, 53.303771, 0],
  [0.000060, 207.14, 2.453732, 0], [0.000056, 154.84, 7.306860, 0],
  [0.000047, 34.52, 27.261239, 0], [0.000042, 207.19, 0.121824, 0],
  [0.000040, 291.34, 1.844379, 0], [0.000037, 161.72, 24.198154, 0],
  [0.000035, 239.56, 25.513099, 0], [0.000023, 331.55, 3.592518, 0],
];

// Julian ephemeris day of the phase with lunation number k (integer: new moon, +0.5: full moon;
// k = 0 is the new moon of 2000 Jan 6).
function phaseJde(k) {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  let jde = 2451550.09766 + SYNODIC_DAYS * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;

  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3) * RAD;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * RAD;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * RAD;
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * RAD;

  const terms = Number.isInteger(k) ? NEW_TERMS : FULL_TERMS;
  for (const [c, e, m, mp, f, om] of terms) {
    jde += c * E ** e * Math.sin(m * M + mp * Mp + f * F + om * Om);
  }
  for (const [c, a0, rate, t2] of PLANETARY) {
    jde += c * Math.sin((a0 + rate * k + t2 * T2) * RAD);
  }
  return jde;
}

// UTC ms of the first new moon (phase 0) or full moon (phase 0.5) strictly after utcMs.
// "Strictly" means at least a minute later, so asking again from the result gives the next one.
export function nextMoonPhase(utcMs, phase) {
  const after = utcMs + 60000;
  const jd = after / DAY + JD_UNIX_EPOCH;
  let k = Math.floor((jd - 2451550.09766) / SYNODIC_DAYS) - 1 + phase;
  let t;
  do {
    t = (phaseJde(k) - JD_UNIX_EPOCH) * DAY;
    k += 1;
  } while (t <= after);
  return t;
}

// --- Spec 06: position and phase (Meeus ch. 47, truncated) -------------------

// Longitude (1e-6 °) and distance (1e-3 km) terms: [D, M, M', F, Σl, Σr]. Table 47.A, terms ≥ 0.002°.
const LR_TERMS = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
];

// Latitude terms (1e-6 °): [D, M, M', F, Σb]. Table 47.B, terms ≥ 0.0013°.
const B_TERMS = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335],
];

// Geocentric apparent right ascension and declination (degrees, equator of date) and distance (km).
// Within ~0.01° of the full theory.
export function moonEquatorial(utcMs) {
  const T = (utcMs / DAY + JD_UNIX_EPOCH - 2451545) / 36525;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000) * RAD;
  const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000) * RAD;
  const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000) * RAD;
  const F = (93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000) * RAD;
  const A1 = (119.75 + 131.849 * T) * RAD;
  const A2 = (53.09 + 479264.290 * T) * RAD;
  const A3 = (313.45 + 481266.484 * T) * RAD;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const L = Lp * RAD;

  let sl = 3958 * Math.sin(A1) + 1962 * Math.sin(L - F) + 318 * Math.sin(A2);
  let sr = 0;
  for (const [d, m, mp, f, l, r] of LR_TERMS) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const e = E ** Math.abs(m);
    sl += l * e * Math.sin(arg);
    sr += r * e * Math.cos(arg);
  }
  let sb = -2235 * Math.sin(L) + 382 * Math.sin(A3) + 175 * Math.sin(A1 - F) + 175 * Math.sin(A1 + F)
    + 127 * Math.sin(L - Mp) - 115 * Math.sin(L + Mp);
  for (const [d, m, mp, f, b] of B_TERMS) {
    sb += b * E ** Math.abs(m) * Math.sin(d * D + m * M + mp * Mp + f * F);
  }

  // Apparent longitude and true obliquity with the main nutation term, as sun.js does.
  const omega = (125.04452 - 1934.136261 * T) * RAD;
  const lambda = (Lp + sl / 1e6 - 0.00478 * Math.sin(omega)) * RAD;
  const beta = (sb / 1e6) * RAD;
  const eps = (23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
    + 0.00256 * Math.cos(omega)) * RAD;

  const ra = Math.atan2(Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lambda));
  const dec = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda));
  return { ra: (((ra / RAD) % 360) + 360) % 360, dec: dec / RAD, distKm: 385000.56 + sr / 1000 };
}

const AU_KM = 149597870.7; // the sun's distance varies ±1.7%, which moves the phase angle by < 0.01°

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// The moon for 06's disc and 14's moonlight, in the Earth-fixed frame sun.js uses
// (x: 0°,0°  y: 0°,90°E  z: N pole). sunDir is sunDirection(utcMs). Returns:
//  lat, lon      sub-lunar point in degrees (lon wrapped to ±180)
//  dir           unit vector to the moon
//  distKm        Earth–moon distance
//  phaseAngle    Sun–Moon–Earth angle in degrees: 0 full, 180 new
//  illuminated   lit fraction of the disc, 0..1
//  litBearing    direction from the sub-lunar point towards the sun, radians clockwise from north
//                (the lit limb faces it)
export function moonPosition(utcMs, sunDir) {
  const { ra, dec, distKm } = moonEquatorial(utcMs);
  const lat = dec;
  const lon = ((((ra - gmst(utcMs) + 180) % 360) + 360) % 360) - 180;
  const la = lat * RAD, lo = lon * RAD;
  const dir = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];

  // Moon -> sun, and its angle with moon -> Earth.
  const toSun = sunDir.map((s, i) => s * AU_KM - dir[i] * distKm);
  const cosPhase = Math.max(-1, Math.min(1, -dot(toSun, dir) / Math.hypot(...toSun)));

  // Moon -> sun in the local east/north frame at the sub-lunar point.
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];

  return {
    lat, lon, dir, distKm,
    phaseAngle: Math.acos(cosPhase) / RAD,
    illuminated: (1 + cosPhase) / 2,
    litBearing: Math.atan2(dot(toSun, east), dot(toSun, north)),
  };
}
