import { useState } from 'react';
import useIsDesktop from '../../hooks/useIsDesktop';
import { formatMiles, formatFeet } from '../../utils/routeFormat';
import ElevationProfile from './ElevationProfile';
import GeologySection from './GeologySection';
import './HikeInfoPanel.css';

function RouteStats({ stats }) {
  return (
    <>
      <dl className="hike-stats">
        <div className="hike-stat">
          <dt>Distance</dt>
          <dd>{formatMiles(stats.distanceMiles)}</dd>
        </div>
        <div className="hike-stat">
          <dt>Elevation</dt>
          <dd>
            {formatFeet(stats.elevationMinFeet)} to {formatFeet(stats.elevationMaxFeet)}
          </dd>
        </div>
        <div className="hike-stat">
          <dt>Total Climb</dt>
          <dd>{formatFeet(stats.elevationGainFeet)}</dd>
        </div>
        <div className="hike-stat">
          <dt>Total Descent</dt>
          <dd>{formatFeet(stats.elevationLossFeet)}</dd>
        </div>
      </dl>
      <ElevationProfile profiles={stats.elevationProfiles} />
    </>
  );
}

// `geology` is null for a hike outside the geology map, otherwise the props for
// GeologySection.
export default function HikeInfoPanel({ trip, geology }) {
  const isDesktop = useIsDesktop();
  // null until the visitor opens or closes it, so the panel starts open where
  // there is room for it and collapsed on a phone, where it would cover most of
  // the globe.
  const [expandedChoice, setExpandedChoice] = useState(null);
  const isExpanded = expandedChoice ?? isDesktop;

  if (!isExpanded) {
    return (
      <button
        type="button"
        className="hike-panel-opener"
        onClick={() => setExpandedChoice(true)}
        aria-expanded={false}
      >
        Hike info <span aria-hidden="true">▾</span>
      </button>
    );
  }

  return (
    <div className="hike-panel">
      <div className="hike-panel-header">
        <h2 className="hike-panel-title">{trip.name}</h2>
        <button
          type="button"
          className="hike-panel-collapse"
          onClick={() => setExpandedChoice(false)}
          aria-expanded={true}
          aria-label="Hide hike info"
        >
          <span aria-hidden="true">▴</span>
        </button>
      </div>
      {trip.region && <p className="hike-panel-region">{trip.region}</p>}
      {(trip.stats || geology) && (
        <div className="hike-panel-body">
          {/* Null for a KML with no route line, or a trip not yet measured. */}
          {trip.stats && <RouteStats stats={trip.stats} />}
          {geology && <GeologySection {...geology} />}
        </div>
      )}
    </div>
  );
}
