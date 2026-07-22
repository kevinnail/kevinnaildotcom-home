import { useEffect, useRef, useState } from 'react';
import { Viewer, KmlDataSource } from 'resium';
import { Ion, createWorldTerrainAsync } from 'cesium';

// Non-secret, client-side token (Ion free tier). Empty token still renders a
// globe, but base imagery + world terrain won't load until it's set in .env.
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';

export default function HikeGlobe({ selectedTrip }) {
  const viewerRef = useRef(null);
  // 'pending' until the async terrain resolves; then the provider (3D relief) or
  // null (fall back to the flat ellipsoid if terrain fails, e.g. missing token).
  const [terrainProvider, setTerrainProvider] = useState('pending');

  // World terrain loads asynchronously (createWorldTerrain was removed in Cesium
  // 1.14x). We resolve it BEFORE mounting the Viewer so it's applied at
  // construction — resium does not reliably swap terrainProvider post-mount.
  useEffect(() => {
    let cancelled = false;
    createWorldTerrainAsync()
      .then((provider) => {
        if (!cancelled) setTerrainProvider(provider);
      })
      .catch((error) => {
        console.error('Cesium World Terrain failed to load', error);
        if (!cancelled) setTerrainProvider(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (terrainProvider === 'pending') {
    return (
      <div className="grid h-full w-full place-items-center bg-black font-body text-mid-gray">
        Loading terrain…
      </div>
    );
  }

  return (
    <Viewer
      ref={viewerRef}
      style={{ width: '100%', height: '100%' }}
      terrainProvider={terrainProvider ?? undefined}
      timeline={false}
      animation={false}
      // Only render when the scene changes (camera move, data load, tile stream-in)
      // instead of every animation frame. Without this Cesium pins a CPU core at
      // idle. maximumRenderTimeChange caps how long a static scene goes without a
      // render so terrain/imagery tiles still resolve after they arrive.
      requestRenderMode
      maximumRenderTimeChange={Infinity}
    >
      {selectedTrip ? <KmlDataSource data={selectedTrip.url} clampToGround /> : null}
    </Viewer>
  );
}
