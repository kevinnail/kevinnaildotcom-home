import { useState } from 'react';

const inputClass =
  'px-2 py-1 rounded bg-black text-white text-xs border border-mid-gray focus:border-neon-blue-bright outline-none';

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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
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
            <img src={photo.url} alt={photo.alt} className="w-full h-32 object-cover" />

            {isEditing ? (
              <div className="flex flex-col gap-2 p-2">
                <input
                  type="text"
                  value={draft.alt}
                  onChange={updateDraft('alt')}
                  placeholder="Alt text"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={draft.caption}
                  onChange={updateDraft('caption')}
                  placeholder="Caption"
                  className={inputClass}
                />
                {isHikes && (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        value={draft.lat}
                        onChange={updateDraft('lat')}
                        placeholder="Lat"
                        className={`${inputClass} w-1/2`}
                      />
                      <input
                        type="number"
                        step="any"
                        value={draft.lng}
                        onChange={updateDraft('lng')}
                        placeholder="Lng"
                        className={`${inputClass} w-1/2`}
                      />
                    </div>
                    <select
                      value={draft.tripId}
                      onChange={updateDraft('tripId')}
                      className={inputClass}
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
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEditing(photo.id)}
                    className="bg-neon-blue text-white rounded px-2 py-0.5 text-xs font-bold cursor-pointer hover:bg-neon-blue-bright hover:text-black"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="text-neutral-400 hover:text-white rounded px-2 py-0.5 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-2 text-xs text-neutral-400 truncate">{photo.caption || '—'}</div>
                {isHikes && photo.lat != null && photo.lng != null && (
                  <div className="px-2 pb-2 text-xs text-neutral-400 truncate">
                    📍 {photo.lat}, {photo.lng}
                  </div>
                )}
                {isHikes && (
                  <div className="px-2 pb-2 text-xs text-neutral-400 truncate">
                    🥾{' '}
                    {photo.tripId
                      ? (tripNameById.get(photo.tripId) ?? 'Unknown trip')
                      : 'Unassigned'}
                  </div>
                )}
                <div className="absolute top-1 right-1 flex gap-1">
                  <button
                    onClick={() => startEditing(photo)}
                    className="bg-black/70 text-neon-blue-bright rounded px-2 py-0.5 text-xs font-bold cursor-pointer hover:bg-black"
                    aria-label={`Edit ${photo.alt || 'photo'}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(photo.id)}
                    className="bg-black/70 text-red-400 rounded px-2 py-0.5 text-xs font-bold cursor-pointer hover:bg-black"
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
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
