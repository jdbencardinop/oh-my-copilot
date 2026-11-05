// Configuration and kill-switch resolution. Pure: callers pass env and file data.

export const FEATURES = ["hashline", "nudge", "rules", "imports"];

export function isTruthy(value) {
  return typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());
}

export function parseFeatureList(value) {
  if (typeof value !== "string") return [];
  const names = value.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return names.includes("all") ? [...FEATURES] : names.filter((n) => FEATURES.includes(n));
}

/**
 * Merge config layers (lowest precedence first), then apply environment
 * kill switches, which can only turn things off.
 *
 * Config file shape: { "enabled": bool, "features": { "<name>": bool }, "circuitBreakerThreshold": int }
 */
export function resolveConfig({ env = {}, layers = [] } = {}) {
  const cfg = {
    enabled: true,
    enabledOrigin: "default",
    features: Object.fromEntries(FEATURES.map((f) => [f, true])),
    featureOrigin: Object.fromEntries(FEATURES.map((f) => [f, "default"])),
    circuitBreakerThreshold: 3,
  };
  for (const { source, data } of layers) {
    if (!data || typeof data !== "object") continue;
    if (typeof data.enabled === "boolean") {
      cfg.enabled = data.enabled;
      cfg.enabledOrigin = source;
    }
    if (data.features && typeof data.features === "object") {
      for (const f of FEATURES) {
        if (typeof data.features[f] === "boolean") {
          cfg.features[f] = data.features[f];
          cfg.featureOrigin[f] = source;
        }
      }
    }
    if (Number.isInteger(data.circuitBreakerThreshold) && data.circuitBreakerThreshold > 0) {
      cfg.circuitBreakerThreshold = data.circuitBreakerThreshold;
    }
  }
  if (isTruthy(env.OMC_DISABLE)) {
    cfg.enabled = false;
    cfg.enabledOrigin = "env OMC_DISABLE";
  }
  for (const f of parseFeatureList(env.OMC_DISABLE_FEATURES)) {
    cfg.features[f] = false;
    cfg.featureOrigin[f] = "env OMC_DISABLE_FEATURES";
  }
  return cfg;
}

/** True when a feature should run right now. */
export function featureActive(state, feature) {
  return state.enabled && state.features[feature] === true && !state.tripped.has(feature);
}
