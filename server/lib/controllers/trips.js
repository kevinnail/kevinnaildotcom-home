import { Router } from 'express';
import Trip from '../models/Trip.js';
import authenticate from '../middleware/authenticate.js';
import badRequest from '../utils/badRequest.js';
import { mediaUrl } from '../utils/s3.js';

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
  });
