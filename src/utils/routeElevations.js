import { createWorldTerrainAsync, sampleTerrainMostDetailed, Cartographic } from 'cesium';
import './cesiumIon';
import { parseKmlRouteLines, resampleRoute, buildRouteStats } from './routeStats';

const FEET_PER_METER = 3.28084;

async function groundHeightsFeet(points) {
  const terrainProvider = await createWorldTerrainAsync();
  const positions = points.map((point) => Cartographic.fromDegrees(point.lng, point.lat));
  await sampleTerrainMostDetailed(terrainProvider, positions, true);
  return positions.map((position, index) => {
    if (!Number.isFinite(position.height)) {
      throw new Error(`No terrain height at route point ${index}`);
    }
    return position.height * FEET_PER_METER;
  });
}

export async function measureKmlRoute(kmlText) {
  const lines = parseKmlRouteLines(kmlText);
  if (lines.length === 0) return null;
  const resampledLines = resampleRoute(lines);
  const heightsFeet = await groundHeightsFeet(resampledLines.flatMap((line) => line.samples));
  let offset = 0;
  const elevationsFeetByLine = resampledLines.map((line) => {
    const elevationsFeet = heightsFeet.slice(offset, offset + line.samples.length);
    offset += line.samples.length;
    return elevationsFeet;
  });
  return buildRouteStats(resampledLines, elevationsFeetByLine);
}
