// Configuration and kill-switch resolution. Pure: callers pass env and file data.

export const FEATURES = ["hashline", "nudge", "rules", "imports", "streamRules", "conflicts"];

// Opt-in features: off unless a config file or /omc turns them on.
export const DEFAULT_OFF = new Set(["imports", "streamRules"]);

export const IMPORT_ROOTS = [
  ".cursor/rules", ".cursorrules", ".clinerules",
  ".windsurf/rules", ".windsurf/global_rules.md", ".windsurfrules",
];

/** Literal, project-relative file or directory; never an arbitrary file reader. */
export function normalizeImportPath(value) {
  if (typeof value !== "string") throw new Error("Import path must be a string.");
  const path = value.trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!path || path.split("/").some((p) => !p || p === "." || p === "..") || /[*?[\]{}\x00-\x1f]/.test(path)) {
    throw new Error(`Invalid import path "${value}": use a literal project-relative path, not a glob.`);
  }
  if (!IMPORT_ROOTS.some((root) => path === root ||
    ([".cursor/rules", ".clinerules", ".windsurf/rules"].includes(root) && path.startsWith(`${root}/`)))) {
    throw new Error(`Unsupported import path "${value}". Supported roots: ${IMPORT_ROOTS.join(", ")}.`);
  }
  return path;
}

/** The most specific file/directory selection wins over the default. */
export function importPathEnabled(path, defaultOn, selections = {}) {
  let enabled = defaultOn;
  let specificity = -1;
  for (const [prefix, value] of Object.entries(selections)) {
    if ((path === prefix || path.startsWith(`${prefix}/`)) && prefix.length > specificity) {
      enabled = value;
      specificity = prefix.length;
    }
  }
  return enabled;
}

/** Canonical feature name for user input in any letter case, or undefined. */
export function canonicalFeature(name) {
  if (typeof name !== "string") return undefined;
  const lower = name.trim().toLowerCase();
  return FEATURES.find((f) => f.toLowerCase() === lower);
}

export function isTruthy(value) {
  return typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());
}

export function parseFeatureList(value) {
  if (typeof value !== "string") return [];
  const names = value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  if (names.some((n) => n.toLowerCase() === "all")) return [...FEATURES];
  return [...new Set(names.map(canonicalFeature).filter(Boolean))];
}

/**
 * Merge config layers (lowest precedence first), then apply environment
 * kill switches, which can only turn things off.
 *
 * importPaths selects literal source paths; features.imports sets the default
 * for unselected sources. Environment kill switches still disable all imports.
 */
export function resolveConfig({ env = {}, layers = [] } = {}) {
  const cfg = {
    enabled: true,
    enabledOrigin: "default",
    features: Object.fromEntries(FEATURES.map((f) => [f, !DEFAULT_OFF.has(f)])),
    featureOrigin: Object.fromEntries(FEATURES.map((f) => [f, "default"])),
    circuitBreakerThreshold: 3,
    importPaths: {},
    importPathErrors: [],
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
    if (data.importPaths !== undefined) {
      if (!data.importPaths || typeof data.importPaths !== "object" || Array.isArray(data.importPaths)) {
        cfg.importPathErrors.push(`${source}: importPaths must be an object of path: boolean entries.`);
      } else {
        for (const [path, enabled] of Object.entries(data.importPaths)) {
          try {
            if (typeof enabled !== "boolean") throw new Error(`Import selection "${path}" must be boolean.`);
            cfg.importPaths[normalizeImportPath(path)] = enabled;
          } catch (err) {
            cfg.importPathErrors.push(`${source}: ${err.message}`);
          }
        }
      }
    }
  }
  cfg.importDefault = cfg.features.imports;
  if (!cfg.features.imports && Object.values(cfg.importPaths).includes(true)) {
    cfg.features.imports = true;
    cfg.featureOrigin.imports = "importPaths";
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
