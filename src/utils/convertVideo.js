// Client-side video conversion for blog uploads. Like the photos in
// resizeImage.js, the file visitors get is never the original: an iPhone HEVC
// .mov or a laptop screen recording is re-encoded to MP4 with H.264 video and
// AAC audio, which every current browser plays, before it goes straight to S3.
//
// A still frame is captured alongside it as the <video> poster, because iPhone
// Safari otherwise shows an empty box until the video is played.

import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
} from 'mediabunny';
import { DISPLAY_QUALITY, encodeCanvas, fitWithinMaxEdge } from './resizeImage';

// Longest edge of the served video: 1080p.
export const VIDEO_MAX_EDGE = 1920;

// The source frame rate is kept up to this, so 60 fps clips and screen
// recordings stay smooth; a slow-motion clip is brought down to it.
const MAX_FRAME_RATE = 60;

const AUDIO_BITRATE = 128_000;

// Scale down to fit VIDEO_MAX_EDGE, never up. H.264 needs even dimensions, so each
// side rounds down to an even number. Pure; convertVideo below calls it.
export function videoTargetSize(width, height) {
  const fitted = fitWithinMaxEdge(width, height, VIDEO_MAX_EDGE);
  return { width: fitted.width - (fitted.width % 2), height: fitted.height - (fitted.height % 2) };
}

// About 6 Mbps for 1080p at 30 fps, scaled by pixel count, and half again above 30 fps.
const videoBitrate = (width, height, frameRate) =>
  Math.round(6_000_000 * ((width * height) / (1920 * 1080)) * (frameRate > 30 ? 1.5 : 1));

// Convert `file` and capture its still frame. `onProgress` gets 0 to 1. Throws
// if this browser can't read the video or encode the result, so a saved post
// never points at a video with no picture or no sound.
export async function convertVideo(file, onProgress) {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error(`${file.name} has no video`);

    const { width, height } = videoTargetSize(
      await videoTrack.getDisplayWidth(),
      await videoTrack.getDisplayHeight(),
    );
    const { bestGuessFrameRate } = await videoTrack.computeFrameRateMetrics();
    const frameRate = Math.min(bestGuessFrameRate, MAX_FRAME_RATE);

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      // Only the main picture and sound; iPhone files carry extra metadata tracks.
      tracks: 'primary',
      video: {
        codec: 'avc',
        width,
        height,
        // The size already keeps the aspect ratio, so this only absorbs the even-number rounding.
        fit: 'fill',
        frameRate: bestGuessFrameRate > MAX_FRAME_RATE ? MAX_FRAME_RATE : undefined,
        quality: new Quality({ bitrate: videoBitrate(width, height, frameRate) }),
      },
      audio: { codec: 'aac', quality: new Quality({ bitrate: AUDIO_BITRATE }) },
    });
    if (conversion.discardedTracks.length > 0) {
      const reasons = conversion.discardedTracks
        .map((discarded) => `${discarded.track.type}: ${discarded.reason}`)
        .join(', ');
      throw new Error(`${file.name} can't be converted in this browser (${reasons})`);
    }

    const stillFrame = await new CanvasSink(videoTrack, { width, height, fit: 'fill' }).getCanvas(
      await videoTrack.getFirstTimestamp(),
    );
    if (!stillFrame) throw new Error(`${file.name} has no frame to use as a still`);
    const poster = await encodeCanvas(stillFrame.canvas, {
      quality: DISPLAY_QUALITY,
      basename: 'poster',
    });

    conversion.onProgress = onProgress;
    await conversion.execute();

    return {
      video: new File([output.target.buffer], 'video.mp4', { type: 'video/mp4' }),
      poster,
    };
  } finally {
    input.dispose();
  }
}
