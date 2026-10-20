import { describe, test, expect } from 'vitest';
import {
  parseKmlRouteLines,
  greatCircleMiles,
  routeLengthMiles,
  resampleRoute,
  summarizeElevations,
  thinProfile,
  buildRouteStats,
  CLIMB_THRESHOLD_FEET,
  PROFILE_POINT_COUNT,
} from '../utils/routeStats';

// One degree of latitude on the mean-radius sphere.
const MILES_PER_DEGREE_LATITUDE = 69.0934;

const kml = (body) =>
  `<?xml version="1.0"?><kml xmlns:gx="http://www.google.com/kml/ext/2.2"><Document>${body}</Document></kml>`;

// A straight north-running line of the given length, starting at the given
// longitude.
function northLine(name, lengthMiles, lng = -121) {
  return {
    name,
    points: [
      { lng, lat: 44 },
      { lng, lat: 44 + lengthMiles / MILES_PER_DEGREE_LATITUDE },
    ],
  };
}

describe('parseKmlRouteLines', () => {
  test('reads a LineString with its name, ignoring the altitude in each tuple', () => {
    const lines = parseKmlRouteLines(
      kml(`<Placemark><name>PCT &gt; Arrowhead Lk</name><LineString><coordinates>
        -121.78,44.16,0 -121.77,44.17,0
        -121.76,44.18,0
      </coordinates></LineString></Placemark>`),
    );
    expect(lines).toEqual([
      {
        name: 'PCT > Arrowhead Lk',
        points: [
          { lng: -121.78, lat: 44.16 },
          { lng: -121.77, lat: 44.17 },
          { lng: -121.76, lat: 44.18 },
        ],
      },
    ]);
  });

  test('gives a line with no name an empty one', () => {
    const [line] = parseKmlRouteLines(
      kml(
        '<Placemark><LineString><coordinates>-121.7,44.1 -121.6,44.1</coordinates></LineString></Placemark>',
      ),
    );
    expect(line.name).toBe('');
  });

  test('leaves out a gx:Track, which the globe never draws', () => {
    const lines = parseKmlRouteLines(
      kml(`<Placemark><gx:Track>
        <when>2024-08-01T10:00:00Z</when><when>2024-08-01T10:05:00Z</when>
        <gx:coord>-121.78 44.16 1600</gx:coord><gx:coord>-121.77 44.17 1650</gx:coord>
      </gx:Track></Placemark>`),
    );
    expect(lines).toEqual([]);
  });

  test('keeps separate lines separate, in file order', () => {
    const lines = parseKmlRouteLines(
      kml(`<Placemark><name>camp</name><LineString><coordinates>-121.7,44.1 -121.6,44.1</coordinates></LineString></Placemark>
           <Placemark><name>PCT</name><LineString><coordinates>-121.5,44.2 -121.4,44.2</coordinates></LineString></Placemark>`),
    );
    expect(lines.map((line) => line.name)).toEqual(['camp', 'PCT']);
    expect(lines[1].points[0]).toEqual({ lng: -121.5, lat: 44.2 });
  });

  test('ignores campsite points and polygon outlines', () => {
    const lines = parseKmlRouteLines(
      kml(`<Placemark><Point><coordinates>-121.78,44.16,0</coordinates></Point></Placemark>
           <Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>
             -121.7,44.1 -121.6,44.1 -121.6,44.2 -121.7,44.1
           </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`),
    );
    expect(lines).toEqual([]);
  });

  test('drops a line with fewer than two usable points', () => {
    const lines = parseKmlRouteLines(
      kml(
        '<Placemark><LineString><coordinates>-121.78,44.16 ,</coordinates></LineString></Placemark>',
      ),
    );
    expect(lines).toEqual([]);
  });

  test('leaves out a line switched off in the file', () => {
    const lines = parseKmlRouteLines(
      kml(`<Placemark><name>Road to trailhead</name><visibility>0</visibility>
             <LineString><coordinates>-121.0,44.0 -121.5,44.5</coordinates></LineString></Placemark>
           <Placemark><name>Hike</name><visibility>1</visibility>
             <LineString><coordinates>-121.7,44.1 -121.6,44.1</coordinates></LineString></Placemark>`),
    );
    expect(lines.map((line) => line.name)).toEqual(['Hike']);
  });

  test('leaves out every line inside a folder switched off in the file', () => {
    const lines = parseKmlRouteLines(
      kml(`<Folder><name>GPS logs</name><visibility>0</visibility>
             <Placemark><LineString><coordinates>-121.0,44.0 -121.1,44.1</coordinates></LineString></Placemark>
             <Folder><Placemark><LineString><coordinates>-121.2,44.2 -121.3,44.3</coordinates></LineString></Placemark></Folder>
           </Folder>
           <Folder><Placemark><LineString><coordinates>-121.7,44.1 -121.6,44.1</coordinates></LineString></Placemark></Folder>`),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].points[0]).toEqual({ lng: -121.7, lat: 44.1 });
  });

  test('ignores route-like text inside a description', () => {
    const lines = parseKmlRouteLines(
      kml(`<Placemark><description><![CDATA[<LineString><coordinates>-121.0,44.0 -121.5,44.5</coordinates></LineString>]]></description>
             <Point><coordinates>-121.78,44.16</coordinates></Point></Placemark>`),
    );
    expect(lines).toEqual([]);
  });

  test('returns no lines for something that is not text', () => {
    expect(parseKmlRouteLines(null)).toEqual([]);
  });
});

describe('distance', () => {
  test('measures one degree of latitude', () => {
    const miles = greatCircleMiles({ lng: -121, lat: 44 }, { lng: -121, lat: 45 });
    expect(miles).toBeCloseTo(MILES_PER_DEGREE_LATITUDE, 2);
  });

  test('adds up lines without counting the gap between them', () => {
    const lines = [northLine('first', 1, -121), northLine('second', 1, -120)];
    expect(routeLengthMiles(lines)).toBeCloseTo(2, 3);
  });
});

describe('resampleRoute', () => {
  test('lays points at the requested spacing, keeping both ends', () => {
    // 1,000 ft of trail sampled every 100 ft.
    const [line] = resampleRoute([northLine('trail', 1000 / 5280)], { spacingFeet: 100 });
    expect(line.name).toBe('trail');
    expect(line.samples[0].distanceMiles).toBe(0);
    expect(line.samples[1].distanceMiles).toBeCloseTo(100 / 5280);
    expect(line.samples.at(-1).distanceMiles).toBeCloseTo(1000 / 5280, 4);
    // 0, 100, ... 900, plus the end.
    expect(line.samples).toHaveLength(11);
  });

  test('widens the spacing rather than exceed the point budget', () => {
    const [line] = resampleRoute([northLine('trail', 1)], { spacingFeet: 1, maximumPoints: 50 });
    expect(line.samples.length).toBeLessThanOrEqual(50);
  });

  test('starts every line at distance zero, rather than carrying on from the last', () => {
    const lines = resampleRoute([northLine('first', 1, -121), northLine('second', 0.4, -120)], {
      spacingFeet: 500,
    });
    expect(lines.map((line) => line.samples[0].distanceMiles)).toEqual([0, 0]);
    expect(lines[1].samples.at(-1).distanceMiles).toBeCloseTo(0.4, 3);
  });
});

describe('summarizeElevations', () => {
  test('reports lowest, highest, climb and descent', () => {
    expect(summarizeElevations([[5000, 5300, 5150, 5600]])).toEqual({
      minFeet: 5000,
      maxFeet: 5600,
      gainFeet: 750,
      lossFeet: 150,
    });
  });

  test('never counts the jump from one line to the next as climb or descent', () => {
    // The second line starts 1,300 ft above where the first ends; nobody walked it.
    const summary = summarizeElevations([
      [5000, 5300],
      [6600, 6900],
    ]);
    expect(summary).toEqual({ minFeet: 5000, maxFeet: 6900, gainFeet: 600, lossFeet: 0 });
  });

  test('ignores wobble smaller than the climb threshold', () => {
    const wobble = CLIMB_THRESHOLD_FEET - 1;
    const elevations = [5000, 5000 + wobble, 5000, 5000 + wobble, 5000];
    expect(summarizeElevations([elevations])).toMatchObject({ gainFeet: 0, lossFeet: 0 });
  });

  test('throws when there are no elevations', () => {
    expect(() => summarizeElevations([[]])).toThrow('No elevations to summarize');
  });
});

describe('thinProfile', () => {
  const samples = Array.from({ length: 1000 }, (_unused, index) => ({
    distanceMiles: index * 0.00654,
  }));
  const elevations = samples.map((_unused, index) => 5000 + index * 0.85);

  test('keeps the requested count including first and last, miles to the thousandth and whole feet', () => {
    const profile = thinProfile(samples, elevations, 5);
    expect(profile).toHaveLength(5);
    expect(profile[0]).toEqual([0, 5000]);
    expect(profile.at(-1)).toEqual([6.533, Math.round(5000 + 999 * 0.85)]);
  });

  test('keeps both ends of a line however small its share', () => {
    expect(thinProfile(samples, elevations, 0)).toHaveLength(2);
  });

  test('keeps every point when there are fewer than requested', () => {
    expect(thinProfile(samples.slice(0, 3), elevations.slice(0, 3), 200)).toHaveLength(3);
  });
});

describe('buildRouteStats', () => {
  test('returns the stored shape in miles and feet, one profile per line', () => {
    const resampled = resampleRoute([northLine('PCT', 3, -121), northLine('camp', 1, -120)], {
      spacingFeet: 2640,
    });
    const elevationsByLine = resampled.map((line, lineIndex) =>
      line.samples.map((_unused, index) => 5000 + lineIndex * 1000 + index * 30),
    );
    const stats = buildRouteStats(resampled, elevationsByLine);

    expect(stats).toMatchObject({
      distanceMiles: 4,
      elevationMinFeet: 5000,
      elevationMaxFeet: 6060,
      // 180 ft up the first line, 60 ft up the second; the 820 ft jump between
      // them is not climbing.
      elevationGainFeet: 240,
      elevationLossFeet: 0,
    });
    expect(stats.elevationProfiles.map((profile) => profile.name)).toEqual(['PCT', 'camp']);
    expect(stats.elevationProfiles[1].points[0]).toEqual([0, 6000]);
    expect(stats.elevationProfiles[1].points.at(-1)).toEqual([1, 6060]);
  });

  test('shares the profile points between lines by length', () => {
    const resampled = resampleRoute([northLine('long', 9, -121), northLine('short', 1, -120)], {
      spacingFeet: 50,
    });
    const elevationsByLine = resampled.map((line) => line.samples.map(() => 5000));
    const [long, short] = buildRouteStats(resampled, elevationsByLine).elevationProfiles;
    expect(long.points).toHaveLength(PROFILE_POINT_COUNT * 0.9);
    expect(short.points).toHaveLength(PROFILE_POINT_COUNT * 0.1);
  });

  test('throws when a line is missing elevations', () => {
    const resampled = resampleRoute([northLine('PCT', 3)], { spacingFeet: 2640 });
    expect(() => buildRouteStats(resampled, [[5000]])).toThrow(
      `Got 1 elevations for ${resampled[0].samples.length} points on line 1`,
    );
  });
});
