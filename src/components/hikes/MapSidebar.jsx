export default function MapSidebar({ trips, selectedTripId, onSelectTrip }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-neon-blue-50 bg-black/90 text-white">
      <div className="border-b border-neon-blue-50 px-4 py-4">
        <h1 className="font-display text-2xl text-neon-blue">Hikes</h1>
        <p className="font-body text-sm text-mid-gray">Select a hike to view its route.</p>
      </div>

      <nav className="flex-1 px-2 py-2">
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

      {/* Selected hike's photo thumbnails go here in slice 6 (feeds the bottom dock). */}
    </aside>
  );
}
