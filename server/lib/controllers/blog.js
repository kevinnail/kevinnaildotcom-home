import { Router } from 'express';
import BlogPost from '../models/BlogPost.js';
import authenticate from '../middleware/authenticate.js';
import requireResourceId from '../utils/resourceId.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { slugify, validateBlocks } from '../utils/blogBlocks.js';

const trimmedText = (value) => (typeof value === 'string' ? value.trim() : '');

// Trims each field named in `labels`, throwing a 400 for the first one left blank.
const requiredText = (body, labels) =>
  Object.fromEntries(
    Object.entries(labels).map(([fieldName, label]) => {
      const value = trimmedText(body?.[fieldName]);
      if (!value) throw badRequest(`${label} is required`);
      return [fieldName, value];
    }),
  );

export default Router()
  .get('/admin', authenticate, async (req, res, next) => {
    try {
      const posts = await BlogPost.getAllForAdmin();
      res.json(posts);
    } catch (error) {
      next(error);
    }
  })
  .get('/admin/:id', authenticate, async (req, res, next) => {
    try {
      const post = await BlogPost.getById(requireResourceId(req));
      if (!post) throw notFound('Blog post not found');

      res.json(post);
    } catch (error) {
      next(error);
    }
  })
  .get('/', async (req, res, next) => {
    try {
      const posts = await BlogPost.getPublishedList();
      res.json(posts);
    } catch (error) {
      next(error);
    }
  })
  .get('/:slug', async (req, res, next) => {
    try {
      const post = await BlogPost.getPublishedBySlug(req.params.slug);
      if (!post) throw notFound('Blog post not found');

      res.json(post);
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
  })
  .put('/:id', authenticate, async (req, res, next) => {
    try {
      const id = requireResourceId(req);
      const { title, category, summary } = requiredText(req.body, {
        title: 'Title',
        category: 'Category',
        summary: 'Summary',
      });
      const blocks = req.body?.blocks;

      const blocksError = validateBlocks(blocks);
      if (blocksError) throw badRequest(blocksError);

      const post = await BlogPost.update(id, { title, category, summary, blocks });
      if (!post) throw notFound('Blog post not found');

      res.json(post);
    } catch (error) {
      next(error);
    }
  })
  .patch('/:id/publish', authenticate, async (req, res, next) => {
    try {
      const post = await BlogPost.publish(requireResourceId(req));
      if (!post) throw notFound('Blog post not found');

      res.json(post);
    } catch (error) {
      next(error);
    }
  });
