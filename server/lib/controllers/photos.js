import { Router } from 'express';
import Photo, { PHOTO_GALLERIES } from '../models/Photo.js';
import authenticate from '../middleware/authenticate.js';
import requireGallery from '../utils/gallery.js';
import { mediaUrl } from '../utils/s3.js';

export default Router()
  .get('/', async (req, res, next) => {
    try {
      const photos = await Photo.getByGallery(requireGallery(req, PHOTO_GALLERIES));
      res.json(photos);
    } catch (error) {
      next(error);
    }
  })
  // The bytes are already in S3 by the time this runs — the client presigned a
  // PUT, uploaded directly, and sends back only the key it was given.
  .post('/', authenticate, async (req, res, next) => {
    try {
      const gallery = requireGallery(req, PHOTO_GALLERIES);
      const { objectKey, thumbObjectKey, alt, caption, lat, lng, takenAt, tripId } = req.body ?? {};

      if (typeof objectKey !== 'string' || objectKey.length === 0) {
        const error = new Error('objectKey is required');
        error.status = 400;
        throw error;
      }

      const photo = await Photo.insert({
        gallery,
        url: mediaUrl(objectKey),
        thumbUrl: thumbObjectKey ? mediaUrl(thumbObjectKey) : null,
        alt,
        caption,
        lat,
        lng,
        takenAt,
        tripId,
      });

      res.status(201).json(photo);
    } catch (error) {
      next(error);
    }
  });
