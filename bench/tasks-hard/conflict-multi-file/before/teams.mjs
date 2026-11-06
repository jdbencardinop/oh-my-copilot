import { clampLimit, parseOffset } from "./limits.mjs";

export class NotFoundError extends Error {}

function present(team) {
  return { id: team.id, name: team.name };
}

/**
 * Lists teams for the admin console, `limit` at a time.
 */
export function listTeams(store, query = {}) {
  const limit = clampLimit(query.limit);
  const offset = parseOffset(query.offset);
  const rows = store.teams.filter((team) => !team.deleted);
  return { items: rows.slice(offset, offset + limit).map(present), total: rows.length };
}

export function getTeam(store, id) {
  const team = store.teams.find((row) => row.id === id && !row.deleted);
  return team ? present(team) : null;
}
