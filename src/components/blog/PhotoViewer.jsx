import { useEffect } from 'react';
import './PhotoViewer.css';

// One of a post's photos over the whole screen, scaled to fill it whatever the
// photo's own size, with arrows (and the arrow keys) to step through the rest.
const PhotoViewer = ({ photos, index, title, onChangeIndex, onClose }) => {
  const photo = photos[index];
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasPrevious) onChangeIndex(index - 1);
      if (event.key === 'ArrowRight' && hasNext) onChangeIndex(index + 1);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [index, hasPrevious, hasNext, onChangeIndex, onClose]);

  // A click on the dark area around the photo closes the viewer; clicks on the
  // photo and the arrows stop here so they don't.
  const step = (event, nextIndex) => {
    event.stopPropagation();
    onChangeIndex(nextIndex);
  };

  return (
    <div
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
    >
      <figure className="photo-viewer-figure" onClick={(event) => event.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.caption || `${title} photo`}
          className="photo-viewer-image"
        />
        {photo.caption && <figcaption className="photo-viewer-caption">{photo.caption}</figcaption>}
      </figure>

      <button type="button" className="photo-viewer-close" onClick={onClose} aria-label="Close photo">
        &times;
      </button>
      {hasPrevious && (
        <button
          type="button"
          className="photo-viewer-step photo-viewer-previous"
          onClick={(event) => step(event, index - 1)}
          aria-label="Previous photo"
        >
          &lsaquo;
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          className="photo-viewer-step photo-viewer-next"
          onClick={(event) => step(event, index + 1)}
          aria-label="Next photo"
        >
          &rsaquo;
        </button>
      )}
    </div>
  );
};

export default PhotoViewer;
