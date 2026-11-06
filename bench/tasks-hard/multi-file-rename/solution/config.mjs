// Configuration loading for the deploy tool.

const DEFAULTS = {
  region: "eastus",
  replicas: 2,
  logLevel: "info",
  timeoutSeconds: 30,
};

const SCHEMA = {
  region: "string",
  replicas: "number",
  logLevel: "string",
  timeoutSeconds: "number",
};

/**
 * Returns the schema used to validate configuration objects.
 * @returns {Record<string, string>}
 */
export function loadConfigSchema() {
  return { ...SCHEMA };
}

/**
 * Merges user settings over the defaults and validates the result against
 * the schema from loadConfigSchema().
 * @param {Record<string, unknown>} [overrides]
 */
export function resolveConfig(overrides = {}) {
  const config = { ...DEFAULTS, ...overrides };
  const schema = loadConfigSchema();
  for (const [key, type] of Object.entries(schema)) {
    if (typeof config[key] !== type) {
      throw new TypeError(`config.${key} must be a ${type}`);
    }
  }
  return config;
}

export function describeConfig(config) {
  return Object.entries(config)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
}
