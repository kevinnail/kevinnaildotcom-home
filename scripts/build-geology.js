// Builds the static geology layer for the backpacking globe from the USGS source
// data downloaded into geology-source/ (gitignored). Re-runnable: every run
// rewrites public/data/geology/ from the source.
//
// Source: the 2021 GeMS release of USGS SIM 3186 (Peters and others,
// doi:10.5066/P9IYBCRI), as shapefiles. Needs GDAL's ogr2ogr, which on Windows
// runs through WSL.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyMapUnit,
  glaciationForLineType,
  hexFromSourceRgb,
  yearsClassForAgeKa,
  mapUnitClassById,
  GLACIAL_ICE,
  SURFACE_DEPOSITS,
  UNDATED_VOLCANIC,
} from '../src/utils/geologyAge.js';
import { deriveAgeWindows, isColorableAgeWindow } from '../src/utils/geologyAgeWindows.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Relative to the repo root with forward slashes, so the same path works when
// ogr2ogr runs inside WSL.
const SHAPEFILE_DIRECTORY =
  'geology-source/ThreeSisters_sim3186_shapefiles/ThreeSisters_sim3186_shapefiles';
const OUTPUT_DIRECTORY = path.join(repoRoot, 'public', 'data', 'geology');
// Ages from the unit descriptions and the layering between units, reviewed by
// hand. See src/utils/geologyAgeWindows.js.
const AGE_EVIDENCE_PATH = path.join(repoRoot, 'scripts', 'geology-age-evidence.json');

// The source gives unit L no name, age, or description, so there is nothing to
// color it by.
const UNITS_WITHOUT_DESCRIPTION = new Set(['L']);

const MORAINE_LINE_TYPE_PREFIX = 'moraine crest';

// Simplification tolerance, in the source's units (meters), applied before
// reprojection. Thins the polygon outlines, which is most of what the browser
// has to download and tessellate, without moving any edge more than 5 m: finer
// than a 1:24,000 map is drawn to. Each polygon is simplified on its own, so a
// shared boundary can open a gap or overlap of up to that much.
const SIMPLIFY_TOLERANCE_METERS = '5';

// Reprojects a shapefile from NAD83 / UTM 10N to WGS84 lat/lng and returns it as
// parsed GeoJSON. Five decimal places is about 1 m, still inside the 1:24,000
// source accuracy.
function readShapefileAsGeoJson(shapefileName, { simplify = false } = {}) {
  const ogr2ogrArguments = [
    '-f',
    'GeoJSON',
    '-t_srs',
    'EPSG:4326',
    '-lco',
    'COORDINATE_PRECISION=5',
    ...(simplify ? ['-simplify', SIMPLIFY_TOLERANCE_METERS] : []),
    '/vsistdout/',
    `${SHAPEFILE_DIRECTORY}/${shapefileName}`,
  ];
  // --exec runs ogr2ogr directly rather than through the WSL shell, so no
  // argument is re-split or re-quoted on the way in.
  const [command, ...commandArguments] =
    process.platform === 'win32'
      ? ['wsl', '--exec', 'ogr2ogr', ...ogr2ogrArguments]
      : ['ogr2ogr', ...ogr2ogrArguments];
  const output = execFileSync(command, commandArguments, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return JSON.parse(output);
}

function readLabSamples() {
  const source = readShapefileAsGeoJson('GeochronPoints.shp');
  return source.features.map(({ properties }) => {
    if (properties.AgeUnits !== 'ka') {
      throw new Error(`Lab sample ${properties.FieSamID} is in "${properties.AgeUnits}", not ka`);
    }
    return {
      unit: properties.MapUnit,
      ageKa: properties.NumericAge,
      errorKa: properties.AgePluErr,
    };
  });
}

// Years mode color for one unit: the ramp color if its age is known closely
// enough, otherwise the neutral for its kind. Inferred ages (bracketed by
// neighbors) are flagged so the layer can draw them fainter than dated ones.
function yearsStyleFor(classId, ageWindow) {
  if (classId === GLACIAL_ICE.id || classId === SURFACE_DEPOSITS.id) {
    return { yearsColor: mapUnitClassById(classId).color, isAgeInferred: false };
  }
  if (!isColorableAgeWindow(ageWindow)) {
    return { yearsColor: UNDATED_VOLCANIC.color, isAgeInferred: false };
  }
  return {
    yearsColor: yearsClassForAgeKa(ageWindow.bestKa).color,
    isAgeInferred: ageWindow.method === 'bracketed',
  };
}

function buildMapUnits() {
  const source = readShapefileAsGeoJson('MapUnitPolys.shp', { simplify: true });
  const volcanicUnitCodes = new Set();
  for (const { properties } of source.features) {
    if (UNITS_WITHOUT_DESCRIPTION.has(properties.MapUnit)) continue;
    const classId = classifyMapUnit({
      ageLabel: properties.Age,
      hierarchyKey: properties.HKey,
      geoMaterial: properties.GeoMat,
    });
    if (classId !== GLACIAL_ICE.id && classId !== SURFACE_DEPOSITS.id) {
      volcanicUnitCodes.add(properties.MapUnit);
    }
  }
  const ageWindows = deriveAgeWindows({
    unitCodes: [...volcanicUnitCodes],
    samples: readLabSamples(),
    evidence: JSON.parse(readFileSync(AGE_EVIDENCE_PATH, 'utf8')),
  });

  const unitsByClass = new Map();
  const features = [];
  for (const feature of source.features) {
    const {
      MapUnit: unit,
      Age: ageLabel,
      HKey: hierarchyKey,
      GeoMat: geoMaterial,
      RGB: sourceRgb,
    } = feature.properties;
    if (UNITS_WITHOUT_DESCRIPTION.has(unit)) continue;
    const classId = classifyMapUnit({ ageLabel, hierarchyKey, geoMaterial });
    // The plate prints glacial ice white, which vanishes over the snow in the
    // imagery, so ice keeps its pale blue in both color modes.
    const plateColor = classId === GLACIAL_ICE.id ? GLACIAL_ICE.color : hexFromSourceRgb(sourceRgb);
    if (!unitsByClass.has(classId)) unitsByClass.set(classId, new Set());
    unitsByClass.get(classId).add(unit);
    features.push({
      type: 'Feature',
      properties: { unit, classId, plateColor, ...yearsStyleFor(classId, ageWindows.get(unit)) },
      geometry: feature.geometry,
    });
  }
  return { collection: { type: 'FeatureCollection', features }, unitsByClass, ageWindows };
}

function buildMoraines() {
  const source = readShapefileAsGeoJson('GeologicLines.shp');
  const linesByGlaciation = new Map();
  const features = [];
  for (const feature of source.features) {
    const lineType = feature.properties.Type;
    if (!lineType?.startsWith(MORAINE_LINE_TYPE_PREFIX)) continue;
    const glaciationId = glaciationForLineType(lineType);
    linesByGlaciation.set(glaciationId, (linesByGlaciation.get(glaciationId) ?? 0) + 1);
    features.push({ type: 'Feature', properties: { glaciationId }, geometry: feature.geometry });
  }
  return { collection: { type: 'FeatureCollection', features }, linesByGlaciation };
}

function writeCollection(fileName, collection) {
  const contents = JSON.stringify(collection);
  writeFileSync(path.join(OUTPUT_DIRECTORY, fileName), contents);
  const megabytes = (Buffer.byteLength(contents) / 1024 / 1024).toFixed(2);
  console.info(`${fileName}: ${collection.features.length} features, ${megabytes} MB`);
}

const mapUnits = buildMapUnits();
const moraines = buildMoraines();

mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
writeCollection('units.geojson', mapUnits.collection);
writeCollection('moraines.geojson', moraines.collection);

for (const [classId, units] of mapUnits.unitsByClass) {
  console.info(`  ${classId}: ${units.size} units (${[...units].sort().join(', ')})`);
}
const unitsByAgeMethod = new Map();
for (const [unit, ageWindow] of mapUnits.ageWindows) {
  const key = isColorableAgeWindow(ageWindow)
    ? ageWindow.method
    : `${ageWindow.method} (not colored)`;
  unitsByAgeMethod.set(key, [...(unitsByAgeMethod.get(key) ?? []), unit]);
}
for (const [method, units] of unitsByAgeMethod) {
  console.info(`  years mode, ${method}: ${units.length} units`);
}
for (const [glaciationId, lineCount] of moraines.linesByGlaciation) {
  console.info(`  moraine crests ${glaciationId}: ${lineCount} lines`);
}
