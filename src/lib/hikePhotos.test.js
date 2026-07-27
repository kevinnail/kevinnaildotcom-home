import { describe, test, expect } from 'vitest';
import { selectTripPhotos, isGeotagged } from './hikePhotos';

const photos = [
  { id: 'a', tripId: 'trip-1', lat: 40, lng: -74 },
  { id: 'b', tripId: 'trip-1', lat: null, lng: null }, // no coords
  { id: 'c', tripId: 'trip-2', lat: 45, lng: -120 },
  { id: 'd', tripId: null, lat: 10, lng: 10 }, // unassigned
  { id: 'e', tripId: 'trip-1', lat: 41, lng: -75 },
];

describe('selectTripPhotos', () => {
  test('keeps every photo for the trip, in order, geotagged or not', () => {
    const result = selectTripPhotos(photos, 'trip-1');
    expect(result.map((photo) => photo.id)).toEqual(['a', 'b', 'e']);
  });

  test('keeps a non-geotagged photo so it can still be displayed', () => {
    // 'b' belongs to trip-1 but has no coordinates: it can't be pinned, yet it's
    // still part of the hike and must appear in the strip.
    const result = selectTripPhotos(photos, 'trip-1');
    expect(result.some((photo) => photo.id === 'b')).toBe(true);
  });

  test('excludes photos assigned to other trips', () => {
    const result = selectTripPhotos(photos, 'trip-1');
    expect(result.some((photo) => photo.id === 'c')).toBe(false);
  });

  test('returns an empty array when no trip is selected', () => {
    expect(selectTripPhotos(photos, null)).toEqual([]);
  });

  test('returns an empty array for a trip with no matching photos', () => {
    expect(selectTripPhotos(photos, 'trip-3')).toEqual([]);
  });
});

describe('isGeotagged', () => {
  test('is true when both coordinates are present', () => {
    expect(isGeotagged({ lat: 40, lng: -74 })).toBe(true);
  });

  test('is false when either coordinate is missing', () => {
    expect(isGeotagged({ lat: null, lng: null })).toBe(false);
    expect(isGeotagged({ lat: 40, lng: null })).toBe(false);
    expect(isGeotagged({ lat: null, lng: -74 })).toBe(false);
  });

  test('is false for a nullish photo', () => {
    expect(isGeotagged(null)).toBe(false);
    expect(isGeotagged(undefined)).toBe(false);
  });
});
