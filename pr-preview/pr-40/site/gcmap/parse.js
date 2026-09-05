// Route-text parsing. Pure: takes the raw textarea contents plus an airport
// lookup, returns structured paths. No DOM access.

// e.g. "500nm@SFO", "800KM@lhr" — a range ring rather than a leg.
const RING = /^(\d+(?:\.\d+)?)(nm|mi|km)?@([A-Za-z]{3})$/;

const UNITS_TO_KM = {
  nm: (v) => v * 1.852,
  mi: (v) => v * 1.609344,
  km: (v) => v
};

/**
 * Parse route text into connected paths plus range rings.
 *
 * Segment sets are separated by whitespace or commas; airports within a set
 * are joined by '-'. Sets are drawn as independent paths.
 *
 * `lookup(code)` returns {lat, lon, ...} or undefined.
 *
 * Returns {paths, rings, unknown, airports}. An unrecognised code ends the
 * current path instead of aborting the parse, so one typo in a long history
 * costs you that leg rather than the whole map — and never invents a
 * nonstop by silently joining the codes either side of it.
 */
export function parseRoute(text, lookup) {
  const paths = [];
  const rings = [];
  const unknown = [];
  const airports = new Map();

  const sets = String(text || '')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);

  for (const set of sets) {
    let current = [];
    const flush = () => {
      if (current.length) paths.push(current);
      current = [];
    };

    for (const raw of set.split('-').filter(Boolean)) {
      const ring = raw.match(RING);
      if (ring) {
        const code = ring[3].toUpperCase();
        const airport = lookup(code);
        if (!airport) {
          if (!unknown.includes(code)) unknown.push(code);
          flush();
          continue;
        }
        const units = (ring[2] || 'nm').toLowerCase();
        rings.push({
          code,
          center: { lat: airport.lat, lon: airport.lon },
          km: UNITS_TO_KM[units](parseFloat(ring[1]))
        });
        airports.set(code, airport);
        continue;
      }

      const code = raw.toUpperCase();
      const airport = lookup(code);
      if (!airport) {
        if (!unknown.includes(code)) unknown.push(code);
        flush();
        continue;
      }
      airports.set(code, airport);

      // Collapse a repeated code (…-SFO-SFO-…): it is not a leg.
      const prev = current[current.length - 1];
      if (prev && prev.code === code) continue;
      current.push({ code, lat: airport.lat, lon: airport.lon });
    }
    flush();
  }

  return { paths, rings, unknown, airports };
}

/**
 * Collapse parsed paths into one entry per airport pair, counting each
 * direction separately.
 *
 * A->B and B->A share a geodesic, so drawing both stacks two identical lines
 * and makes the lower one unclickable. One merged entry carries both counts.
 *
 * `distanceKm(a, b)` is injected so this stays free of geo imports.
 */
export function aggregateLegs(paths, distanceKm) {
  const legs = new Map();

  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      if (from.code === to.code) continue;

      const [first, second] =
        from.code < to.code ? [from, to] : [to, from];
      const key = `${first.code}|${second.code}`;

      let leg = legs.get(key);
      if (!leg) {
        leg = {
          key,
          from: first,
          to: second,
          km: distanceKm(first, second),
          count: 0,
          forward: 0, // first -> second
          reverse: 0  // second -> first
        };
        legs.set(key, leg);
      }
      leg.count++;
      if (from.code === first.code) leg.forward++;
      else leg.reverse++;
    }
  }

  return [...legs.values()];
}
