import { eq, fail, load, noConflictMarkers } from "../_lib/check.mjs";

noConflictMarkers(["limits.mjs", "users.mjs", "teams.mjs"]);
const limits = await load("limits.mjs");
const users = await load("users.mjs");
const teams = await load("teams.mjs");

eq([limits.DEFAULT_LIMIT, limits.MAX_LIMIT], [50, 200], "DEFAULT_LIMIT and MAX_LIMIT");
eq([limits.clampLimit(undefined), limits.clampLimit("500"), limits.clampLimit(7)], [50, 200, 7], "clampLimit");
eq(limits.parseOffset("3"), 3, "parseOffset");

const rows = (prefix) => [
  { id: 1, name: `${prefix} Zed`, email: "z@x.io" },
  { id: 2, name: `${prefix} Amy`, email: "a@x.io", suspended: true },
  { id: 3, name: `${prefix} Bob`, email: "b@x.io", deleted: true },
  { id: 4, name: `${prefix} Cat`, email: "c@x.io" },
];
const store = { users: rows("U"), teams: rows("T") };

eq(users.listUsers(store), { items: [{ id: 2, name: "U Amy" }, { id: 4, name: "U Cat" }, { id: 1, name: "U Zed" }], total: 3 }, "listUsers sorted, suspended listed");
eq(users.listUsers(store, { limit: 1, offset: 1 }).items, [{ id: 4, name: "U Cat" }], "listUsers paging");
eq(teams.listTeams(store), { items: [{ id: 1, name: "T Zed" }, { id: 4, name: "T Cat" }], total: 2 }, "listTeams unsorted, suspended hidden");

eq(users.getUser(store, 4), { id: 4, name: "U Cat", email: "c@x.io" }, "getUser includes email");
eq(teams.getTeam(store, 4), { id: 4, name: "T Cat" }, "getTeam");
for (const [what, fn, Err] of [
  ["getUser missing", () => users.getUser(store, 3), users.NotFoundError],
  ["getTeam missing", () => teams.getTeam(store, 99), teams.NotFoundError],
]) {
  let thrown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  if (!(thrown instanceof Err)) fail(`${what}: expected NotFoundError, got ${thrown ?? "no exception"}`);
}
console.log("ok");
