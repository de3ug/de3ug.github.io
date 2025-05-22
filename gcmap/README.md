# GCMap

A simple single-page React app for plotting great-circle routes between airports.

## Setup

```bash
npm install
npm run dev
```

Open your browser at the printed local URL.

## Demo

The `public/demo.gif` file is not included in the repository to keep the repo small. You can add your own `demo.gif` locally if you want to showcase the app:

```bash
# place a demo.gif illustrating the app in gcmap/public/
```

Type a route such as `SEA-LHR-DXB-SIN` to see arcs drawn on the map and leg-by-leg distances reported below.

This project uses Leaflet, GeographicLib and Tailwind CSS. The airports data is loaded from `public/airports.json` at runtime. Replace it with the full OpenFlights dataset for complete coverage.
