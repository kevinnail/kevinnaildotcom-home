// Presigned direct-to-S3 uploads, ported from the Lambda's handlePresign. Image
// bytes never pass through this server: the browser PUTs straight to the bucket
// with the URL signed here, and only the resulting object key comes back to be
// stored.

import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

// DeleteObjects accepts up to 1000 keys per request, so purging a trip with
// hundreds of photos costs one or a handful of calls instead of one per object.
const DELETE_BATCH = 1000;

// Object keys are content-immutable uuids, so the bytes at a key never change —
// a one-year immutable Cache-Control is baked in at upload time so repeat views
// come off disk. It is signed into the URL, so the client MUST echo this exact
// value on the PUT; omitting or altering it fails the signature.
export const UPLOAD_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// One S3 prefix per upload target. `kml` is not a photo gallery — it shares the
// presign route only, and `requiredExtension` makes it reject anything but a
// .kml filename.
const UPLOAD_GALLERIES = {
  astro: { prefix: 'astro' },
  hikes: { prefix: 'hikes' },
  kml: { prefix: 'kml', requiredExtension: 'kml' },
};

export const UPLOAD_GALLERY_NAMES = Object.keys(UPLOAD_GALLERIES);

const client = new S3Client({});

function fileExtension(filename) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename ?? '');
  return match ? match[1].toLowerCase() : 'jpg';
}

// The public CloudFront URL for a stored object. Rows keep the full URL, exactly
// as the manifest entries they replace did.
export function mediaUrl(objectKey) {
  return `${process.env.MEDIA_BASE_URL}/${objectKey}`;
}

// The inverse of mediaUrl: rows store the public URL, not the key, so a delete
// derives the key back out of it. A URL from somewhere else (or a null thumbUrl)
// yields null and is skipped rather than guessed at.
export function objectKeyFromUrl(url) {
  const base = `${process.env.MEDIA_BASE_URL}/`;

  return typeof url === 'string' && url.startsWith(base) ? url.slice(base.length) : null;
}

// Purge the stored objects behind a set of public URLs. Callers pass URLs
// straight off the rows they are deleting — including nulls, which drop out.
export async function deleteObjectsByUrl(urls) {
  const objectKeys = urls.map(objectKeyFromUrl).filter(Boolean);

  for (let start = 0; start < objectKeys.length; start += DELETE_BATCH) {
    const chunk = objectKeys.slice(start, start + DELETE_BATCH);

    await client.send(
      new DeleteObjectsCommand({
        Bucket: process.env.MEDIA_BUCKET,
        Delete: { Objects: chunk.map((objectKey) => ({ Key: objectKey })), Quiet: true },
      }),
    );
  }
}

export async function createUploadUrl({ gallery, filename, contentType }) {
  const target = UPLOAD_GALLERIES[gallery];
  const extension = fileExtension(filename);

  if (target.requiredExtension && extension !== target.requiredExtension) {
    const error = new Error(`Filename must end in .${target.requiredExtension}`);
    error.status = 400;
    throw error;
  }

  const objectKey = `${target.prefix}/${randomUUID()}.${extension}`;

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: process.env.MEDIA_BUCKET,
      Key: objectKey,
      ContentType: contentType,
      CacheControl: UPLOAD_CACHE_CONTROL,
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(['content-type', 'cache-control']),
    },
  );

  return {
    uploadUrl,
    objectKey,
    publicUrl: mediaUrl(objectKey),
    cacheControl: UPLOAD_CACHE_CONTROL,
  };
}
