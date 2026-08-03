import { describe, test, expect, vi, afterEach } from 'vitest';
import { parseKmlLocation, fetchTripLocations } from './kmlLocation';

// Trimmed to the shape a Google Earth Pro export actually has: a document-level
// LookAt above the styles, then placemarks whose coordinates are lng,lat,alt
// tuples separated by whitespace. The LookAt is kept in the fixture on purpose —
// the pin comes from the first placemark coordinate even when one is present.
const kmlWithLookAt = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>PCT WA Goat Rocks Wilderness</name>
  <LookAt>
    <longitude>-121.432207</longitude>
    <latitude>46.569769</latitude>
    <altitude>0</altitude>
    <range>23805.558251</range>
  </LookAt>
  <Placemark>
    <LineString>
      <coordinates>-121.386,46.643,1372 -121.390,46.640,1400</coordinates>
    </LineString>
  </Placemark>
</Document>
</kml>`;

const kmlWithoutLookAt = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <Placemark>
    <LineString>
      <coordinates>
        -121.386,46.643,1372
        -121.390,46.640,1400
      </coordinates>
    </LineString>
  </Placemark>
</Document>
</kml>`;

describe('parseKmlLocation', () => {
  test('reads the first coordinate tuple of the first placemark', () => {
    expect(parseKmlLocation(kmlWithoutLookAt)).toEqual({ lng: -121.386, lat: 46.643 });
  });

  test('uses the coordinates even when the document carries a LookAt', () => {
    expect(parseKmlLocation(kmlWithLookAt)).toEqual({ lng: -121.386, lat: 46.643 });
  });

  test('reads a namespace-prefixed coordinates tag', () => {
    const prefixed = `<kml:kml><kml:Document><kml:Placemark>
      <kml:coordinates>-120.5,47.25,0</kml:coordinates>
      </kml:Placemark></kml:Document></kml:kml>`;
    expect(parseKmlLocation(prefixed)).toEqual({ lng: -120.5, lat: 47.25 });
  });

  test('returns null for out-of-range coordinates', () => {
    const swapped = `<kml><coordinates>46.643,-181.0,0</coordinates></kml>`;
    expect(parseKmlLocation(swapped)).toBeNull();
  });

  test('returns null when the tuple is missing its latitude', () => {
    expect(parseKmlLocation('<kml><coordinates>-121.386</coordinates></kml>')).toBeNull();
  });

  test('returns null when the coordinates tag is empty', () => {
    expect(parseKmlLocation('<kml><coordinates>   </coordinates></kml>')).toBeNull();
  });

  test('returns null when the file carries no coordinate at all', () => {
    expect(parseKmlLocation('<kml><Document><name>Empty</name></Document></kml>')).toBeNull();
  });

  test('returns null for a non-string input', () => {
    expect(parseKmlLocation(null)).toBeNull();
    expect(parseKmlLocation(undefined)).toBeNull();
  });
});

describe('fetchTripLocations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('pairs each trip with the coordinate read from its KML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => kmlWithLookAt })),
    );
    const trips = [{ id: 'trip-1', name: 'Goat Rocks', url: 'https://cdn.test/goat-rocks.kml' }];

    const located = await fetchTripLocations(trips);

    expect(located).toEqual([{ trip: trips[0], lng: -121.386, lat: 46.643 }]);
    expect(fetch).toHaveBeenCalledWith('https://cdn.test/goat-rocks.kml');
  });

  test('skips a trip whose KML fails to load and keeps the rest', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.includes('missing')
          ? { ok: false, status: 404 }
          : { ok: true, text: async () => kmlWithoutLookAt },
      ),
    );
    const trips = [
      { id: 'trip-1', name: 'Missing', url: 'https://cdn.test/missing.kml' },
      { id: 'trip-2', name: 'Goat Rocks', url: 'https://cdn.test/goat-rocks.kml' },
    ];

    const located = await fetchTripLocations(trips);

    expect(located).toEqual([{ trip: trips[1], lng: -121.386, lat: 46.643 }]);
    expect(console.error).toHaveBeenCalled();
  });

  test('skips a trip whose KML carries no usable coordinate', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => '<kml><Document/></kml>' })),
    );
    const trips = [{ id: 'trip-1', name: 'Empty', url: 'https://cdn.test/empty.kml' }];

    expect(await fetchTripLocations(trips)).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
