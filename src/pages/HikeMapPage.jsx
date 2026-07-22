import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import MapSidebar from '../components/hikes/MapSidebar';
import HikeGlobe from '../components/hikes/HikeGlobe';
import { hikeTrips } from '../data/hikeTrips';

export default function HikeMapPage() {
  const [selectedTripId, setSelectedTripId] = useState(hikeTrips[0]?.id ?? null);
  const selectedTrip = hikeTrips.find((trip) => trip.id === selectedTripId) ?? null;

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
            trips={hikeTrips}
            selectedTripId={selectedTripId}
            onSelectTrip={setSelectedTripId}
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
