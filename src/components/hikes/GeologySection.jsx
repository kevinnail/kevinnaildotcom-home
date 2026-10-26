import {
  MAP_UNIT_CLASSES,
  GLACIATIONS,
  GLACIAL_ICE,
  SURFACE_DEPOSITS,
  UNDATED_VOLCANIC,
  YEARS_CLASSES,
} from '../../utils/geologyAge';
import './GeologySection.css';

const SOURCE_URL = 'https://pubs.usgs.gov/sim/3186/site/data.html';
const DATABASE_URL = 'https://doi.org/10.5066/P9IYBCRI';

const COLOR_MODES = [
  { id: 'plate', label: 'Each Flow' },
  { id: 'age', label: 'Geologic Era' },
  { id: 'years', label: 'Years' },
];

const YEARS_NEUTRAL_CLASSES = [UNDATED_VOLCANIC, SURFACE_DEPOSITS, GLACIAL_ICE];
// Same as the layer's fills, so the legend swatches match the map.
const MEASURED_SWATCH_OPACITY = 0.5;
const INFERRED_SWATCH_OPACITY = 0.25;
const SAMPLE_SWATCH_COLOR = YEARS_CLASSES[4].color;

function LayerToggle({ label, isOn, onToggle }) {
  return (
    <button type="button" className="hike-layer-toggle" aria-pressed={isOn} onClick={onToggle}>
      {label}
    </button>
  );
}

function LegendItem({ color, opacity = 1, children }) {
  return (
    <li className="geology-legend-item">
      <span
        aria-hidden="true"
        className="geology-swatch"
        style={{ backgroundColor: color, opacity }}
      />
      <span>{children}</span>
    </li>
  );
}

function YearsLegend() {
  return (
    <ul className="geology-legend">
      {YEARS_CLASSES.map((yearsClass) => (
        <LegendItem key={yearsClass.id} color={yearsClass.color}>
          {yearsClass.range}
        </LegendItem>
      ))}
      <LegendItem color={SAMPLE_SWATCH_COLOR} opacity={MEASURED_SWATCH_OPACITY}>
        Dated: lab, radiocarbon, or the authors&apos; estimate
      </LegendItem>
      <LegendItem color={SAMPLE_SWATCH_COLOR} opacity={INFERRED_SWATCH_OPACITY}>
        Fainter: inferred from dated layers above and below
      </LegendItem>
      {YEARS_NEUTRAL_CLASSES.map((mapUnitClass) => (
        <LegendItem key={mapUnitClass.id} color={mapUnitClass.color}>
          {mapUnitClass.range}
        </LegendItem>
      ))}
    </ul>
  );
}

// Toggles, legend, and source credit for the geology layers, shown inside the
// hike panel for hikes whose route crosses the Three Sisters geology map. The
// legend and credit appear only while a layer is on.
export default function GeologySection({
  isMapUnitsOn,
  isMorainesOn,
  colorMode,
  onToggleMapUnits,
  onToggleMoraines,
  onChangeColorMode,
  hasLoadError,
}) {
  return (
    <section className="geology-section" aria-label="Geology">
      <div className="geology-layer-toggles">
        <LayerToggle label="Geology" isOn={isMapUnitsOn} onToggle={onToggleMapUnits} />
        <LayerToggle label="Moraines" isOn={isMorainesOn} onToggle={onToggleMoraines} />
      </div>

      {hasLoadError && <p className="geology-error">Geology data could not load.</p>}

      {isMapUnitsOn && (
        <div className="geology-color-modes">
          {COLOR_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className="geology-color-mode"
              aria-pressed={colorMode === mode.id}
              onClick={() => onChangeColorMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {isMapUnitsOn && colorMode === 'plate' && (
        <p className="geology-note">
          Each color is one lava flow, dome, or cone the geologists mapped as a single eruption, or
          one kind of deposit like glacial rubble. Colors match the official USGS map.
        </p>
      )}

      {isMapUnitsOn && colorMode === 'age' && (
        <ul className="geology-legend">
          {MAP_UNIT_CLASSES.map((mapUnitClass) => (
            <LegendItem key={mapUnitClass.id} color={mapUnitClass.color}>
              {mapUnitClass.range}
              {mapUnitClass.epoch && (
                <span className="geology-legend-detail">{mapUnitClass.epoch}</span>
              )}
            </LegendItem>
          ))}
        </ul>
      )}

      {isMapUnitsOn && colorMode === 'years' && <YearsLegend />}

      {isMorainesOn && (
        <ul className="geology-legend">
          {GLACIATIONS.map((glaciation) => (
            <li key={glaciation.id} className="geology-legend-item">
              <span
                aria-hidden="true"
                className="geology-moraine-swatch"
                style={{ backgroundColor: glaciation.color }}
              />
              <span>
                {glaciation.name}
                <span className="geology-legend-detail">{glaciation.range}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {(isMapUnitsOn || isMorainesOn) && (
        <p className="geology-credit">
          Geology: Hildreth, Fierstein, and Calvert,{' '}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            USGS SIM 3186
          </a>{' '}
          (2012); database by{' '}
          <a href={DATABASE_URL} target="_blank" rel="noreferrer">
            Peters and others
          </a>{' '}
          (2021).
        </p>
      )}
    </section>
  );
}
