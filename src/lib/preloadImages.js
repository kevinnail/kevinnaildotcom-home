// Pull images into the browser's HTTP cache before anything asks to display them.
//
// Stepping through the photo dock swaps an <img> `src`, and on its own that swap
// starts a cold fetch: the arrow click registers and nothing paints until the round
// trip and decode finish. Warming the neighbours of the open photo means the bytes
// are already cached by the time they're needed. Gallery objects are content-
// immutable with a far-future Cache-Control (see UPLOAD_CACHE_CONTROL in
// server/lib/utils/s3.js), so a warmed entry is still valid when the real <img>
// asks for it.
//
// A failed prefetch is deliberately not surfaced. It is a speculative fetch for an
// image that may never be viewed; if the visitor does navigate to it, the real
// <img> issues its own request and reports the failure in the one place it matters.
// Nothing downstream branches on the outcome, so there is no error to propagate.
export default function preloadImages(urls) {
  for (const url of urls) {
    if (!url) continue;
    const image = new Image();
    image.src = url;
    // decode() also gets the image decoded off the main thread, so the swap is a
    // paint rather than a decode. It rejects if the fetch failed — see above.
    image.decode?.().catch(() => {});
  }
}
