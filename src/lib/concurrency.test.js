import { describe, test, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('mapWithConcurrency', () => {
  test('resolves to results in input order regardless of completion order', async () => {
    const items = [30, 10, 20, 0];
    // Later-listed fast items finish before earlier slow ones, but output order
    // must still follow the input order.
    const results = await mapWithConcurrency(items, 2, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay;
    });
    expect(results).toEqual([30, 10, 20, 0]);
  });

  test('never exceeds the concurrency limit in flight', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 12 }, (_unused, index) => index);

    await mapWithConcurrency(items, 3, async (value) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick();
      inFlight -= 1;
      return value;
    });

    expect(maxInFlight).toBe(3);
  });

  test('passes the index to the worker', async () => {
    const results = await mapWithConcurrency(
      ['a', 'b', 'c'],
      2,
      async (value, index) => `${value}${index}`,
    );
    expect(results).toEqual(['a0', 'b1', 'c2']);
  });

  test('returns an empty array for no items', async () => {
    const results = await mapWithConcurrency([], 5, async () => {
      throw new Error('worker should not run');
    });
    expect(results).toEqual([]);
  });
});
