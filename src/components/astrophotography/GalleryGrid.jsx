import { useState } from 'react';
import astrophotos from '../../data/astrophotos';
import GalleryItem from './GalleryItem';
import LightboxModal from './LightboxModal';

export default function GalleryGrid() {
  const [lightbox, setLightbox] = useState({ isOpen: false, currentIndex: 0 });

  const openLightbox = (index) => {
    if (window.innerWidth < 768) return;
    setLightbox({ isOpen: true, currentIndex: index });
  };

  const closeLightbox = () =>
    setLightbox((prev) => ({ ...prev, isOpen: false }));

  const prev = () =>
    setLightbox((prev) => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));

  const next = () =>
    setLightbox((prev) => ({
      ...prev,
      currentIndex: Math.min(astrophotos.length - 1, prev.currentIndex + 1),
    }));

  return (
    <>
      <div className="flex flex-wrap gap-4 justify-center p-5">
        {astrophotos.map((photo, index) => (
          <GalleryItem
            key={photo.src}
            photo={photo}
            onClick={() => openLightbox(index)}
          />
        ))}
      </div>

      {lightbox.isOpen && (
        <LightboxModal
          photos={astrophotos}
          currentIndex={lightbox.currentIndex}
          onClose={closeLightbox}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}
