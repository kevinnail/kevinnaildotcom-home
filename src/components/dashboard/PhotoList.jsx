export default function PhotoList({ photos, onDelete }) {
  if (photos.length === 0) {
    return <p className="text-mid-gray text-center mt-6">No photos yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="relative rounded-lg overflow-hidden border border-mid-gray bg-neutral-900"
        >
          <img src={photo.url} alt={photo.alt} className="w-full h-32 object-cover" />
          <div className="p-2 text-xs text-mid-gray truncate">{photo.caption || '—'}</div>
          <button
            onClick={() => onDelete(photo.id)}
            className="absolute top-1 right-1 bg-black/70 text-red-400 rounded px-2 py-0.5 text-xs font-bold hover:bg-black"
            aria-label={`Delete ${photo.alt || 'photo'}`}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
