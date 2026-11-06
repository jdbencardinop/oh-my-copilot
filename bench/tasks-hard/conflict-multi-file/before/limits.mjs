// Paging limits shared by the list endpoints.

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export function clampLimit(raw) {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`invalid limit ${raw}`);
  return Math.min(n, MAX_LIMIT);
}

export function parseOffset(raw) {
  const n = Number(raw ?? 0);
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`invalid offset ${raw}`);
  return n;
}
