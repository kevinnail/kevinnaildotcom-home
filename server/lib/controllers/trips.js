import { Router } from 'express';
import Trip from '../models/Trip.js';
import Photo from '../models/Photo.js';
import authenticate from '../middleware/authenticate.js';
import requireResourceId from '../utils/resourceId.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { mediaUrl, deleteObjectsByUrl } from '../utils/s3.js';

export default Router()
  .get('/', async (req, res, next) => {
    try {
      const trips = await Trip.getAll();
      res.json(trips);
    } catch (error) {
      next(error);
    }
  })
  // The KML bytes went straight to S3 via presign (?gallery=kml); this only
  // records the resulting object as a trip the map can list.
  .post('/', authenticate, async (req, res, next) => {
    try {
      const { objectKey, name, region } = req.body ?? {};

      if (typeof objectKey !== 'string' || objectKey.length === 0) {
        throw badRequest('objectKey is required');
      }
      // A trip with no name is unpickable in the map sidebar, so it is required
      // here even though the column has a default.
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw badRequest('name is required');
      }

      const trip = await Trip.insert({
        name: name.trim(),
        region: typeof region === 'string' ? region.trim() : '',
        url: mediaUrl(objectKey),
      });

      res.status(201).json(trip);
    } catch (error) {
      next(error);
    }
  })
  // Deleting a trip cascades to its photos. The rows go by the foreign key, but
  // their S3 objects have to be read off them first — hence the lookup before
  // the delete rather than a single statement.
  .delete('/:id', authenticate, async (req, res, next) => {
    try {
      const id = requireResourceId(req);

      const trip = await Trip.getById(id);
      if (!trip) throw notFound();

      const photos = await Photo.getByTrip(id);

      // The KML object plus every assigned photo's original and thumbnail, in
      // one pass. The trip itself has no thumbnail.
      await deleteObjectsByUrl([
        trip.url,
        ...photos.flatMap((photo) => [photo.url, photo.thumbUrl]),
      ]);

      await Trip.deleteById(id);

      // The dashboard drops these from its photo state without a reload.
      res.json({ ok: true, deletedPhotoIds: photos.map((photo) => photo.id) });
    } catch (error) {
      next(error);
    }
  });
