export function parseEnv(env) {
  const parsed = {};
  if (env.CACHE_ENABLED !== undefined) {
    parsed.cache = { ...parsed.cache, enabled: Boolean(env.CACHE_ENABLED) };
  }
  if (env.CACHE_TTL_SECONDS !== undefined) {
    parsed.cache = { ...parsed.cache, ttlSeconds: Number(env.CACHE_TTL_SECONDS) || 60 };
  }
  if (env.HTTP_TIMEOUT_MS !== undefined) {
    parsed.http = { timeoutMs: Number(env.HTTP_TIMEOUT_MS) || 2000 };
  }
  return parsed;
}
