// Client-side thumbnail generation for the backpacking sidebar strip. The sidebar
// renders each hike photo at ~80px; decoding the multi-megapixel originals there
// is what makes the strip crawl. We downscale to a small JPEG at upload time so
// the strip only ever decodes tiny images. The Lambda never sees image bytes, so
// this has to happen in the browser (same place EXIF is read).

// Longest edge of a generated thumbnail, in pixels. 400px covers an ~80px sidebar
// cell at high DPR with room to spare, while keeping each file a few tens of KB.
export const THUMBNAIL_MAX_EDGE = 400;

// JPEG quality for the thumbnail encode. 0.8 is visually clean at thumbnail size.
export const THUMBNAIL_QUALITY = 0.8;

// Scale (width, height) down so the longest edge is at most `maxEdge`, preserving
// aspect ratio. Never upscales — an already-small image is returned unchanged, so
// a thumbnail is never larger than its source. Pure; the canvas glue below calls it.
export function fitWithinMaxEdge(width, height, maxEdge) {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longestEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

// Decode `file`, downscale to a thumbnail, and return it as a JPEG File named
// `thumb.jpg` so it flows through the existing presign/upload path unchanged
// (which keys off `.name`/`.type`). `createImageBitmap` does the decode + resize
// off the main thread. Throws if the image can't be decoded or encoded — the
// caller treats that as the photo failing, so every saved entry has a real thumb.
export async function createThumbnail(
  file,
  { maxEdge = THUMBNAIL_MAX_EDGE, quality = THUMBNAIL_QUALITY } = {},
) {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithinMaxEdge(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Thumbnail encode failed'))),
        'image/jpeg',
        quality,
      );
    });
    return new File([blob], 'thumb.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
