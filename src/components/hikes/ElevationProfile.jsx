import { formatMiles } from '../../utils/routeFormat';

// Drawing space for each chart. The SVG stretches to the panel's width, so only
// the proportions matter; the stroke stays 2px through the stretch.
const CHART_WIDTH = 1000;
const CHART_HEIGHT = 300;

// One line's chart: elevation against distance along that line, drawn on the
// height scale shared by every line of the trip.
function LineProfile({ profile, lowestFeet, elevationSpanFeet, isNamed }) {
  const lengthMiles = profile.points.at(-1)[0];
  const linePoints = profile.points.map(([distanceMiles, elevationFeet]) => {
    const x = (distanceMiles / lengthMiles) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((elevationFeet - lowestFeet) / elevationSpanFeet) * CHART_HEIGHT;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPoints = [`0,${CHART_HEIGHT}`, ...linePoints, `${CHART_WIDTH},${CHART_HEIGHT}`];

  return (
    <figure className="elevation-profile">
      {isNamed && profile.name && (
        <figcaption className="elevation-profile-name">{profile.name}</figcaption>
      )}
      <svg
        className="elevation-profile-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Elevation profile${profile.name ? ` of ${profile.name}` : ''} over ${formatMiles(lengthMiles)}`}
      >
        <polygon className="elevation-profile-area" points={areaPoints.join(' ')} />
        <polyline className="elevation-profile-line" points={linePoints.join(' ')} />
      </svg>
      <div className="elevation-profile-axis">
        <span>0 mi</span>
        <span>{formatMiles(lengthMiles)}</span>
      </div>
    </figure>
  );
}

// One chart per route line, in file order, rather than one chart stringing the
// lines together: a side trip that starts halfway along the main route would
// otherwise show as a cliff wherever it happened to be joined on. Every chart
// spans the same heights, the trip's lowest point to its highest, so their
// shapes compare directly. Line names from the KML label the charts when there
// is more than one.
export default function ElevationProfile({ profiles }) {
  const elevationsFeet = profiles.flatMap((profile) =>
    profile.points.map(([, elevationFeet]) => elevationFeet),
  );
  const lowestFeet = Math.min(...elevationsFeet);
  // A dead-flat trip still draws, as lines along the bottom.
  const elevationSpanFeet = Math.max(...elevationsFeet) - lowestFeet || 1;

  return (
    <div className="elevation-profiles">
      {profiles.map((profile, index) => (
        <LineProfile
          key={index}
          profile={profile}
          lowestFeet={lowestFeet}
          elevationSpanFeet={elevationSpanFeet}
          isNamed={profiles.length > 1}
        />
      ))}
    </div>
  );
}
