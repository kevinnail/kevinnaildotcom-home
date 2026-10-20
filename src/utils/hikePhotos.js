// A photo can be placed on the globe only if it carries coordinates. Everything
// map-related (fly-to, pin) keys off this; a photo without it still belongs to
// its hike and is worth showing, just not locatable.
export function isGeotagged(photo) {
  return photo?.lat != null && photo?.lng != null;
}

// Every photo assigned to the selected hike, geotagged or not. Non-geotagged
// photos are part of the hike and still get a thumbnail and full-size view; they
// simply skip the fly-to and pin. Returns [] when no trip is selected, so the
// strip stays empty while trips are still loading.
export function selectTripPhotos(photos, tripId) {
  if (tripId == null) return [];
  return photos.filter((photo) => photo.tripId === tripId);
}
