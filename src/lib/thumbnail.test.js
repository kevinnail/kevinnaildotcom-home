import { describe, test, expect } from 'vitest';
import { fitWithinMaxEdge } from './thumbnail';

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
});
