import { describe, test, expect } from 'vitest';
import {
  joinRouteLines,
  pointAlongPath,
  bearingRadians,
  turnToward,
} from '../utils/routeFlyAlong';

const firstLine = {
  samples: [
    { lng: 0, lat: 0, distanceMiles: 0 },
    { lng: 0, lat: 1, distanceMiles: 2 },
  ],
};
const secondLine = {
  samples: [
    { lng: 5, lat: 5, distanceMiles: 0 },
    { lng: 5, lat: 6, distanceMiles: 3 },
  ],
};

describe('joinRouteLines', () => {
  // Otherwise the second line replays from distance 0 and the camera never reaches it.
  test('keeps counting distance from where the line before it ended', () => {
    const path = joinRouteLines([firstLine, secondLine]);
    expect(path.map((sample) => sample.distanceMiles)).toEqual([0, 2, 2, 5]);
    expect(path[2]).toMatchObject({ lng: 5, lat: 5 });
  });
});

describe('pointAlongPath', () => {
  const path = joinRouteLines([firstLine, secondLine]).map((sample, index) => ({
    ...sample,
    heightMeters: index * 100,
  }));

  // Otherwise the camera stutters from sample to sample instead of gliding between them.
  test('blends position and height between the samples either side', () => {
    expect(pointAlongPath(path, 1)).toEqual({ lng: 0, lat: 0.5, heightMeters: 50, distanceMiles: 1 });
  });

  // Otherwise the camera drifts across the gap between two lines it never walked.
  test('is on the next line as soon as the previous one ends', () => {
    expect(pointAlongPath(path, 2.5)).toMatchObject({ lng: 5, lat: 5 + 0.5 / 3 });
  });

  // Otherwise the last frame of the fly-along has no spot to look at and throws.
  test('stays on the last sample past the end of the path', () => {
    expect(pointAlongPath(path, 9)).toBe(path.at(-1));
  });
});

describe('bearingRadians', () => {
  // Otherwise the camera faces the wrong way down the trail.
  test('measures clockwise from north', () => {
    expect(bearingRadians({ lng: 0, lat: 0 }, { lng: 0, lat: 1 })).toBeCloseTo(0);
    expect(bearingRadians({ lng: 0, lat: 0 }, { lng: 1, lat: 0 })).toBeCloseTo(Math.PI / 2);
    expect(bearingRadians({ lng: 0, lat: 0 }, { lng: -1, lat: 0 })).toBeCloseTo(-Math.PI / 2);
  });
});

describe('turnToward', () => {
  // Otherwise a trail wandering either side of due south spins the camera a full turn.
  test('turns the short way across south', () => {
    const justEastOfSouth = Math.PI - 0.1;
    const justWestOfSouth = -Math.PI + 0.1;
    expect(turnToward(justEastOfSouth, justWestOfSouth, 1)).toBeCloseTo(Math.PI + 0.1);
  });

  // Otherwise the smoothing does nothing and every zigzag in the line jerks the camera.
  test('turns only the given fraction of the way', () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
  });
});
