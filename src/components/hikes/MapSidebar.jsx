import { useState } from 'react';

// One hike row, shared by the desktop list and the mobile picker sheet so both
// stay visually identical and in sync. Each row reads as its own card: a hairline
// border defines the list at a glance, and the selected row brightens its border,
// fill, and type while picking up a blue glow so the active hike is unmistakable.
function TripOption({ trip, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(trip.id)}
      aria-current={isSelected ? 'true' : undefined}
      className={`group relative flex w-full touch-manipulation items-center gap-3 overflow-hidden rounded-xl border px-3.5 py-2.5 text-left font-body transition-all duration-200 [-webkit-tap-highlight-color:transparent] active:scale-[0.98] active:border-neon-blue-bright active:bg-neon-blue-bright/30 active:text-white active:duration-75 ${
        isSelected
          ? 'border-neon-blue-bright bg-neon-blue-50/35 text-white shadow-[0_0_20px_-5px_var(--color-neon-blue-bright)]'
          : 'border-white/10 bg-white/[0.03] text-gray-200 hover:-translate-y-px hover:border-neon-blue-bright/45 hover:bg-white/[0.07] hover:text-white'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg leading-tight">{trip.name}</span>
        {trip.region && (
          <span
            className={`mt-0.5 block truncate text-[0.7rem] uppercase tracking-[0.14em] transition-colors ${
              isSelected ? 'text-neon-blue-bright' : 'text-gray-400 group-hover:text-gray-300'
            }`}
          >
            {trip.region}
          </span>
        )}
      </span>

      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-4 w-4 shrink-0 transition-all duration-200 ${
          isSelected
            ? 'text-neon-blue-bright opacity-100'
            : '-translate-x-1 text-gray-400 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
        }`}
      >
        {/* Check once chosen, chevron while it's still just an option. */}
        {isSelected ? <path d="m5 13 4 4L19 7" /> : <path d="m9 18 6-6-6-6" />}
      </svg>
    </button>
  );
}

export default function MapSidebar({
  trips,
  selectedTripId,
  onSelectTrip,
  emptyMessage,
  statusMessage,
  tripPhotos,
  selectedPhotoId,
  onSelectPhoto,
  photoMessage,
  isShowingAllRoutes,
  onShowAllRoutes,
}) {
  // Mobile-only: the full hike list lives in a bottom sheet instead of a
  // sideways-scrolling strip, which is awkward to browse on a phone.
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? null;

  let mobileTitle = statusMessage;
  let mobileSubtitle = '';
  if (!statusMessage) {
    mobileTitle = selectedTrip ? selectedTrip.name : 'All hikes';
    mobileSubtitle = selectedTrip ? selectedTrip.region : 'Tap a pin to open one';
  }

  return (
    <aside className="flex max-h-[55vh] w-full shrink-0 flex-col overflow-hidden border-t border-neon-blue-50 bg-black/90 text-white md:max-h-none md:w-72 md:border-r md:border-t-0">
      <div className="hidden shrink-0 border-b border-neon-blue-50 px-4 py-4 md:block">
        <h1 className="font-display text-2xl text-white">Hikes</h1>
        <p className="font-body text-sm text-gray-300">
          {isShowingAllRoutes
            ? 'Click a pin on the map, or a hike below, to open it.'
            : 'Select a hike to view its route.'}
        </p>
        {trips.length > 1 && !isShowingAllRoutes && (
          <button
            type="button"
            onClick={onShowAllRoutes}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-body text-sm text-gray-200 transition-colors hover:border-neon-blue-bright/45 hover:bg-white/[0.07] hover:text-white"
          >
            Show all hikes
          </button>
        )}
      </div>

      <div className="shrink-0 border-b border-neon-blue-50 px-4 py-2 md:hidden">
        <span
          aria-live="polite"
          className="line-clamp-2 block font-display text-xl leading-tight text-white [text-shadow:0_0_12px_var(--color-neon-blue-bright)]"
        >
          {mobileTitle}
        </span>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate font-body text-[0.7rem] uppercase tracking-[0.14em] text-neon-blue-bright">
            {mobileSubtitle}
          </span>
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            disabled={trips.length === 0}
            className="shrink-0 touch-manipulation rounded border border-neon-blue-50 px-3 py-1 font-body text-sm text-black transition-all [-webkit-tap-highlight-color:transparent] hover:bg-neon-blue-50/40 active:scale-[0.97] active:duration-75 disabled:opacity-40 bg-[#50d71e] hover:text-white"
          >
            {selectedTrip ? 'Change hike' : 'Choose a hike'}
          </button>
        </div>
      </div>

      {/* Desktop hike list */}
      <nav className="hidden min-h-0 px-2 py-2 md:block md:flex-1 md:overflow-y-auto">
        {trips.length === 0 && (
          <p className="px-3 py-2 font-body text-sm text-gray-300">{emptyMessage}</p>
        )}
        <ul className="space-y-1.5">
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
          <h2 className="sr-only shrink-0 font-display text-sm uppercase tracking-wide text-gray-300 md:not-sr-only md:px-2 md:pb-2">
            Photos
          </h2>
          {tripPhotos.length === 0 ? (
            <p className="px-2 py-1 font-body text-sm text-gray-300">{photoMessage}</p>
          ) : (
            <ul className="flex min-h-0 gap-2 overflow-x-auto px-1 md:grid md:grid-cols-3 md:overflow-x-visible md:overflow-y-auto">
              {tripPhotos.map((photo) => {
                const isSelected = photo.id === selectedPhotoId;
                return (
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

            {trips.length > 1 && !isShowingAllRoutes && (
              <div className="shrink-0 border-b border-neon-blue-50 p-2">
                <button
                  type="button"
                  onClick={() => {
                    onShowAllRoutes();
                    setIsPickerOpen(false);
                  }}
                  className="w-full touch-manipulation rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left font-display text-lg text-gray-200 transition-all [-webkit-tap-highlight-color:transparent] active:scale-[0.98] active:bg-neon-blue-bright/30 active:text-white active:duration-75"
                >
                  ← All hikes
                </button>
              </div>
            )}
            {trips.length === 0 ? (
              <p className="px-4 py-3 font-body text-sm text-gray-300">{emptyMessage}</p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
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
            )}

            <div className="shrink-0 border-t border-neon-blue-50 p-3">
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="w-full touch-manipulation rounded-lg border border-neon-blue-bright bg-neon-blue-50/35 py-2.5 font-display text-lg text-white transition-all [-webkit-tap-highlight-color:transparent] active:scale-[0.98] active:bg-neon-blue-bright/30 active:duration-75"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
