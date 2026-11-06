// Helpers for the background job runner.

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function backoff(attempt, baseMs = 100, capMs = 5000) {
  return Math.min(capMs, baseMs * 2 ** (attempt - 1));
}

/**
 * Counts jobs per status: { queued: 3, running: 1, ... }.
 */
export function countByStatus(jobs) {
  const totals = {};
  for (const job of jobs) {
    let count = totals[job.status] ?? 0;
    count += 1;
    totals[job.status] = count;
  }
  return totals;
}

/**
 * Calls `task(attempt)` until it succeeds, waiting `backoff(attempt)` between
 * attempts. Gives up after `retries` retries.
 */
export async function runWithRetry(task, { retries = 3, wait = sleep, onRetry = () => {} } = {}) {
  let count = 0;
  let lastError;
  const attempt = async () => {
    count += 1;
    return task(count);
  };
  while (count <= retries) {
    try {
      const value = await attempt();
      return { value, attempts: count };
    } catch (error) {
      lastError = error;
      if (count > retries) break;
      onRetry(error, count);
      await wait(backoff(count));
    }
  }
  const error = new Error(`job failed after ${count} attempts: ${lastError.message}`);
  error.cause = lastError;
  throw error;
}

/**
 * Runs tasks with at most `limit` in flight; resolves to their results in order.
 */
export async function runPool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  let count = 0;
  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      count += 1;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return { results, count };
}

/**
 * Formats "3 jobs" / "1 job".
 */
export function pluralJobs(count) {
  return `${count} job${count === 1 ? "" : "s"}`;
}

/**
 * Drops the oldest finished jobs so that at most `keep` remain.
 */
export function pruneFinished(jobs, keep) {
  const finished = jobs.filter((job) => job.status === "done").sort((a, b) => a.finishedAt - b.finishedAt);
  let count = finished.length;
  const drop = new Set();
  for (const job of finished) {
    if (count <= keep) break;
    drop.add(job.id);
    count -= 1;
  }
  return jobs.filter((job) => !drop.has(job.id));
}
