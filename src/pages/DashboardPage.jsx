import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import LoginForm from '../components/dashboard/LoginForm';
import UploadForm from '../components/dashboard/UploadForm';
import PhotoList from '../components/dashboard/PhotoList';
import {
  fetchAstroPhotos,
  updatePhoto,
  reorderPhotos,
  deletePhoto,
  SessionExpiredError,
} from '../lib/mediaApi';

const TOKEN_KEY = 'mediaAdminToken';

export default function DashboardPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    (async () => {
      try {
        const loadedPhotos = await fetchAstroPhotos();
        if (active) setPhotos(loadedPhotos);
      } catch {
        if (active) setError('Could not load photos.');
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

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
      const updated = await updatePhoto(token, id, fields);
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
      const saved = await reorderPhotos(token, orderedIds);
      setPhotos(saved);
    } catch (reorderError) {
      setPhotos(previous);
      if (reorderError instanceof SessionExpiredError) handleSessionExpired();
      else setError('Reorder failed.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePhoto(token, id);
      setPhotos((current) => current.filter((photo) => photo.id !== id));
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
            <h1 className="text-neon-blue font-display text-3xl">Media Dashboard</h1>
            {token && (
              <button
                onClick={signOut}
                className="text-sm text-mid-gray hover:text-white underline"
              >
                Sign out
              </button>
            )}
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {token ? (
            <>
              <UploadForm
                token={token}
                onUploaded={(entry) => setPhotos((current) => [entry, ...current])}
                onSessionExpired={handleSessionExpired}
              />
              <PhotoList
                photos={photos}
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
