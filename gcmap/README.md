# Great Circle Map

This is a lightweight single-page web app for plotting great-circle flight paths. Enter a series of airport codes (e.g. `SEA-LHR` or `JFK-LAX-SFO`) and see the route drawn on an interactive map along with distance calculations.

## Setup

Open <http://localhost:3000/gcmap/> in your browser.

The app is completely static and pulls Leaflet, Turf.js and Tailwind from public CDNs. Airport locations are parsed client-side from the included `airports.dat` file, which is the full dataset from OurAirports. For production you may wish to self-host the JS/CSS assets or bundle them locally.
