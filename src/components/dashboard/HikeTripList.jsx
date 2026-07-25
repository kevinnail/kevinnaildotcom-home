import { useState, useEffect, useCallback } from 'react';
import PhotoList from './PhotoList';

// Group hike photos by their `tripId`. Unassigned photos (no tripId) are left out
// — they live in their own section on the dashboard.
function groupPhotosByTrip(photos) {
  const byTripId = new Map();
  for (const photo of photos) {
    if (!photo.tripId) continue;
    const existing = byTripId.get(photo.tripId) ?? [];
    existing.push(photo);
    byTripId.set(photo.tripId, existing);
  }
  return byTripId;
}

// Trip cards for the Backpacking dashboard: each shows its name, region, and how
// many photos are assigned to it, and opens a modal listing those photo cards
// (reusing PhotoList) so assigned photos are managed in-place, grouped with their
// trail — no separate route. Deleting a trip removes its S3 object + manifest
// entry (the photos keep their now-dangling tripId, harmless per slice 6a).
export default function HikeTripList({ trips, photos, onEdit, onDelete, onDeleteTrip }) {
  const [openTripId, setOpenTripId] = useState(null);
  // The trip awaiting delete confirmation, and whether its delete is in flight.
  const [confirmTrip, setConfirmTrip] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const photosByTripId = groupPhotosByTrip(photos);
  const openTrip = openTripId != null ? trips.find((trip) => trip.id === openTripId) : null;
  const openTripPhotos = openTrip ? (photosByTripId.get(openTrip.id) ?? []) : [];
  const confirmPhotoCount = confirmTrip ? (photosByTripId.get(confirmTrip.id)?.length ?? 0) : 0;

  const closeModal = useCallback(() => setOpenTripId(null), []);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    await onDeleteTrip(confirmTrip.id);
    setDeleting(false);
    setConfirmTrip(null);
  };

  useEffect(() => {
    if (!openTrip) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [openTrip, closeModal]);

  if (trips.length === 0) {
    return <p className="text-neutral-400 text-center mt-6">No trips yet.</p>;
  }

  return (
    <>
      <ul className="mt-6 flex flex-col gap-2">
        {trips.map((trip) => {
          const count = photosByTripId.get(trip.id)?.length ?? 0;
          return (
            <li
              key={trip.id}
              className="flex items-center justify-between rounded-lg border border-mid-gray bg-neutral-900 px-4 py-3"
            >
              <div className="min-w-0">
                <span className="block truncate font-display text-lg text-neon-blue-bright">
                  {trip.name}
                </span>
                <span className="block truncate text-sm text-neutral-400">
                  {trip.region || '—'} · {count} photo{count === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setOpenTripId(trip.id)}
                  aria-label={`View photos for ${trip.name}`}
                  className="cursor-pointer rounded bg-black/70 px-3 py-1 text-xs font-bold text-neon-blue-bright hover:bg-black"
                >
                  View photos
                </button>
                <button
                  onClick={() => setConfirmTrip(trip)}
                  aria-label={`Delete ${trip.name}`}
                  className="cursor-pointer rounded bg-black/70 px-3 py-1 text-xs font-bold text-red-400 hover:bg-black"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {openTrip && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label={`Photos for ${openTrip.name}`}
        >
          <div
            className="my-8 w-full max-w-3xl rounded-lg border border-mid-gray bg-black p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="truncate font-display text-2xl text-neon-blue-bright">
                  {openTrip.name}
                </h2>
                <p className="truncate text-sm text-neutral-400">
                  {openTrip.region || '—'} · {openTripPhotos.length} photo
                  {openTripPhotos.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                onClick={closeModal}
                aria-label="Close"
                className="shrink-0 cursor-pointer border-none bg-transparent px-2 text-3xl font-bold text-neutral-300 hover:text-white"
              >
                &times;
              </button>
            </div>
            <PhotoList
              photos={openTripPhotos}
              gallery="hikes"
              trips={trips}
              onEdit={onEdit}
              onReorder={() => {}}
              onDelete={onDelete}
            />
          </div>
        </div>
      )}

      {confirmTrip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => !deleting && setConfirmTrip(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Delete ${confirmTrip.name}?`}
        >
          <div
            className="w-full max-w-md rounded-lg border border-red-500/40 bg-black p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-2xl text-red-400">Delete trip?</h2>
            <p className="mt-3 text-sm text-neutral-300">
              This permanently deletes <span className="font-bold">{confirmTrip.name}</span>
              {confirmPhotoCount > 0 ? (
                <>
                  {' '}
                  and its{' '}
                  <span className="font-bold">
                    {confirmPhotoCount} photo{confirmPhotoCount === 1 ? '' : 's'}
                  </span>{' '}
                  from storage
                </>
              ) : (
                ' (no photos are assigned to it)'
              )}
              . This can&apos;t be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmTrip(null)}
                disabled={deleting}
                className="cursor-pointer rounded border border-mid-gray px-4 py-2 text-sm font-bold text-neutral-300 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="cursor-pointer rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
