import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import MapSidebar from '../components/hikes/MapSidebar';
import HikeGlobe from '../components/hikes/HikeGlobe';
import HikePhotoDock from '../components/hikes/HikePhotoDock';
import { fetchTrips, fetchHikePhotos } from '../lib/mediaApi';
import { selectTripPhotos } from '../lib/hikePhotos';
import useIsDesktop from '../lib/useIsDesktop';

export default function HikeMapPage() {
  const [trips, setTrips] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  // Selecting a photo always flies the globe + drops the pin. Whether the photo
  // dock opens is a separate step: immediate on desktop (it doesn't obscure the
  // globe there), but manual on mobile, where the dock would cover the globe —
  // so the user taps a "View photo" pill to open it after seeing the location.
  const [isPhotoViewOpen, setIsPhotoViewOpen] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [loadedTrips, loadedPhotos] = await Promise.all([fetchTrips(), fetchHikePhotos()]);
        if (!active) return;
        setTrips(loadedTrips);
        setPhotos(loadedPhotos);
        setSelectedTripId(loadedTrips[0]?.id ?? null);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? null;
  const tripPhotos = selectTripPhotos(photos, selectedTripId);
  const selectedIndex = tripPhotos.findIndex((photo) => photo.id === selectedPhotoId);
  const selectedPhoto = selectedIndex >= 0 ? tripPhotos[selectedIndex] : null;

  // Switching hikes clears the expanded photo so the new hike starts with no pin.
  function handleSelectTrip(tripId) {
    setSelectedTripId(tripId);
    setSelectedPhotoId(null);
    setIsPhotoViewOpen(false);
  }

  // A thumbnail tap flies the globe on every device; on desktop it also opens the
  // dock immediately, on mobile it defers to the "View photo" pill.
  function handleSelectPhoto(photoId) {
    setSelectedPhotoId(photoId);
    setIsPhotoViewOpen(isDesktop);
  }

  // Desktop matches the prior behaviour (closing clears the pin). Mobile keeps the
  // pin/selection so the globe stays put and the "View photo" pill reappears.
  function handleCloseDock() {
    setIsPhotoViewOpen(false);
    if (isDesktop) setSelectedPhotoId(null);
  }

  // Stepping the selected photo drives both the dock image and the globe pin,
  // so prev/next is equivalent to clicking the neighbouring sidebar thumbnail.
  function stepPhoto(offset) {
    if (selectedIndex < 0) return;
    const nextPhoto = tripPhotos[selectedIndex + offset];
    if (nextPhoto) setSelectedPhotoId(nextPhoto.id);
  }

  const sidebarMessage =
    status === 'loading'
      ? 'Loading trips…'
      : status === 'error'
        ? 'Could not load trips.'
        : 'No trips yet.';

  const photoMessage =
    status === 'loading' ? 'Loading photos…' : 'No geotagged photos for this hike.';

  return (
    <>
      <Helmet>
        <title>Kevin Nail | Backpacking Map</title>
        <meta
          name="description"
          content="Explore Kevin Nail's backpacking trips on a 3D map — trails, campsites, and photos."
        />
        <link rel="canonical" href="https://kevinnail.com/backpacking" />
      </Helmet>

      <div className="flex h-dvh w-screen flex-col overflow-hidden bg-black">
        <Banner compact />
        <div className="flex flex-1 flex-col-reverse overflow-hidden md:flex-row">
          <MapSidebar
            trips={trips}
            selectedTripId={selectedTripId}
            onSelectTrip={handleSelectTrip}
            emptyMessage={sidebarMessage}
            tripPhotos={tripPhotos}
            selectedPhotoId={selectedPhotoId}
            onSelectPhoto={handleSelectPhoto}
            photoMessage={photoMessage}
          />
          <main className="relative min-h-0 flex-1">
            <HikeGlobe selectedTrip={selectedTrip} selectedPhoto={selectedPhoto} />
            {/* Mobile: a photo is located on the globe but its dock is closed —
                offer to open it without covering the pin until the user chooses. */}
            {selectedPhoto && !isPhotoViewOpen && (
              <button
                type="button"
                onClick={() => setIsPhotoViewOpen(true)}
                className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-neon-blue-50 bg-black/85 px-5 py-2.5 font-body text-white shadow-lg backdrop-blur transition-colors hover:bg-neon-blue-50 hover:text-neon-blue-bright md:hidden"
              >
                <span aria-hidden="true">⤢</span> View photo
              </button>
            )}
            <HikePhotoDock
              photo={isPhotoViewOpen ? selectedPhoto : null}
              onClose={handleCloseDock}
              onPrev={() => stepPhoto(-1)}
              onNext={() => stepPhoto(1)}
              hasPrev={selectedIndex > 0}
              hasNext={selectedIndex >= 0 && selectedIndex < tripPhotos.length - 1}
            />
          </main>
        </div>
      </div>
    </>
  );
}
