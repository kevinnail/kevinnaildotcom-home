export default function MapSidebar({
  trips,
  selectedTripId,
  onSelectTrip,
  emptyMessage,
  tripPhotos,
  selectedPhotoId,
  onSelectPhoto,
  photoMessage,
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-neon-blue-50 bg-black/90 text-white">
      <div className="shrink-0 border-b border-neon-blue-50 px-4 py-4">
        <h1 className="font-display text-2xl text-neon-blue">Hikes</h1>
        <p className="font-body text-sm text-mid-gray">Select a hike to view its route.</p>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {trips.length === 0 && (
          <p className="px-3 py-2 font-body text-sm text-mid-gray">{emptyMessage}</p>
        )}
        <ul className="space-y-1">
          {trips.map((trip) => {
            const isSelected = trip.id === selectedTripId;
            return (
              <li key={trip.id}>
                <button
                  type="button"
                  onClick={() => onSelectTrip(trip.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`w-full rounded px-3 py-2 text-left font-body transition-colors ${
                    isSelected
                      ? 'bg-neon-blue-50 text-neon-blue'
                      : 'text-white hover:bg-neon-blue-50/40'
                  }`}
                >
                  <span className="block font-display text-lg">{trip.name}</span>
                  <span className="block text-sm text-mid-gray">{trip.region}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {selectedTripId != null && (
        <div className="flex max-h-[45vh] shrink-0 flex-col border-t border-neon-blue-50 px-2 py-3">
          <h2 className="shrink-0 px-2 pb-2 font-display text-sm uppercase tracking-wide text-mid-gray">
            Photos
          </h2>
          {tripPhotos.length === 0 ? (
            <p className="px-2 py-1 font-body text-sm text-mid-gray">{photoMessage}</p>
          ) : (
            <ul className="grid min-h-0 grid-cols-3 gap-2 overflow-y-auto px-1">
              {tripPhotos.map((photo) => {
                const isSelected = photo.id === selectedPhotoId;
                return (
                  // content-visibility:auto skips layout/paint for thumbnails
                  // that aren't near the viewport, so scrolling only decodes the
                  // handful on screen instead of the whole list. The intrinsic
                  // size reserves each cell's space so the scrollbar stays honest.
                  <li
                    key={photo.id}
                    className="[content-visibility:auto] [contain-intrinsic-size:auto_88px]"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPhoto(photo.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`block w-full overflow-hidden rounded border-4 transition-colors ${
                        isSelected
                          ? 'border-yellow-400'
                          : 'border-transparent hover:border-neon-blue-50'
                      }`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.alt ?? ''}
                        loading="lazy"
                        decoding="async"
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
