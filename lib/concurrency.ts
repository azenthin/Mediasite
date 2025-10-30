// Small concurrency limiter to run async work with a max parallelism
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let idx = 0;
  const workers: Promise<void>[] = [];

  async function run() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await worker(items[current], current);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  for (let i = 0; i < workerCount; i++) {
    workers.push(run());
  }
  await Promise.all(workers);
  return results;
}
