import { Router } from 'express';
import BlogPost from '../models/BlogPost.js';
import authenticate from '../middleware/authenticate.js';
import requireResourceId from '../utils/resourceId.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { slugify, validateBlocks } from '../utils/blogBlocks.js';
import { mediaUrl, deleteObjectsByUrl } from '../utils/s3.js';

// Postgres foreign-key violation: an image insert naming a post that doesn't exist.
const FOREIGN_KEY_VIOLATION = '23503';

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

      // Read first so an unknown post is a 404, not a failed photo ownership check.
      if (!(await BlogPost.getById(id))) throw notFound('Blog post not found');

      const blocksError = validateBlocks(blocks, await BlogPost.getImageIds(id));
      if (blocksError) throw badRequest(blocksError);

      const saved = await BlogPost.update(id, { title, category, summary, blocks });
      if (!saved) throw notFound('Blog post not found');

      await deleteObjectsByUrl(saved.removedUrls);
      res.json(saved.post);
    } catch (error) {
      next(error);
    }
  })
  // The bytes are already in S3: the client presigned each PUT, uploaded
  // directly, and sends back only the keys it was given.
  .post('/:id/images', authenticate, async (req, res, next) => {
    try {
      const id = requireResourceId(req);
      const objectKeys = req.body?.objectKeys;

      if (
        !Array.isArray(objectKeys) ||
        objectKeys.length === 0 ||
        !objectKeys.every((objectKey) => typeof objectKey === 'string' && objectKey)
      ) {
        throw badRequest('objectKeys must be a non-empty list of object keys');
      }

      const images = await BlogPost.insertImages(id, objectKeys.map(mediaUrl));

      res.status(201).json(images);
    } catch (error) {
      next(error.code === FOREIGN_KEY_VIOLATION ? notFound('Blog post not found') : error);
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
  })
  // Like the photos, the cover's bytes are already in S3 under the blog prefix.
  .put('/:id/cover', authenticate, async (req, res, next) => {
    try {
      const id = requireResourceId(req);
      const objectKey = req.body?.objectKey;

      if (typeof objectKey !== 'string' || !objectKey) throw badRequest('objectKey is required');

      const coverUrl = mediaUrl(objectKey);
      const replaced = await BlogPost.setCover(id, coverUrl);
      if (!replaced) throw notFound('Blog post not found');

      await deleteObjectsByUrl([replaced.previousUrl]);
      res.json({ coverUrl });
    } catch (error) {
      next(error);
    }
  })
  .delete('/:id/cover', authenticate, async (req, res, next) => {
    try {
      const replaced = await BlogPost.setCover(requireResourceId(req), null);
      if (!replaced) throw notFound('Blog post not found');

      await deleteObjectsByUrl([replaced.previousUrl]);
      res.json({ coverUrl: null });
    } catch (error) {
      next(error);
    }
  })
  .delete('/:id', authenticate, async (req, res, next) => {
    try {
      const deleted = await BlogPost.deleteById(requireResourceId(req));
      if (!deleted) throw notFound('Blog post not found');

      // A null cover drops out inside deleteObjectsByUrl.
      await deleteObjectsByUrl(deleted.removedUrls);
      res.json(deleted.post);
    } catch (error) {
      next(error);
    }
  });
