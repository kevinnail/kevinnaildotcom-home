const EARTH_RADIUS_MILES = 3958.7613;

const FEET_PER_MILE = 5280;

export const ELEVATION_SPACING_FEET = 100;

export const MAXIMUM_ELEVATION_SAMPLES = 4000;

export const CLIMB_THRESHOLD_FEET = 16;

export const PROFILE_POINT_COUNT = 200;

const END_POINT_TOLERANCE_MILES = 0.0001;

const LINE_STRING_BLOCK = /<(?:\w+:)?LineString\b[\s\S]*?<\/(?:\w+:)?LineString>/gi;
const COORDINATES_TAG = /<(?:\w+:)?coordinates\b[^>]*>([\s\S]*?)</i;
const NAME_TAG = /<(?:\w+:)?name\b[^>]*>([\s\S]*?)<\/(?:\w+:)?name>/i;

// Every opening or closing tag, with its local name (namespace prefix dropped).
const TAG = /<(\/?)(?:[\w.-]+:)?([\w.-]+)\b[^>]*?(\/?)>/g;
// Features that can be switched off in Google Earth, hiding everything inside.
const FEATURE_TAGS = new Set(['Document', 'Folder', 'Placemark']);
// Description HTML and comments can contain anything, tags included.
const UNPARSED_SECTIONS = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g;

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXmlText(text) {
  return text
    .replace(/&#(\d+);/g, (_entity, code) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_entity, name) => XML_ENTITIES[name])
    .trim();
}

function toPoint(longitudeText, latitudeText) {
  if (!longitudeText?.trim() || !latitudeText?.trim()) return null;
  const lng = Number(longitudeText);
  const lat = Number(latitudeText);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lng, lat };
}

// LineString coordinates are "lng,lat[,alt]" tuples separated by whitespace.
function lineStringPoints(block) {
  const [, coordinatesText] = block.match(COORDINATES_TAG) ?? [];
  if (!coordinatesText) return [];
  return coordinatesText
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const [longitudeText, latitudeText] = tuple.split(',');
      return toPoint(longitudeText, latitudeText);
    })
    .filter(Boolean);
}

function visiblePlacemarkTexts(kmlText) {
  const text = kmlText.replace(UNPARSED_SECTIONS, '');
  const openFeatures = [];
  const placemarkTexts = [];
  for (const match of text.matchAll(TAG)) {
    const [tag, closingSlash, localName, selfClosingSlash] = match;
    if (localName === 'visibility' && !closingSlash && !selfClosingSlash) {
      const valueEnd = text.indexOf('<', match.index + tag.length);
      const value = text.slice(match.index + tag.length, valueEnd).trim();
      const feature = openFeatures.at(-1);
      if (feature && (value === '0' || value === 'false')) feature.isHidden = true;
      continue;
    }
    if (!FEATURE_TAGS.has(localName) || selfClosingSlash) continue;
    if (!closingSlash) {
      openFeatures.push({ localName, isHidden: false, contentStart: match.index + tag.length });
      continue;
    }
    const feature = openFeatures.pop();
    const isShown = !feature.isHidden && openFeatures.every((ancestor) => !ancestor.isHidden);
    if (localName === 'Placemark' && isShown) {
      placemarkTexts.push(text.slice(feature.contentStart, match.index));
    }
  }
  return placemarkTexts;
}

export function parseKmlRouteLines(kmlText) {
  if (typeof kmlText !== 'string') return [];
  const lines = visiblePlacemarkTexts(kmlText).flatMap((placemarkText) => {
    const [, nameText = ''] = placemarkText.match(NAME_TAG) ?? [];
    const name = decodeXmlText(nameText);
    return [...placemarkText.matchAll(LINE_STRING_BLOCK)].map(([block]) => ({
      name,
      points: lineStringPoints(block),
    }));
  });
  return lines.filter((line) => line.points.length >= 2);
}

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function greatCircleMiles(from, to) {
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function lineLengthMiles(points) {
  let lengthMiles = 0;
  for (let index = 1; index < points.length; index += 1) {
    lengthMiles += greatCircleMiles(points[index - 1], points[index]);
  }
  return lengthMiles;
}

export function routeLengthMiles(lines) {
  return lines.reduce((total, line) => total + lineLengthMiles(line.points), 0);
}

function resampleLine(points, stepMiles) {
  const samples = [{ ...points[0], distanceMiles: 0 }];
  const lastSampleMiles = lineLengthMiles(points) - END_POINT_TOLERANCE_MILES;
  let distanceAlongLine = 0;
  let nextSampleMiles = stepMiles;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentMiles = greatCircleMiles(start, end);
    while (
      nextSampleMiles < distanceAlongLine + segmentMiles &&
      nextSampleMiles < lastSampleMiles
    ) {
      const fraction = (nextSampleMiles - distanceAlongLine) / segmentMiles;
      samples.push({
        lng: start.lng + (end.lng - start.lng) * fraction,
        lat: start.lat + (end.lat - start.lat) * fraction,
        distanceMiles: nextSampleMiles,
      });
      nextSampleMiles += stepMiles;
    }
    distanceAlongLine += segmentMiles;
  }
  samples.push({ ...points.at(-1), distanceMiles: distanceAlongLine });
  return samples;
}

export function resampleRoute(
  lines,
  { spacingFeet = ELEVATION_SPACING_FEET, maximumPoints = MAXIMUM_ELEVATION_SAMPLES } = {},
) {
  const evenlySpacedBudget = Math.max(1, maximumPoints - 2 * lines.length);
  const stepMiles = Math.max(
    spacingFeet / FEET_PER_MILE,
    routeLengthMiles(lines) / evenlySpacedBudget,
  );
  return lines.map((line) => ({ name: line.name, samples: resampleLine(line.points, stepMiles) }));
}

function climbAndDescent(elevationsFeet) {
  let gainFeet = 0;
  let lossFeet = 0;
  let referenceFeet = elevationsFeet[0];
  for (const elevationFeet of elevationsFeet) {
    if (elevationFeet - referenceFeet >= CLIMB_THRESHOLD_FEET) {
      gainFeet += elevationFeet - referenceFeet;
      referenceFeet = elevationFeet;
    } else if (referenceFeet - elevationFeet >= CLIMB_THRESHOLD_FEET) {
      lossFeet += referenceFeet - elevationFeet;
      referenceFeet = elevationFeet;
    }
  }
  return { gainFeet, lossFeet };
}

export function summarizeElevations(elevationsFeetByLine) {
  const allElevations = elevationsFeetByLine.flat();
  if (allElevations.length === 0) throw new Error('No elevations to summarize');
  let gainFeet = 0;
  let lossFeet = 0;
  for (const elevationsFeet of elevationsFeetByLine) {
    const line = climbAndDescent(elevationsFeet);
    gainFeet += line.gainFeet;
    lossFeet += line.lossFeet;
  }
  return {
    minFeet: Math.min(...allElevations),
    maxFeet: Math.max(...allElevations),
    gainFeet,
    lossFeet,
  };
}

const roundTo = (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals;

export function thinProfile(samples, elevationsFeet, pointCount) {
  const total = samples.length;
  const keep = Math.max(2, Math.min(pointCount, total));
  const profile = [];
  for (let step = 0; step < keep; step += 1) {
    const index = Math.round((step * (total - 1)) / (keep - 1));
    profile.push([roundTo(samples[index].distanceMiles, 3), Math.round(elevationsFeet[index])]);
  }
  return profile;
}

export function buildRouteStats(resampledLines, elevationsFeetByLine) {
  if (resampledLines.length !== elevationsFeetByLine.length) {
    throw new Error(
      `Got elevations for ${elevationsFeetByLine.length} of ${resampledLines.length} lines`,
    );
  }
  resampledLines.forEach((line, index) => {
    if (line.samples.length !== elevationsFeetByLine[index].length) {
      throw new Error(
        `Got ${elevationsFeetByLine[index].length} elevations for ${line.samples.length} points on line ${index + 1}`,
      );
    }
  });
  const lineLengths = resampledLines.map((line) => line.samples.at(-1).distanceMiles);
  const totalMiles = lineLengths.reduce((total, lengthMiles) => total + lengthMiles, 0);
  const { minFeet, maxFeet, gainFeet, lossFeet } = summarizeElevations(elevationsFeetByLine);
  return {
    distanceMiles: roundTo(totalMiles, 2),
    elevationMinFeet: Math.round(minFeet),
    elevationMaxFeet: Math.round(maxFeet),
    elevationGainFeet: Math.round(gainFeet),
    elevationLossFeet: Math.round(lossFeet),
    elevationProfiles: resampledLines.map((line, index) => ({
      name: line.name,
      points: thinProfile(
        line.samples,
        elevationsFeetByLine[index],
        Math.round((PROFILE_POINT_COUNT * lineLengths[index]) / totalMiles),
      ),
    })),
  };
}
