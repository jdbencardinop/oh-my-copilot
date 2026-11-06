export function createLookupCache(loadProfile) {
  const entries = new Map();
  return {
    async get(tenantId, userId, locale) {
      if (!entries.has(userId)) {
        entries.set(userId, await loadProfile(tenantId, userId, locale));
      }
      return entries.get(userId);
    },
    invalidate(tenantId, userId) {
      entries.delete(userId);
    },
  };
}
