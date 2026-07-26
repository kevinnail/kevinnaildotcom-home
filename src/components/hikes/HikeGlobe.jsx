import { useEffect, useRef, useState } from 'react';
import { Viewer, KmlDataSource, Entity } from 'resium';
import {
  Ion,
  createWorldTerrainAsync,
  Cartesian3,
  Color,
  BoundingSphere,
  HeadingPitchRange,
  HeightReference,
  Math as CesiumMath,
} from 'cesium';

// Non-secret, client-side token (Ion free tier). Empty token still renders a
// globe, but base imagery + world terrain won't load until it's set in .env.
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';

// Fixed fly-to framing used for every photo, so each pin gets the same,
// predictable view instead of inheriting whatever zoom/tilt the user left.
// - RANGE: how far (metres) the camera sits from the pin. Kept fairly wide so
//   we don't slam in close, where terrain often occludes the pin.
// - PITCH: viewing angle above the horizon. Cesium's HeadingPitchRange pitch is
//   measured downward from horizontal (0 = level, -90° = straight down), so a
//   35° look-down is -35°. Oblique enough to read the terrain, shallow enough
//   to keep the camera above nearby ridgelines rather than punching through them.
const PHOTO_VIEW_RANGE_METERS = 13000;
const PHOTO_VIEW_PITCH_RADIANS = CesiumMath.toRadians(-20);

export default function HikeGlobe({ selectedTrip, selectedPhoto }) {
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

  // Recenter the camera on the selected photo — a deliberate response to a photo
  // click (not trip select; slices 4–5 keep the camera still on trip select).
  // Every photo gets the same predefined framing (fixed range + fixed 20°
  // look-down); we keep only the user's current heading so the pin stays on
  // whatever side they were facing. Keyed on id/coords so unrelated re-renders
  // don't re-trigger the flight. requestRenderMode is fine: flyTo drives its
  // own renders.
  const photoId = selectedPhoto?.id ?? null;
  const photoLng = selectedPhoto?.lng;
  const photoLat = selectedPhoto?.lat;
  useEffect(() => {
    if (photoId == null) return;
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const { camera } = viewer;
    camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(photoLng, photoLat), 0), {
      offset: new HeadingPitchRange(
        camera.heading,
        PHOTO_VIEW_PITCH_RADIANS,
        PHOTO_VIEW_RANGE_METERS,
      ),
      duration: 1.2,
    });
  }, [photoId, photoLng, photoLat]);

  if (terrainProvider === 'pending') {
    return (
      <div className="grid h-full w-full place-items-center bg-black font-body text-gray-300">
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
      {selectedPhoto ? (
        <Entity
          position={Cartesian3.fromDegrees(selectedPhoto.lng, selectedPhoto.lat)}
          point={{
            pixelSize: 14,
            color: Color.fromCssColorString('#4fd2ff'),
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            // Sit on the terrain surface (height ignored) so the pin stays
            // anchored to its spot as the camera moves, instead of floating at
            // ellipsoid height and sliding around with parallax.
            heightReference: HeightReference.CLAMP_TO_GROUND,
            // Keep the pin visible even when terrain would occlude it, so an
            // oblique view never hides it behind a ridge.
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }}
        />
      ) : null}
    </Viewer>
  );
}
