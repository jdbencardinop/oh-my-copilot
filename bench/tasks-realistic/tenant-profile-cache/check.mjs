import assert from "node:assert/strict";
import { assertUnchanged, load } from "../_lib/check.mjs";

assertUnchanged(import.meta.url, ["test/profiles.test.mjs"]);
const { makeProfiles } = await load("src/profiles.mjs");

const calls = [];
const profiles = makeProfiles(async (tenantId, userId, locale) => {
  calls.push([tenantId, userId, locale]);
  return { tenantId, userId, locale, tags: ["original"], details: { enabled: true } };
});

const [first, concurrent] = await Promise.all([
  profiles.get("north", "42", "en"),
  profiles.get("north", "42", "en"),
]);
assert.equal(calls.length, 1, "concurrent lookups should share a pending load");
first.tags.push("changed");
first.details.enabled = false;
assert.deepEqual(concurrent.tags, ["original"], "concurrent results must not share nested data");
assert.equal((await profiles.get("north", "42", "en")).details.enabled, true, "cached data must not be mutable by callers");
assert.equal((await profiles.get("south", "42", "en")).tenantId, "south", "tenant must be part of the key");
assert.equal((await profiles.get("north", "42", "es")).locale, "es", "locale must be part of the key");
await profiles.get("north", "99", "en");
await profiles.get("a|b", "c", "en");
assert.equal((await profiles.get("a", "b|c", "en")).tenantId, "a", "delimiters in identifiers must not collide");

profiles.invalidate("north", "42");
const before = calls.length;
await profiles.get("south", "42", "en");
await profiles.get("north", "99", "en");
assert.equal(calls.length, before, "invalidation must not evict other tenants or users");
await profiles.get("north", "42", "en");
await profiles.get("north", "42", "es");
assert.equal(calls.length, before + 2, "invalidation must evict every locale");

let attempts = 0;
const retriable = makeProfiles(async () => {
  if (++attempts === 1) throw new Error("temporary failure");
  return { ok: true };
});
await assert.rejects(retriable.get("t", "u"), /temporary failure/);
assert.deepEqual(await retriable.get("t", "u"), { ok: true }, "failed loads must not stay cached");
assert.equal(attempts, 2);

let rejectOld;
let resolveNew;
let racingCalls = 0;
const racing = makeProfiles(() => {
  racingCalls++;
  return racingCalls === 1
    ? new Promise((_, reject) => { rejectOld = reject; })
    : new Promise((resolve) => { resolveNew = resolve; });
});
const old = racing.get("tenant", "user");
await new Promise((resolve) => setImmediate(resolve));
assert.equal(racingCalls, 1);
racing.invalidate("tenant", "user");
const fresh = racing.get("tenant", "user");
await new Promise((resolve) => setImmediate(resolve));
assert.equal(racingCalls, 2, "invalidation must start a fresh load even when the old one is pending");
resolveNew({ version: "new" });
assert.deepEqual(await fresh, { version: "new" });
rejectOld(new Error("old request failed"));
await assert.rejects(old, /old request failed/);
assert.deepEqual(await racing.get("tenant", "user"), { version: "new" }, "an older failure must not evict the new entry");
assert.equal(racingCalls, 2);

let resolveStale;
let refreshCalls = 0;
const refreshing = makeProfiles(() => ++refreshCalls === 1
  ? new Promise((resolve) => { resolveStale = resolve; })
  : Promise.resolve({ version: "new" }));
const stale = refreshing.get("tenant", "user");
await new Promise((resolve) => setImmediate(resolve));
refreshing.invalidate("tenant", "user");
assert.deepEqual(await refreshing.get("tenant", "user"), { version: "new" });
resolveStale({ version: "old" });
assert.deepEqual(await stale, { version: "old" });
assert.deepEqual(await refreshing.get("tenant", "user"), { version: "new" }, "a late old success must not replace the refreshed value");
assert.equal(refreshCalls, 2);
console.log("ok");
