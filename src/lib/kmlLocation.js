// One coordinate per hike, for the "all hikes" overview. Loading every trip's KML
// into the globe draws every trail, waypoint and pushpin at once, which from orbit
// is an unreadable knot of pins over the Cascades — and each trail is a two-pixel
// line to click. So the overview doesn't load the KML into Cesium at all: it reads
// a single point out of each file and drops one labelled pin for the hike.
//
// The file is read as text and scanned, not parsed into a DOM: DOMParser is a
// browser API and the test environment is node, and pulling one number pair out of
// a Google Earth export doesn't need a tree. Tag matching allows an optional
// namespace prefix (`kml:coordinates`), which some exporters write.

const COORDINATES_TAG = /<(?:\w+:)?coordinates\b[^>]*>([\s\S]*?)</i;

// Takes the raw text of the two tags, because `Number('')` is 0 — an empty
// <longitude> would otherwise read as a valid pin off the coast of Africa.
function toLocation(longitudeText, latitudeText) {
  if (!longitudeText?.trim() || !latitudeText?.trim()) return null;
  const lng = Number(longitudeText);
  const lat = Number(latitudeText);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lng, lat };
}

// the first coordinate in the document — the start of the first
// placemark, so a trailhead or the first waypoint. Off-centre for the route, but
// it is on the hike, which is all the overview pin has to be.
function firstCoordinateLocation(kmlText) {
  const [, coordinatesText] = kmlText.match(COORDINATES_TAG) ?? [];
  if (!coordinatesText) return null;
  const [firstTuple] = coordinatesText.trim().split(/\s+/);
  const [longitudeText, latitudeText] = (firstTuple ?? '').split(',');
  return toLocation(longitudeText, latitudeText);
}

// `{ lng, lat }` for the trip's overview pin, or null if the file carries no
// usable coordinate.
export function parseKmlLocation(kmlText) {
  if (typeof kmlText !== 'string') return null;
  return firstCoordinateLocation(kmlText);
}

// Trips paired with their pin location, in input order, skipping any whose KML
// can't be fetched or read. One unreachable file costs its own pin and nothing
// else — blanking the whole overview because a single trip failed would be worse
// than showing the rest.
export async function fetchTripLocations(trips) {
  const located = await Promise.all(
    trips.map(async (trip) => {
      try {
        const response = await fetch(trip.url);
        if (!response.ok) throw new Error(`KML request failed: ${response.status}`);
        const location = parseKmlLocation(await response.text());
        if (!location) throw new Error('KML carries no usable coordinate');
        return { trip, ...location };
      } catch (error) {
        console.error(`Overview pin unavailable for "${trip.name}"`, error);
        return null;
      }
    }),
  );
  return located.filter(Boolean);
}
