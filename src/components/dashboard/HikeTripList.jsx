import { useState, useEffect, useCallback } from 'react';
import PhotoList from './PhotoList';
import './HikeTripList.css';

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
export default function HikeTripList({
  trips,
  photos,
  onEdit,
  onDelete,
  onDeleteTrip,
  onMeasureTrip,
}) {
  const [openTripId, setOpenTripId] = useState(null);
  // The trip awaiting delete confirmation, and whether its delete is in flight.
  const [confirmTrip, setConfirmTrip] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // The trip whose route is being measured, one at a time.
  const [measuringTripId, setMeasuringTripId] = useState(null);

  const handleMeasure = async (trip) => {
    setMeasuringTripId(trip.id);
    await onMeasureTrip(trip);
    setMeasuringTripId(null);
  };

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
            <li key={trip.id} className="trip-row">
              <div className="trip-row-text">
                <span className="trip-row-name">{trip.name}</span>
                <span className="trip-row-details">
                  {trip.region ? `${trip.region} · ` : ''}
                  {count} photo{count === 1 ? '' : 's'}
                </span>
              </div>
              <div className="trip-row-actions">
                {trip.stats === null && (
                  <button
                    type="button"
                    onClick={() => handleMeasure(trip)}
                    disabled={measuringTripId !== null}
                    className="admin-button"
                  >
                    {measuringTripId === trip.id ? 'Measuring…' : 'Compute route stats'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpenTripId(trip.id)}
                  aria-label={`View photos for ${trip.name}`}
                  className="admin-button"
                >
                  View photos
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmTrip(trip)}
                  aria-label={`Delete ${trip.name}`}
                  className="admin-button admin-button-danger"
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
            <div className="trip-photos-header">
              <div className="trip-row-text">
                <h2 className="admin-confirm-title">{openTrip.name}</h2>
                <p className="trip-row-details">
                  {openTrip.region ? `${openTrip.region} · ` : ''}
                  {openTripPhotos.length} photo{openTripPhotos.length === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" onClick={closeModal} className="admin-button">
                Close
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
          className="admin-confirm-backdrop"
          onClick={() => !deleting && setConfirmTrip(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Delete ${confirmTrip.name}?`}
        >
          <div className="admin-confirm" onClick={(event) => event.stopPropagation()}>
            <h2 className="admin-confirm-title admin-confirm-title-danger">Delete trip?</h2>
            <p className="admin-confirm-message">
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
            <div className="admin-confirm-actions">
              <button
                type="button"
                onClick={() => setConfirmTrip(null)}
                disabled={deleting}
                className="admin-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="admin-button admin-button-danger"
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
