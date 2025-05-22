# GCMap

A simple single-page React app for plotting great-circle routes between airports.

## Setup

```bash
npm install
npm run dev
```

Open your browser at the printed local URL.

## Demo

Type a route such as `SEA-LHR-DXB-SIN` to see arcs drawn on the map and leg-by-leg distances reported below.

This project uses Leaflet, GeographicLib and Tailwind CSS. The airports data is loaded from `public/airports.json` at runtime. Replace it with the full OpenFlights dataset for complete coverage.
