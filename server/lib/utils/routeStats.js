import { badRequest } from './httpError.js';

// The client measures a trip's distance and elevation when it uploads the KML
// (src/utils/routeStats.js) and sends the result, in miles and feet; the server
// never reads the KML bytes. This checks the shape before it is stored.

// Far more than the 200 points the client keeps across a trip's lines; caps so
// a runaway payload is a 400 rather than a huge row.
const MAX_PROFILE_LINES = 100;
const MAX_PROFILE_POINTS = 1000;
const MAX_LINE_NAME_LENGTH = 200;

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// One line's profile: a name and [distanceMiles, elevationFeet] pairs, starting
// at zero and in distance order.
function isProfileShaped(profile) {
  if (profile === null || typeof profile !== 'object') return false;
  const { name, points } = profile;
  return (
    typeof name === 'string' &&
    name.length <= MAX_LINE_NAME_LENGTH &&
    Array.isArray(points) &&
    points.length >= 2 &&
    points.every(
      (point, index) =>
        Array.isArray(point) &&
        point.length === 2 &&
        isNumber(point[0]) &&
        isNumber(point[1]) &&
        point[0] >= (index === 0 ? 0 : points[index - 1][0]),
    )
  );
}

// Returns the stats as stored, or throws a 400 naming the first problem.
export function requireRouteStats(stats) {
  if (stats === null || typeof stats !== 'object' || Array.isArray(stats)) {
    throw badRequest('stats must be an object');
  }
  const {
    distanceMiles,
    elevationMinFeet,
    elevationMaxFeet,
    elevationGainFeet,
    elevationLossFeet,
    elevationProfiles,
  } = stats;

  if (!isNumber(distanceMiles) || distanceMiles <= 0) {
    throw badRequest('stats.distanceMiles must be a positive number');
  }
  if (!isNumber(elevationMinFeet) || !isNumber(elevationMaxFeet)) {
    throw badRequest('stats elevation range must be numbers');
  }
  if (elevationMinFeet > elevationMaxFeet) {
    throw badRequest('stats.elevationMinFeet is above elevationMaxFeet');
  }
  if (!isNumber(elevationGainFeet) || elevationGainFeet < 0) {
    throw badRequest('stats.elevationGainFeet must be zero or more');
  }
  if (!isNumber(elevationLossFeet) || elevationLossFeet < 0) {
    throw badRequest('stats.elevationLossFeet must be zero or more');
  }

  const totalPoints = Array.isArray(elevationProfiles)
    ? elevationProfiles.reduce((total, profile) => total + (profile?.points?.length ?? 0), 0)
    : 0;
  const areProfilesShaped =
    Array.isArray(elevationProfiles) &&
    elevationProfiles.length >= 1 &&
    elevationProfiles.length <= MAX_PROFILE_LINES &&
    totalPoints <= MAX_PROFILE_POINTS &&
    elevationProfiles.every(isProfileShaped);
  if (!areProfilesShaped) {
    throw badRequest(
      `stats.elevationProfiles must be 1 to ${MAX_PROFILE_LINES} lines of { name, points }, ` +
        `each with 2 or more [distanceMiles, elevationFeet] pairs in distance order, ` +
        `${MAX_PROFILE_POINTS} points at most in all`,
    );
  }

  return {
    distanceMiles,
    elevationMinFeet,
    elevationMaxFeet,
    elevationGainFeet,
    elevationLossFeet,
    elevationProfiles,
  };
}
