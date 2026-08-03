import { describe, test, expect, vi, afterEach } from 'vitest';
import { parseKmlLocation, fetchTripLocations } from './kmlLocation';

// Trimmed to the shape a Google Earth Pro export actually has: a document-level
// LookAt above the styles, then placemarks whose coordinates are lng,lat,alt
// tuples separated by whitespace.
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
  test('prefers the document LookAt, which is centred on the whole route', () => {
    expect(parseKmlLocation(kmlWithLookAt)).toEqual({ lng: -121.432207, lat: 46.569769 });
  });

  test('falls back to the first coordinate tuple when there is no LookAt', () => {
    expect(parseKmlLocation(kmlWithoutLookAt)).toEqual({ lng: -121.386, lat: 46.643 });
  });

  test('reads namespace-prefixed tags', () => {
    const prefixed = `<kml:kml><kml:Document><kml:LookAt>
      <kml:longitude>-120.5</kml:longitude><kml:latitude>47.25</kml:latitude>
      </kml:LookAt></kml:Document></kml:kml>`;
    expect(parseKmlLocation(prefixed)).toEqual({ lng: -120.5, lat: 47.25 });
  });

  test('ignores a LookAt with unreadable numbers and uses the coordinates instead', () => {
    const brokenLookAt = `<kml><LookAt><longitude></longitude><latitude></latitude></LookAt>
      <coordinates>-121.386,46.643,1372</coordinates></kml>`;
    expect(parseKmlLocation(brokenLookAt)).toEqual({ lng: -121.386, lat: 46.643 });
  });

  test('returns null for out-of-range coordinates', () => {
    const swapped = `<kml><coordinates>46.643,-181.0,0</coordinates></kml>`;
    expect(parseKmlLocation(swapped)).toBeNull();
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

    expect(located).toEqual([{ trip: trips[0], lng: -121.432207, lat: 46.569769 }]);
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
});
