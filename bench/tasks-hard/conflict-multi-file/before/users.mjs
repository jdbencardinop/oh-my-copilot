import { clampLimit, parseOffset } from "./limits.mjs";

export class NotFoundError extends Error {}

function present(user) {
  return { id: user.id, name: user.name };
}

/**
 * Lists users for the admin console, `limit` at a time.
 */
export function listUsers(store, query = {}) {
  const limit = clampLimit(query.limit);
  const offset = parseOffset(query.offset);
  const rows = store.users.filter((user) => !user.deleted);
  return { items: rows.slice(offset, offset + limit).map(present), total: rows.length };
}

export function getUser(store, id) {
  const user = store.users.find((row) => row.id === id && !row.deleted);
  return user ? present(user) : null;
}
