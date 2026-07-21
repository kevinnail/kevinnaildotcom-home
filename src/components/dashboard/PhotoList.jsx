import { useState } from 'react';

const inputClass =
  'px-2 py-1 rounded bg-black text-white text-xs border border-mid-gray focus:border-neon-blue outline-none';

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

export default function PhotoList({ photos, onEdit, onReorder, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ alt: '', caption: '' });
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  if (photos.length === 0) {
    return <p className="text-mid-gray text-center mt-6">No photos yet.</p>;
  }

  const startEditing = (photo) => {
    setEditingId(photo.id);
    setDraft({ alt: photo.alt ?? '', caption: photo.caption ?? '' });
  };

  const cancelEditing = () => setEditingId(null);

  const updateDraft = (name) => (event) =>
    setDraft((current) => ({ ...current, [name]: event.target.value }));

  const saveEditing = (id) => {
    onEdit(id, draft);
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
            draggable={!isEditing}
            onDragStart={() => setDraggingId(photo.id)}
            onDragEnd={resetDrag}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingId) setDragOverId(photo.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(photo.id);
            }}
            className={`relative rounded-lg overflow-hidden border bg-neutral-900 ${
              isDropTarget ? 'border-neon-blue ring-2 ring-neon-blue' : 'border-mid-gray'
            } ${draggingId === photo.id ? 'opacity-50' : ''} ${isEditing ? '' : 'cursor-move'}`}
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
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEditing(photo.id)}
                    className="bg-neon-blue-50 text-white rounded px-2 py-0.5 text-xs font-bold hover:bg-neon-blue"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="text-mid-gray hover:text-white rounded px-2 py-0.5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-2 text-xs text-mid-gray truncate">{photo.caption || '—'}</div>
                <div className="absolute top-1 right-1 flex gap-1">
                  <button
                    onClick={() => startEditing(photo)}
                    className="bg-black/70 text-neon-blue rounded px-2 py-0.5 text-xs font-bold hover:bg-black"
                    aria-label={`Edit ${photo.alt || 'photo'}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(photo.id)}
                    className="bg-black/70 text-red-400 rounded px-2 py-0.5 text-xs font-bold hover:bg-black"
                    aria-label={`Delete ${photo.alt || 'photo'}`}
                  >
                    Delete
                  </button>
                </div>
                <div className="absolute top-1 left-1 bg-black/70 text-mid-gray rounded px-1 text-xs select-none">
                  ⠿
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
