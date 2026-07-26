import { useState } from 'react';

// One hike row, shared by the desktop list and the mobile picker sheet so both
// stay visually identical and in sync.
function TripOption({ trip, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(trip.id)}
      aria-current={isSelected ? 'true' : undefined}
      className={`w-full rounded px-3 py-2 text-left font-body transition-colors ${
        isSelected ? 'bg-neon-blue-50 text-white' : 'text-white hover:bg-neon-blue-50/40'
      }`}
    >
      <span className="block font-display text-lg">{trip.name}</span>
      <span className="block text-sm text-gray-300">{trip.region}</span>
    </button>
  );
}

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
  // Mobile-only: the full hike list lives in a bottom sheet instead of a
  // sideways-scrolling strip, which is awkward to browse on a phone.
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? null;

  function handlePickTrip(tripId) {
    onSelectTrip(tripId);
    setIsPickerOpen(false);
  }

  return (
    <aside className="flex max-h-[55vh] w-full shrink-0 flex-col overflow-hidden border-t border-neon-blue-50 bg-black/90 text-white md:max-h-none md:w-72 md:border-r md:border-t-0">
      {/* Desktop header */}
      <div className="hidden shrink-0 border-b border-neon-blue-50 px-4 py-4 md:block">
        <h1 className="font-display text-2xl text-white">Hikes</h1>
        <p className="font-body text-sm text-gray-300">Select a hike to view its route.</p>
      </div>

      {/* Mobile current-hike bar: shows the active hike and opens the picker */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neon-blue-50 px-4 py-2 md:hidden">
        <div className="min-w-0">
          <span className="block truncate font-display text-lg text-white">
            {selectedTrip ? selectedTrip.name : 'Hikes'}
          </span>
          {selectedTrip?.region && (
            <span className="block truncate font-body text-sm text-gray-300">
              {selectedTrip.region}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          disabled={trips.length === 0}
          className="shrink-0 rounded border border-neon-blue-50 px-3 py-1.5 font-body text-sm text-black transition-colors hover:bg-neon-blue-50/40 disabled:opacity-40 bg-[#50d71e] hover:text-white"
        >
          Change hike
        </button>
      </div>

      {/* Desktop hike list */}
      <nav className="hidden min-h-0 px-2 py-2 md:block md:flex-1 md:overflow-y-auto">
        {trips.length === 0 && (
          <p className="px-3 py-2 font-body text-sm text-gray-300">{emptyMessage}</p>
        )}
        <ul className="space-y-1">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripOption
                trip={trip}
                isSelected={trip.id === selectedTripId}
                onSelect={onSelectTrip}
              />
            </li>
          ))}
        </ul>
      </nav>

      {selectedTripId != null && (
        <div className="flex max-h-[45vh] shrink-0 flex-col border-t border-neon-blue-50 px-2 py-3">
          <h2 className="shrink-0 px-2 pb-2 font-display text-sm uppercase tracking-wide text-gray-300">
            Photos
          </h2>
          {tripPhotos.length === 0 ? (
            <p className="px-2 py-1 font-body text-sm text-gray-300">{photoMessage}</p>
          ) : (
            <ul className="flex min-h-0 gap-2 overflow-x-auto px-1 md:grid md:grid-cols-3 md:overflow-x-visible md:overflow-y-auto">
              {tripPhotos.map((photo) => {
                const isSelected = photo.id === selectedPhotoId;
                return (
                  // content-visibility:auto skips layout/paint for thumbnails
                  // that aren't near the viewport, so scrolling only decodes the
                  // handful on screen instead of the whole list. The intrinsic
                  // size reserves each cell's space so the scrollbar stays honest.
                  <li
                    key={photo.id}
                    className="w-20 shrink-0 md:w-auto md:shrink [content-visibility:auto] [contain-intrinsic-size:auto_88px]"
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
                        src={photo.thumbUrl}
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

      {/* Mobile hike picker: bottom sheet over a dimmed backdrop */}
      {isPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a hike"
        >
          <button
            type="button"
            aria-label="Close hike picker"
            onClick={() => setIsPickerOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="relative flex max-h-[70vh] flex-col rounded-t-2xl border-t border-neon-blue-50 bg-black">
            <div className="flex shrink-0 items-center justify-between border-b border-neon-blue-50 px-4 py-3">
              <h2 className="font-display text-xl text-white">Choose a hike</h2>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                aria-label="Close"
                className="rounded-full px-2 font-body text-2xl leading-none text-white transition-colors hover:text-neon-blue-bright"
              >
                ×
              </button>
            </div>
            {trips.length === 0 ? (
              <p className="px-4 py-3 font-body text-sm text-gray-300">{emptyMessage}</p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {trips.map((trip) => (
                  <li key={trip.id}>
                    <TripOption
                      trip={trip}
                      isSelected={trip.id === selectedTripId}
                      onSelect={handlePickTrip}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
