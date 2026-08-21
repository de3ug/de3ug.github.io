// Pure spherical geometry and colour helpers for the great-circle map.
// No DOM, no Leaflet — everything here is unit-testable in plain node.

// Mean Earth radius (IUGG). Matches what Turf used, so distances are unchanged.
const R_KM = 6371.0088;

export const toRad = (deg) => (deg * Math.PI) / 180;
export const toDeg = (rad) => (rad * 180) / Math.PI;

export const nmToKm = (nm) => nm * 1.852;
export const miToKm = (mi) => mi * 1.609344;
export const kmToNm = (km) => km / 1.852;
export const kmToMi = (km) => km / 1.609344;

/** Fold a longitude into [-180, 180). */
export function normalizeLon(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Signed shortest angular step from lon a to lon b, in (-180, 180]. */
export function shortestLonDelta(a, b) {
  return normalizeLon(b - a);
}

/** Angular separation of two points, in radians (haversine — stable at small d). */
function angularDistance(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Great-circle distance in kilometres between two {lat, lon} points. */
export function distanceKm(from, to) {
  return (
    R_KM *
    angularDistance(
      toRad(from.lat),
      toRad(normalizeLon(from.lon)),
      toRad(to.lat),
      toRad(normalizeLon(to.lon))
    )
  );
}

/**
 * Rewrite a longitude sequence so consecutive points never jump more than
 * 180deg. Longitudes are allowed to run outside [-180, 180] — that is the
 * whole point: a path over the Pacific stays one continuous line instead of
 * being chopped in half at the antimeridian.
 */
export function unwrapLons(points) {
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1][1];
    let lon = points[i][1];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    points[i][1] = lon;
  }
  return points;
}

/**
 * Sample the shorter great-circle arc between two points.
 * Returns [[lat, lon], ...] with continuous (unwrapped) longitudes.
 */
export function greatCirclePoints(from, to, npoints = 64) {
  const lat1 = toRad(from.lat);
  const lon1 = toRad(normalizeLon(from.lon));
  const lat2 = toRad(to.lat);
  const lon2 = toRad(normalizeLon(to.lon));

  const d = angularDistance(lat1, lon1, lat2, lon2);
  const sinD = Math.sin(d);
  const n = Math.max(2, npoints | 0);

  // Coincident or (near-)antipodal endpoints leave the interpolation
  // undefined; a straight lat/lon ramp is the sane degenerate answer.
  if (d < 1e-9 || Math.abs(sinD) < 1e-9) {
    const startLon = normalizeLon(from.lon);
    const step = shortestLonDelta(startLon, normalizeLon(to.lon));
    const out = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      out.push([from.lat + (to.lat - from.lat) * f, startLon + step * f]);
    }
    return out;
  }

  const points = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const a = Math.sin((1 - f) * d) / sinD;
    const b = Math.sin(f * d) / sinD;
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    points.push([toDeg(Math.atan2(z, Math.hypot(x, y))), toDeg(Math.atan2(y, x))]);
  }
  return unwrapLons(points);
}

// Viridis control points. Perceptually uniform and safe for the common
// colour-vision deficiencies, unlike the jet ramp this replaced.
const VIRIDIS = [
  [68, 1, 84], [72, 40, 120], [62, 73, 137], [49, 104, 142], [38, 130, 142],
  [31, 158, 137], [53, 183, 121], [109, 205, 89], [253, 231, 37]
];

/** Sample the viridis ramp at t in [0, 1]; returns an `rgb(...)` string. */
export function viridis(t) {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const x = clamped * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(x));
  const f = x - i;
  const lo = VIRIDIS[i];
  const hi = VIRIDIS[i + 1];
  const ch = (k) => Math.round(lo[k] + (hi[k] - lo[k]) * f);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}
