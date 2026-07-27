import pool from '../utils/pool.js';

// The gallery a photo belongs to. Kept in sync with the CHECK constraint on
// photos.gallery in sql/setup.sql.
export const PHOTO_GALLERIES = ['astro', 'hikes'];

// Astro keeps a hand-curated order; hikes read chronologically by EXIF capture
// time, falling back to upload time. This reproduces the client-side
// sortByCaptureTime the manifests needed.
const ORDER_BY = {
  astro: 'sort_order ASC NULLS LAST, uploaded_at DESC',
  hikes: 'COALESCE(taken_at, uploaded_at) ASC',
};

export default class Photo {
  // `gallery` and `sort_order` are server-side concerns — the manifests never
  // carried them, so they are not serialized to the client.
  constructor(row) {
    this.id = row.id;
    this.url = row.url;
    this.thumbUrl = row.thumb_url ?? null;
    this.alt = row.alt ?? '';
    this.caption = row.caption ?? '';
    this.lat = row.lat ?? null;
    this.lng = row.lng ?? null;
    this.takenAt = row.taken_at ? row.taken_at.toISOString() : null;
    this.tripId = row.trip_id ?? null;
    this.uploadedAt = row.uploaded_at.toISOString();
  }

  // A new astro photo lands at the front of the hand-curated order, reproducing
  // the manifest's newest-first prepend; hike photos leave sort_order null and
  // fall back to their capture time.
  static async insert({ gallery, url, thumbUrl, alt, caption, lat, lng, takenAt, tripId }) {
    const { rows } = await pool.query(
      `INSERT INTO photos (gallery, url, thumb_url, alt, caption, lat, lng, taken_at, trip_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
         CASE WHEN $1 = 'astro'
           THEN (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM photos WHERE gallery = 'astro')
           ELSE NULL
         END)
       RETURNING *`,
      [
        gallery,
        url,
        thumbUrl ?? null,
        alt ?? '',
        caption ?? '',
        lat ?? null,
        lng ?? null,
        takenAt ?? null,
        tripId ?? null,
      ],
    );

    return new Photo(rows[0]);
  }

  static async getByGallery(gallery) {
    const { rows } = await pool.query(
      `SELECT * FROM photos WHERE gallery = $1 ORDER BY ${ORDER_BY[gallery]}`,
      [gallery],
    );

    return rows.map((row) => new Photo(row));
  }
}
