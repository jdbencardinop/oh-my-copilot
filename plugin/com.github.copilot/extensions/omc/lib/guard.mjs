// Fail-open wrappers with a per-feature circuit breaker.
// A feature that throws repeatedly is switched off for the rest of the session
// so Copilot keeps working with its built-in behavior.

export function createBreaker({ threshold = 3, tripped = new Set(), onError = () => {}, onTrip = () => {} } = {}) {
  const failures = new Map();

  function recordFailure(feature, err) {
    const count = (failures.get(feature) ?? 0) + 1;
    failures.set(feature, count);
    safeCall(onError, feature, err, count);
    if (count >= threshold && !tripped.has(feature)) {
      tripped.add(feature);
      safeCall(onTrip, feature, err);
    }
  }

  return {
    tripped,
    get threshold() {
      return threshold;
    },
    set threshold(value) {
      threshold = value;
    },
    failures(feature) {
      return failures.get(feature) ?? 0;
    },
    reset(feature) {
      if (feature) {
        failures.delete(feature);
        tripped.delete(feature);
      } else {
        failures.clear();
        tripped.clear();
      }
    },
    /** Wrap fn so errors return `fallback` instead of propagating. */
    wrap(feature, fn, fallback) {
      return async (...args) => {
        if (tripped.has(feature)) return typeof fallback === "function" ? fallback(...args) : fallback;
        try {
          const result = await fn(...args);
          failures.set(feature, 0);
          return result;
        } catch (err) {
          recordFailure(feature, err);
          return typeof fallback === "function" ? fallback(...args, err) : fallback;
        }
      };
    },
  };
}

function safeCall(fn, ...args) {
  try {
    fn(...args);
  } catch {
    // Reporting must never break the caller.
  }
}
