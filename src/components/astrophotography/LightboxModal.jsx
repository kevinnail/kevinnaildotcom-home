import { useEffect, useCallback } from 'react';

export default function LightboxModal({
  photos,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    },
    [onClose, onPrev, onNext]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const photo = photos[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-9 text-[#f1f1f1] text-[40px] font-bold cursor-pointer bg-transparent border-none transition-colors duration-300 hover:text-[#bbb] z-10"
        aria-label="Close lightbox"
      >
        &times;
      </button>

      <div
        className="flex items-center justify-center w-full relative"
        onClick={(e) => e.stopPropagation()}
      >
        {currentIndex > 0 && (
          <button
            onClick={onPrev}
            className="text-lg font-bold px-2 py-1.5 text-[rgb(193,193,193)] cursor-pointer rounded-lg select-none bg-neon-blue-50 mx-2.5 border-none"
            aria-label="Previous image"
          >
            &laquo; Prev
          </button>
        )}

        <img
          src={photo.src}
          alt={photo.alt}
          className="max-w-[70%] max-h-[80vh] border border-[#888] block"
          style={{ animation: 'zoom 0.6s' }}
        />

        {currentIndex < photos.length - 1 && (
          <button
            onClick={onNext}
            className="text-lg font-bold px-2 py-1.5 text-[rgb(193,193,193)] cursor-pointer rounded-lg select-none bg-neon-blue-50 mx-2.5 border-none"
            aria-label="Next image"
          >
            Next &raquo;
          </button>
        )}
      </div>

      <div className="text-[#ccc] text-center mt-2.5 py-2.5 max-w-[700px]">
        {photo.caption}
      </div>
    </div>
  );
}
