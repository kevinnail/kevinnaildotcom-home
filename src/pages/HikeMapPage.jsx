import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import MapSidebar from '../components/hikes/MapSidebar';
import HikeGlobe from '../components/hikes/HikeGlobe';
import HikePhotoDock from '../components/hikes/HikePhotoDock';
import HikeCoachMarks from '../components/hikes/HikeCoachMarks';
import AdminLinkRow from '../components/layout/AdminLinkRow';
import { fetchTrips, fetchHikePhotos } from '../api/mediaApi';
import { selectTripPhotos, isGeotagged } from '../utils/hikePhotos';
import preloadImages from '../utils/preloadImages';
import useIsDesktop from '../hooks/useIsDesktop';

export default function HikeMapPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);

  const [isPhotoViewOpen, setIsPhotoViewOpen] = useState(false);

  // Back and forward change the hike without a click, so the open photo is
  // cleared here instead of in the click handlers.
  const [photoSelectionTripId, setPhotoSelectionTripId] = useState(tripId);
  if (tripId !== photoSelectionTripId) {
    setPhotoSelectionTripId(tripId);
    setSelectedPhotoId(null);
    setIsPhotoViewOpen(false);
  }

  // Reported by HikeGlobe: true once terrain, the viewer, and the overview pins are
  // all in. The trips request and the globe race each other and either can win, so
  // the page is only really loaded when both are done — see `statusMessage` below.
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [loadedTrips, loadedPhotos] = await Promise.all([fetchTrips(), fetchHikePhotos()]);
        if (!active) return;
        setTrips(loadedTrips);
        setPhotos(loadedPhotos);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedTrip = trips.find((trip) => trip.id === tripId) ?? null;
  const selectedTripId = selectedTrip?.id ?? null;
  const isShowingAllRoutes = selectedTripId == null;
  const isTripNotFound = status === 'ready' && tripId != null && selectedTrip == null;
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

  function handleSelectTrip(newTripId) {
    setSelectedPhotoId(null);
    setIsPhotoViewOpen(false);
    if (newTripId !== selectedTripId) navigate(`/backpacking/${newTripId}`);
  }

  function handleShowAllRoutes() {
    navigate('/backpacking');
  }

  function handleSelectPhoto(photoId) {
    const photo = tripPhotos.find((candidate) => candidate.id === photoId);
    setSelectedPhotoId(photoId);
    setIsPhotoViewOpen(isDesktop || !isGeotagged(photo));
  }

  function handleCloseDock() {
    setIsPhotoViewOpen(false);
    if (isDesktop || !isGeotagged(selectedPhoto)) setSelectedPhotoId(null);
  }

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

  const statusMessage = trips.length === 0 ? sidebarMessage : isGlobeReady ? null : 'Loading map…';

  const photoMessage = status === 'loading' ? 'Loading photos…' : 'No photos for this hike.';

  return (
    <>
      <Helmet>
        <title>Kevin Nail | Backpacking Map</title>
        <meta
          name="description"
          content="Explore Kevin Nail's backpacking trips on a 3D map — trails, campsites, and photos."
        />
        <link
          rel="canonical"
          href={`https://kevinnail.com/backpacking${selectedTripId ? `/${selectedTripId}` : ''}`}
        />
      </Helmet>

      <div className="flex h-dvh w-screen flex-col overflow-hidden bg-black">
        <Banner />
        <AdminLinkRow to="/dashboard" label="← Media dashboard" />
        <div className="flex flex-1 flex-col-reverse overflow-hidden md:flex-row">
          <MapSidebar
            trips={trips}
            selectedTripId={selectedTripId}
            onSelectTrip={handleSelectTrip}
            emptyMessage={sidebarMessage}
            statusMessage={statusMessage}
            tripPhotos={tripPhotos}
            selectedPhotoId={selectedPhotoId}
            onSelectPhoto={handleSelectPhoto}
            photoMessage={photoMessage}
            isShowingAllRoutes={isShowingAllRoutes}
            onShowAllRoutes={handleShowAllRoutes}
            isTripNotFound={isTripNotFound}
          />
          <main className="relative min-h-0 flex-1">
            <HikeGlobe
              selectedTrip={selectedTrip}
              selectedPhoto={selectedPhoto}
              trips={trips}
              isShowingAllRoutes={isShowingAllRoutes}
              isPhotoViewOpen={isPhotoViewOpen}
              onSelectTrip={handleSelectTrip}
              onReadyChange={setIsGlobeReady}
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
