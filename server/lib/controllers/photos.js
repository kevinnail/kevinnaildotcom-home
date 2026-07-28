import { Router } from 'express';
import Photo, { PHOTO_GALLERIES } from '../models/Photo.js';
import authenticate from '../middleware/authenticate.js';
import requireGallery from '../utils/gallery.js';
import requireResourceId from '../utils/resourceId.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { mediaUrl, deleteObjectsByUrl } from '../utils/s3.js';

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
  })

  // Renumber the curated order. Declared before `/:id` so `order` is never read
  // as a photo id.
  .put('/order', authenticate, async (req, res, next) => {
    try {
      const gallery = requireGallery(req, PHOTO_GALLERIES);
      const orderedIds = req.body?.order;

      if (!Array.isArray(orderedIds)) throw badRequest('order must be an array of photo ids');

      const reordered = await Photo.reorder(gallery, orderedIds);
      if (!reordered) {
        throw badRequest('order must be a permutation of the existing photo ids');
      }

      res.json(await Photo.getByGallery(gallery));
    } catch (error) {
      next(error);
    }
  })

  // A partial edit of one photo's metadata. `gallery` is not required here — the
  // id identifies the row on its own, unlike the manifest this replaces.
  .patch('/:id', authenticate, async (req, res, next) => {
    try {
      const id = requireResourceId(req);
      const { alt, caption, lat, lng, tripId } = req.body ?? {};

      const photo = await Photo.update(id, {
        alt,
        caption,
        lat,
        lng,
        tripId,
        // An absent tripId keeps the prior trip; a supplied one — including an
        // explicit null, which unassigns — replaces it.
        tripIdProvided: tripId !== undefined,
      });
      if (!photo) throw notFound();

      res.json(photo);
    } catch (error) {
      if (error.code === FOREIGN_KEY_VIOLATION) error.status = 400;
      next(error);
    }
  })

  .delete('/:id', authenticate, async (req, res, next) => {
    try {
      const id = requireResourceId(req);

      const photo = await Photo.getById(id);
      if (!photo) throw notFound();

      // The stored objects go first: an orphaned row is recoverable and visible,
      // an orphaned S3 object is neither — it just keeps billing.
      await deleteObjectsByUrl([photo.url, photo.thumbUrl]);
      await Photo.deleteById(id);

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
