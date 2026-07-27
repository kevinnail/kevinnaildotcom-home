import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import requireGallery from '../utils/gallery.js';
import { createUploadUrl, UPLOAD_GALLERY_NAMES } from '../utils/s3.js';

export default Router().post('/', authenticate, async (req, res, next) => {
  try {
    const gallery = requireGallery(req, UPLOAD_GALLERY_NAMES);
    const { filename, contentType } = req.body ?? {};

    res.json(await createUploadUrl({ gallery, filename, contentType }));
  } catch (error) {
    next(error);
  }
});
