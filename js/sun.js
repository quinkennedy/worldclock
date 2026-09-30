// NOAA solar position (the "General Solar Position" spreadsheet algorithm).
// Pure functions: UTC milliseconds in, angles out. Accurate to ~0.01° over 1800–2100.

const RAD = Math.PI / 180;

function julianCentury(utcMs) {
  const jd = utcMs / 86400000 + 2440587.5;
  return (jd - 2451545) / 36525;
}

// Returns { decl, eot, lat, lon, lambda }: declination and sub-solar lat/lon in degrees
// (lon wrapped to ±180), equation of time in minutes, apparent ecliptic longitude in degrees (0..360).
export function sunPosition(utcMs) {
  const T = julianCentury(utcMs);

  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;

  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);

  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);

  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) / RAD;

  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eot =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));

  // Apparent solar noon is at Greenwich when UTC minutes + EoT = 720.
  const dayMs = ((utcMs % 86400000) + 86400000) % 86400000;
  const utcMinutes = dayMs / 60000;
  let lon = (720 - utcMinutes - eot) / 4;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;

  return { decl, eot, lat: decl, lon, lambda: ((lambda % 360) + 360) % 360 };
}

// Unit vector towards the sun in Earth-fixed coordinates:
// x -> (0°, 0°), y -> (0°, 90°E), z -> North Pole. The shader uses the same frame.
export function sunDirection(utcMs) {
  const { lat, lon } = sunPosition(utcMs);
  const la = lat * RAD, lo = lon * RAD;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

// UTC ms when the sun's apparent longitude reaches targetDeg in the given UTC year:
// 0 March equinox, 90 June solstice, 180 September equinox, 270 December solstice.
// Newton steps on the mean solar motion. Exact for this model, which puts it within ~10 min of
// the published instants (the model's longitude is good to ~0.01°).
export function solarLongitudeTime(year, targetDeg) {
  const DAY = 86400000;
  const YEAR_DAYS = 365.2422;
  let t = Date.UTC(year, 2, 20) + (targetDeg / 360) * YEAR_DAYS * DAY;
  for (let i = 0; i < 8; i++) {
    const diff = ((((targetDeg - sunPosition(t).lambda) % 360) + 540) % 360) - 180;
    t += (diff / 360) * YEAR_DAYS * DAY;
    if (Math.abs(diff) < 1e-6) break;
  }
  return t;
}
