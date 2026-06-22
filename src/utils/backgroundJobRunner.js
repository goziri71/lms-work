/**
 * Serialize background jobs so they don't stampede the DB connection pool.
 */

let busy = false;
const queue = [];

async function drainQueue() {
  if (busy || queue.length === 0) return;
  busy = true;
  const { name, fn } = queue.shift();
  try {
    await fn();
  } catch (err) {
    console.warn(`[background] ${name} failed:`, err?.message || err);
  } finally {
    busy = false;
    drainQueue();
  }
}

/**
 * Queue a background task. Jobs run one at a time.
 */
export function scheduleBackgroundJob(name, fn) {
  queue.push({ name, fn });
  drainQueue();
}

/**
 * setInterval wrapper — skips tick if the previous run is still in the queue or executing.
 */
export function scheduleBackgroundInterval(name, fn, intervalMs) {
  let inFlight = false;
  return setInterval(() => {
    if (inFlight) {
      console.warn(`[background] ${name} skipped (still running)`);
      return;
    }
    scheduleBackgroundJob(name, async () => {
      inFlight = true;
      try {
        await fn();
      } finally {
        inFlight = false;
      }
    });
  }, intervalMs);
}
