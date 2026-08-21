import {
  distanceKm,
  greatCirclePoints,
  kmToMi,
  kmToNm,
  normalizeLon,
  viridis
} from './geo.js';
import { aggregateLegs, parseRoute } from './parse.js';

// Leaflet renders vector layers once, in the [-180, 180] world, while the tile
// layer repeats forever. Zoomed out that leaves flight paths cut off in every
// copy but one, so each path is drawn in the neighbouring copies too.
//
// Three copies is enough: the map is capped at ~1100px wide and minZoom 1 puts
// a whole world in 512px, so at most ~2.2 copies are ever on screen, and
// worldCopyJump keeps panning from wandering further out.
const WORLD_OFFSETS = [-360, 0, 360];

const ARC_POINTS = 64;
const EQUATOR_KM = 40075;

// ?file= only ever addresses a data file shipped next to the page.
const DATA_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.txt$/;

const state = {
  airports: {},
  parsed: null,
  legs: [],
  maxCount: 1,
  showMarkers: true,
  showLabels: true,
  colorByFrequency: true,
  sort: { key: 'count', dir: -1 }
};

let map;
let routeLayer;
let labelLayer;
let labelMarkers = [];
let labelShift = 0;
// Canvas paints with literal colour strings, so CSS custom properties have to
// be resolved up front and refreshed whenever the theme flips.
let theme = { route: '#d92b2b', airport: '#d92b2b' };

const el = (id) => document.getElementById(id);
const lookup = (code) => state.airports[code];

const fmt = (n, digits = 0) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function notify(message, kind = 'info') {
  const box = el('notice');
  box.textContent = message || '';
  box.className = `notice notice-${kind}`;
  box.hidden = !message;
}

/** "San Francisco, United States" — whatever of the two we actually have. */
function placeOf(code) {
  const airport = state.airports[code];
  if (!airport) return '';
  return [airport.city, airport.country].filter(Boolean).join(', ');
}

async function loadAirports() {
  const res = await fetch('public/airports.json');
  if (!res.ok) throw new Error(`airports.json: HTTP ${res.status}`);
  const raw = await res.json();
  const out = {};
  for (const code of Object.keys(raw)) {
    const [lat, lon, city, country] = raw[code];
    out[code] = { code, lat, lon, city, country };
  }
  state.airports = out;
}

function initMap() {
  map = L.map('map', {
    minZoom: 1,
    worldCopyJump: true,
    // Canvas keeps hundreds of wrapped paths cheap, and `tolerance` gives the
    // 2px-wide lines a forgiving hit area so they can actually be clicked.
    renderer: L.canvas({ tolerance: 6 })
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  routeLayer = L.layerGroup().addTo(map);
  labelLayer = L.layerGroup().addTo(map);
  map.setView([20, 0], 2);

  // Labels sit in one world copy and are thinned to fit; both only need
  // recomputing once the view has settled.
  map.on('moveend', positionLabels);
  map.on('zoomend', positionLabels);
}

// Approximate on-screen footprint of a three-letter label, including the
// offset that lifts it clear of its dot.
const LABEL_BOX = { dx: 6, dy: -14, w: 28, h: 14 };

function positionLabels() {
  if (!labelMarkers.length) return;

  // Keep the labels in whichever world copy is being looked at.
  const shift = Math.round(map.getCenter().lng / 360) * 360;
  if (shift !== labelShift) {
    labelShift = shift;
    for (const item of labelMarkers) item.marker.setLatLng([item.lat, item.lon + shift]);
  }

  // Greedy declutter: 76 airports zoomed out to the whole world is an
  // unreadable smear, so busier airports claim their space first and anything
  // that would land on top of an already-placed label is hidden.
  const placed = [];
  for (const item of labelMarkers) {
    const point = map.latLngToContainerPoint([item.lat, item.lon + labelShift]);
    const box = {
      x1: point.x + LABEL_BOX.dx,
      y1: point.y + LABEL_BOX.dy,
      x2: point.x + LABEL_BOX.dx + LABEL_BOX.w,
      y2: point.y + LABEL_BOX.dy + LABEL_BOX.h
    };
    const clash = placed.some(
      (other) => box.x1 < other.x2 && box.x2 > other.x1 && box.y1 < other.y2 && box.y2 > other.y1
    );
    const node = item.marker.getElement();
    if (node) node.style.visibility = clash ? 'hidden' : '';
    if (!clash) placed.push(box);
  }
}

function legPopupHtml(leg) {
  const a = leg.from.code;
  const b = leg.to.code;
  const nm = fmt(kmToNm(leg.km));
  const mi = fmt(kmToMi(leg.km));
  const km = fmt(leg.km);
  const total = leg.km * leg.count;

  const rows = [
    [`${escapeHtml(a)} &rarr; ${escapeHtml(b)}`, fmt(leg.forward)],
    [`${escapeHtml(b)} &rarr; ${escapeHtml(a)}`, fmt(leg.reverse)],
    ['Total', `${fmt(leg.count)} flight${leg.count === 1 ? '' : 's'}`]
  ]
    .map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`)
    .join('');

  return `
    <div class="leg-popup">
      <h3>${escapeHtml(a)} &harr; ${escapeHtml(b)}</h3>
      <p class="leg-places">${escapeHtml(placeOf(a))} &harr; ${escapeHtml(placeOf(b))}</p>
      <table><tbody>${rows}</tbody></table>
      <p class="leg-dist">Each way ${nm} nm &middot; ${mi} mi &middot; ${km} km</p>
      <p class="leg-dist">Flown ${fmt(kmToMi(total))} mi &middot; ${fmt(total)} km</p>
    </div>`;
}

function airportPopupHtml(code, legCount) {
  const place = placeOf(code);
  return `
    <div class="leg-popup">
      <h3>${escapeHtml(code)}</h3>
      ${place ? `<p class="leg-places">${escapeHtml(place)}</p>` : ''}
      <p class="leg-dist">${fmt(legCount)} route${legCount === 1 ? '' : 's'} from here</p>
    </div>`;
}

function readTheme() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  theme = {
    route: read('--route', '#d92b2b'),
    airport: read('--airport', '#d92b2b')
  };
}

function colorFor(count) {
  if (!state.colorByFrequency || state.maxCount < 2) return theme.route;
  return viridis((count - 1) / (state.maxCount - 1));
}

function drawLegs() {
  for (const leg of state.legs) {
    if (!leg.points) leg.points = greatCirclePoints(leg.from, leg.to, ARC_POINTS);
    const color = colorFor(leg.count);
    const weight = state.colorByFrequency && state.maxCount > 1
      ? 1.5 + 2 * ((leg.count - 1) / (state.maxCount - 1))
      : 2;

    for (const offset of WORLD_OFFSETS) {
      const shifted = leg.points.map(([lat, lon]) => [lat, lon + offset]);
      const line = L.polyline(shifted, { color, weight, opacity: 0.85 });
      line.bindPopup(() => legPopupHtml(leg));
      line.addTo(routeLayer);
    }
  }
  // Deliberately not contributing to fitBounds: these longitudes are unwrapped
  // and can sit outside [-180, 180], which would throw the fit into another
  // world copy. The airports they connect bound the same area.
}

function drawAirports(bounds) {
  // How many distinct routes touch each airport — shown in its popup.
  const degree = new Map();
  for (const leg of state.legs) {
    degree.set(leg.from.code, (degree.get(leg.from.code) || 0) + 1);
    degree.set(leg.to.code, (degree.get(leg.to.code) || 0) + 1);
  }

  labelMarkers = [];
  labelShift = 0;

  // Busiest airports first, so they win the decluttering pass below.
  const byBusiest = [...state.parsed.airports].sort(
    (a, b) => (degree.get(b[0]) || 0) - (degree.get(a[0]) || 0)
  );

  for (const [code, airport] of byBusiest) {
    const lat = airport.lat;
    const lon = normalizeLon(airport.lon);
    bounds.push(L.latLng(lat, lon));

    if (state.showMarkers) {
      for (const offset of WORLD_OFFSETS) {
        const dot = L.circleMarker([lat, lon + offset], {
          radius: 4,
          color: theme.airport,
          weight: 1,
          fillOpacity: 1
        });
        dot.bindPopup(airportPopupHtml(code, degree.get(code) || 0));
        dot.addTo(routeLayer);
      }
    }

    if (state.showLabels) {
      const marker = L.marker([lat, lon], {
        interactive: false, // never swallow a click meant for a line beneath
        keyboard: false,
        icon: L.divIcon({
          className: 'airport-label',
          html: escapeHtml(code),
          iconSize: null
        })
      });
      marker.addTo(labelLayer);
      labelMarkers.push({ marker, lat, lon });
    }
  }
  positionLabels();
}

function drawRings(bounds) {
  for (const ring of state.parsed.rings) {
    for (const offset of WORLD_OFFSETS) {
      const circle = L.circle([ring.center.lat, normalizeLon(ring.center.lon) + offset], {
        radius: ring.km * 1000,
        color: colorFor(1),
        weight: 2,
        fill: false
      }).addTo(routeLayer);
      if (offset === 0) bounds.push(circle.getBounds());
    }
  }
}

function renderLegend() {
  const legend = el('legend');
  legend.innerHTML = '';
  if (!state.colorByFrequency || state.maxCount < 2) {
    legend.hidden = true;
    return;
  }
  legend.hidden = false;

  // A continuous ramp. The old legend emitted one swatch per value, which for
  // this data meant 59 swatches in a row.
  const stops = [];
  for (let i = 0; i <= 10; i++) stops.push(viridis(i / 10));

  legend.innerHTML = `
    <span class="legend-label">1&times;</span>
    <span class="legend-bar" style="background:linear-gradient(to right, ${stops.join(',')})"></span>
    <span class="legend-label">${fmt(state.maxCount)}&times;</span>
    <span class="legend-caption">flights per route</span>`;
}

function totals() {
  let km = 0;
  let flights = 0;
  for (const leg of state.legs) {
    km += leg.km * leg.count;
    flights += leg.count;
  }
  return { km, flights };
}

function renderSummary() {
  const { km, flights } = totals();
  const stats = [
    [fmt(flights), 'flights'],
    [fmt(state.legs.length), 'routes'],
    [fmt(state.parsed ? state.parsed.airports.size : 0), 'airports'],
    [fmt(kmToNm(km)), 'nm'],
    [fmt(kmToMi(km)), 'mi'],
    [fmt(km), 'km'],
    [`${fmt(km / EQUATOR_KM, 1)}&times;`, 'round the equator']
  ];

  el('summary').innerHTML = stats
    .map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`)
    .join('');
}

const SORTERS = {
  route: (a, b) => a.key.localeCompare(b.key),
  count: (a, b) => a.count - b.count,
  distance: (a, b) => a.km - b.km,
  total: (a, b) => a.km * a.count - b.km * b.count
};

function renderTable() {
  const tbody = document.querySelector('#results tbody');
  const { key, dir } = state.sort;
  const sorted = [...state.legs].sort((a, b) => SORTERS[key](a, b) * dir);

  // One row per route rather than one per leg. The old table repeated an
  // identical SEA-SFO row once for every time it had been flown.
  const rows = sorted.map((leg) => {
    const total = leg.km * leg.count;
    const split = `${fmt(leg.forward)}&nbsp;/&nbsp;${fmt(leg.reverse)}`;
    return `<tr>
      <td class="route">${escapeHtml(leg.from.code)} &harr; ${escapeHtml(leg.to.code)}</td>
      <td class="num">${fmt(leg.count)}</td>
      <td class="num split">${split}</td>
      <td class="num">${fmt(kmToNm(leg.km))}</td>
      <td class="num">${fmt(kmToMi(leg.km))}</td>
      <td class="num">${fmt(leg.km)}</td>
      <td class="num">${fmt(total)}</td>
    </tr>`;
  });

  const { km, flights } = totals();
  rows.push(`<tr class="total-row">
    <th scope="row">Total</th>
    <td class="num">${fmt(flights)}</td>
    <td class="num"></td>
    <td class="num"></td>
    <td class="num"></td>
    <td class="num"></td>
    <td class="num">${fmt(km)}</td>
  </tr>`);

  tbody.innerHTML = rows.join('');

  for (const th of document.querySelectorAll('#results th[data-sort]')) {
    const active = th.dataset.sort === key;
    th.setAttribute('aria-sort', active ? (dir === 1 ? 'ascending' : 'descending') : 'none');
  }
}

/**
 * Redraw everything from `state`. Never re-reads or re-parses the textarea.
 * `fit` is only set for a fresh route — a display toggle must not yank the
 * map back out of wherever the reader had panned to.
 */
function render({ fit = false } = {}) {
  if (!state.parsed) return;

  readTheme();
  routeLayer.clearLayers();
  labelLayer.clearLayers();

  const bounds = [];
  drawRings(bounds);
  drawLegs();
  drawAirports(bounds);

  renderLegend();
  renderSummary();
  renderTable();

  // Seed an empty bounds and extend uniformly — L.latLngBounds(singleLatLng)
  // silently yields an *empty* bounds, which used to drop the first marker.
  if (fit && bounds.length) {
    const combined = L.latLngBounds([]);
    for (const b of bounds) combined.extend(b);
    if (combined.isValid()) map.fitBounds(combined.pad(0.15));
  }
}

/** Parse the textarea, then render. */
function draw() {
  const parsed = parseRoute(el('route-input').value, lookup);

  if (!parsed.paths.length && !parsed.rings.length) {
    notify(
      parsed.unknown.length
        ? `No usable segments. Unrecognised: ${parsed.unknown.join(', ')}`
        : 'Enter at least one segment, e.g. SEA-LHR',
      'error'
    );
    return;
  }

  state.parsed = parsed;
  state.legs = aggregateLegs(parsed.paths, distanceKm);
  state.maxCount = state.legs.reduce((max, leg) => Math.max(max, leg.count), 1);

  notify(
    parsed.unknown.length
      ? `Skipped ${parsed.unknown.length} unrecognised code${parsed.unknown.length === 1 ? '' : 's'}: ${parsed.unknown.join(', ')}`
      : '',
    'warn'
  );

  render({ fit: true });
}

async function loadFile(name) {
  if (!DATA_FILE.test(name)) throw new Error('Invalid file name');
  const res = await fetch(`public/${name}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.text()).trim();
}

function wireControls() {
  const input = el('route-input');

  el('draw-btn').addEventListener('click', draw);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      draw();
    }
  });

  // Display toggles only need a redraw — the parse is already in state.
  const toggles = [
    ['markers-cb', 'showMarkers'],
    ['labels-cb', 'showLabels'],
    ['color-cb', 'colorByFrequency']
  ];
  for (const [id, key] of toggles) {
    const box = el(id);
    state[key] = box.checked;
    box.addEventListener('change', () => {
      state[key] = box.checked;
      render();
    });
  }

  for (const th of document.querySelectorAll('#results th[data-sort]')) {
    const toggleSort = () => {
      const key = th.dataset.sort;
      if (state.sort.key === key) state.sort.dir *= -1;
      else state.sort = { key, dir: key === 'route' ? 1 : -1 };
      renderTable();
    };
    th.addEventListener('click', toggleSort);
    th.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleSort();
      }
    });
  }
}

async function setup() {
  const button = el('draw-btn');
  button.disabled = true;
  notify('Loading airport data…');

  try {
    await loadAirports();
  } catch (error) {
    console.error(error);
    notify('Could not load airport data. Try reloading the page.', 'error');
    return;
  }

  initMap();
  wireControls();
  readTheme();

  // Canvas strokes are baked-in colours, so the shared site theme toggle has
  // to trigger an actual repaint rather than just restyling the DOM.
  new MutationObserver(() => render()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  button.disabled = false;
  notify('');

  const file = new URLSearchParams(window.location.search).get('file');
  if (!file) return;

  try {
    el('route-input').value = await loadFile(file);
    draw();
  } catch (error) {
    console.error(error);
    notify(`Unable to load "${file}".`, 'error');
  }
}

setup().catch((error) => {
  console.error(error);
  notify('Something went wrong starting the map.', 'error');
});
