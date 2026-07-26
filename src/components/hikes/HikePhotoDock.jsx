import { useEffect, useState } from 'react';

// Bottom dock over the globe showing the one expanded, selected photo. Absolutely
// positioned inside the `relative` <main>; `pointer-events` are enabled only on
// the panel itself so the globe stays draggable in the gaps around it. Renders
// nothing when no photo is selected. Prev/next step the selection, which also
// moves the globe pin, so the viewer can "look around" without leaving the image.
// A fullscreen toggle blows the image up to a viewport-filling overlay for detail.
export default function HikePhotoDock({ photo, onClose, onPrev, onNext, hasPrev, hasNext }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen persists as you step between photos, but if the dock closes
  // entirely the next open should start docked. Reset by comparing open/closed
  // across renders rather than in an effect — adjusting state during render
  // avoids the cascading re-render a setState-in-effect triggers.
  const isOpen = photo != null;
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setIsFullscreen(false);
  }

  // Arrow keys mirror the on-screen buttons; Escape steps back out (fullscreen →
  // docked → closed). Bound only while a photo is open so the globe keeps normal
  // keyboard behaviour otherwise.
  useEffect(() => {
    if (!photo) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'ArrowLeft' && hasPrev) onPrev();
      else if (event.key === 'ArrowRight' && hasNext) onNext();
      else if (event.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, hasPrev, hasNext, onPrev, onNext, onClose, isFullscreen]);

  if (!photo) return null;

  const prevButton = (
    <button
      type="button"
      onClick={onPrev}
      disabled={!hasPrev}
      aria-label="Previous photo"
      className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 font-body text-xl leading-none text-white transition-colors hover:bg-neon-blue-50 hover:text-neon-blue-bright disabled:pointer-events-none disabled:opacity-30"
    >
      ‹
    </button>
  );

  const nextButton = (
    <button
      type="button"
      onClick={onNext}
      disabled={!hasNext}
      aria-label="Next photo"
      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/70 px-3 py-2 font-body text-xl leading-none text-white transition-colors hover:bg-neon-blue-50 hover:text-neon-blue-bright disabled:pointer-events-none disabled:opacity-30"
    >
      ›
    </button>
  );

  const caption = photo.caption && (
    <figcaption className="shrink-0 px-4 py-2 font-body text-sm text-white">
      {photo.caption}
    </figcaption>
  );

  if (isFullscreen) {
    return (
      <figure className="fixed inset-0 z-50 flex flex-col bg-black/95">
        <button
          type="button"
          onClick={() => setIsFullscreen(false)}
          aria-label="Exit fullscreen"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/70 px-4 py-2 font-body text-sm leading-none text-white transition-colors hover:bg-neon-blue-50 hover:text-neon-blue-bright"
        >
          Minimize
        </button>
        {prevButton}
        {nextButton}
        <img
          src={photo.url}
          alt={photo.alt ?? ''}
          decoding="async"
          className="min-h-0 w-full flex-1 object-contain"
        />
        {caption}
      </figure>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
      <figure className="pointer-events-auto relative flex max-h-[40vh] max-w-3xl flex-col overflow-hidden rounded-lg border border-neon-blue-50 bg-black/85 shadow-lg backdrop-blur">
        <div className="absolute right-2 top-2 z-10 flex gap-2">
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            aria-label="View fullscreen"
            className="rounded-full bg-black/70 px-3 py-1 font-body text-lg leading-none text-white hover:bg-neon-blue-50 hover:text-neon-blue-bright"
          >
            ⤢
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo"
            className="rounded-full bg-black/70 px-3 py-1 font-body text-lg leading-none text-white hover:bg-neon-blue-50 hover:text-neon-blue-bright"
          >
            ×
          </button>
        </div>
        {prevButton}
        {nextButton}
        <img
          src={photo.url}
          alt={photo.alt ?? ''}
          decoding="async"
          className="min-h-0 w-full flex-1 object-contain"
        />
        {caption}
      </figure>
    </div>
  );
}
