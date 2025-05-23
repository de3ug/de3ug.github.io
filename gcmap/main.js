let airportData = {};
let map, layerGroup;

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

function nmToKm(nm) { return nm * 1.852; }
function miToKm(mi) { return mi * 1.60934; }
function kmToNm(km) { return km * 0.539957; }
function kmToMi(km) { return km * 0.621371; }

function initMap() {
  map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 8,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  layerGroup = L.layerGroup().addTo(map);
  map.setView([20,0],2);
}

function parseRoute(str) {
  const parts = str.split('-').map(p => p.trim()).filter(p => p);
  if (parts.length < 2 || parts.length > 10) {
    showToast('Enter 2-10 segments');
    return null;
  }
  const route = [];
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
  // remove duplicate consecutive airports
  const cleaned = [];
  for (const seg of route) {
    if (seg.type === 'airport') {
      const prev = cleaned[cleaned.length - 1];
      if (prev && prev.type === 'airport' && prev.code === seg.code) continue;
    }
    cleaned.push(seg);
  }
  return cleaned;
}

function drawRoute(route) {
  layerGroup.clearLayers();
  const tbody = document.querySelector('#results tbody');
  tbody.innerHTML = '';
  let totalKm = 0;
  const bounds = [];

  for (let i = 0; i < route.length; i++) {
    const seg = route[i];
    if (seg.type === 'circle') {
      const circle = L.circle([seg.center[0], seg.center[1]], {
        radius: seg.km * 1000,
        color: '#d92b2b',
        weight: 2
      }).addTo(layerGroup);
      bounds.push(circle.getBounds());
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
    L.geoJSON(line, {
      style: { color: '#d92b2b', weight: 2 }
    }).addTo(layerGroup);

    const nm = kmToNm(km).toFixed(0);
    const mi = kmToMi(km).toFixed(0);
    const kmStr = km.toFixed(0);
    const row = `<tr class="border-b"><td class="p-2">${a.code} → ${b.code}</td><td class="p-2">${nm}</td><td class="p-2">${mi}</td><td class="p-2">${kmStr}</td></tr>`;
    tbody.insertAdjacentHTML('beforeend', row);
    bounds.push(L.geoJSON(line).getBounds());
  }

  const totalRow = `<tr class="font-bold"><td class="p-2">Total</td><td class="p-2">${kmToNm(totalKm).toFixed(0)}</td><td class="p-2">${kmToMi(totalKm).toFixed(0)}</td><td class="p-2">${totalKm.toFixed(0)}</td></tr>`;
  tbody.insertAdjacentHTML('beforeend', totalRow);

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
  document.getElementById('draw-btn').addEventListener('click', () => {
    const input = document.getElementById('route-input').value.trim().toUpperCase();
    const route = parseRoute(input);
    if (route) drawRoute(route);
  });
}

setup();

// TODO: Autocomplete dropdown for IATA codes
// TODO: Choice of map style (roadmap / satellite)
// TODO: Orthographic globe projection toggle
