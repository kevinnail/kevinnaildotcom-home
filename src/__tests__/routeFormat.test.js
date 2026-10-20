import { describe, test, expect } from 'vitest';
import { formatMiles, formatFeet } from '../utils/routeFormat';

describe('formatMiles', () => {
  test('shows one decimal place', () => {
    expect(formatMiles(8.82)).toBe('8.8 mi');
    expect(formatMiles(1)).toBe('1.0 mi');
  });
});

describe('formatFeet', () => {
  test('rounds to whole feet with thousands separators', () => {
    expect(formatFeet(6906.4)).toBe('6,906 ft');
    expect(formatFeet(0)).toBe('0 ft');
  });
});
