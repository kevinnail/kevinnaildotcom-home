import { useState } from 'react';
import './PhotoList.css';

// Parse a coordinate text input into a number, or null when blank/invalid.
function parseCoordinate(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Move the entry with `fromId` to sit where `toId` currently is, shifting the
// rest. Returns a new array; the input is untouched.
function movePhoto(photos, fromId, toId) {
  if (fromId === toId) return photos;
  const fromIndex = photos.findIndex((photo) => photo.id === fromId);
  const toIndex = photos.findIndex((photo) => photo.id === toId);
  if (fromIndex === -1 || toIndex === -1) return photos;
  const reordered = [...photos];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

export default function PhotoList({ photos, gallery, trips = [], onEdit, onReorder, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ alt: '', caption: '', lat: '', lng: '', tripId: '' });
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const isHikes = gallery === 'hikes';
  const tripNameById = new Map(trips.map((trip) => [trip.id, trip.name]));
  // Hikes read chronologically by EXIF capture time, so manual drag-reorder is
  // meaningless there; only astro is hand-ordered.
  const canReorder = !isHikes;

  if (photos.length === 0) {
    return <p className="text-neutral-400 text-center mt-6">No photos yet.</p>;
  }

  const startEditing = (photo) => {
    setEditingId(photo.id);
    setDraft({
      alt: photo.alt ?? '',
      caption: photo.caption ?? '',
      lat: photo.lat ?? '',
      lng: photo.lng ?? '',
      tripId: photo.tripId ?? '',
    });
  };

  const cancelEditing = () => setEditingId(null);

  const updateDraft = (name) => (event) =>
    setDraft((current) => ({ ...current, [name]: event.target.value }));

  const saveEditing = (id) => {
    const fields = { alt: draft.alt, caption: draft.caption };
    if (isHikes) {
      fields.lat = parseCoordinate(draft.lat);
      fields.lng = parseCoordinate(draft.lng);
      // '' => null unassigns the photo; the Lambda treats an explicit null as a clear.
      fields.tripId = draft.tripId || null;
    }
    onEdit(id, fields);
    setEditingId(null);
  };

  const resetDrag = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = (targetId) => {
    if (draggingId && draggingId !== targetId) {
      const reordered = movePhoto(photos, draggingId, targetId);
      onReorder(reordered.map((photo) => photo.id));
    }
    resetDrag();
  };

  return (
    <div className="photo-grid">
      {photos.map((photo) => {
        const isEditing = editingId === photo.id;
        const isDropTarget = dragOverId === photo.id && draggingId !== photo.id;
        return (
          <div
            key={photo.id}
            draggable={canReorder && !isEditing}
            onDragStart={canReorder ? () => setDraggingId(photo.id) : undefined}
            onDragEnd={canReorder ? resetDrag : undefined}
            onDragOver={
              canReorder
                ? (event) => {
                    event.preventDefault();
                    if (draggingId) setDragOverId(photo.id);
                  }
                : undefined
            }
            onDrop={
              canReorder
                ? (event) => {
                    event.preventDefault();
                    handleDrop(photo.id);
                  }
                : undefined
            }
            className={`relative rounded-lg overflow-hidden border bg-neutral-900 ${
              isDropTarget ? 'border-neon-blue ring-2 ring-neon-blue' : 'border-mid-gray'
            } ${draggingId === photo.id ? 'opacity-50' : ''} ${
              canReorder && !isEditing ? 'cursor-move' : ''
            }`}
          >
            <img
              src={photo.url}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              className="w-full h-32 object-cover"
            />

            {isEditing ? (
              <div className="photo-card-body">
                <input
                  type="text"
                  value={draft.alt}
                  onChange={updateDraft('alt')}
                  placeholder="Alt text"
                  className="admin-input"
                />
                <input
                  type="text"
                  value={draft.caption}
                  onChange={updateDraft('caption')}
                  placeholder="Caption"
                  className="admin-input"
                />
                {isHikes && (
                  <>
                    <div className="photo-card-coordinates">
                      <input
                        type="number"
                        step="any"
                        value={draft.lat}
                        onChange={updateDraft('lat')}
                        placeholder="Lat"
                        className="admin-input"
                      />
                      <input
                        type="number"
                        step="any"
                        value={draft.lng}
                        onChange={updateDraft('lng')}
                        placeholder="Lng"
                        className="admin-input"
                      />
                    </div>
                    <select
                      value={draft.tripId}
                      onChange={updateDraft('tripId')}
                      className="admin-input"
                      aria-label="Trip"
                    >
                      <option value="">Unassigned</option>
                      {trips.map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <div className="photo-card-actions">
                  <button
                    type="button"
                    onClick={() => saveEditing(photo.id)}
                    className="admin-button admin-button-primary"
                  >
                    Save
                  </button>
                  <button type="button" onClick={cancelEditing} className="admin-button">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="photo-card-body">
                <p className="photo-card-detail">{photo.caption || 'No caption'}</p>
                {isHikes && photo.lat != null && photo.lng != null && (
                  <p className="photo-card-detail">
                    📍 {photo.lat}, {photo.lng}
                  </p>
                )}
                {isHikes && (
                  <p className="photo-card-detail">
                    🥾{' '}
                    {photo.tripId
                      ? (tripNameById.get(photo.tripId) ?? 'Unknown trip')
                      : 'Unassigned'}
                  </p>
                )}
                <div className="photo-card-actions">
                  <button
                    type="button"
                    onClick={() => startEditing(photo)}
                    className="admin-button"
                    aria-label={`Edit ${photo.alt || 'photo'}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(photo.id)}
                    className="admin-button admin-button-danger"
                    aria-label={`Delete ${photo.alt || 'photo'}`}
                  >
                    Delete
                  </button>
                </div>
                {canReorder && (
                  <div className="absolute top-1 left-1 bg-black/70 text-mid-gray rounded px-1 text-xs select-none">
                    ⠿
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
