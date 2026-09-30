// Spec 05: the zenith star map. Pure functions: UTC ms in.
// The shader places each star at the point on Earth where it is overhead: lat = Dec, lon = RA − GMST.

const RAD = Math.PI / 180;
const ARCSEC = RAD / 3600;

function daysSinceJ2000(utcMs) {
  return utcMs / 86400000 + 2440587.5 - 2451545;
}

// Greenwich mean sidereal time in degrees (0..360), IAU 1982. UT1 is taken as UTC (< 0.9 s apart).
export function gmst(utcMs) {
  const d = daysSinceJ2000(utcMs);
  const T = d / 36525;
  const g = 280.46061837 + 360.98564736629 * d + T * T * (0.000387933 - T / 38710000);
  return ((g % 360) + 360) % 360;
}

// Row-major 3x3 precession matrix, J2000 mean equator -> mean equator of date (Lieske 1977, Meeus ch. 21).
function precession(utcMs) {
  const T = daysSinceJ2000(utcMs) / 36525;
  const zeta = (2306.2181 + (0.30188 + 0.017998 * T) * T) * T * ARCSEC;
  const z = (2306.2181 + (1.09468 + 0.018203 * T) * T) * T * ARCSEC;
  const theta = (2004.3109 - (0.42665 + 0.041833 * T) * T) * T * ARCSEC;
  const cZ = Math.cos(zeta), sZ = Math.sin(zeta);
  const cz = Math.cos(z), sz = Math.sin(z);
  const cT = Math.cos(theta), sT = Math.sin(theta);
  return [
    cZ * cT * cz - sZ * sz, -sZ * cT * cz - cZ * sz, -sT * cz,
    cZ * cT * sz + sZ * cz, -sZ * cT * sz + cZ * cz, -sT * sz,
    cZ * sT, -sZ * sT, cT,
  ];
}

// Column-major mat3 (for uniformMatrix3fv) taking a J2000 equatorial unit vector to the Earth-fixed
// frame sun.js uses (x: 0°,0°  y: 0°,90°E  z: N pole): precession to date, then Earth's rotation by GMST.
export function skyMatrix(utcMs) {
  const P = precession(utcMs);
  const g = gmst(utcMs) * RAD;
  const c = Math.cos(g), s = Math.sin(g);
  // Rz(−GMST) · P
  const M = [
    c * P[0] + s * P[3], c * P[1] + s * P[4], c * P[2] + s * P[5],
    -s * P[0] + c * P[3], -s * P[1] + c * P[4], -s * P[2] + c * P[5],
    P[6], P[7], P[8],
  ];
  return new Float32Array([M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]]);
}

// B−V colour index -> sRGB [r, g, b] in 0..1 with the brightest channel at 1.
// Temperature from Ballesteros (2012), then the Planckian locus (Kim et al. 2002) to linear sRGB.
export function bvToRgb(bv) {
  const T = Math.min(25000, Math.max(1667, 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))));
  const t = 1000 / T;
  const x = T < 4000
    ? ((-0.2661239 * t - 0.2343589) * t + 0.8776956) * t + 0.179910
    : ((-3.0258469 * t + 2.1070379) * t + 0.2226347) * t + 0.240390;
  const y = T < 2222 ? ((-1.1063814 * x - 1.34811020) * x + 2.18555832) * x - 0.20219683
    : T < 4000 ? ((-0.9549476 * x - 1.37418593) * x + 2.09137015) * x - 0.16748867
    : ((3.0817580 * x - 5.87338670) * x + 3.75112997) * x - 0.37001483;
  const X = x / y, Z = (1 - x - y) / y;
  const lin = [
    3.2406 * X - 1.5372 - 0.4986 * Z,
    -0.9689 * X + 1.8758 + 0.0415 * Z,
    0.0557 * X - 0.2040 + 1.0570 * Z,
  ].map((v) => Math.max(0, v));
  const max = Math.max(...lin);
  return lin.map((v) => {
    const c = v / max;
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  });
}

// 02's stars.bin ([raRad, decRad, vmag, bv] Float32 LE per star) -> interleaved vertex data,
// 7 floats per star: J2000 unit vector xyz, sRGB colour, vmag.
export const STAR_STRIDE = 7;

export function starVertices(buffer) {
  const src = new DataView(buffer);
  const n = buffer.byteLength / 16;
  const out = new Float32Array(n * STAR_STRIDE);
  for (let i = 0; i < n; i++) {
    const ra = src.getFloat32(i * 16, true);
    const dec = src.getFloat32(i * 16 + 4, true);
    const [r, g, b] = bvToRgb(src.getFloat32(i * 16 + 12, true));
    out.set([
      Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec),
      r, g, b,
      src.getFloat32(i * 16 + 8, true),
    ], i * STAR_STRIDE);
  }
  return out;
}
