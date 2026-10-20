// Derives an age window for every volcanic map unit of the Three Sisters geology
// layer, for the "years" color mode.
//
// Three sources, in order of authority:
// 1. Lab dates: the source's geochronology table (argon samples).
// 2. Stated ages: ages written in the unit descriptions but missing from the lab
//    table (radiocarbon, the authors' own estimates, subunits that share their
//    parent's age). These override lab dates where the authors say so.
// 3. Relations: which unit lies on, cuts, or banks against which. A unit with no
//    date of its own is younger than everything beneath it and older than
//    everything above it, so its dated neighbors bracket it.
//
// Sources 2 and 3 live in scripts/geology-age-evidence.json, one entry per
// source sentence, each carrying the quote it came from.

// A bracket wider than this ratio (oldest bound over youngest) says too little
// to color by, so it is treated like a one-sided bound.
export const MAXIMUM_BRACKET_RATIO = 2.5;

const DERIVED_METHODS = ['bracketed', 'olderThan', 'youngerThan', 'none'];

const lowerBoundOf = (ages) => Math.min(...ages.map((age) => age.minKa ?? age.ageKa - age.errorKa));
const upperBoundOf = (ages) => Math.max(...ages.map((age) => age.maxKa ?? age.ageKa + age.errorKa));

// The middle sample, so a long-lived unit such as North Sister colors by the
// center of its activity rather than by either end.
function medianAgeKa(ages) {
  const sorted = ages.map((age) => age.ageKa).sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)];
}

function fixedWindow(method, ages, bestKa) {
  return {
    method,
    isFixed: true,
    minKa: lowerBoundOf(ages),
    maxKa: upperBoundOf(ages),
    bestKa,
  };
}

function statedAgeWindow(statedAge) {
  if (statedAge.minKa !== undefined) {
    const ages = [{ minKa: statedAge.minKa, maxKa: statedAge.maxKa }];
    return fixedWindow(statedAge.method, ages, Math.sqrt(statedAge.minKa * statedAge.maxKa));
  }
  const ages = [{ ageKa: statedAge.ageKa, errorKa: statedAge.errorKa ?? 0 }];
  return fixedWindow(statedAge.method, ages, statedAge.ageKa);
}

// Expands one evidence entry (one source sentence) into younger/older pairs.
function relationPairs(entry) {
  const pairs = [
    ...(entry.youngerThan ?? []).map((code) => ({ younger: entry.unit, older: code })),
    ...(entry.olderThan ?? []).map((code) => ({ younger: code, older: entry.unit })),
  ];
  return pairs.map((pair) => ({ ...pair, agesOf: entry.agesOf ?? {}, entry }));
}

function requireWindow(windows, code, context) {
  const window = windows.get(code);
  if (!window) throw new Error(`Unknown map unit "${code}" in ${context}`);
  return window;
}

// unitCodes: every volcanic map unit. samples: [{ unit, ageKa, errorKa }] from the
// lab table. evidence: the parsed evidence file. Returns a Map of unit code to
// { method, minKa, maxKa, bestKa }. Throws if the evidence names a unit that does
// not exist or if two relations contradict each other.
export function deriveAgeWindows({ unitCodes, samples, evidence }) {
  const windows = new Map();
  for (const code of unitCodes) {
    const unitSamples = samples.filter((sample) => sample.unit === code);
    windows.set(
      code,
      unitSamples.length
        ? fixedWindow('lab', unitSamples, medianAgeKa(unitSamples))
        : { method: 'none', isFixed: false, minKa: 0, maxKa: Infinity },
    );
  }

  const statedAges = evidence.statedAges.filter((statedAge) => statedAge.method !== 'sameAs');
  for (const statedAge of statedAges) {
    requireWindow(windows, statedAge.unit, 'stated ages');
    windows.set(statedAge.unit, statedAgeWindow(statedAge));
  }
  for (const statedAge of evidence.statedAges.filter((entry) => entry.method === 'sameAs')) {
    requireWindow(windows, statedAge.unit, 'stated ages');
    const parent = requireWindow(windows, statedAge.sameAs, `sameAs for "${statedAge.unit}"`);
    if (!parent.isFixed) {
      throw new Error(
        `"${statedAge.unit}" is sameAs "${statedAge.sameAs}", which has no fixed age`,
      );
    }
    windows.set(statedAge.unit, { ...parent, method: 'sameAs' });
  }

  for (const bound of evidence.eventBounds) {
    const window = requireWindow(windows, bound.unit, 'event bounds');
    if (window.isFixed) continue;
    if (bound.olderThanKa !== undefined) window.minKa = Math.max(window.minKa, bound.olderThanKa);
    if (bound.youngerThanKa !== undefined)
      window.maxKa = Math.min(window.maxKa, bound.youngerThanKa);
  }

  const pairs = evidence.relations.flatMap(relationPairs);
  for (const pair of pairs) {
    const context = `relation from "${pair.entry.describedIn}"`;
    requireWindow(windows, pair.younger, context);
    requireWindow(windows, pair.older, context);
  }

  // Tighten until nothing moves. Each pass can only narrow a window, and the
  // bounds come from a finite set of dates, so this settles.
  let hasChanged = true;
  while (hasChanged) {
    hasChanged = false;
    for (const pair of pairs) {
      const younger = windows.get(pair.younger);
      const older = windows.get(pair.older);
      // An age the sentence gives for a neighbor ("overlies aeg (here, 27±2 ka)")
      // is the date of the part actually in contact, so it beats the neighbor's
      // overall range.
      const olderUpperKa = pair.agesOf[pair.older]
        ? upperBoundOf(pair.agesOf[pair.older])
        : older.maxKa;
      const youngerLowerKa = pair.agesOf[pair.younger]
        ? lowerBoundOf(pair.agesOf[pair.younger])
        : younger.minKa;
      if (!younger.isFixed && olderUpperKa < younger.maxKa) {
        younger.maxKa = olderUpperKa;
        hasChanged = true;
      }
      if (!older.isFixed && youngerLowerKa > older.minKa) {
        older.minKa = youngerLowerKa;
        hasChanged = true;
      }
    }
  }

  for (const pair of pairs) {
    const younger = windows.get(pair.younger);
    const older = windows.get(pair.older);
    if (younger.minKa > older.maxKa) {
      throw new Error(
        `Age conflict: "${pair.younger}" (at least ${younger.minKa} ka) is said to be younger ` +
          `than "${pair.older}" (at most ${older.maxKa} ka), per "${pair.entry.describedIn}"`,
      );
    }
  }

  const result = new Map();
  for (const [code, window] of windows) {
    result.set(code, window.isFixed ? withoutFlag(window) : classifyDerived(window));
  }
  return result;
}

function withoutFlag({ isFixed: _isFixed, ...window }) {
  return window;
}

function classifyDerived({ minKa, maxKa }) {
  const hasLowerBound = minKa > 0;
  const hasUpperBound = Number.isFinite(maxKa);
  if (hasLowerBound && hasUpperBound) {
    // Midpoint on a log scale, matching how the color ramp spaces ages.
    return { method: 'bracketed', minKa, maxKa, bestKa: Math.sqrt(minKa * maxKa) };
  }
  if (hasUpperBound) return { method: 'youngerThan', minKa, maxKa, bestKa: null };
  if (hasLowerBound) return { method: 'olderThan', minKa, maxKa, bestKa: null };
  return { method: 'none', minKa, maxKa, bestKa: null };
}

// Whether the window is precise enough to color by: any fixed age, or a bracket
// no wider than MAXIMUM_BRACKET_RATIO.
export function isColorableAgeWindow(window) {
  if (!DERIVED_METHODS.includes(window.method)) return true;
  return window.method === 'bracketed' && window.maxKa / window.minKa <= MAXIMUM_BRACKET_RATIO;
}
