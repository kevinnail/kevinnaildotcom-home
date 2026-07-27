import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Banner from '../components/layout/Banner';
import LoginForm from '../components/dashboard/LoginForm';
import UploadForm from '../components/dashboard/UploadForm';
import BulkUploadForm from '../components/dashboard/BulkUploadForm';
import PhotoList from '../components/dashboard/PhotoList';
import KmlUploadForm from '../components/dashboard/KmlUploadForm';
import HikeTripList from '../components/dashboard/HikeTripList';
import {
  fetchAstroPhotos,
  fetchHikePhotos,
  fetchTrips,
  updatePhoto,
  reorderPhotos,
  deletePhoto,
  deleteKml,
  SessionExpiredError,
} from '../lib/mediaApi';
import { useAdminToken, signIn, signOut } from '../lib/adminSession';

const GALLERY_TABS = [
  { id: 'astro', label: 'Astronomy', fetchPhotos: fetchAstroPhotos },
  { id: 'hikes', label: 'Backpacking', fetchPhotos: fetchHikePhotos },
];

export default function DashboardPage() {
  const token = useAdminToken();
  const [gallery, setGallery] = useState('astro');
  const [photos, setPhotos] = useState([]);
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    const loadPhotos = GALLERY_TABS.find((tab) => tab.id === gallery).fetchPhotos;
    (async () => {
      // Clear any previous gallery's photos before the new set arrives.
      setPhotos([]);
      try {
        const loadedPhotos = await loadPhotos();
        if (active) setPhotos(loadedPhotos);
      } catch {
        if (active) setError('Could not load photos.');
      }
    })();
    return () => {
      active = false;
    };
  }, [token, gallery]);

  // KML trips live under the Backpacking tab alongside the hike photos.
  useEffect(() => {
    if (!token || gallery !== 'hikes') return undefined;
    let active = true;
    (async () => {
      try {
        const loadedTrips = await fetchTrips();
        if (active) setTrips(loadedTrips);
      } catch {
        if (active) setError('Could not load trips.');
      }
    })();
    return () => {
      active = false;
    };
  }, [token, gallery]);

  const handleSessionExpired = () => {
    setError('Session expired — please log in again.');
    signOut();
  };

  const handleEdit = async (id, fields) => {
    try {
      const updated = await updatePhoto(token, id, fields, gallery);
      setPhotos((current) => current.map((photo) => (photo.id === id ? updated : photo)));
    } catch (editError) {
      if (editError instanceof SessionExpiredError) handleSessionExpired();
      else setError('Edit failed.');
    }
  };

  const handleReorder = async (orderedIds) => {
    const previous = photos;
    const entryById = new Map(previous.map((photo) => [photo.id, photo]));
    // Optimistically show the new order, then reconcile with the server's copy.
    setPhotos(orderedIds.map((id) => entryById.get(id)));
    try {
      const saved = await reorderPhotos(token, orderedIds, gallery);
      setPhotos(saved);
    } catch (reorderError) {
      setPhotos(previous);
      if (reorderError instanceof SessionExpiredError) handleSessionExpired();
      else setError('Reorder failed.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePhoto(token, id, gallery);
      setPhotos((current) => current.filter((photo) => photo.id !== id));
    } catch (deleteError) {
      if (deleteError instanceof SessionExpiredError) handleSessionExpired();
      else setError('Delete failed.');
    }
  };

  // Hike photos with no trip assigned get their own dashboard section; assigned
  // ones are managed inside each trip's modal (HikeTripList).
  const unassignedPhotos = photos.filter((photo) => !photo.tripId);

  const handleTripDelete = async (id) => {
    try {
      await deleteKml(token, id);
      setTrips((current) => current.filter((trip) => trip.id !== id));
      // The server cascade-deleted this trip's photos; drop them from state so the
      // trip's modal and the counts update without a reload.
      setPhotos((current) => current.filter((photo) => photo.tripId !== id));
    } catch (deleteError) {
      if (deleteError instanceof SessionExpiredError) handleSessionExpired();
      else setError('Delete failed.');
    }
  };

  return (
    <>
      <Helmet>
        <title>Dashboard | Kevin Nail</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="bg-black min-h-screen">
        <Banner />
        <div className="max-w-3xl mx-auto p-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-neon-blue-bright font-display text-3xl">Media Dashboard</h1>
            {token && (
              <div className="flex items-center gap-4">
                {/* The galleries are where the uploads actually land, so jumping
                    between them and here is the common admin loop. */}
                <Link
                  to="/astrophotography"
                  className="text-sm text-neon-blue-bright hover:text-white underline"
                >
                  Astro gallery
                </Link>
                <Link
                  to="/backpacking"
                  className="text-sm text-neon-blue-bright hover:text-white underline"
                >
                  Hike map
                </Link>
                <button
                  onClick={signOut}
                  className="text-sm text-neutral-400 hover:text-white underline cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {token ? (
            <>
              <div className="flex gap-2 mb-4" role="tablist" aria-label="Gallery">
                {GALLERY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={gallery === tab.id}
                    onClick={() => setGallery(tab.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold cursor-pointer ${
                      gallery === tab.id
                        ? 'bg-neon-blue text-white'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white border border-mid-gray'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {gallery === 'hikes' ? (
                <>
                  <KmlUploadForm
                    token={token}
                    onUploaded={(entry) => setTrips((current) => [entry, ...current])}
                    onSessionExpired={handleSessionExpired}
                  />
                  <div className="mt-6 flex flex-col gap-3">
                    <BulkUploadForm
                      token={token}
                      trips={trips}
                      onUploaded={(entries) => setPhotos((current) => [...entries, ...current])}
                      onSessionExpired={handleSessionExpired}
                    />
                  </div>
                  <HikeTripList
                    trips={trips}
                    photos={photos}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDeleteTrip={handleTripDelete}
                  />
                  <section className="mt-8">
                    <h2 className="font-display text-xl text-neon-blue-bright">
                      Unassigned photos
                    </h2>
                    <PhotoList
                      photos={unassignedPhotos}
                      gallery="hikes"
                      trips={trips}
                      onEdit={handleEdit}
                      onReorder={handleReorder}
                      onDelete={handleDelete}
                    />
                  </section>
                </>
              ) : (
                <>
                  <UploadForm
                    token={token}
                    onUploaded={(entry) => setPhotos((current) => [entry, ...current])}
                    onSessionExpired={handleSessionExpired}
                  />
                  <PhotoList
                    photos={photos}
                    gallery={gallery}
                    trips={trips}
                    onEdit={handleEdit}
                    onReorder={handleReorder}
                    onDelete={handleDelete}
                  />
                </>
              )}
            </>
          ) : (
            <LoginForm onAuthenticated={signIn} />
          )}
        </div>
      </div>
    </>
  );
}
