import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import MapSidebar from '../components/hikes/MapSidebar';
import HikeGlobe from '../components/hikes/HikeGlobe';
import HikePhotoDock from '../components/hikes/HikePhotoDock';
import HikeCoachMarks from '../components/hikes/HikeCoachMarks';
import AdminLinkRow from '../components/layout/AdminLinkRow';
import { fetchTrips, fetchHikePhotos } from '../lib/mediaApi';
import { selectTripPhotos, isGeotagged } from '../lib/hikePhotos';
import preloadImages from '../lib/preloadImages';
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
  // Desktop-only overview: every route on screen at once so the visitor can see
  // where the hikes are and click one to open it.
  const [hasRequestedAllRoutes, setHasRequestedAllRoutes] = useState(false);
  const isDesktop = useIsDesktop();
  // Derived rather than stored, so narrowing the window to phone width can't leave
  // the overview running with its only exit — the desktop sidebar button — gone.
  const isShowingAllRoutes = isDesktop && hasRequestedAllRoutes;

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
  // Memoised so it is a stable value the prefetch effect below can depend on —
  // a fresh array every render would re-run the prefetch on every render.
  const tripPhotos = useMemo(
    () => selectTripPhotos(photos, selectedTripId),
    [photos, selectedTripId],
  );
  const selectedIndex = tripPhotos.findIndex((photo) => photo.id === selectedPhotoId);
  const selectedPhoto = selectedIndex >= 0 ? tripPhotos[selectedIndex] : null;

  // Warm the photos on either side of the open one. Prev/next is the common way
  // through a hike, so by the time an arrow is clicked its image is already fetched
  // and decoded and the swap is just a paint. Only the immediate neighbours: a
  // wider window would have a long hike speculatively pulling down photos most
  // visitors never reach.
  useEffect(() => {
    if (selectedIndex < 0) return;
    preloadImages([tripPhotos[selectedIndex - 1]?.url, tripPhotos[selectedIndex + 1]?.url]);
  }, [tripPhotos, selectedIndex]);

  // Switching hikes clears the expanded photo so the new hike starts with no pin.
  // Choosing a hike is also the natural way out of the all-routes overview,
  // whether the pick came from the sidebar or from clicking the route itself.
  function handleSelectTrip(tripId) {
    setSelectedTripId(tripId);
    setSelectedPhotoId(null);
    setIsPhotoViewOpen(false);
    setHasRequestedAllRoutes(false);
  }

  // Entering the overview drops the pin and dock: it's about where the hikes are,
  // not about any one photo.
  function handleToggleAllRoutes() {
    setHasRequestedAllRoutes((hasRequested) => !hasRequested);
    setSelectedPhotoId(null);
    setIsPhotoViewOpen(false);
  }

  // A geotagged thumbnail tap flies the globe; on desktop it also opens the dock
  // immediately, on mobile it defers to the "View photo" pill so the pin is seen
  // first. A non-geotagged photo has no location to preview, so its dock opens
  // straight away on every device.
  function handleSelectPhoto(photoId) {
    const photo = tripPhotos.find((candidate) => candidate.id === photoId);
    setSelectedPhotoId(photoId);
    setIsPhotoViewOpen(isDesktop || !isGeotagged(photo));
  }

  // Desktop matches the prior behaviour (closing clears the pin). Mobile keeps a
  // geotagged pin/selection so the globe stays put and the "View photo" pill
  // reappears; a non-geotagged photo has no pin to preserve, so clear it too.
  function handleCloseDock() {
    setIsPhotoViewOpen(false);
    if (isDesktop || !isGeotagged(selectedPhoto)) setSelectedPhotoId(null);
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

  const photoMessage = status === 'loading' ? 'Loading photos…' : 'No photos for this hike.';

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
        <AdminLinkRow to="/dashboard" label="← Media dashboard" />
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
            isShowingAllRoutes={isShowingAllRoutes}
            onToggleAllRoutes={handleToggleAllRoutes}
          />
          <main className="relative min-h-0 flex-1">
            <HikeGlobe
              selectedTrip={selectedTrip}
              selectedPhoto={selectedPhoto}
              trips={trips}
              isShowingAllRoutes={isShowingAllRoutes}
              onSelectTrip={handleSelectTrip}
            />
            {/* Mobile: a photo is located on the globe but its dock is closed —
                offer to open it without covering the pin until the user chooses.
                Only geotagged photos have a pin to preview, so the pill is theirs. */}
            {selectedPhoto && isGeotagged(selectedPhoto) && !isPhotoViewOpen && (
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
            {/* Mounted only while a geotagged photo is open — the walkthrough
                explains the zoom control and the per-photo fly-to, which exist
                only for located photos. It renders nothing once dismissed. */}
            {isPhotoViewOpen && isGeotagged(selectedPhoto) && <HikeCoachMarks />}
          </main>
        </div>
      </div>
    </>
  );
}
