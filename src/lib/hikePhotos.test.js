import { describe, test, expect } from 'vitest';
import { selectTripPhotos } from './hikePhotos';

const photos = [
  { id: 'a', tripId: 'trip-1', lat: 40, lng: -74 },
  { id: 'b', tripId: 'trip-1', lat: null, lng: null }, // no coords
  { id: 'c', tripId: 'trip-2', lat: 45, lng: -120 },
  { id: 'd', tripId: null, lat: 10, lng: 10 }, // unassigned
  { id: 'e', tripId: 'trip-1', lat: 41, lng: -75 },
];

describe('selectTripPhotos', () => {
  test('keeps only the trip’s geotagged photos, in order', () => {
    const result = selectTripPhotos(photos, 'trip-1');
    expect(result.map((photo) => photo.id)).toEqual(['a', 'e']);
  });

  test('drops photos missing lat or lng', () => {
    // 'b' belongs to trip-1 but has no coordinates, so it can never be pinned.
    const result = selectTripPhotos(photos, 'trip-1');
    expect(result.some((photo) => photo.id === 'b')).toBe(false);
  });

  test('returns an empty array when no trip is selected', () => {
    expect(selectTripPhotos(photos, null)).toEqual([]);
  });

  test('returns an empty array for a trip with no matching photos', () => {
    expect(selectTripPhotos(photos, 'trip-3')).toEqual([]);
  });
});
