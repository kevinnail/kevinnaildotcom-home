import exifr from 'exifr';

// Read GPS coordinates + capture time from an image file, entirely client-side
// (the Lambda never sees image bytes). Returns nulls for anything missing or on
// any parse error — a photo with no/broken EXIF must never block its upload.
// GPS and timestamp are read independently so a failure in one still yields the
// other. `takenAt` is the chronological sort key for the backpacking gallery.
export async function readPhotoMeta(file) {
  const meta = { lat: null, lng: null, takenAt: null };

  try {
    const gps = await exifr.gps(file);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      meta.lat = gps.latitude;
      meta.lng = gps.longitude;
    }
  } catch {
    // No or unreadable GPS block — leave coordinates null.
  }

  try {
    const parsed = await exifr.parse(file, ['DateTimeOriginal']);
    const takenDate = parsed?.DateTimeOriginal;
    if (takenDate instanceof Date && !Number.isNaN(takenDate.getTime())) {
      meta.takenAt = takenDate.toISOString();
    }
  } catch {
    // No or unreadable capture time — leave takenAt null.
  }

  return meta;
}
