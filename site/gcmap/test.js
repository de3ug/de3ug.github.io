// Tests for the pure gcmap modules. Run with: node site/gcmap/test.js
//
// The previous version sliced main.js apart as a string and ran it in a `vm`
// sandbox, so it broke on any refactor. These import the real modules.

import assert from 'node:assert/strict';
import {
  distanceKm,
  greatCirclePoints,
  kmToMi,
  kmToNm,
  normalizeLon,
  shortestLonDelta,
  unwrapLons,
  viridis
} from './geo.js';
import { aggregateLegs, parseRoute } from './parse.js';

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures++;
    console.error(`  FAIL ${name}\n       ${error.message}`);
  }
}

const AIRPORTS = {
  SFO: { code: 'SFO', lat: 37.619, lon: -122.375, city: 'San Francisco', country: 'United States' },
  SEA: { code: 'SEA', lat: 47.449, lon: -122.309, city: 'Seattle', country: 'United States' },
  JFK: { code: 'JFK', lat: 40.6398, lon: -73.7789, city: 'New York', country: 'United States' },
  SIN: { code: 'SIN', lat: 1.3502, lon: 103.9944, city: 'Singapore', country: 'Singapore' },
  LHR: { code: 'LHR', lat: 51.4706, lon: -0.4619, city: 'London', country: 'United Kingdom' },
  NRT: { code: 'NRT', lat: 35.7647, lon: 140.386, city: 'Tokyo', country: 'Japan' }
};
const lookup = (code) => AIRPORTS[code];

// ── geo ──────────────────────────────────────────────────────

console.log('geo');

test('normalizeLon folds into [-180, 180)', () => {
  assert.equal(normalizeLon(0), 0);
  assert.equal(normalizeLon(190), -170);
  assert.equal(normalizeLon(-190), 170);
  assert.equal(normalizeLon(540), -180);
});

test('shortestLonDelta takes the short way round', () => {
  assert.equal(shortestLonDelta(170, -170), 20);
  assert.equal(shortestLonDelta(-170, 170), -20);
});

test('distanceKm matches published great-circle distances', () => {
  // Reference values agree with the usual online calculators to <0.5%.
  const within = (actual, expected, tolerance) =>
    assert.ok(
      Math.abs(actual - expected) / expected < tolerance,
      `${actual.toFixed(1)} km not within ${tolerance * 100}% of ${expected} km`
    );
  within(distanceKm(AIRPORTS.SFO, AIRPORTS.JFK), 4152, 0.01);
  within(distanceKm(AIRPORTS.SFO, AIRPORTS.SIN), 13580, 0.01);
  within(distanceKm(AIRPORTS.SFO, AIRPORTS.SEA), 1094, 0.01);
  within(distanceKm(AIRPORTS.LHR, AIRPORTS.SIN), 10870, 0.01);
});

test('distanceKm is symmetric and zero for a point on itself', () => {
  assert.equal(distanceKm(AIRPORTS.SFO, AIRPORTS.SFO), 0);
  const there = distanceKm(AIRPORTS.SFO, AIRPORTS.NRT);
  const back = distanceKm(AIRPORTS.NRT, AIRPORTS.SFO);
  assert.ok(Math.abs(there - back) < 1e-9);
});

test('unit conversions round-trip', () => {
  assert.ok(Math.abs(kmToNm(1.852) - 1) < 1e-12);
  assert.ok(Math.abs(kmToMi(1.609344) - 1) < 1e-12);
});

test('greatCirclePoints starts and ends on its endpoints', () => {
  const points = greatCirclePoints(AIRPORTS.SFO, AIRPORTS.JFK, 32);
  assert.equal(points.length, 32);
  assert.ok(Math.abs(points[0][0] - AIRPORTS.SFO.lat) < 1e-6);
  assert.ok(Math.abs(points[0][1] - AIRPORTS.SFO.lon) < 1e-6);
  assert.ok(Math.abs(points[31][0] - AIRPORTS.JFK.lat) < 1e-6);
  assert.ok(Math.abs(points[31][1] - AIRPORTS.JFK.lon) < 1e-6);
});

test('greatCirclePoints bulges poleward on a long northern route', () => {
  // SFO-LHR is a classic: the great circle runs well north of both airports.
  const maxLat = Math.max(...greatCirclePoints(AIRPORTS.SFO, AIRPORTS.LHR, 64).map((p) => p[0]));
  assert.ok(maxLat > AIRPORTS.LHR.lat, `expected bulge above ${AIRPORTS.LHR.lat}, got ${maxLat}`);
});

test('a transpacific arc is continuous, not chopped at the antimeridian', () => {
  const points = greatCirclePoints(AIRPORTS.SFO, AIRPORTS.SIN, 64);
  for (let i = 1; i < points.length; i++) {
    const jump = Math.abs(points[i][1] - points[i - 1][1]);
    assert.ok(jump < 180, `longitude jumped ${jump.toFixed(1)}deg at index ${i}`);
  }
  // Continuity is what lets it be drawn in the neighbouring world copies.
  const lons = points.map((p) => p[1]);
  assert.ok(Math.min(...lons) < -180, 'expected the arc to run past -180');
});

test('greatCirclePoints survives identical endpoints', () => {
  const points = greatCirclePoints(AIRPORTS.SFO, AIRPORTS.SFO, 8);
  assert.equal(points.length, 8);
  assert.ok(points.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])));
});

test('greatCirclePoints survives antipodal endpoints', () => {
  const points = greatCirclePoints({ lat: 10, lon: 20 }, { lat: -10, lon: -160 }, 8);
  assert.ok(points.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])));
});

test('unwrapLons removes the 360-degree seam', () => {
  const out = unwrapLons([[0, 179], [0, -179], [0, -177]]);
  assert.deepEqual(out, [[0, 179], [0, 181], [0, 183]]);
});

test('viridis returns clamped rgb strings', () => {
  for (const t of [-1, 0, 0.5, 1, 2, NaN]) {
    assert.match(viridis(t), /^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/);
  }
  assert.notEqual(viridis(0), viridis(1));
});

// ── parse ────────────────────────────────────────────────────

console.log('parse');

test('parses a simple leg', () => {
  const { paths, unknown } = parseRoute('SFO-JFK', lookup);
  assert.equal(unknown.length, 0);
  assert.deepEqual(paths.map((p) => p.map((a) => a.code)), [['SFO', 'JFK']]);
});

test('is case insensitive', () => {
  const { paths } = parseRoute('sfo-jfk', lookup);
  assert.deepEqual(paths[0].map((a) => a.code), ['SFO', 'JFK']);
});

test('splits independent trips on commas, spaces and newlines', () => {
  const { paths } = parseRoute('SFO-SEA, SEA-SFO\nSFO-JFK SIN-LHR', lookup);
  assert.deepEqual(paths.map((p) => p.map((a) => a.code)), [
    ['SFO', 'SEA'], ['SEA', 'SFO'], ['SFO', 'JFK'], ['SIN', 'LHR']
  ]);
});

test('collapses a repeated code rather than making a zero-length leg', () => {
  const { paths } = parseRoute('SFO-SFO-JFK', lookup);
  assert.deepEqual(paths[0].map((a) => a.code), ['SFO', 'JFK']);
});

test('an unknown code is skipped, not fatal', () => {
  const { paths, unknown } = parseRoute('SFO-JFK ZZZ-LHR SEA-SFO', lookup);
  assert.deepEqual(unknown, ['ZZZ']);
  // LHR survives as a lone airport so it still gets a marker; it just has no
  // leg, because the code it was joined to could not be resolved.
  assert.deepEqual(paths.map((p) => p.map((a) => a.code)), [
    ['SFO', 'JFK'], ['LHR'], ['SEA', 'SFO']
  ]);
  assert.equal(aggregateLegs(paths, distanceKm).length, 2);
});

test('an unknown code breaks the path instead of inventing a nonstop', () => {
  const { paths, unknown } = parseRoute('SFO-ZZZ-JFK', lookup);
  assert.deepEqual(unknown, ['ZZZ']);
  // The important bit: no SFO-JFK leg is fabricated across the gap.
  assert.deepEqual(paths.map((p) => p.map((a) => a.code)), [['SFO'], ['JFK']]);
});

test('parses range rings with each unit', () => {
  const { rings } = parseRoute('500nm@SFO 100mi@JFK 200km@LHR 300@SEA', lookup);
  assert.equal(rings.length, 4);
  assert.ok(Math.abs(rings[0].km - 926) < 0.5);
  assert.ok(Math.abs(rings[1].km - 160.9) < 0.5);
  assert.equal(rings[2].km, 200);
  // A bare number defaults to nautical miles.
  assert.ok(Math.abs(rings[3].km - 555.6) < 0.5);
});

test('empty input yields nothing rather than throwing', () => {
  const result = parseRoute('   ', lookup);
  assert.deepEqual(result.paths, []);
  assert.deepEqual(result.rings, []);
});

test('collects every airport seen, including lone ones', () => {
  const { airports } = parseRoute('SFO-JFK LHR', lookup);
  assert.deepEqual([...airports.keys()].sort(), ['JFK', 'LHR', 'SFO']);
});

// ── aggregation ──────────────────────────────────────────────

console.log('aggregate');

test('merges both directions into one leg with a per-direction count', () => {
  const { paths } = parseRoute('SFO-SEA, SEA-SFO, SEA-SFO', lookup);
  const legs = aggregateLegs(paths, distanceKm);
  assert.equal(legs.length, 1);
  assert.equal(legs[0].count, 3);
  // Key orders the pair alphabetically, so SEA is `from`.
  assert.equal(legs[0].from.code, 'SEA');
  assert.equal(legs[0].to.code, 'SFO');
  assert.equal(legs[0].forward, 2); // SEA -> SFO
  assert.equal(legs[0].reverse, 1); // SFO -> SEA
});

test('distance is computed once per route, not once per flight', () => {
  const { paths } = parseRoute('SFO-SEA, SEA-SFO', lookup);
  let calls = 0;
  const counted = (a, b) => {
    calls++;
    return distanceKm(a, b);
  };
  aggregateLegs(paths, counted);
  assert.equal(calls, 1);
});

test('multi-stop paths produce one leg per hop', () => {
  const { paths } = parseRoute('SFO-SEA-NRT-SIN', lookup);
  const legs = aggregateLegs(paths, distanceKm);
  assert.equal(legs.length, 3);
  assert.deepEqual(legs.map((l) => l.count), [1, 1, 1]);
});

test('total distance weights each route by how often it was flown', () => {
  const { paths } = parseRoute('SFO-SEA, SEA-SFO', lookup);
  const legs = aggregateLegs(paths, distanceKm);
  const total = legs.reduce((sum, leg) => sum + leg.km * leg.count, 0);
  assert.ok(Math.abs(total - 2 * distanceKm(AIRPORTS.SFO, AIRPORTS.SEA)) < 1e-9);
});

test('routes that share no airports stay separate', () => {
  const { paths } = parseRoute('SFO-SEA JFK-LHR', lookup);
  assert.equal(aggregateLegs(paths, distanceKm).length, 2);
});

// ── real data ────────────────────────────────────────────────

console.log('flight history');

const { readFileSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const dir = fileURLToPath(new URL('.', import.meta.url));
const airportData = JSON.parse(readFileSync(`${dir}public/airports.json`, 'utf8'));
const realLookup = (code) => {
  const row = airportData[code];
  return row ? { code, lat: row[0], lon: row[1], city: row[2], country: row[3] } : undefined;
};

test('every code in the shipped flight history resolves', () => {
  const text = readFileSync(`${dir}public/flight.history.doug.txt`, 'utf8');
  const { unknown } = parseRoute(text, realLookup);
  assert.deepEqual(unknown, [], `unresolved codes: ${unknown.join(', ')}`);
});

test('the shipped flight history aggregates to sane totals', () => {
  const text = readFileSync(`${dir}public/flight.history.doug.txt`, 'utf8');
  const { paths } = parseRoute(text, realLookup);
  const legs = aggregateLegs(paths, distanceKm);
  const flights = legs.reduce((sum, leg) => sum + leg.count, 0);
  const totalKm = legs.reduce((sum, leg) => sum + leg.km * leg.count, 0);

  assert.ok(legs.length > 50, `expected >50 distinct routes, got ${legs.length}`);
  assert.ok(flights > legs.length, 'repeat flights should outnumber distinct routes');
  // Currently ~892,000 km; the bound only needs to catch a gross regression.
  assert.ok(totalKm > 5e5, `expected over 500,000 km, got ${Math.round(totalKm)}`);
  assert.ok(legs.every((leg) => leg.forward + leg.reverse === leg.count));
});

test('airports.json is a well-formed lookup', () => {
  const codes = Object.keys(airportData);
  assert.ok(codes.length > 5000, `only ${codes.length} airports`);
  for (const code of codes) {
    const [lat, lon] = airportData[code];
    assert.match(code, /^[A-Z]{3}$/);
    assert.ok(lat >= -90 && lat <= 90, `${code} latitude ${lat}`);
    assert.ok(lon >= -180 && lon <= 180, `${code} longitude ${lon}`);
  }
});

console.log(failures ? `\n${failures} test(s) failed.` : '\nAll tests passed.');
process.exit(failures ? 1 : 0);
