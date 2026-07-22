import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import LoginForm from '../components/dashboard/LoginForm';
import UploadForm from '../components/dashboard/UploadForm';
import BulkUploadForm from '../components/dashboard/BulkUploadForm';
import PhotoList from '../components/dashboard/PhotoList';
import KmlUploadForm from '../components/dashboard/KmlUploadForm';
import KmlList from '../components/dashboard/KmlList';
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

const TOKEN_KEY = 'mediaAdminToken';

const GALLERY_TABS = [
  { id: 'astro', label: 'Astronomy', fetchPhotos: fetchAstroPhotos },
  { id: 'hikes', label: 'Backpacking', fetchPhotos: fetchHikePhotos },
];

export default function DashboardPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
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

  const signIn = (newToken) => {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  };

  const signOut = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

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

  const handleTripDelete = async (id) => {
    try {
      await deleteKml(token, id);
      setTrips((current) => current.filter((trip) => trip.id !== id));
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
              <button
                onClick={signOut}
                className="text-sm text-neutral-400 hover:text-white underline cursor-pointer"
              >
                Sign out
              </button>
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
                  <BulkUploadForm
                    token={token}
                    trips={trips}
                    onUploaded={(entries) => setPhotos((current) => [...entries, ...current])}
                    onSessionExpired={handleSessionExpired}
                  />
                  <div className="mt-6 flex flex-col gap-3">
                    <KmlUploadForm
                      token={token}
                      onUploaded={(entry) => setTrips((current) => [entry, ...current])}
                      onSessionExpired={handleSessionExpired}
                    />
                    <KmlList trips={trips} onDelete={handleTripDelete} />
                  </div>
                </>
              ) : (
                <UploadForm
                  token={token}
                  onUploaded={(entry) => setPhotos((current) => [entry, ...current])}
                  onSessionExpired={handleSessionExpired}
                />
              )}
              <PhotoList
                photos={photos}
                gallery={gallery}
                trips={trips}
                onEdit={handleEdit}
                onReorder={handleReorder}
                onDelete={handleDelete}
              />
            </>
          ) : (
            <LoginForm onAuthenticated={signIn} />
          )}
        </div>
      </div>
    </>
  );
}
