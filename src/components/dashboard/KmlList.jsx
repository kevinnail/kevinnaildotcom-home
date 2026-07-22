// Existing map trips with a Delete action. Deleting removes the S3 object and the
// manifest entry, so the trip disappears from the /backpacking map sidebar too.
export default function KmlList({ trips, onDelete }) {
  if (trips.length === 0) {
    return <p className="text-neutral-400 text-center mt-6">No trips yet.</p>;
  }

  return (
    <ul className="mt-6 flex flex-col gap-2">
      {trips.map((trip) => (
        <li
          key={trip.id}
          className="flex items-center justify-between rounded-lg border border-mid-gray bg-neutral-900 px-4 py-3"
        >
          <div className="min-w-0">
            <span className="block truncate font-display text-lg text-neon-blue-bright">
              {trip.name}
            </span>
            <span className="block truncate text-sm text-neutral-400">{trip.region || '—'}</span>
          </div>
          <button
            onClick={() => onDelete(trip.id)}
            aria-label={`Delete ${trip.name}`}
            className="shrink-0 cursor-pointer rounded bg-black/70 px-3 py-1 text-xs font-bold text-red-400 hover:bg-black"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
