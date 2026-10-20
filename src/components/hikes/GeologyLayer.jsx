import { useCallback, useEffect, useRef } from 'react';
import { GeoJsonDataSource, useCesium } from 'resium';
import { Color, PolylineOutlineMaterialProperty } from 'cesium';
import { mapUnitClassById, glaciationById } from '../../utils/geologyAge';

// Built by scripts/build-geology.js from the USGS source data.
const MAP_UNITS_URL = '/data/geology/units.geojson';
const MORAINES_URL = '/data/geology/moraines.geojson';
const MAP_UNITS_NAME = 'geology-map-units';
const MORAINES_NAME = 'geology-moraines';

// Enough fill to read the colors, little enough that the satellite imagery, the
// ridgelines, and the hike routes still show through.
const MAP_UNIT_FILL_ALPHA = 0.5;
// Years mode draws an age inferred from the units above and below at half the
// fill of a measured one, so the two never read as equally certain.
const INFERRED_AGE_FILL_ALPHA = 0.25;
const MORAINE_WIDTH_PIXELS = 4;
const MORAINE_OUTLINE_WIDTH_PIXELS = 1;
const MORAINE_OUTLINE_COLOR = Color.fromCssColorString('#111111');

// Features clamped to terrain draw in data source order, and a geology layer is
// only added when first switched on, which is usually after the hike route. Push
// both to the bottom, map units beneath moraines, so the route stays on top.
function sendGeologyToBack(dataSources) {
  for (const name of [MORAINES_NAME, MAP_UNITS_NAME]) {
    const [dataSource] = dataSources.getByName(name);
    if (dataSource) dataSources.lowerToBottom(dataSource);
  }
}

// 'plate' is the printed USGS plate's own color per unit; 'age' is the unit's
// epoch band; 'years' is the unit's age in years, colored at build time.
function fillFor(properties, colorMode) {
  if (colorMode === 'plate') {
    return { cssColor: properties.plateColor.getValue(), alpha: MAP_UNIT_FILL_ALPHA };
  }
  if (colorMode === 'years') {
    const alpha = properties.isAgeInferred.getValue()
      ? INFERRED_AGE_FILL_ALPHA
      : MAP_UNIT_FILL_ALPHA;
    return { cssColor: properties.yearsColor.getValue(), alpha };
  }
  return {
    cssColor: mapUnitClassById(properties.classId.getValue()).color,
    alpha: MAP_UNIT_FILL_ALPHA,
  };
}

function styleMapUnits(dataSource, colorMode) {
  for (const entity of dataSource.entities.values) {
    const { cssColor, alpha } = fillFor(entity.properties, colorMode);
    entity.polygon.material = Color.fromCssColorString(cssColor).withAlpha(alpha);
  }
}

// Each layer's visibility is null until it is first switched on, so a visitor who
// never opens the geology never downloads it. After that, true and false only
// show and hide the loaded layer.
export default function GeologyLayer({
  mapUnitsVisibility,
  morainesVisibility,
  colorMode,
  onLoadError,
}) {
  const { scene, viewer } = useCesium();
  // Held so a color mode change can restyle the loaded polygons in place rather
  // than reloading the file.
  const mapUnitsDataSourceRef = useRef(null);

  // The globe renders on demand (requestRenderMode), so showing or hiding a data
  // source has to ask for the frame that makes the change visible.
  useEffect(() => {
    scene?.requestRender();
  }, [scene, mapUnitsVisibility, morainesVisibility]);

  useEffect(() => {
    if (!mapUnitsDataSourceRef.current) return;
    styleMapUnits(mapUnitsDataSourceRef.current, colorMode);
    scene?.requestRender();
  }, [colorMode, scene]);

  const handleMapUnitsLoad = useCallback(
    (dataSource) => {
      for (const entity of dataSource.entities.values) {
        // Cesium cannot draw outlines on polygons clamped to terrain.
        entity.polygon.outline = false;
      }
      styleMapUnits(dataSource, colorMode);
      mapUnitsDataSourceRef.current = dataSource;
      sendGeologyToBack(viewer.dataSources);
      scene?.requestRender();
    },
    [colorMode, scene, viewer],
  );

  const handleMorainesLoad = useCallback(
    (dataSource) => {
      for (const entity of dataSource.entities.values) {
        const { color } = glaciationById(entity.properties.glaciationId.getValue());
        entity.polyline.material = new PolylineOutlineMaterialProperty({
          color: Color.fromCssColorString(color),
          outlineColor: MORAINE_OUTLINE_COLOR,
          outlineWidth: MORAINE_OUTLINE_WIDTH_PIXELS,
        });
        entity.polyline.width = MORAINE_WIDTH_PIXELS;
      }
      sendGeologyToBack(viewer.dataSources);
      scene?.requestRender();
    },
    [scene, viewer],
  );

  const handleLoadError = useCallback(
    (_dataSource, error) => {
      console.error('Geology layer failed to load', error);
      onLoadError();
    },
    [onLoadError],
  );

  return (
    <>
      {mapUnitsVisibility != null && (
        <GeoJsonDataSource
          name={MAP_UNITS_NAME}
          data={MAP_UNITS_URL}
          clampToGround
          show={mapUnitsVisibility}
          onLoad={handleMapUnitsLoad}
          onError={handleLoadError}
        />
      )}
      {morainesVisibility != null && (
        <GeoJsonDataSource
          name={MORAINES_NAME}
          data={MORAINES_URL}
          clampToGround
          show={morainesVisibility}
          onLoad={handleMorainesLoad}
          onError={handleLoadError}
        />
      )}
    </>
  );
}
