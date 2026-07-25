import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import MapSidebar from '../components/hikes/MapSidebar';
import HikeGlobe from '../components/hikes/HikeGlobe';
import HikePhotoDock from '../components/hikes/HikePhotoDock';
import { fetchTrips, fetchHikePhotos } from '../lib/mediaApi';
import { selectTripPhotos } from '../lib/hikePhotos';

export default function HikeMapPage() {
  const [trips, setTrips] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);

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
        <Banner />
        <div className="flex flex-1 overflow-hidden">
          <MapSidebar
            trips={trips}
            selectedTripId={selectedTripId}
            onSelectTrip={handleSelectTrip}
            emptyMessage={sidebarMessage}
            tripPhotos={tripPhotos}
            selectedPhotoId={selectedPhotoId}
            onSelectPhoto={setSelectedPhotoId}
            photoMessage={photoMessage}
          />
          <main className="relative flex-1">
            <HikeGlobe selectedTrip={selectedTrip} selectedPhoto={selectedPhoto} />
            <HikePhotoDock
              photo={selectedPhoto}
              onClose={() => setSelectedPhotoId(null)}
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
