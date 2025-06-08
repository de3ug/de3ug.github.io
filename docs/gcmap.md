# Great Circle Map

This is a lightweight single-page web app for plotting great-circle flight paths. Enter a series of airport codes (e.g. `SEA-LHR` or `JFK-LAX-SFO`) and see the route drawn on an interactive map along with distance calculations. Circles of equal range can be drawn using the `distance@airport` syntax, e.g. `500nm@SFO`.

Multiple sets of segments can be provided by separating them with spaces, commas or newlines. Sets are not connected to each other when drawn.

## Setup

Open <http://localhost:3000/gcmap/> in your browser.

The app is completely static and pulls Leaflet, Turf.js and Tailwind from public CDNs. Airport locations are parsed client-side from the included `airports.dat` file, which is the full dataset from OurAirports. For production you may wish to self-host the JS/CSS assets or bundle them locally.
