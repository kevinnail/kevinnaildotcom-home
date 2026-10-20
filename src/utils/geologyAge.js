// Age classes for the Three Sisters geology layer (USGS SIM 3186, Hildreth,
// Fierstein, and Calvert 2012; database by Peters and others 2021).
//
// The layer has two color modes. "Map units" uses the printed plate's own color
// for every unit. "Age" uses the bands below: every map unit carries an epoch
// label from the source ("late Pleistocene"), but only about half have a lab
// date, so age mode colors by the label, which makes one kind of claim
// everywhere, and exact dates are left to the info box.
//
// Plain-language ranges use the epoch boundaries of the International
// Chronostratigraphic Chart: the Holocene begins 11,700 years ago, the late
// Pleistocene 129,000, the middle Pleistocene 774,000. "Latest Pleistocene" is the
// source's informal term for the end of the Pleistocene and has no fixed boundary.
//
// Ordered youngest first. Colors are samples of the perceptually uniform "plasma"
// ramp, bright for young and dark for old.
export const AGE_BANDS = [
  {
    id: 'holocene',
    sourceLabels: ['late Holocene', 'Holocene', 'early Holocene'],
    range: 'Last 11,700 years',
    epoch: 'Holocene',
    color: '#f0f921',
  },
  {
    id: 'holoceneOrLatestPleistocene',
    sourceLabels: ['early Holocene or latest Pleistocene'],
    range: 'Close to 11,700 years ago',
    epoch: 'Early Holocene or latest Pleistocene',
    color: '#fca636',
  },
  {
    id: 'latestPleistocene',
    sourceLabels: ['latest Pleistocene'],
    range: 'Shortly before 11,700 years ago',
    epoch: 'Latest Pleistocene',
    color: '#e16462',
  },
  {
    id: 'latePleistocene',
    sourceLabels: ['late Pleistocene'],
    range: '129,000 to 11,700 years ago',
    epoch: 'Late Pleistocene',
    color: '#b12a90',
  },
  {
    // North Sister is labelled "late and middle": its flows span the boundary.
    // The rest are "late or middle": one or the other, not pinned down.
    id: 'lateOrMiddlePleistocene',
    sourceLabels: ['late or middle Pleistocene', 'late and middle Pleistocene'],
    range: 'Either side of 129,000 years ago',
    epoch: 'Late or middle Pleistocene',
    color: '#6a00a8',
  },
  {
    id: 'middlePleistocene',
    sourceLabels: ['middle Pleistocene'],
    range: '774,000 to 129,000 years ago',
    epoch: 'Middle Pleistocene',
    color: '#0d0887',
  },
];

// Till, alluvium, landslides, and pumice are not eruptions, so they sit outside
// the age ramp in a quiet neutral that lets the lava stand out.
export const SURFACE_DEPOSITS = {
  id: 'surfaceDeposits',
  range: 'Glacial till, stream gravel, landslides, pumice',
  color: '#d6d3d1',
};

// Pale blue rather than white: the imagery already shows the ice as snow-white,
// and a white fill over it disappears.
export const GLACIAL_ICE = {
  id: 'glacialIce',
  range: 'Glacial ice',
  color: '#8ecbff',
};

// Legend order: the age ramp, then the non-eruptive classes.
export const MAP_UNIT_CLASSES = [...AGE_BANDS, SURFACE_DEPOSITS, GLACIAL_ICE];

// The rectangle the USGS map covers, in degrees, rounded outward from the extent
// of the built GeoJSON. The geology panel is offered only for hikes whose route
// passes through it.
export const GEOLOGY_MAP_AREA = { west: -121.949, south: 43.999, east: -121.625, north: 44.25 };

export function isInGeologyMapArea({ lng, lat }) {
  const { west, south, east, north } = GEOLOGY_MAP_AREA;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

// "Years" mode colors each volcanic unit by its age in years, from
// src/utils/geologyAgeWindows.js, in stepped ranges rather than a smooth ramp: half
// the dated units fall between about 19,000 and 59,000 years, and a smooth ramp
// over the full span gave that stretch too little color to tell neighbors apart.
// The ranges are narrowest where the ages bunch. Colors step through the
// "plasma" scale the epoch bands also sample, bright for young and dark for old,
// leaving out its near-black end, which vanishes over dark imagery.
//
// Ordered youngest first. Each range holds ages from the previous range's
// maxKa up to, but not including, its own.
export const YEARS_CLASSES = [
  { id: 'underHolocene', range: 'Under 11,700 years', maxKa: 11.7, color: '#f0f921' },
  { id: 'to20ka', range: '11,700 to 20,000', maxKa: 20, color: '#fdca26' },
  { id: 'to25ka', range: '20,000 to 25,000', maxKa: 25, color: '#fb9f3a' },
  { id: 'to30ka', range: '25,000 to 30,000', maxKa: 30, color: '#ed7953' },
  { id: 'to40ka', range: '30,000 to 40,000', maxKa: 40, color: '#d8576b' },
  { id: 'to60ka', range: '40,000 to 60,000', maxKa: 60, color: '#bd3786' },
  { id: 'to130ka', range: '60,000 to 130,000', maxKa: 130, color: '#9c179e' },
  { id: 'to300ka', range: '130,000 to 300,000', maxKa: 300, color: '#7201a8' },
  { id: 'over300ka', range: 'Over 300,000', maxKa: Infinity, color: '#46039f' },
];

// Volcanic units whose age cannot be pinned down closely enough to color.
export const UNDATED_VOLCANIC = {
  id: 'undatedVolcanic',
  range: 'Lava of uncertain age',
  color: '#78716c',
};

export function yearsClassForAgeKa(ageKa) {
  if (!(ageKa > 0)) throw new Error(`Unusable age "${ageKa}"`);
  return YEARS_CLASSES.find((yearsClass) => ageKa < yearsClass.maxKa);
}

// The source's own Description of Map Units groups every surficial deposit
// under this hierarchy key; the volcanic units sit in the next group.
const SURFICIAL_GROUP_PREFIX = '001-001-';

// Maps one source map unit to its legend class. An age label with no band is a
// data change this code has not accounted for, so it throws rather than letting
// a unit fall silently into the wrong color.
export function classifyMapUnit({ ageLabel, hierarchyKey, geoMaterial }) {
  if (hierarchyKey?.startsWith(SURFICIAL_GROUP_PREFIX)) {
    return geoMaterial === 'Water or ice' ? GLACIAL_ICE.id : SURFACE_DEPOSITS.id;
  }
  const band = AGE_BANDS.find((candidate) => candidate.sourceLabels.includes(ageLabel));
  if (!band) throw new Error(`No age band for source age label "${ageLabel}"`);
  return band.id;
}

// The source stores each unit's fill color from the printed plate as a
// "red, green, blue" string. Converts it to a CSS hex color.
export function hexFromSourceRgb(sourceRgb) {
  const channels = (sourceRgb ?? '').split(',').map((channel) => Number(channel.trim()));
  const isValid =
    channels.length === 3 &&
    channels.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255);
  if (!isValid) throw new Error(`Unreadable source RGB "${sourceRgb}"`);
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function mapUnitClassById(classId) {
  const mapUnitClass = MAP_UNIT_CLASSES.find((candidate) => candidate.id === classId);
  if (!mapUnitClass) throw new Error(`Unknown map unit class "${classId}"`);
  return mapUnitClass;
}

// Moraine crests, which the source types by the glaciation that built them. Ages
// are the ones given in the source's description of glacial deposits (unit g).
// Ordered youngest first. Saturated colors, drawn with a dark outline, so the
// lines hold up on snow, bare rock, and the lava fills alike. No white: it
// vanishes into the snow in the imagery.
export const GLACIATIONS = [
  {
    id: 'LIA',
    sourceType: 'moraine crest LIA',
    name: 'Little Ice Age',
    range: '1500 to 1900 C.E.',
    color: '#39ff14',
  },
  {
    id: 'NG',
    sourceType: 'moraine crest NG',
    name: 'Early Neoglacial',
    range: 'About 5,000 to 2,500 years ago',
    color: '#ffe600',
  },
  {
    id: 'YD',
    sourceType: 'moraine crest YD',
    name: 'Latest Pleistocene readvance',
    range: 'About 13,000 to 12,000 years ago',
    color: '#ff9500',
  },
  {
    id: 'LGM',
    sourceType: 'moraine crest LGM',
    name: 'Late Pleistocene, including the Last Glacial Maximum',
    range: 'About 25,000 to 17,000 years ago',
    color: '#b388ff',
  },
];

export function glaciationForLineType(lineType) {
  const glaciation = GLACIATIONS.find((candidate) => candidate.sourceType === lineType);
  if (!glaciation) throw new Error(`Unknown moraine line type "${lineType}"`);
  return glaciation.id;
}

export function glaciationById(glaciationId) {
  const glaciation = GLACIATIONS.find((candidate) => candidate.id === glaciationId);
  if (!glaciation) throw new Error(`Unknown glaciation "${glaciationId}"`);
  return glaciation;
}
