import { useCallback, useEffect, useRef, useState } from 'react';
import { Viewer, KmlDataSource, Entity, ScreenSpaceEventHandler, ScreenSpaceEvent } from 'resium';
import {
  Ion,
  createWorldTerrainAsync,
  Cartesian3,
  Cartographic,
  Color,
  BoundingSphere,
  HeadingPitchRange,
  HeightReference,
  ScreenSpaceEventType,
  sampleTerrainMostDetailed,
  Math as CesiumMath,
} from 'cesium';
import { isGeotagged } from '../../lib/hikePhotos';

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

// Framing for the route overview flown on trip select. Heading 0 is north-up so
// every hike is introduced from the same orientation, and range 0 tells Cesium to
// derive the distance from the route's own bounding sphere — the whole trail
// fills the view whether it's a two-mile loop or a fifty-mile traverse.
const TRIP_OVERVIEW_PITCH_DEGREES = -50;
const TRIP_OVERVIEW_DURATION_SECONDS = 2;

// "All hikes" overview: pitched near straight-down so widely separated ranges sit
// in one frame without the near ones hiding the far ones behind terrain.
const ALL_ROUTES_PITCH_DEGREES = -75;
const ALL_ROUTES_DURATION_SECONDS = 2.5;

// Picking a trail is picking a line a few pixels wide, so widen the pick rectangle
// — a cursor that has to land exactly on the stroke makes the routes feel inert.
const ROUTE_PICK_TOLERANCE_PIXELS = 12;

function formatRange(rangeMeters) {
  return rangeMeters >= 1000 ? `${(rangeMeters / 1000).toFixed(1)} km` : `${rangeMeters} m`;
}

export default function HikeGlobe({
  selectedTrip,
  selectedPhoto,
  trips,
  isShowingAllRoutes,
  onSelectTrip,
}) {
  const viewerRef = useRef(null);
  // Which trip each loaded overview route belongs to, keyed by its Cesium
  // DataSource. A click gives us an Entity; its collection's owner is the data
  // source, so this map is what turns a picked trail back into a trip id.
  const routeTripIdsRef = useRef(new Map());
  // 'pending' until the async terrain resolves; then the provider (3D relief) or
  // null (fall back to the flat ellipsoid if terrain fails, e.g. missing token).
  const [terrainProvider, setTerrainProvider] = useState('pending');
  const [zoomLevelIndex, setZoomLevelIndex] = useState(DEFAULT_ZOOM_LEVEL_INDEX);
  const [isHoveringRoute, setIsHoveringRoute] = useState(false);
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

  // Frame the whole route once its KML finishes loading. Selecting a hike while
  // zoomed into a previous one otherwise leaves the camera pointed at unrelated
  // terrain with no clue where the new trail went. Driven by onLoad rather than a
  // selectedTrip effect because the entities don't exist — and so have no bounding
  // sphere to fly to — until the KML resolves.
  const handleTripRouteLoad = useCallback((dataSource) => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    viewer.flyTo(dataSource, {
      duration: TRIP_OVERVIEW_DURATION_SECONDS,
      offset: new HeadingPitchRange(0, CesiumMath.toRadians(TRIP_OVERVIEW_PITCH_DEGREES), 0),
    });
  }, []);

  // Overview mode loads every route at once. Each KML resolves on its own, so we
  // wait until the last one lands and then fly to all of their entities together —
  // Viewer.flyTo unions the bounding spheres for us. Flying on each load instead
  // would yank the camera once per hike as they trickle in.
  const handleAllRoutesLoad = useCallback(
    (tripId, dataSource) => {
      const viewer = viewerRef.current?.cesiumElement;
      if (!viewer) return;
      routeTripIdsRef.current.set(dataSource, tripId);
      if (routeTripIdsRef.current.size < trips.length) return;

      const allRouteEntities = [...routeTripIdsRef.current.keys()].flatMap(
        (loadedSource) => loadedSource.entities.values,
      );
      if (allRouteEntities.length === 0) return;
      viewer.flyTo(allRouteEntities, {
        duration: ALL_ROUTES_DURATION_SECONDS,
        offset: new HeadingPitchRange(0, CesiumMath.toRadians(ALL_ROUTES_PITCH_DEGREES), 0),
      });
    },
    [trips.length],
  );

  // The map is only stale once the routes it describes are unmounted, which is
  // exactly when the mode flips.
  useEffect(() => {
    routeTripIdsRef.current = new Map();
  }, [isShowingAllRoutes]);

  function tripIdForPickedObject(pickedObject) {
    const owningDataSource = pickedObject?.id?.entityCollection?.owner;
    if (!owningDataSource) return null;
    return routeTripIdsRef.current.get(owningDataSource) ?? null;
  }

  function handleOverviewClick(movement) {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const picked = viewer.scene.pick(
      movement.position,
      ROUTE_PICK_TOLERANCE_PIXELS,
      ROUTE_PICK_TOLERANCE_PIXELS,
    );
    const tripId = tripIdForPickedObject(picked);
    if (tripId != null) onSelectTrip(tripId);
  }

  // Without a cursor change the trails give no sign they're clickable. The cursor
  // rides on the wrapper element rather than the canvas so it stays React state
  // instead of a manual DOM mutation.
  function handleOverviewHover(movement) {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const picked = viewer.scene.pick(
      movement.endPosition,
      ROUTE_PICK_TOLERANCE_PIXELS,
      ROUTE_PICK_TOLERANCE_PIXELS,
    );
    setIsHoveringRoute(tripIdForPickedObject(picked) != null);
  }

  // Recenter the camera on the selected photo — a deliberate response to a photo
  // click. Selecting a trip clears the photo, so this never races the route
  // overview flight above.
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
  // Null unless the photo can actually be placed, so a non-geotagged selection
  // never triggers a fly-to (its coords would be undefined).
  const photoId = isGeotagged(selectedPhoto) ? selectedPhoto.id : null;
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
  // Only a geotagged photo has a spot on the globe, so the pin and the zoom
  // control (which only reframes that spot) appear solely for those.
  const hasPhotoLocation = isGeotagged(selectedPhoto);

  return (
    // Gating on the mode as well as the hover means a hover left over from a
    // previous overview session can't strand the pointer cursor.
    <div
      className={`relative h-full w-full ${
        isShowingAllRoutes && isHoveringRoute ? 'cursor-pointer' : ''
      }`}
    >
      {/* The zoom level only drives the photo fly-to, so the control is dead
          weight until a photo is selected — hide it until then. */}
      {hasPhotoLocation ? (
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
        // Clicking a route selects the hike and nothing else — Cesium's default
        // response of popping the KML's description panel and a crosshair over the
        // entity is not what a click means here.
        infoBox={false}
        selectionIndicator={false}
        // Only render when the scene changes (camera move, data load, tile stream-in)
        // instead of every animation frame. Without this Cesium pins a CPU core at
        // idle. maximumRenderTimeChange caps how long a static scene goes without a
        // render so terrain/imagery tiles still resolve after they arrive.
        requestRenderMode
        maximumRenderTimeChange={Infinity}
      >
        {isShowingAllRoutes
          ? trips.map((trip) => (
              <KmlDataSource
                key={trip.id}
                data={trip.url}
                clampToGround
                onLoad={(dataSource) => handleAllRoutesLoad(trip.id, dataSource)}
              />
            ))
          : selectedTrip && (
              <KmlDataSource
                key={selectedTrip.id}
                data={selectedTrip.url}
                clampToGround
                onLoad={handleTripRouteLoad}
              />
            )}
        {isShowingAllRoutes ? (
          <ScreenSpaceEventHandler>
            <ScreenSpaceEvent action={handleOverviewClick} type={ScreenSpaceEventType.LEFT_CLICK} />
            <ScreenSpaceEvent action={handleOverviewHover} type={ScreenSpaceEventType.MOUSE_MOVE} />
          </ScreenSpaceEventHandler>
        ) : null}
        {hasPhotoLocation && !isShowingAllRoutes ? (
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
