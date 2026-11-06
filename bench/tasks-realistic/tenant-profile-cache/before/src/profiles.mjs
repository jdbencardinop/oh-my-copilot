import { createLookupCache } from "./cache.mjs";

export function makeProfiles(loadProfile) {
  const cache = createLookupCache(loadProfile);
  return {
    get(tenantId, userId, locale = "en") {
      return cache.get(tenantId, userId, locale);
    },
    invalidate(tenantId, userId) {
      cache.invalidate(tenantId, userId);
    },
  };
}
