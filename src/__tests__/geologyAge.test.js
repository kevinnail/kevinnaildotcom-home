import { readFileSync } from 'node:fs';
import { describe, test, expect } from 'vitest';
import {
  AGE_BANDS,
  classifyMapUnit,
  mapUnitClassById,
  hexFromSourceRgb,
  glaciationForLineType,
  glaciationById,
  yearsClassForAgeKa,
  YEARS_CLASSES,
  isInGeologyMapArea,
} from '../utils/geologyAge';

const volcanic = (ageLabel) => ({
  ageLabel,
  hierarchyKey: '001-002-010',
  geoMaterial: 'Intermediate-composition lava flows',
});

describe('classifyMapUnit', () => {
  test('puts each volcanic source age label in its band', () => {
    expect(classifyMapUnit(volcanic('late Holocene'))).toBe('holocene');
    expect(classifyMapUnit(volcanic('Holocene'))).toBe('holocene');
    expect(classifyMapUnit(volcanic('early Holocene or latest Pleistocene'))).toBe(
      'holoceneOrLatestPleistocene',
    );
    expect(classifyMapUnit(volcanic('latest Pleistocene'))).toBe('latestPleistocene');
    expect(classifyMapUnit(volcanic('late Pleistocene'))).toBe('latePleistocene');
    expect(classifyMapUnit(volcanic('middle Pleistocene'))).toBe('middlePleistocene');
  });

  test('groups "late or middle" and North Sister\'s "late and middle" together', () => {
    expect(classifyMapUnit(volcanic('late or middle Pleistocene'))).toBe('lateOrMiddlePleistocene');
    expect(classifyMapUnit(volcanic('late and middle Pleistocene'))).toBe(
      'lateOrMiddlePleistocene',
    );
  });

  test('keeps surficial deposits off the age ramp, whatever their age label', () => {
    // Till is labelled "Holocene and late Pleistocene", which is not an eruption
    // age and has no band; the surficial group must win before the label is read.
    const till = {
      ageLabel: 'Holocene and late Pleistocene',
      hierarchyKey: '001-001-005',
      geoMaterial: 'Glacial till',
    };
    expect(classifyMapUnit(till)).toBe('surfaceDeposits');
  });

  test('separates glacial ice from the other surficial deposits', () => {
    const ice = {
      ageLabel: 'late Holocene',
      hierarchyKey: '001-001-001',
      geoMaterial: 'Water or ice',
    };
    expect(classifyMapUnit(ice)).toBe('glacialIce');
  });

  test('throws on a volcanic age label it has no band for', () => {
    expect(() => classifyMapUnit(volcanic('early Pleistocene'))).toThrow(
      'No age band for source age label "early Pleistocene"',
    );
  });

  test('throws on a volcanic unit with no age label at all', () => {
    expect(() => classifyMapUnit(volcanic(null))).toThrow('No age band');
  });

  test('never maps one source label to two bands', () => {
    const labels = AGE_BANDS.flatMap((band) => band.sourceLabels);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('mapUnitClassById', () => {
  test('returns the legend entry the layer colors with', () => {
    expect(mapUnitClassById('latePleistocene')).toMatchObject({
      range: '129,000 to 11,700 years ago',
      color: '#b12a90',
    });
  });

  test('throws on an id the legend does not know', () => {
    expect(() => mapUnitClassById('pliocene')).toThrow('Unknown map unit class "pliocene"');
  });
});

describe('hexFromSourceRgb', () => {
  test('converts the plate color of Obsidian Cliffs to hex', () => {
    expect(hexFromSourceRgb('255, 102, 222')).toBe('#ff66de');
  });

  test('pads single-digit channels so the hex stays six digits', () => {
    expect(hexFromSourceRgb('255, 0, 0')).toBe('#ff0000');
  });

  test('throws on a missing color', () => {
    expect(() => hexFromSourceRgb(null)).toThrow('Unreadable source RGB "null"');
  });

  test('throws on a channel outside 0 to 255', () => {
    expect(() => hexFromSourceRgb('255, 300, 0')).toThrow('Unreadable source RGB');
  });
});

describe('glaciations', () => {
  test('maps each source moraine line type to its glaciation', () => {
    expect(glaciationForLineType('moraine crest LIA')).toBe('LIA');
    expect(glaciationForLineType('moraine crest NG')).toBe('NG');
    expect(glaciationForLineType('moraine crest YD')).toBe('YD');
    expect(glaciationForLineType('moraine crest LGM')).toBe('LGM');
  });

  test('returns the legend entry for a glaciation id', () => {
    expect(glaciationById('YD')).toMatchObject({ range: 'About 13,000 to 12,000 years ago' });
  });

  test('throws on a line type that is not a moraine crest', () => {
    expect(() => glaciationForLineType('dike')).toThrow('Unknown moraine line type "dike"');
  });
});

describe('yearsClassForAgeKa', () => {
  test('separates Obsidian Cliffs from the older andesite wrapped around it', () => {
    // roc is dated 37.8 ka; aoc, which surrounds it, 44.6 to 48.9 ka.
    expect(yearsClassForAgeKa(37.8).id).toBe('to40ka');
    expect(yearsClassForAgeKa(47.9).id).toBe('to60ka');
  });

  test('puts an age on a boundary into the older range', () => {
    expect(yearsClassForAgeKa(20).id).toBe('to25ka');
    expect(yearsClassForAgeKa(19.99).id).toBe('to20ka');
  });

  test('covers the youngest and oldest dated units', () => {
    expect(yearsClassForAgeKa(1.5).id).toBe('underHolocene');
    expect(yearsClassForAgeKa(531.7).id).toBe('over300ka');
  });

  test('keeps ranges in order with no gaps, ending open', () => {
    const limits = YEARS_CLASSES.map((yearsClass) => yearsClass.maxKa);
    expect(limits).toEqual([...limits].sort((first, second) => first - second));
    expect(limits.at(-1)).toBe(Infinity);
  });

  test('gives every range its own color', () => {
    const colors = YEARS_CLASSES.map((yearsClass) => yearsClass.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  test('throws on a missing or non-positive age', () => {
    expect(() => yearsClassForAgeKa(null)).toThrow('Unusable age "null"');
    expect(() => yearsClassForAgeKa(0)).toThrow('Unusable age "0"');
  });
});

describe('isInGeologyMapArea', () => {
  test('includes a point on the map, Collier Cone', () => {
    expect(isInGeologyMapArea({ lng: -121.785, lat: 44.168 })).toBe(true);
  });

  test('excludes hikes elsewhere in the Cascades', () => {
    // Mount Jefferson, about 60 km north; Mount Bachelor's summit, just south.
    expect(isInGeologyMapArea({ lng: -121.8, lat: 44.674 })).toBe(false);
    expect(isInGeologyMapArea({ lng: -121.689, lat: 43.979 })).toBe(false);
  });

  test('covers every coordinate in the built geology data', () => {
    // If a rebuild ever widens the data, this fails rather than letting the panel
    // hide on a hike that crosses the new edge.
    for (const fileName of ['units.geojson', 'moraines.geojson']) {
      const collection = JSON.parse(
        readFileSync(new URL(`../../public/data/geology/${fileName}`, import.meta.url), 'utf8'),
      );
      const outside = [];
      const visit = (coordinates) => {
        if (typeof coordinates[0] === 'number') {
          const [lng, lat] = coordinates;
          if (!isInGeologyMapArea({ lng, lat })) outside.push(coordinates);
        } else coordinates.forEach(visit);
      };
      for (const feature of collection.features) visit(feature.geometry.coordinates);
      expect(outside).toEqual([]);
    }
  });
});
