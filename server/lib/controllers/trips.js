import { Router } from 'express';
import Trip from '../models/Trip.js';

export default Router().get('/', async (req, res, next) => {
  try {
    const trips = await Trip.getAll();
    res.json(trips);
  } catch (error) {
    next(error);
  }
});
