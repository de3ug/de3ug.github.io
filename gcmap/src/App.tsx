import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Circle } from 'react-leaflet';
import { LatLngExpression, LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geodesic } from 'geographiclib';
import * as turf from '@turf/turf';

interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface CircleDef {
  code: string;
  radiusNm: number;
}

interface Segment {
  code: string;
  circle?: CircleDef;
}

interface LegDistance {
  nm: number;
  mi: number;
  km: number;
}

interface Leg {
  from: Airport;
  to: Airport;
  dist: LegDistance;
  path: LatLngExpression[];
}

const geod = Geodesic.WGS84;

function parseInput(raw: string): Segment[] {
  const parts = raw
    .split('-')
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  const segments: Segment[] = [];
  for (const part of parts) {
    const circleMatch = part.match(/(\d+)NM@([A-Z]{3})/);
    if (circleMatch) {
      segments.push({ code: circleMatch[2], circle: { code: circleMatch[2], radiusNm: parseFloat(circleMatch[1]) } });
    } else {
      const code = part;
      if (segments.length === 0 || segments[segments.length - 1].code !== code) {
        segments.push({ code });
      }
    }
  }
  return segments.slice(0, 10);
}

function calcDistance(a: Airport, b: Airport): LegDistance {
  const res = geod.Inverse(a.latitude, a.longitude, b.latitude, b.longitude);
  const meters = res.s12;
  return {
    nm: meters / 1852,
    mi: meters / 1609.344,
    km: meters / 1000,
  };
}

export default function App() {
  const [airports, setAirports] = useState<Record<string, Airport>>({});
  const [input, setInput] = useState('');
  const [legs, setLegs] = useState<Leg[]>([]);
  const [circles, setCircles] = useState<CircleDef[]>([]);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    fetch('/airports.json')
      .then((r) => r.json())
      .then((data: Airport[]) => {
        const dict: Record<string, Airport> = {};
        data.forEach((a) => {
          if (a.iata) dict[a.iata.toUpperCase()] = a;
        });
        setAirports(dict);
      });
  }, []);

  useEffect(() => {
    const segments = parseInput(input);
    const newLegs: Leg[] = [];
    const newCircles: CircleDef[] = [];
    const missing: string[] = [];
    let prev: Airport | null = null;
    for (const seg of segments) {
      const airport = airports[seg.code];
      if (!airport) {
        missing.push(seg.code);
        continue;
      }
      if (prev) {
        const dist = calcDistance(prev, airport);
        const line = turf.greatCircle([prev.longitude, prev.latitude], [airport.longitude, airport.latitude], { npoints: 100 });
        const coords = line.geometry.coordinates.map((c) => [c[1], c[0]] as LatLngExpression);
        newLegs.push({ from: prev, to: airport, dist, path: coords });
      }
      if (seg.circle) {
        newCircles.push(seg.circle);
      }
      prev = airport;
    }
    setLegs(newLegs);
    setCircles(newCircles);
    if (missing.length > 0) {
      alert(`Missing airport codes: ${missing.join(', ')}`);
    }
  }, [input, airports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new LatLngBounds([]);
    legs.forEach((leg) => {
      leg.path.forEach((p) => bounds.extend(p as any));
    });
    circles.forEach((c) => {
      const a = airports[c.code];
      if (a) bounds.extend([a.latitude, a.longitude]);
    });
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [legs, circles, airports]);

  const totals = legs.reduce(
    (acc, l) => ({ nm: acc.nm + l.dist.nm, mi: acc.mi + l.dist.mi, km: acc.km + l.dist.km }),
    { nm: 0, mi: 0, km: 0 }
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-gray-100 flex items-center gap-2">
        <input
          className="border p-2 flex-1"
          placeholder="Enter route e.g. SEA-LHR-DXB-SIN"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>
      <div className="flex-1">
        <MapContainer ref={mapRef} className="w-full h-full" center={[0, 0]} zoom={2} scrollWheelZoom>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {legs.map((leg, idx) => (
            <Polyline key={idx} positions={leg.path} pathOptions={{ color: '#d92b2b', weight: 2 }} />
          ))}
          {circles.map((c, idx) => {
            const a = airports[c.code];
            if (!a) return null;
            return (
              <Circle
                key={`c${idx}`}
                center={[a.latitude, a.longitude]}
                radius={c.radiusNm * 1852}
                pathOptions={{ color: '#d92b2b', weight: 2, fill: false }}
              />
            );
          })}
        </MapContainer>
      </div>
      {legs.length > 0 && (
        <div className="p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-2 text-left">Leg</th>
                <th className="px-2 text-right">Distance (nm)</th>
                <th className="px-2 text-right">mi</th>
                <th className="px-2 text-right">km</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, idx) => (
                <tr key={idx} className="border-b">
                  <td className="px-2">{leg.from.iata} → {leg.to.iata}</td>
                  <td className="px-2 text-right">{leg.dist.nm.toFixed(1)}</td>
                  <td className="px-2 text-right">{leg.dist.mi.toFixed(1)}</td>
                  <td className="px-2 text-right">{leg.dist.km.toFixed(1)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="px-2">Total</td>
                <td className="px-2 text-right">{totals.nm.toFixed(1)}</td>
                <td className="px-2 text-right">{totals.mi.toFixed(1)}</td>
                <td className="px-2 text-right">{totals.km.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
