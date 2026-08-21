# Great Circle Map

A lightweight single-page app for plotting great-circle flight paths. Enter a
series of airport codes (e.g. `SEA-LHR` or `JFK-LAX-SFO`) and the route is drawn
on an interactive map with distances totalled up. Range rings use the
`distance@airport` syntax, e.g. `500nm@SFO` (units: `nm` default, `mi`, `km`).

Multiple sets of segments can be given, separated by spaces, commas or newlines.
Sets are drawn as independent paths and never joined to each other.

## Running it

    python build.py --format=web     # serves site/ at localhost:8000

Then open <http://localhost:8000/gcmap/>.

`?file=<name>.txt` preloads a route file from `site/gcmap/public/`, which is how
[Doug's flight history](https://de3ug.github.io/gcmap/?file=flight.history.doug.txt)
is linked from the front page. Only plain `*.txt` names in that directory are
accepted.

## Layout

| Path | Role |
| --- | --- |
| `site/gcmap/index.html` | Markup and controls |
| `site/gcmap/main.js` | App: map, layers, table, interaction |
| `site/gcmap/geo.js` | Pure spherical maths and the colour ramp |
| `site/gcmap/parse.js` | Route-text parsing and per-route aggregation |
| `site/gcmap/test.js` | Tests for the two pure modules |
| `site/css/gcmap.css` | Styling, including the dark theme |
| `data/airports.dat` | OpenFlights source dump — **not** deployed |
| `site/gcmap/public/airports.json` | Generated lookup the page actually loads |

Leaflet is the only runtime dependency, pulled from a CDN with an SRI hash.
Great-circle interpolation and distance are computed in `geo.js` rather than by
pulling in a geospatial library for two functions.

## Airport data

`site/gcmap/public/airports.json` is **generated** — don't edit it by hand:

    python build.py --format=airports

It converts `data/airports.dat` (the full OpenFlights dump, ~1.1 MB) into a
compact `{"IATA": [lat, lon, city, country]}` map of the ~6,000 airports that
have an IATA code, at ~290 KB. The source file needs a real CSV reader: about
20 rows quote a comma inside a field (`"Svalbard Airport, Longyear"`), and
splitting on `,` silently drops them.

## Tests

    node site/gcmap/test.js

Covers the geometry (distances against published values, antimeridian
continuity, degenerate endpoints), the parser (unknown codes, separators, range
rings) and aggregation, plus checks that every code in the shipped flight
history still resolves. Run in CI alongside the HTML validator.

## Notes on the drawing

* **World copies.** Leaflet draws vector layers once, in the `[-180, 180]`
  world, while tiles repeat forever — so zoomed out, paths used to stop dead at
  the edge. Arcs are built with *unwrapped* longitudes (they may run past
  ±180 so a transpacific route stays one continuous line) and each is drawn in
  the neighbouring world copies too.
* **Both directions merged.** `SFO-SEA` and `SEA-SFO` share a geodesic, so they
  are collapsed into one line carrying both counts. Clicking it shows the split
  each way and the combined total.
* **Canvas renderer.** Hundreds of wrapped paths stay cheap, and a click
  tolerance gives the thin lines a usable hit area.
* **Labels.** Drawn in whichever world copy is on screen and thinned greedily —
  busiest airports claim their space first — so a global view stays readable.
