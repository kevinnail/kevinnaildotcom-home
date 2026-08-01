// Client-side image resizing for the backpacking gallery. Every uploaded photo
// produces two files, and the camera original is not one of them:
//
//   * a display image (DISPLAY_MAX_EDGE) — the file the site actually serves, and
//   * a thumbnail (THUMBNAIL_MAX_EDGE) — the sidebar strip on the map page.
//
// A raw exposure is 8-15 MB while the photo dock caps the image at 40vh, so every
// one of those megabytes was download and decode time paid on an arrow click for
// pixels nobody ever saw. The astro gallery deliberately does NOT go through this
// — those images are detail-critical and are served at full resolution.
//
// This is the old Photoshop "Save for Web" pipeline: a canvas re-encode drops EXIF,
// ICC, and the embedded preview block, and the 2D context is sRGB, so a wide-gamut
// source is converted on the way through. Dropping EXIF also means a published
// trail photo no longer carries the GPS coordinates of a campsite — the coordinates
// the gallery does want are read off the original by `readPhotoMeta` before this
// runs.
//
// The server never sees image bytes (browsers PUT straight to S3), so this has to
// happen here, same as EXIF.

// Longest edge of the served display image. 2048px fills the fullscreen overlay on
// a 1440p display and holds up on a 4K, well past what the 40vh dock can show.
export const DISPLAY_MAX_EDGE = 2048;
export const DISPLAY_QUALITY = 0.8;

// Longest edge of a generated thumbnail. 400px covers an ~80px sidebar cell at high
// DPR with room to spare, while keeping each file a few tens of KB.
export const THUMBNAIL_MAX_EDGE = 400;
export const THUMBNAIL_QUALITY = 0.8;

// Scale (width, height) down so the longest edge is at most `maxEdge`, preserving
// aspect ratio. Never upscales — an already-small image is returned unchanged, so
// a resize never produces a file larger than its source. Pure; the canvas glue
// below calls it.
export function fitWithinMaxEdge(width, height, maxEdge) {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longestEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

// WebP is roughly 30% smaller than JPEG at matching quality, but canvas encoding of
// it is not universal, and `toBlob` silently hands back a PNG when asked for a type
// it can't encode — which would be far larger than the original and defeat the whole
// exercise. So probe once and fall back to JPEG rather than trusting the request.
let supportsWebp = null;

function encodeFormat() {
  if (supportsWebp === null) {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    supportsWebp = probe.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return supportsWebp
    ? { mimeType: 'image/webp', extension: 'webp' }
    : { mimeType: 'image/jpeg', extension: 'jpg' };
}

// Decode `file`, downscale it to fit `maxEdge`, and return the re-encoded result as
// a File named `<basename>.<extension>` so it flows through the existing
// presign/upload path unchanged (which keys off `.name` and `.type`). Throws if the
// image can't be decoded or encoded — the caller treats that as the photo failing,
// so a saved entry never points at bytes that were never written.
export async function resizeImage(file, { maxEdge, quality, basename }) {
  // `from-image` is explicit rather than left to the browser default: canvas output
  // carries no EXIF, so an orientation flag that isn't baked into the pixels right
  // here is lost for good and the photo ships sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const { width, height } = fitWithinMaxEdge(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    // The default 'low' smoothing is a cheap box filter that aliases badly over the
    // 4-6x downscale a camera original needs — it shows up as shimmer in foliage.
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    const { mimeType, extension } = encodeFormat();
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error(`${basename} encode failed`))),
        mimeType,
        quality,
      );
    });

    // The extension has to match the encode: the server derives the S3 object key's
    // extension from this filename (`fileExtension` in server/lib/utils/s3.js).
    return new File([blob], `${basename}.${extension}`, { type: mimeType });
  } finally {
    bitmap.close();
  }
}

export function createDisplayImage(file) {
  return resizeImage(file, {
    maxEdge: DISPLAY_MAX_EDGE,
    quality: DISPLAY_QUALITY,
    basename: 'display',
  });
}

export function createThumbnail(file) {
  return resizeImage(file, {
    maxEdge: THUMBNAIL_MAX_EDGE,
    quality: THUMBNAIL_QUALITY,
    basename: 'thumb',
  });
}
