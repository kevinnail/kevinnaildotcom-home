// Run `worker(item, index)` over `items` with at most `limit` promises in flight
// at once, resolving to the results in input order. A rejected worker rejects the
// whole run, so callers that want per-item failure handling should have the worker
// resolve to a result object rather than throw.
export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runFrom() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const runnerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: runnerCount }, runFrom));
  return results;
}
