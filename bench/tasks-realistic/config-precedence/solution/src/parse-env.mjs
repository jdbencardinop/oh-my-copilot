function parseBoolean(value, name) {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new TypeError(`invalid ${name}`);
}

function parseInteger(value, name) {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) throw new TypeError(`invalid ${name}`);
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed)) throw new TypeError(`invalid ${name}`);
  return parsed;
}

export function parseEnv(env) {
  const parsed = {};
  if (env.CACHE_ENABLED !== undefined) {
    parsed.cache = { ...parsed.cache, enabled: parseBoolean(env.CACHE_ENABLED, "CACHE_ENABLED") };
  }
  if (env.CACHE_TTL_SECONDS !== undefined) {
    parsed.cache = { ...parsed.cache, ttlSeconds: parseInteger(env.CACHE_TTL_SECONDS, "CACHE_TTL_SECONDS") };
  }
  if (env.HTTP_TIMEOUT_MS !== undefined) {
    parsed.http = { timeoutMs: parseInteger(env.HTTP_TIMEOUT_MS, "HTTP_TIMEOUT_MS") };
  }
  return parsed;
}
