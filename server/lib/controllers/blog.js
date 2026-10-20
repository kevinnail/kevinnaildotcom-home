import { Router } from 'express';
import BlogPost from '../models/BlogPost.js';
import authenticate from '../middleware/authenticate.js';
import { badRequest } from '../utils/httpError.js';
import { slugify } from '../utils/blogBlocks.js';

const trimmedText = (value) => (typeof value === 'string' ? value.trim() : '');

export default Router()
  .get('/admin', authenticate, async (req, res, next) => {
    try {
      const posts = await BlogPost.getAllForAdmin();
      res.json(posts);
    } catch (error) {
      next(error);
    }
  })
  .post('/', authenticate, async (req, res, next) => {
    try {
      const title = trimmedText(req.body?.title);
      const category = trimmedText(req.body?.category);

      if (!slugify(title)) throw badRequest('Title must contain letters or numbers');
      if (!category) throw badRequest('Category is required');

      const post = await BlogPost.insert({ title, category });

      res.status(201).json(post);
    } catch (error) {
      next(error);
    }
  });
