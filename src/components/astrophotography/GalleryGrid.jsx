import { useState, useEffect } from 'react';
import { fetchAstroPhotos } from '../../lib/mediaApi';
import GalleryItem from './GalleryItem';
import LightboxModal from './LightboxModal';

export default function GalleryGrid({ fetchPhotos = fetchAstroPhotos }) {
  const [photos, setPhotos] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [lightbox, setLightbox] = useState({ isOpen: false, currentIndex: 0 });

  useEffect(() => {
    let active = true;
    fetchPhotos()
      .then((data) => {
        if (!active) return;
        setPhotos(data);
        setLoadState('ready');
      })
      .catch(() => {
        if (active) setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [fetchPhotos]);

  const openLightbox = (index) => {
    if (window.innerWidth < 768) return;
    setLightbox({ isOpen: true, currentIndex: index });
  };

  const closeLightbox = () => setLightbox((prev) => ({ ...prev, isOpen: false }));

  const prev = () =>
    setLightbox((prev) => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));

  const next = () =>
    setLightbox((prev) => ({
      ...prev,
      currentIndex: Math.min(photos.length - 1, prev.currentIndex + 1),
    }));

  if (loadState === 'loading') {
    return <p className="text-mid-gray text-center p-10">Loading gallery…</p>;
  }

  if (loadState === 'error') {
    return <p className="text-red-400 text-center p-10">Could not load the gallery.</p>;
  }

  if (photos.length === 0) {
    return <p className="text-mid-gray text-center p-10">No photos yet.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-4 justify-center p-5">
        {photos.map((photo, index) => (
          <GalleryItem key={photo.id} photo={photo} onClick={() => openLightbox(index)} />
        ))}
      </div>

      {lightbox.isOpen && (
        <LightboxModal
          photos={photos}
          currentIndex={lightbox.currentIndex}
          onClose={closeLightbox}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}
