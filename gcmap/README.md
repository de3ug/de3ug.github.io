# Great Circle Map

This is a lightweight single-page web app for plotting great-circle flight paths. Enter a series of airport codes (e.g. `SEA-LHR` or `JFK-LAX-SFO`) and see the route drawn on an interactive map along with distance calculations.

## Setup

1. Install dependencies

```bash
npm i
```

2. Start the dev server

```bash
npm run dev
```

Then open <http://localhost:3000/gcmap/> in your browser.

The app is completely static and pulls Leaflet, Turf.js and Tailwind from public CDNs. For production you may wish to self-host these assets or bundle them locally.
