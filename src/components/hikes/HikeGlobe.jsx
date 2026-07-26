import { useEffect, useRef, useState } from 'react';
import { Viewer, KmlDataSource, Entity } from 'resium';
import {
  Ion,
  createWorldTerrainAsync,
  Cartesian3,
  Cartographic,
  Color,
  BoundingSphere,
  HeadingPitchRange,
  HeightReference,
  sampleTerrainMostDetailed,
  Math as CesiumMath,
} from 'cesium';

// Non-secret, client-side token (Ion free tier). Empty token still renders a
// globe, but base imagery + world terrain won't load until it's set in .env.
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';

// Fly-to framing used for every photo, so each pin gets the same, predictable
// view instead of inheriting whatever zoom/tilt the user left. The user picks a
// level with the +/− buttons and it sticks across photos, so stepping to the
// next pin keeps the framing they chose rather than snapping back to a default.
// - rangeMeters: how far the camera sits from the pin. Widest level first.
// - pitchDegrees: viewing angle, measured downward from horizontal (0 = level,
//   -90 = straight down). It steepens as the range closes: a shallow oblique is
//   readable from far out, but up close it drags the camera down into whatever
//   ridge sits between it and the pin, so we look further over the top instead.
const ZOOM_LEVELS = [
  { rangeMeters: 40000, pitchDegrees: -20 },
  { rangeMeters: 26000, pitchDegrees: -20 },
  { rangeMeters: 13000, pitchDegrees: -20 },
  { rangeMeters: 6500, pitchDegrees: -30 },
  { rangeMeters: 2500, pitchDegrees: -38 },
  { rangeMeters: 500, pitchDegrees: -45 },
];
const DEFAULT_ZOOM_LEVEL_INDEX = ZOOM_LEVELS.findIndex((level) => level.rangeMeters === 13000);

function formatRange(rangeMeters) {
  return rangeMeters >= 1000 ? `${(rangeMeters / 1000).toFixed(1)} km` : `${rangeMeters} m`;
}

export default function HikeGlobe({ selectedTrip, selectedPhoto }) {
  const viewerRef = useRef(null);
  // 'pending' until the async terrain resolves; then the provider (3D relief) or
  // null (fall back to the flat ellipsoid if terrain fails, e.g. missing token).
  const [terrainProvider, setTerrainProvider] = useState('pending');
  const [zoomLevelIndex, setZoomLevelIndex] = useState(DEFAULT_ZOOM_LEVEL_INDEX);
  const { rangeMeters, pitchDegrees } = ZOOM_LEVELS[zoomLevelIndex];

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
  // Framing is the chosen zoom level's range + pitch; we keep only the user's
  // current heading so the pin stays on whatever side they were facing. Keyed on
  // id/coords/level so unrelated re-renders don't re-trigger the flight, while a
  // +/− press re-frames the photo already on screen. requestRenderMode is fine:
  // flyTo drives its own renders.
  //
  // The target must sit at the photo's GROUND elevation, not the ellipsoid
  // (sea level). HeadingPitchRange places the camera relative to the target, so
  // aiming at sea level under a 3,000 m ridge parks the camera inside the
  // mountain at close ranges — the pin still shows (it's CLAMP_TO_GROUND with the
  // depth test off) but the view is buried. sampleTerrainMostDetailed resolves the
  // real height first; if it fails we fall back to sea level, which is the old
  // behaviour and still fine at the wide levels.
  const photoId = selectedPhoto?.id ?? null;
  const photoLng = selectedPhoto?.lng;
  const photoLat = selectedPhoto?.lat;
  useEffect(() => {
    if (photoId == null) return undefined;
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return undefined;
    let cancelled = false;

    function flyToGroundTarget(targetHeightMeters) {
      if (cancelled) return;
      const { camera } = viewer;
      camera.flyToBoundingSphere(
        new BoundingSphere(Cartesian3.fromDegrees(photoLng, photoLat, targetHeightMeters), 0),
        {
          offset: new HeadingPitchRange(
            camera.heading,
            CesiumMath.toRadians(pitchDegrees),
            rangeMeters,
          ),
          duration: 1.2,
        },
      );
    }

    if (!terrainProvider) {
      flyToGroundTarget(0);
      return undefined;
    }
    sampleTerrainMostDetailed(terrainProvider, [Cartographic.fromDegrees(photoLng, photoLat)])
      .then(([sampled]) => flyToGroundTarget(sampled?.height ?? 0))
      .catch((error) => {
        console.error('Terrain height sample failed; framing photo from sea level', error);
        flyToGroundTarget(0);
      });
    return () => {
      cancelled = true;
    };
  }, [photoId, photoLng, photoLat, rangeMeters, pitchDegrees, terrainProvider]);

  if (terrainProvider === 'pending') {
    return (
      <div className="grid h-full w-full place-items-center bg-black font-body text-gray-300">
        Loading terrain…
      </div>
    );
  }

  // Lower index = wider range, so "+" (zoom in) steps the index up.
  const canZoomIn = zoomLevelIndex < ZOOM_LEVELS.length - 1;
  const canZoomOut = zoomLevelIndex > 0;

  return (
    <div className="relative h-full w-full">
      {/* The zoom level only drives the photo fly-to, so the control is dead
          weight until a photo is selected — hide it until then. */}
      {selectedPhoto ? (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-neon-blue-50 bg-black/80 px-2 py-1 font-body text-white shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => setZoomLevelIndex((index) => index - 1)}
            disabled={!canZoomOut}
            aria-label="Zoom out photo view"
            className="rounded-full bg-black/70 px-3 py-1 text-lg leading-none transition-colors hover:bg-neon-blue-50 hover:text-neon-blue-bright disabled:pointer-events-none disabled:opacity-30"
          >
            −
          </button>
          <span className="min-w-14 text-center text-xs tabular-nums">
            {formatRange(rangeMeters)}
          </span>
          <button
            type="button"
            onClick={() => setZoomLevelIndex((index) => index + 1)}
            disabled={!canZoomIn}
            aria-label="Zoom in photo view"
            className="rounded-full bg-black/70 px-3 py-1 text-lg leading-none transition-colors hover:bg-neon-blue-50 hover:text-neon-blue-bright disabled:pointer-events-none disabled:opacity-30"
          >
            +
          </button>
        </div>
      ) : null}
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
    </div>
  );
}
