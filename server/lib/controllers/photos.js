import { Router } from 'express';
import Photo, { PHOTO_GALLERIES } from '../models/Photo.js';

// Every photo route selects its gallery with `?gallery=`; anything outside the
// allowlist (including an absent param) is a client error, not an empty gallery.
function requireGallery(req) {
  const { gallery } = req.query;

  if (!PHOTO_GALLERIES.includes(gallery)) {
    const error = new Error(`gallery must be one of: ${PHOTO_GALLERIES.join(', ')}`);
    error.status = 400;
    throw error;
  }

  return gallery;
}

export default Router().get('/', async (req, res, next) => {
  try {
    const photos = await Photo.getByGallery(requireGallery(req));
    res.json(photos);
  } catch (error) {
    next(error);
  }
});
