export function createLookupCache(loadProfile) {
  const entries = new Map();
  return {
    async get(tenantId, userId, locale) {
      const key = JSON.stringify([tenantId, userId, locale]);
      let entry = entries.get(key);
      if (!entry) {
        entry = { tenantId, userId };
        entry.promise = Promise.resolve().then(() => loadProfile(tenantId, userId, locale)).catch((error) => {
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        });
        entries.set(key, entry);
      }
      return structuredClone(await entry.promise);
    },
    invalidate(tenantId, userId) {
      for (const [key, entry] of entries) {
        if (entry.tenantId === tenantId && entry.userId === userId) entries.delete(key);
      }
    },
  };
}
