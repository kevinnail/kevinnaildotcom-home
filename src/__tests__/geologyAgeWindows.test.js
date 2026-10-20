import { describe, test, expect } from 'vitest';
import {
  deriveAgeWindows,
  isColorableAgeWindow,
  MAXIMUM_BRACKET_RATIO,
} from '../utils/geologyAgeWindows';

const noEvidence = { statedAges: [], eventBounds: [], relations: [] };
const evidenceWith = (overrides) => ({ ...noEvidence, ...overrides });

describe('deriveAgeWindows', () => {
  test('gives a lab-dated unit its median sample and the full error range', () => {
    const windows = deriveAgeWindows({
      unitCodes: ['mns'],
      samples: [
        { unit: 'mns', ageKa: 119, errorKa: 6 },
        { unit: 'mns', ageKa: 55, errorKa: 5 },
        { unit: 'mns', ageKa: 46, errorKa: 6 },
      ],
      evidence: noEvidence,
    });
    expect(windows.get('mns')).toEqual({ method: 'lab', minKa: 40, maxKa: 125, bestKa: 55 });
  });

  test("lets a stated age override the lab date, as for Middle Sister's cone", () => {
    const windows = deriveAgeWindows({
      unitCodes: ['mms'],
      samples: [{ unit: 'mms', ageKa: 16.4, errorKa: 11.7 }],
      evidence: evidenceWith({
        statedAges: [{ unit: 'mms', method: 'authorsEstimate', ageKa: 20.3, errorKa: 2.5 }],
      }),
    });
    expect(windows.get('mms')).toMatchObject({ method: 'authorsEstimate', bestKa: 20.3 });
    expect(windows.get('mms').minKa).toBeCloseTo(17.8);
    expect(windows.get('mms').maxKa).toBeCloseTo(22.8);
  });

  test('copies the final parent age to a sameAs unit, after overrides apply', () => {
    const windows = deriveAgeWindows({
      unitCodes: ['mms', 'mmt'],
      samples: [{ unit: 'mms', ageKa: 16.4, errorKa: 11.7 }],
      evidence: evidenceWith({
        statedAges: [
          { unit: 'mmt', method: 'sameAs', sameAs: 'mms' },
          { unit: 'mms', method: 'authorsEstimate', ageKa: 20.3, errorKa: 2.5 },
        ],
      }),
    });
    expect(windows.get('mmt')).toMatchObject({ method: 'sameAs', bestKa: 20.3 });
  });

  test('brackets an undated unit between dated units above and below it', () => {
    const windows = deriveAgeWindows({
      unitCodes: ['aph', 'rpg', 'alh'],
      samples: [
        { unit: 'rpg', ageKa: 32.8, errorKa: 1.5 },
        { unit: 'alh', ageKa: 40, errorKa: 1 },
      ],
      evidence: evidenceWith({
        relations: [
          { unit: 'aph', olderThan: ['rpg'], youngerThan: ['alh'], describedIn: 'aph', quote: '' },
        ],
      }),
    });
    const window = windows.get('aph');
    expect(window.method).toBe('bracketed');
    expect(window.minKa).toBeCloseTo(31.3);
    expect(window.maxKa).toBeCloseTo(41);
    expect(window.bestKa).toBeCloseTo(Math.sqrt(31.3 * 41));
  });

  test('carries a bound through an undated unit in between', () => {
    // top (dated) lies on middle (undated), which lies on bottom (undated):
    // bottom is older than top even though no sentence says so directly.
    const windows = deriveAgeWindows({
      unitCodes: ['top', 'middle', 'bottom'],
      samples: [{ unit: 'top', ageKa: 30, errorKa: 1 }],
      evidence: evidenceWith({
        relations: [
          { unit: 'top', youngerThan: ['middle'], describedIn: 'top', quote: '' },
          { unit: 'middle', youngerThan: ['bottom'], describedIn: 'middle', quote: '' },
        ],
      }),
    });
    expect(windows.get('bottom')).toMatchObject({ method: 'olderThan', minKa: 29 });
  });

  test("prefers the sentence's own age for a neighbor over the neighbor's overall range", () => {
    const windows = deriveAgeWindows({
      unitCodes: ['adh', 'aeg'],
      samples: [
        { unit: 'aeg', ageKa: 27, errorKa: 3.2 },
        { unit: 'aeg', ageKa: 28.5, errorKa: 2.1 },
      ],
      evidence: evidenceWith({
        relations: [
          {
            unit: 'adh',
            olderThan: ['aeg'],
            agesOf: { aeg: [{ ageKa: 27, errorKa: 2 }] },
            describedIn: 'adh',
            quote: '',
          },
        ],
      }),
    });
    // 27 - 2, not the overall aeg minimum of 27 - 3.2.
    expect(windows.get('adh').minKa).toBe(25);
  });

  test('applies event bounds such as overlying Mazama ash', () => {
    const windows = deriveAgeWindows({
      unitCodes: ['bcc'],
      samples: [],
      evidence: evidenceWith({
        eventBounds: [
          { unit: 'bcc', olderThanKa: 7.7 },
          { unit: 'bcc', youngerThanKa: 13 },
        ],
      }),
    });
    expect(windows.get('bcc')).toMatchObject({ method: 'bracketed', minKa: 7.7, maxKa: 13 });
  });

  test('reports a unit with no dated neighbors as none', () => {
    const windows = deriveAgeWindows({ unitCodes: ['asy'], samples: [], evidence: noEvidence });
    expect(windows.get('asy')).toMatchObject({ method: 'none', bestKa: null });
  });

  test('never moves a fixed age because of a relation', () => {
    const windows = deriveAgeWindows({
      unitCodes: ['young', 'old'],
      samples: [
        { unit: 'young', ageKa: 20, errorKa: 1 },
        { unit: 'old', ageKa: 30, errorKa: 1 },
      ],
      evidence: evidenceWith({
        relations: [{ unit: 'young', youngerThan: ['old'], describedIn: 'young', quote: '' }],
      }),
    });
    expect(windows.get('young')).toMatchObject({ minKa: 19, maxKa: 21 });
    expect(windows.get('old')).toMatchObject({ minKa: 29, maxKa: 31 });
  });

  test('throws when a relation contradicts the dates', () => {
    expect(() =>
      deriveAgeWindows({
        unitCodes: ['young', 'old'],
        samples: [
          { unit: 'young', ageKa: 40, errorKa: 1 },
          { unit: 'old', ageKa: 20, errorKa: 1 },
        ],
        evidence: evidenceWith({
          relations: [{ unit: 'young', youngerThan: ['old'], describedIn: 'young', quote: '' }],
        }),
      }),
    ).toThrow('Age conflict: "young"');
  });

  test('throws on a relation naming a unit that does not exist', () => {
    expect(() =>
      deriveAgeWindows({
        unitCodes: ['aph'],
        samples: [],
        evidence: evidenceWith({
          relations: [{ unit: 'aph', olderThan: ['nope'], describedIn: 'aph', quote: '' }],
        }),
      }),
    ).toThrow('Unknown map unit "nope"');
  });

  test('throws on a sameAs whose parent has no fixed age', () => {
    expect(() =>
      deriveAgeWindows({
        unitCodes: ['child', 'parent'],
        samples: [],
        evidence: evidenceWith({
          statedAges: [{ unit: 'child', method: 'sameAs', sameAs: 'parent' }],
        }),
      }),
    ).toThrow('which has no fixed age');
  });
});

describe('isColorableAgeWindow', () => {
  test('colors any fixed age', () => {
    expect(isColorableAgeWindow({ method: 'lab', minKa: 10, maxKa: 50 })).toBe(true);
    expect(isColorableAgeWindow({ method: 'radiocarbon', minKa: 2, maxKa: 2 })).toBe(true);
  });

  test('colors a bracket up to the ratio limit and not past it', () => {
    expect(
      isColorableAgeWindow({ method: 'bracketed', minKa: 10, maxKa: 10 * MAXIMUM_BRACKET_RATIO }),
    ).toBe(true);
    expect(isColorableAgeWindow({ method: 'bracketed', minKa: 10, maxKa: 26 })).toBe(false);
  });

  test('never colors a one-sided or missing bound', () => {
    expect(isColorableAgeWindow({ method: 'olderThan', minKa: 28, maxKa: Infinity })).toBe(false);
    expect(isColorableAgeWindow({ method: 'youngerThan', minKa: 0, maxKa: 20 })).toBe(false);
    expect(isColorableAgeWindow({ method: 'none', minKa: 0, maxKa: Infinity })).toBe(false);
  });
});
