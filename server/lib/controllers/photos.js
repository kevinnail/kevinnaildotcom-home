import { Router } from 'express';
import Photo, { PHOTO_GALLERIES } from '../models/Photo.js';
import authenticate from '../middleware/authenticate.js';
import requireGallery from '../utils/gallery.js';
import badRequest from '../utils/badRequest.js';
import { mediaUrl } from '../utils/s3.js';

// Most photos one bulk-upload request may add at once, carried over from the
// Lambda. A cap keeps a runaway client from holding a transaction open over
// thousands of inserts.
export const MAX_BATCH = 500;

// Postgres foreign-key violation — here it can only mean the client sent a
// tripId that isn't a trip, which is a bad request, not a server fault.
const FOREIGN_KEY_VIOLATION = '23503';

// The bytes are already in S3 by the time these run — the client presigned a
// PUT, uploaded directly, and sends back only the key it was given.
function photoRow(gallery, item, label) {
  const { objectKey, thumbObjectKey, alt, caption, lat, lng, takenAt, tripId } = item ?? {};

  if (typeof objectKey !== 'string' || objectKey.length === 0) {
    throw badRequest(`${label} is required`);
  }

  return {
    gallery,
    url: mediaUrl(objectKey),
    thumbUrl: thumbObjectKey ? mediaUrl(thumbObjectKey) : null,
    alt,
    caption,
    lat,
    lng,
    takenAt,
    tripId,
  };
}

export default Router()
  .get('/', async (req, res, next) => {
    try {
      const photos = await Photo.getByGallery(requireGallery(req, PHOTO_GALLERIES));
      res.json(photos);
    } catch (error) {
      next(error);
    }
  })
  .post('/', authenticate, async (req, res, next) => {
    try {
      const gallery = requireGallery(req, PHOTO_GALLERIES);

      const photo = await Photo.insert(photoRow(gallery, req.body, 'objectKey'));

      res.status(201).json(photo);
    } catch (error) {
      if (error.code === FOREIGN_KEY_VIOLATION) error.status = 400;
      next(error);
    }
  })
  // Bulk hike upload: every file's bytes and thumbnail are already in S3, and
  // this records the whole set in one transaction.
  .post('/batch', authenticate, async (req, res, next) => {
    try {
      const gallery = requireGallery(req, PHOTO_GALLERIES);
      const items = req.body?.photos;

      if (!Array.isArray(items) || items.length === 0) {
        throw badRequest('photos must be a non-empty array');
      }
      if (items.length > MAX_BATCH) {
        throw badRequest(`photos exceeds the ${MAX_BATCH} per-batch limit`);
      }

      // Validated up front so a malformed item costs nothing — the transaction
      // only opens once every item is known to be well formed.
      const rows = items.map((item, index) =>
        photoRow(gallery, item, `photos[${index}].objectKey`),
      );

      res.status(201).json(await Photo.insertMany(rows));
    } catch (error) {
      if (error.code === FOREIGN_KEY_VIOLATION) error.status = 400;
      next(error);
    }
  });
