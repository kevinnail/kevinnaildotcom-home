import { formatMiles, formatFeet } from '../../utils/routeFormat';

// Drawing space for each chart. The SVG stretches to the panel's width, so only
// the proportions matter; the stroke stays 2px through the stretch.
const CHART_WIDTH = 1000;
const CHART_HEIGHT = 300;

// Round spacings for the height lines, finest first: 1, 2, 2.5, 5, 10 ... 50,000 ft.
const HEIGHT_LINE_STEPS_FEET = [1, 10, 100, 1000, 10000].flatMap((power) =>
  [1, 2, 2.5, 5].map((multiple) => multiple * power),
);
const MAX_HEIGHT_LINES = 3;
// Height lines stay this share of the chart's height away from its top and
// bottom edges, so the label centered on each line stays inside the chart.
const LABEL_MARGIN = 0.1;

// The round elevations to draw height lines at: the finest spacing that puts no
// more than three lines between the label margins.
function heightLinesFeet(lowestFeet, elevationSpanFeet) {
  const firstStep = (stepFeet) =>
    Math.ceil((lowestFeet + elevationSpanFeet * LABEL_MARGIN) / stepFeet);
  const lastStep = (stepFeet) =>
    Math.floor((lowestFeet + elevationSpanFeet * (1 - LABEL_MARGIN)) / stepFeet);
  const lineCount = (stepFeet) => lastStep(stepFeet) - firstStep(stepFeet) + 1;
  const stepFeet = HEIGHT_LINE_STEPS_FEET.find(
    (candidateFeet) => lineCount(candidateFeet) <= MAX_HEIGHT_LINES,
  );
  return Array.from(
    { length: lineCount(stepFeet) },
    (_unused, index) => (firstStep(stepFeet) + index) * stepFeet,
  );
}

// One line's chart: elevation against distance along that line, spanning that
// line's own lowest point to its highest, so its climb fills the chart and a
// steep side trip looks steep. Labeled height lines give the real elevations.
function LineProfile({ profile, isNamed }) {
  const lengthMiles = profile.points.at(-1)[0];
  const elevationsFeet = profile.points.map(([, elevationFeet]) => elevationFeet);
  const lowestFeet = Math.min(...elevationsFeet);
  // A dead-flat line still draws, along the bottom.
  const elevationSpanFeet = Math.max(...elevationsFeet) - lowestFeet || 1;
  const heightShare = (elevationFeet) => (elevationFeet - lowestFeet) / elevationSpanFeet;
  const chartY = (elevationFeet) => CHART_HEIGHT - heightShare(elevationFeet) * CHART_HEIGHT;

  const linePoints = profile.points.map(([distanceMiles, elevationFeet]) => {
    const x = (distanceMiles / lengthMiles) * CHART_WIDTH;
    return `${x.toFixed(1)},${chartY(elevationFeet).toFixed(1)}`;
  });
  const areaPoints = [`0,${CHART_HEIGHT}`, ...linePoints, `${CHART_WIDTH},${CHART_HEIGHT}`];
  const linesFeet = heightLinesFeet(lowestFeet, elevationSpanFeet);

  return (
    <figure className="elevation-profile">
      {isNamed && profile.name && (
        <figcaption className="elevation-profile-name">{profile.name}</figcaption>
      )}
      <div className="elevation-profile-plot">
        <svg
          className="elevation-profile-chart"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Elevation profile${profile.name ? ` of ${profile.name}` : ''} over ${formatMiles(lengthMiles)}, ${formatFeet(lowestFeet)} to ${formatFeet(lowestFeet + elevationSpanFeet)}`}
        >
          {linesFeet.map((lineFeet) => (
            <line
              key={lineFeet}
              className="elevation-profile-height-line"
              x1={0}
              x2={CHART_WIDTH}
              y1={chartY(lineFeet)}
              y2={chartY(lineFeet)}
            />
          ))}
          <polygon className="elevation-profile-area" points={areaPoints.join(' ')} />
          <polyline className="elevation-profile-line" points={linePoints.join(' ')} />
        </svg>
        {/* HTML rather than SVG text, which the stretched SVG would distort. */}
        {linesFeet.map((lineFeet) => (
          <span
            key={lineFeet}
            className="elevation-profile-height-label"
            style={{ bottom: `${heightShare(lineFeet) * 100}%` }}
            aria-hidden="true"
          >
            {formatFeet(lineFeet)}
          </span>
        ))}
      </div>
      <div className="elevation-profile-axis">
        <span>0 mi</span>
        <span>{formatMiles(lengthMiles)}</span>
      </div>
    </figure>
  );
}

// One chart per route line, in file order, rather than one chart stringing the
// lines together: a side trip that starts halfway along the main route would
// otherwise show as a cliff wherever it happened to be joined on. Line names
// from the KML label the charts when there is more than one.
export default function ElevationProfile({ profiles }) {
  return (
    <div className="elevation-profiles">
      {profiles.map((profile, index) => (
        <LineProfile key={index} profile={profile} isNamed={profiles.length > 1} />
      ))}
    </div>
  );
}
