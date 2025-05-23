let airportData = {};
let map, layerGroup;
let segmentPopup;

// display options controlled by checkboxes in the UI
let showMarkers = true;
let colorByFrequency = true;

const DEFAULT_COLOR = '#d92b2b';

async function loadAirports() {
  const res = await fetch('public/airports.dat');
  const text = await res.text();
  airportData = {};
  for (const line of text.trim().split(/\r?\n/)) {
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 8) continue;
    const code = parts[4].replace(/"/g, '');
    if (!code || code === '\\N') continue;
    const lat = parseFloat(parts[6]);
    const lon = parseFloat(parts[7]);
    if (isNaN(lat) || isNaN(lon)) continue;
    airportData[code] = {
      name: parts[1].replace(/"/g, ''),
      city: parts[2].replace(/"/g, ''),
      country: parts[3].replace(/"/g, ''),
      lat,
      lon
    };
  }
}

function showToast(msg) {
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function showSegmentPopup(text, latlng) {
  if (segmentPopup) {
    map.closePopup(segmentPopup);
  }
  segmentPopup = L.popup().setLatLng(latlng).setContent(text).openOn(map);
}

function nmToKm(nm) { return nm * 1.852; }
function miToKm(mi) { return mi * 1.60934; }
function kmToNm(km) { return km * 0.539957; }
function kmToMi(km) { return km * 0.621371; }

// return a color from the jet colormap for a value in [0,1]
function jetColor(t) {
  const r = Math.min(1, Math.max(0, Math.min(4 * t - 1.5, -4 * t + 4.5)));
  const g = Math.min(1, Math.max(0, Math.min(4 * t - 0.5, -4 * t + 3.5)));
  const b = Math.min(1, Math.max(0, Math.min(4 * t + 0.5, -4 * t + 2.5)));
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

function initMap() {
  map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 8,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  layerGroup = L.layerGroup().addTo(map);
  map.setView([20,0],2);

  map.on('click', () => {
    if (segmentPopup) {
      map.closePopup(segmentPopup);
      segmentPopup = null;
    }
  });
}

function parseRoute(str) {
  const groups = str
    .trim()
    .split(/[\s,]+/)
    .map(g => g.trim())
    .filter(g => g);

  if (!groups.length) {
    showToast('Enter at least one segment');
    return null;
  }

  const route = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const parts = groups[gi].split(/-/).map(p => p.trim()).filter(p => p);
    if (!parts.length) continue;
    for (const part of parts) {
      const circleMatch = part.match(/^(\d+(?:\.\d+)?)(nm|mi|km)?@([A-Z]{3})$/i);
      if (circleMatch) {
        const radius = parseFloat(circleMatch[1]);
        const units = (circleMatch[2] || 'nm').toLowerCase();
        const code = circleMatch[3].toUpperCase();
        const airport = airportData[code];
        if (!airport) {
          showToast(`Unknown airport code: ${code}`);
          return null;
        }
        let km = radius;
        if (units === 'nm') km = nmToKm(radius);
        else if (units === 'mi') km = miToKm(radius);
        route.push({ type: 'circle', center: [airport.lat, airport.lon], km });
      } else {
        const code = part.toUpperCase();
        const airport = airportData[code];
        if (!airport) {
          showToast(`Unknown airport code: ${code}`);
          return null;
        }
        route.push({ type: 'airport', code, lat: airport.lat, lon: airport.lon });
      }
    }
    if (gi < groups.length - 1) {
      route.push({ type: 'separator' });
    }
  }

  // remove duplicate consecutive airports within a segment set
  const cleaned = [];
  for (const seg of route) {
    if (seg.type === 'airport') {
      const prev = cleaned[cleaned.length - 1];
      if (prev && prev.type === 'airport' && prev.code === seg.code) continue;
    }
    cleaned.push(seg);
  }

  if (!cleaned.length) {
    showToast('Enter at least one valid segment');
    return null;
  }

  return cleaned;
}

function drawRoute(route) {
  layerGroup.clearLayers();
  const tbody = document.querySelector('#results tbody');
  tbody.innerHTML = '';
  let totalKm = 0;
  const bounds = [];

  const airportSet = new Map();
  const segmentCounts = {};
  const segmentLines = {};

  for (let i = 0; i < route.length; i++) {
    const seg = route[i];
    if (seg.type === 'circle') {
      const circle = L.circle([seg.center[0], seg.center[1]], {
        radius: seg.km * 1000,
        color: DEFAULT_COLOR,
        weight: 2
      }).addTo(layerGroup);
      bounds.push(circle.getBounds());
    }
    if (seg.type === 'airport') {
      airportSet.set(seg.code, [seg.lat, seg.lon]);
    }
  }

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i+1];
    if (a.type !== 'airport' || b.type !== 'airport') continue;
    const from = [a.lon, a.lat];
    const to = [b.lon, b.lat];
    const line = turf.greatCircle(from, to, { npoints: 100 });
    const km = turf.length(line, { units: 'kilometers' });
    totalKm += km;

    const key = [a.code, b.code].sort().join('-');
    segmentCounts[key] = (segmentCounts[key] || 0) + 1;
    if (!segmentLines[key]) segmentLines[key] = line;

    const nm = kmToNm(km).toFixed(0);
    const mi = kmToMi(km).toFixed(0);
    const kmStr = km.toFixed(0);
    const row = `<tr class="border-b"><td class="p-2">${a.code} → ${b.code}</td><td class="p-2">${nm}</td><td class="p-2">${mi}</td><td class="p-2">${kmStr}</td></tr>`;
    tbody.insertAdjacentHTML('beforeend', row);
  }

  const totalRow = `<tr class="font-bold"><td class="p-2">Total</td><td class="p-2">${kmToNm(totalKm).toFixed(0)}</td><td class="p-2">${kmToMi(totalKm).toFixed(0)}</td><td class="p-2">${totalKm.toFixed(0)}</td></tr>`;
  tbody.insertAdjacentHTML('beforeend', totalRow);

  // draw airport markers if enabled
  if (showMarkers) {
    for (const [code, coord] of airportSet.entries()) {
      const marker = L.circleMarker([coord[0], coord[1]], {
        radius: 4,
        color: DEFAULT_COLOR,
        weight: 1,
        fillOpacity: 1
      }).addTo(layerGroup);
      marker.bindTooltip(code, { permanent: true, direction: 'top', className: 'airport-label' });
      bounds.push(marker.getLatLng());
    }
  }

  // draw segments using counts
  const maxCount = Math.max(...Object.values(segmentCounts), 1);
  for (const [key, line] of Object.entries(segmentLines)) {
    const count = segmentCounts[key];
    let color = DEFAULT_COLOR;
    if (colorByFrequency && maxCount > 1) {
      const t = (count - 1) / (maxCount - 1);
      color = jetColor(t);
    }
    const gj = L.geoJSON(line, { style: { color, weight: 2 } }).addTo(layerGroup);
    gj.on('click', (e) => {
      const segText = key.replace('-', ' \u2192 ');
      const label = `${segText}: ${count}`;
      showSegmentPopup(label, e.latlng);
      L.DomEvent.stopPropagation(e);
    });
    bounds.push(gj.getBounds());
  }

  // update legend
  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  if (colorByFrequency && maxCount > 1) {
    for (let i = 1; i <= maxCount; i++) {
      const t = (i - 1) / (maxCount - 1);
      const container = document.createElement('div');
      container.className = 'flex flex-col items-center';
      const label = document.createElement('div');
      label.className = 'text-xs';
      label.textContent = `${i}`;
      const swatch = document.createElement('div');
      swatch.className = 'legend-swatch';
      swatch.style.background = jetColor(t);
      container.appendChild(label);
      container.appendChild(swatch);
      legend.appendChild(container);
    }
  }

  if (bounds.length) {
    const combo = bounds[0].extend ? bounds[0] : L.latLngBounds(bounds[0]);
    for (let i = 1; i < bounds.length; i++) {
      combo.extend(bounds[i]);
    }
    map.fitBounds(combo.pad(0.25));
  }
}

async function setup() {
  await loadAirports();
  initMap();
  const inputEl = document.getElementById('route-input');
  const markersCb = document.getElementById('markers-cb');
  const colorCb = document.getElementById('color-cb');

  showMarkers = markersCb.checked;
  colorByFrequency = colorCb.checked;

  markersCb.addEventListener('change', () => {
    showMarkers = markersCb.checked;
    document.getElementById('draw-btn').click();
  });

  colorCb.addEventListener('change', () => {
    colorByFrequency = colorCb.checked;
    document.getElementById('draw-btn').click();
  });
  document.getElementById('draw-btn').addEventListener('click', () => {
    const input = inputEl.value.trim().toUpperCase();
    const route = parseRoute(input);
    if (route) drawRoute(route);
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('draw-btn').click();
    }
  });

  const params = new URLSearchParams(window.location.search);
  if (params.has('file')) {
    const file = params.get('file');
    try {
      const res = await fetch('public/' + file);
      const text = await res.text();
      inputEl.value = text.trim();
      document.getElementById('draw-btn').click();
    } catch (err) {
      console.error(err);
      showToast('Unable to load file');
    }
  }
}

setup();

// TODO: Autocomplete dropdown for IATA codes
// TODO: Choice of map style (roadmap / satellite)
// TODO: Orthographic globe projection toggle
