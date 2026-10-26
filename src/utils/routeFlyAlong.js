const toRadians = (degrees) => (degrees * Math.PI) / 180;

// One path through every line of a resampled route, each line after the one
// before it. Distance keeps counting across lines, so the camera jumps from one
// line's end to the next line's start rather than flying over the gap.
export function joinRouteLines(resampledLines) {
  let lineStartMiles = 0;
  return resampledLines.flatMap((line) => {
    const offsetMiles = lineStartMiles;
    lineStartMiles += line.samples.at(-1).distanceMiles;
    return line.samples.map((sample) => ({
      ...sample,
      distanceMiles: offsetMiles + sample.distanceMiles,
    }));
  });
}

// The spot on the path at a distance along it, between the two samples either
// side. Past the end it is the last sample.
export function pointAlongPath(path, distanceMiles) {
  const endIndex = path.findIndex((sample) => sample.distanceMiles > distanceMiles);
  if (endIndex === -1) return path.at(-1);
  const start = path[endIndex - 1];
  const end = path[endIndex];
  const fraction =
    (distanceMiles - start.distanceMiles) / (end.distanceMiles - start.distanceMiles);
  return {
    lng: start.lng + (end.lng - start.lng) * fraction,
    lat: start.lat + (end.lat - start.lat) * fraction,
    heightMeters: start.heightMeters + (end.heightMeters - start.heightMeters) * fraction,
    distanceMiles,
  };
}

// Compass direction from one point to another, in radians clockwise from north,
// which is what Cesium calls heading.
export function bearingRadians(from, to) {
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  return Math.atan2(
    Math.sin(longitudeDelta) * Math.cos(toLatitude),
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
      Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta),
  );
}

// Turns a heading part of the way toward another, the short way around, so a
// trail heading just either side of south never spins the camera all the way round.
export function turnToward(headingRadians, targetRadians, fraction) {
  const difference = targetRadians - headingRadians;
  const shortestTurn = Math.atan2(Math.sin(difference), Math.cos(difference));
  return headingRadians + shortestTurn * fraction;
}
