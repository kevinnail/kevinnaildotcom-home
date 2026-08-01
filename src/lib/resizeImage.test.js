import { describe, test, expect } from 'vitest';
import { fitWithinMaxEdge, DISPLAY_MAX_EDGE, THUMBNAIL_MAX_EDGE } from './resizeImage';

describe('fitWithinMaxEdge', () => {
  test('scales a landscape image so its width (longest edge) hits maxEdge', () => {
    const result = fitWithinMaxEdge(4000, 3000, 400);
    expect(result).toEqual({ width: 400, height: 300 });
  });

  test('scales a portrait image so its height (longest edge) hits maxEdge', () => {
    const result = fitWithinMaxEdge(3000, 4000, 400);
    expect(result).toEqual({ width: 300, height: 400 });
  });

  test('leaves an image already within maxEdge untouched (never upscales)', () => {
    const result = fitWithinMaxEdge(320, 240, 400);
    expect(result).toEqual({ width: 320, height: 240 });
  });

  test('rounds fractional dimensions to whole pixels', () => {
    // 4032x3024 (a common phone sensor) → scale 400/4032; height rounds to 300.
    const result = fitWithinMaxEdge(4032, 3024, 400);
    expect(result).toEqual({ width: 400, height: 300 });
  });

  test('a 24MP camera original lands within the display budget', () => {
    // 6000x4000 is a typical full-frame frame; the display encode must bring the
    // long edge down to exactly DISPLAY_MAX_EDGE and keep the 3:2 aspect ratio.
    const result = fitWithinMaxEdge(6000, 4000, DISPLAY_MAX_EDGE);
    expect(result).toEqual({ width: 2048, height: 1365 });
  });

  test('a photo smaller than the display budget is not upscaled to it', () => {
    // A screenshot or an already-web-sized image must pass through at its own size
    // rather than being inflated to 2048px, which would cost bytes and add nothing.
    const result = fitWithinMaxEdge(1200, 800, DISPLAY_MAX_EDGE);
    expect(result).toEqual({ width: 1200, height: 800 });
  });

  test('the thumbnail budget is well under the display budget', () => {
    // The two sizes exist to serve different surfaces; if they ever converge, the
    // sidebar strip is decoding display-sized images and the strip crawls again.
    expect(THUMBNAIL_MAX_EDGE).toBeLessThan(DISPLAY_MAX_EDGE);
  });
});
