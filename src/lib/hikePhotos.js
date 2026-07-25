// Photos shown for a selected hike on the map: assigned to that trip AND
// geotagged (a pin needs coordinates). Returns [] when no trip is selected, so
// the strip and pin stay empty while trips are still loading.
export function selectTripPhotos(photos, tripId) {
  if (tripId == null) return [];
  return photos.filter(
    (photo) => photo.tripId === tripId && photo.lat != null && photo.lng != null,
  );
}
