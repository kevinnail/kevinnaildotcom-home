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

// Shared by the single insert and the batch insert so both write identical rows
// — the only difference between them is the transaction they run in.
const INSERT_SQL = `
  INSERT INTO photos (gallery, url, thumb_url, alt, caption, lat, lng, taken_at, trip_id, sort_order)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
    CASE WHEN $1 = 'astro'
      THEN (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM photos WHERE gallery = 'astro')
      ELSE NULL
    END)
  RETURNING *`;

function insertParams({ gallery, url, thumbUrl, alt, caption, lat, lng, takenAt, tripId }) {
  return [
    gallery,
    url,
    thumbUrl ?? null,
    alt ?? '',
    caption ?? '',
    lat ?? null,
    lng ?? null,
    takenAt ?? null,
    tripId ?? null,
  ];
}

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
  static async insert(fields) {
    const { rows } = await pool.query(INSERT_SQL, insertParams(fields));

    return new Photo(rows[0]);
  }

  // Bulk upload is all-or-nothing: one rejected row (an unknown trip_id, say)
  // rolls the whole batch back, so the client never ends up with a half-saved
  // set of photos whose S3 objects it has already uploaded.
  static async insertMany(entries) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const photos = [];
      // Sequential, not concurrent: astro's sort_order reads MIN(sort_order) of
      // the rows already inserted, so each row has to see the one before it.
      for (const entry of entries) {
        const { rows } = await client.query(INSERT_SQL, insertParams(entry));
        photos.push(new Photo(rows[0]));
      }

      await client.query('COMMIT');
      return photos;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getByGallery(gallery) {
    const { rows } = await pool.query(
      `SELECT * FROM photos WHERE gallery = $1 ORDER BY ${ORDER_BY[gallery]}`,
      [gallery],
    );

    return rows.map((row) => new Photo(row));
  }

  // Every photo assigned to a trip, so a trip delete can purge their S3 objects
  // and report their ids before the foreign-key cascade takes the rows.
  static async getByTrip(tripId) {
    const { rows } = await pool.query('SELECT * FROM photos WHERE trip_id = $1', [tripId]);

    return rows.map((row) => new Photo(row));
  }

  static async getById(id) {
    const { rows } = await pool.query('SELECT * FROM photos WHERE id = $1', [id]);

    return rows[0] ? new Photo(rows[0]) : null;
  }

  // A partial patch: an absent field keeps its prior value. `tripId` is the one
  // exception — a photo has to be able to be UN-assigned from a trip, so an
  // explicit null clears it while COALESCE could only ever preserve. The caller
  // decides which case it is by passing `tripIdProvided`.
  static async update(id, { alt, caption, lat, lng, tripId, tripIdProvided }) {
    const { rows } = await pool.query(
      `UPDATE photos SET
         alt     = COALESCE($2, alt),
         caption = COALESCE($3, caption),
         lat     = COALESCE($4, lat),
         lng     = COALESCE($5, lng),
         trip_id = CASE WHEN $6::boolean THEN $7::uuid ELSE trip_id END
       WHERE id = $1
       RETURNING *`,
      [id, alt ?? null, caption ?? null, lat ?? null, lng ?? null, tripIdProvided, tripId ?? null],
    );

    return rows[0] ? new Photo(rows[0]) : null;
  }

  static async deleteById(id) {
    const { rows } = await pool.query('DELETE FROM photos WHERE id = $1 RETURNING *', [id]);

    return rows[0] ? new Photo(rows[0]) : null;
  }

  // Renumber a gallery's curated order to 0..n-1 in one transaction.
  // `orderedIds` must be an exact permutation of the gallery's ids: anything
  // else (a duplicate, an unknown id, a short list) would silently drop or
  // double a photo, so it returns false and writes nothing. The rows are locked
  // for the comparison so a concurrent insert can't invalidate it mid-check.
  static async reorder(gallery, orderedIds) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query('SELECT id FROM photos WHERE gallery = $1 FOR UPDATE', [
        gallery,
      ]);
      const existingIds = new Set(rows.map((row) => row.id));

      const isPermutation =
        orderedIds.length === existingIds.size &&
        new Set(orderedIds).size === orderedIds.length &&
        orderedIds.every((id) => existingIds.has(id));

      if (!isPermutation) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `UPDATE photos SET sort_order = ordering.position - 1
         FROM unnest($1::uuid[]) WITH ORDINALITY AS ordering(id, position)
         WHERE photos.id = ordering.id`,
        [orderedIds],
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
