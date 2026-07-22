import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import MapSidebar from '../components/hikes/MapSidebar';
import HikeGlobe from '../components/hikes/HikeGlobe';
import { fetchTrips } from '../lib/mediaApi';

export default function HikeMapPage() {
  const [trips, setTrips] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [selectedTripId, setSelectedTripId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loadedTrips = await fetchTrips();
        if (!active) return;
        setTrips(loadedTrips);
        setSelectedTripId(loadedTrips[0]?.id ?? null);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? null;

  const sidebarMessage =
    status === 'loading'
      ? 'Loading trips…'
      : status === 'error'
        ? 'Could not load trips.'
        : 'No trips yet.';

  return (
    <>
      <Helmet>
        <title>Kevin Nail | Backpacking Map</title>
        <meta
          name="description"
          content="Explore Kevin Nail's backpacking trips on a 3D map — trails, campsites, and photos."
        />
        <link rel="canonical" href="https://kevinnail.com/backpacking" />
      </Helmet>

      <div className="flex h-dvh w-screen flex-col overflow-hidden bg-black">
        <Banner />
        <div className="flex flex-1 overflow-hidden">
          <MapSidebar
            trips={trips}
            selectedTripId={selectedTripId}
            onSelectTrip={setSelectedTripId}
            emptyMessage={sidebarMessage}
          />
          <main className="relative flex-1">
            <HikeGlobe selectedTrip={selectedTrip} />
            {/* Bottom dock (expanded selected photo) is wired in slice 6. */}
          </main>
        </div>
      </div>
    </>
  );
}
