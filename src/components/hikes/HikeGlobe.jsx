import { useCallback, useEffect, useRef, useState } from 'react';
import { Viewer, KmlDataSource, Entity } from 'resium';
import {
  createWorldTerrainAsync,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  BoundingSphere,
  HeadingPitchRange,
  HeightReference,
  LabelStyle,
  Matrix4,
  Transforms,
  VerticalOrigin,
  sampleTerrainMostDetailed,
  Math as CesiumMath,
} from 'cesium';
import '../../utils/cesiumIon';
import { isGeotagged } from '../../utils/hikePhotos';
import { FEET_PER_METER, formatFeet } from '../../utils/routeFormat';
import { isInGeologyMapArea } from '../../utils/geologyAge';
import { fetchTripLocations } from '../../utils/kmlLocation';
import useIsDesktop from '../../hooks/useIsDesktop';
import GeologyLayer from './GeologyLayer';
import HikeInfoPanel from './HikeInfoPanel';

// Fly-to framing used for every photo, so each pin gets the same, predictable
// view instead of inheriting whatever zoom/tilt the user left. The user picks a
// level with the +/− buttons and it sticks across photos, so stepping to the
// next pin keeps the framing they chose rather than snapping back to a default.
// - rangeFeet: how far the camera sits from the pin, in round miles or feet so
//   the label beside the buttons reads cleanly. Widest level first.
// - pitchDegrees: viewing angle, measured downward from horizontal (0 = level,
//   -90 = straight down). It steepens as the range closes: a shallow oblique is
//   readable from far out, but up close it drags the camera down into whatever
//   ridge sits between it and the pin, so we look further over the top instead.
const FEET_PER_MILE = 5280;
const ZOOM_LEVELS = [
  { rangeFeet: 25 * FEET_PER_MILE, pitchDegrees: -20 },
  { rangeFeet: 15 * FEET_PER_MILE, pitchDegrees: -20 },
  { rangeFeet: 8 * FEET_PER_MILE, pitchDegrees: -20 },
  { rangeFeet: 4 * FEET_PER_MILE, pitchDegrees: -30 },
  { rangeFeet: 1.5 * FEET_PER_MILE, pitchDegrees: -38 },
  { rangeFeet: 1500, pitchDegrees: -45 },
];
const DEFAULT_ZOOM_LEVEL_INDEX = ZOOM_LEVELS.findIndex(
  (level) => level.rangeFeet === 8 * FEET_PER_MILE,
);

// Framing for the route overview flown on trip select. Heading 0 is north-up so
// every hike is introduced from the same orientation, and range 0 tells Cesium to
// derive the distance from the route's own bounding sphere — the whole trail
// fills the view whether it's a two-mile loop or a fifty-mile traverse.
const TRIP_OVERVIEW_PITCH_DEGREES = -50;
const TRIP_OVERVIEW_DURATION_SECONDS = 2;

// "All hikes" overview: pitched near straight-down so widely separated ranges sit
// in one frame without the near ones hiding the far ones behind terrain. Range 0
// lets Cesium derive the distance from the pins' own bounding sphere; a lone pin
// has no extent to derive from, so it gets a fixed range instead.
const ALL_ROUTES_PITCH_DEGREES = -75;
const ALL_ROUTES_DURATION_SECONDS = 2.5;
const SINGLE_PIN_RANGE_METERS = 60000;

// The overview pin's label sits above its dot rather than on it.
const PIN_LABEL_OFFSET = new Cartesian2(0, -16);

// Overview pins are the primary way into a hike on a phone, where the target is a
// fingertip rather than a cursor. Cesium picks the label as readily as the point,
// so growing both widens one hit area rather than creating two.
const PIN_POINT_PIXEL_SIZE = { desktop: 16, touch: 24 };
const PIN_LABEL_FONT = {
  desktop: '15px "Open Sans", sans-serif',
  touch: '19px "Open Sans", sans-serif',
};

// On a phone the open photo dock covers the bottom of the globe: at most 40% of
// the screen plus 1rem of padding above and below it, HikePhotoDock's
// max-h-[40vh] and p-4. If the dock's size changes, change this with it.
function phoneDockHeightPixels() {
  return window.innerHeight * 0.4 + 32;
}

// Stable empty list, so "no pins on screen" never looks like a change to the
// effect that frames them.
const NO_PINS = [];

// Whether any point of a loaded KML route falls inside the area the USGS geology
// map covers. Checks the route's own lines and placemarks rather than the
// overview pin, which is only the first coordinate in the file.
function routeTouchesGeologyMapArea(dataSource) {
  for (const entity of dataSource.entities.values) {
    const positions = [
      ...(entity.polyline?.positions?.getValue() ?? []),
      ...(entity.position ? [entity.position.getValue()] : []),
    ];
    for (const position of positions) {
      if (!position) continue;
      const cartographic = Cartographic.fromCartesian(position);
      if (!cartographic) continue;
      const point = {
        lng: CesiumMath.toDegrees(cartographic.longitude),
        lat: CesiumMath.toDegrees(cartographic.latitude),
      };
      if (isInGeologyMapArea(point)) return true;
    }
  }
  return false;
}

// Whole miles without a trailing ".0", so the levels read 25 mi and 1.5 mi.
const rangeMilesFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

// Miles, or feet under a mile.
function formatRange(rangeFeet) {
  return rangeFeet >= FEET_PER_MILE
    ? `${rangeMilesFormat.format(rangeFeet / FEET_PER_MILE)} mi`
    : formatFeet(rangeFeet);
}

export default function HikeGlobe({
  selectedTrip,
  selectedPhoto,
  trips,
  isShowingAllRoutes,
  isPhotoViewOpen,
  onSelectTrip,
  onReadyChange,
}) {
  const [viewer, setViewer] = useState(null);
  // Stable identity: a fresh callback each render would detach and reattach the
  // ref on every render.
  const handleViewerRef = useCallback((instance) => {
    setViewer(instance?.cesiumElement ?? null);
  }, []);
  // 'pending' until the async terrain resolves; then the provider (3D relief) or
  // null (fall back to the flat ellipsoid if terrain fails, e.g. missing token).
  const [terrainProvider, setTerrainProvider] = useState('pending');
  const [zoomLevelIndex, setZoomLevelIndex] = useState(DEFAULT_ZOOM_LEVEL_INDEX);
  const [isHoveringPin, setIsHoveringPin] = useState(false);
  // Geology layers: null until first switched on, then true or false. See
  // GeologyLayer for why null is distinct from false.
  const [mapUnitsVisibility, setMapUnitsVisibility] = useState(null);
  const [morainesVisibility, setMorainesVisibility] = useState(null);
  const [geologyColorMode, setGeologyColorMode] = useState('plate');
  const [hasGeologyLoadError, setHasGeologyLoadError] = useState(false);
  const handleGeologyLoadError = useCallback(() => setHasGeologyLoadError(true), []);
  // The id of the open trip once its route has loaded and been found to cross
  // the geology map, which only covers the Three Sisters. From the whole-globe
  // overview, or on a hike elsewhere, the layer would be too small or too far
  // away to see, so the panel is only offered while such a hike is open.
  const [geologyMapTripId, setGeologyMapTripId] = useState(null);
  // One { trip, lng, lat } per hike, read out of the KML files, for the overview.
  // Stored alongside the trips it was derived from so a result that no longer
  // matches the current trips is simply ignored, rather than cleared by an effect.
  const [pinResult, setPinResult] = useState(null);
  const fetchedTripsRef = useRef(null);
  const isDesktop = useIsDesktop();
  const { rangeFeet, pitchDegrees } = ZOOM_LEVELS[zoomLevelIndex];
  const rangeMeters = rangeFeet / FEET_PER_METER;
  const pinSizing = isDesktop ? 'desktop' : 'touch';

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
  const handleTripRouteLoad = useCallback(
    (dataSource, tripId) => {
      setGeologyMapTripId(routeTouchesGeologyMapArea(dataSource) ? tripId : null);
      if (!viewer) return;
      viewer.flyTo(dataSource, {
        duration: TRIP_OVERVIEW_DURATION_SECONDS,
        offset: new HeadingPitchRange(0, CesiumMath.toRadians(TRIP_OVERVIEW_PITCH_DEGREES), 0),
      });
    },
    [viewer],
  );

  // Overview mode reads one coordinate out of each trip's KML instead of loading
  // the files into the scene. This runs on mount now that the overview is the
  // landing state, and again only if the trips themselves change.
  useEffect(() => {
    if (!isShowingAllRoutes || trips.length === 0) return undefined;
    // Leaving and re-entering the overview reuses what was already read; only a
    // new trips array is worth fetching for.
    if (fetchedTripsRef.current === trips) return undefined;
    fetchedTripsRef.current = trips;
    // No cancellation guard: the result is stored with the trips it came from, so
    // one that lands after the user has left the overview is just cached for the
    // next entry rather than something to throw away.
    fetchTripLocations(trips).then((located) => setPinResult({ trips, pins: located }));
    return undefined;
  }, [isShowingAllRoutes, trips]);

  // Empty unless the overview is open and the pins belong to the current trips,
  // which is also what makes re-entering the overview re-frame the camera: the
  // list flips back from empty to the same pins and the fly-to below re-runs.
  const tripPins = isShowingAllRoutes && pinResult?.trips === trips ? pinResult.pins : NO_PINS;

  // fetchTripLocations resolves with whatever it could read, so a trip with an
  // unreachable KML would otherwise stall the page on "loading" forever.
  const hasResolvedOverviewPins = pinResult?.trips === trips;
  const isGlobeReady =
    terrainProvider !== 'pending' &&
    viewer != null &&
    (!isShowingAllRoutes || trips.length === 0 || hasResolvedOverviewPins);

  useEffect(() => {
    onReadyChange?.(isGlobeReady);
  }, [isGlobeReady, onReadyChange]);

  // Frame every pin at once, after they've all resolved. Flying per pin would yank
  // the camera once per hike as the KMLs trickle in. This is the page's opening
  // shot as well as the "show all hikes" flight — whichever of the viewer and the
  // pins arrives second triggers it, so the visitor never lands on the raw globe
  // with every hike stacked on one another.
  useEffect(() => {
    if (!viewer || tripPins.length === 0) return;
    const pinPositions = tripPins.map((pin) => Cartesian3.fromDegrees(pin.lng, pin.lat));
    viewer.camera.flyToBoundingSphere(BoundingSphere.fromPoints(pinPositions), {
      duration: ALL_ROUTES_DURATION_SECONDS,
      offset: new HeadingPitchRange(
        0,
        CesiumMath.toRadians(ALL_ROUTES_PITCH_DEGREES),
        pinPositions.length > 1 ? 0 : SINGLE_PIN_RANGE_METERS,
      ),
    });
  }, [tripPins, viewer]);

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
  // Opening or closing the dock on a phone re-frames the photo, so the pin moves
  // out from under the dock and back to the middle when it closes.
  const isDockCoveringGlobe = !isDesktop && isPhotoViewOpen;
  useEffect(() => {
    if (photoId == null || !viewer) return undefined;
    let cancelled = false;

    function flyToGroundTarget(targetHeightMeters) {
      if (cancelled) return;
      const { camera } = viewer;
      const target = Cartesian3.fromDegrees(photoLng, photoLat, targetHeightMeters);
      const { heading } = camera;
      const pitch = CesiumMath.toRadians(pitchDegrees);
      // The camera sits back along its line of sight to the pin, at the zoom
      // level's range and pitch, in the pin's east-north-up frame.
      const lineOfSight = new Cartesian3(
        Math.sin(heading) * Math.cos(pitch),
        Math.cos(heading) * Math.cos(pitch),
        Math.sin(pitch),
      );
      const cameraOffset = Matrix4.multiplyByPointAsVector(
        Transforms.eastNorthUpToFixedFrame(target),
        Cartesian3.multiplyByScalar(lineOfSight, -rangeMeters, new Cartesian3()),
        new Cartesian3(),
      );
      // From that same spot, look further down by the angle that lifts the pin
      // half the dock's height up the screen, to the middle of the globe left
      // above the dock.
      const dockTiltRadians = isDockCoveringGlobe
        ? Math.atan(
            (phoneDockHeightPixels() / viewer.canvas.clientHeight) *
              Math.tan(camera.frustum.fovy / 2.5),
          )
        : 0;
      camera.flyTo({
        destination: Cartesian3.add(target, cameraOffset, new Cartesian3()),
        orientation: { heading, pitch: pitch - dockTiltRadians, roll: 0 },
        duration: 1.2,
      });
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
  }, [
    photoId,
    photoLng,
    photoLat,
    rangeMeters,
    pitchDegrees,
    isDockCoveringGlobe,
    terrainProvider,
    viewer,
  ]);

  if (terrainProvider === 'pending') {
    return (
      <div className="grid h-full w-full place-items-center bg-black font-body text-gray-300">
        Loading terrain…
      </div>
    );
  }

  const isGeologyAvailable =
    !isShowingAllRoutes && selectedTrip != null && geologyMapTripId === selectedTrip.id;
  // Layers already switched on hide while geology is unavailable and come back as
  // they were on the next hike that crosses the map. A layer never switched on
  // stays null, so it still isn't downloaded.
  const visibleWhenAvailable = (visibility) =>
    isGeologyAvailable || visibility == null ? visibility : false;

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
        isShowingAllRoutes && isHoveringPin ? 'cursor-pointer' : ''
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
            {formatRange(rangeFeet)}
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
      {/* On a phone the open photo dock fills most of the globe, and the panel
          would sit on top of it and its close button, so it steps aside until
          the dock closes. Any geology layers stay on the map. */}
      {!isShowingAllRoutes && selectedTrip && (isDesktop || !isPhotoViewOpen) && (
        <HikeInfoPanel
          trip={selectedTrip}
          geology={
            isGeologyAvailable
              ? {
                  isMapUnitsOn: mapUnitsVisibility === true,
                  isMorainesOn: morainesVisibility === true,
                  colorMode: geologyColorMode,
                  onToggleMapUnits: () => setMapUnitsVisibility((visibility) => !visibility),
                  onToggleMoraines: () => setMorainesVisibility((visibility) => !visibility),
                  onChangeColorMode: setGeologyColorMode,
                  hasLoadError: hasGeologyLoadError,
                }
              : null
          }
        />
      )}
      <Viewer
        ref={handleViewerRef}
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
        // idle.
        //
        // maximumRenderTimeChange is the escape hatch from that: a render is also
        // requested once the clock has advanced this many seconds since the last
        // one. It is a HEARTBEAT, not a cap — HIGHER values render less, and
        // Infinity disables it entirely (`difference > maximumRenderTimeChange` is
        // never true). It was Infinity here, which broke the first hike on a cold
        // load: the KML pushpin is a CLAMP_TO_GROUND billboard, and its clamp is
        // resolved against whatever terrain happens to be loaded at that instant.
        // On the opening fly-to that terrain is still streaming, so the pin lands
        // near the ellipsoid — sea level, ~1,500 m under the plateau. Once the
        // camera stopped, nothing re-rendered, so the clamp was never re-resolved
        // and the pin sat at sea level swimming with parallax. Switching hikes hid
        // it, because by the second fly-to the terrain was already cached.
        // A finite value lets the scene settle after tiles land.
        requestRenderMode
        maximumRenderTimeChange={1}
      >
        <GeologyLayer
          mapUnitsVisibility={visibleWhenAvailable(mapUnitsVisibility)}
          morainesVisibility={visibleWhenAvailable(morainesVisibility)}
          colorMode={geologyColorMode}
          onLoadError={handleGeologyLoadError}
        />
        {/* Overview draws pins only — the routes themselves belong to the single-trip
            view, which is what clicking a pin opens. */}
        {isShowingAllRoutes
          ? tripPins.map(({ trip, lng, lat }) => (
              <Entity
                key={trip.id}
                position={Cartesian3.fromDegrees(lng, lat)}
                onClick={() => onSelectTrip(trip.id)}
                onMouseEnter={() => setIsHoveringPin(true)}
                onMouseLeave={() => setIsHoveringPin(false)}
                point={{
                  pixelSize: PIN_POINT_PIXEL_SIZE[pinSizing],
                  color: Color.fromCssColorString('#4fd2ff'),
                  outlineColor: Color.WHITE,
                  outlineWidth: 2,
                  heightReference: HeightReference.CLAMP_TO_GROUND,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                }}
                label={{
                  text: trip.name,
                  font: PIN_LABEL_FONT[pinSizing],
                  fillColor: Color.WHITE,
                  outlineColor: Color.BLACK,
                  outlineWidth: 3,
                  // Satellite imagery is busy and every shade of it turns up under
                  // these pins, so the text carries its own dark outline rather
                  // than relying on contrast with whatever is behind it.
                  style: LabelStyle.FILL_AND_OUTLINE,
                  pixelOffset: PIN_LABEL_OFFSET,
                  verticalOrigin: VerticalOrigin.BOTTOM,
                  heightReference: HeightReference.CLAMP_TO_GROUND,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                }}
              />
            ))
          : selectedTrip && (
              <KmlDataSource
                key={selectedTrip.id}
                data={selectedTrip.url}
                clampToGround
                onLoad={(dataSource) => handleTripRouteLoad(dataSource, selectedTrip.id)}
              />
            )}
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
