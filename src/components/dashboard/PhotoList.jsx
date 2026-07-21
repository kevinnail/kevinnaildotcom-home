import { useState } from 'react';

const inputClass =
  'px-2 py-1 rounded bg-black text-white text-xs border border-mid-gray focus:border-neon-blue outline-none';

export default function PhotoList({ photos, onEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ alt: '', caption: '' });

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

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="relative rounded-lg overflow-hidden border border-mid-gray bg-neutral-900"
        >
          <img src={photo.url} alt={photo.alt} className="w-full h-32 object-cover" />

          {editingId === photo.id ? (
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
            </>
          )}
        </div>
      ))}
    </div>
  );
}
