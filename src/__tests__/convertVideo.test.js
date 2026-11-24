import { describe, it, expect } from 'vitest';
import { videoTargetSize } from '../utils/convertVideo';

describe('videoTargetSize', () => {
  // Otherwise a 4K iPhone clip uploads at four times the pixels anyone's screen shows.
  it('scales a 4K landscape video down to 1920 wide', () => {
    expect(videoTargetSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
  });

  // Otherwise a portrait clip is sized by its width and stays far taller than 1080p.
  it('scales a 4K portrait video down to 1920 tall', () => {
    expect(videoTargetSize(2160, 3840)).toEqual({ width: 1080, height: 1920 });
  });

  // Otherwise a small video is upscaled into a bigger, blurrier file.
  it('leaves a 720p video at its own size', () => {
    expect(videoTargetSize(1280, 720)).toEqual({ width: 1280, height: 720 });
  });

  // Otherwise the H.264 encoder rejects an odd width or height and the upload fails.
  it('rounds each side down to an even number', () => {
    expect(videoTargetSize(1281, 721)).toEqual({ width: 1280, height: 720 });
    expect(videoTargetSize(2560, 1439)).toEqual({ width: 1920, height: 1078 });
  });
});
