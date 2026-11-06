import assert from "node:assert/strict";
import { assertUnchanged, load } from "../_lib/check.mjs";

assertUnchanged(import.meta.url, ["test/config.test.mjs", "src/defaults.mjs"]);
const { buildConfig } = await load("src/config.mjs");
const { defaults } = await load("src/defaults.mjs");
const originalDefaults = structuredClone(defaults);
const project = {
  cache: { enabled: false },
  http: { headers: { "x-project": "blue" } },
  labels: ["project", "second"],
  note: "project",
};
const overrides = {
  cache: { enabled: undefined },
  http: { headers: { accept: "" } },
  labels: [],
  note: "",
};
const originalProject = structuredClone(project);
const originalOverrides = structuredClone(overrides);
const config = buildConfig({
  project,
  env: { CACHE_ENABLED: "  FALSE ", CACHE_TTL_SECONDS: "0", HTTP_TIMEOUT_MS: " 0 ", IRRELEVANT: "ignored" },
  overrides,
});
assert.deepEqual(config.cache, { enabled: false, ttlSeconds: 0 });
assert.deepEqual(config.http, { timeoutMs: 0, headers: { accept: "", "x-client": "desk", "x-project": "blue" } });
assert.deepEqual(config.labels, []);
assert.equal(config.note, "");
config.http.headers["x-project"] = "mutated";
config.labels.push("mutated");
assert.deepEqual(project, originalProject, "inputs must remain unchanged");
assert.deepEqual(overrides, originalOverrides, "overrides must remain unchanged");
assert.deepEqual(defaults, originalDefaults, "shared defaults must remain unchanged");
const another = buildConfig({ project });
assert.equal(another.http.headers["x-project"], "blue", "config objects must be independent");
another.labels.push("local");
assert.deepEqual(buildConfig({ project }).labels, ["project", "second"]);

assert.equal(buildConfig({ project: { cache: null } }).cache, null, "null must replace a nested object");
assert.equal(buildConfig({ project: { cache: null }, overrides: { cache: { enabled: false } } }).cache.enabled, false);
assert.equal(buildConfig({ env: { CACHE_ENABLED: "1" }, overrides: { cache: { enabled: false } } }).cache.enabled, false);
assert.equal(buildConfig({ env: { CACHE_ENABLED: "0" } }).cache.enabled, false);
assert.equal(buildConfig({ env: { CACHE_ENABLED: "TrUe" } }).cache.enabled, true);
assert.equal(buildConfig({ env: { CACHE_TTL_SECONDS: String(Number.MAX_SAFE_INTEGER) } }).cache.ttlSeconds, Number.MAX_SAFE_INTEGER);
const special = buildConfig({ project: JSON.parse('{"__proto__":{"setting":"value"}}') });
assert.equal(Object.getPrototypeOf(special), Object.prototype, "own keys must not change the result's prototype");
assert.equal(Object.hasOwn(special, "__proto__"), true);
assert.equal(special.__proto__.setting, "value");
for (const value of ["", "maybe", "2"]) {
  assert.throws(() => buildConfig({ env: { CACHE_ENABLED: value } }), `invalid boolean ${value}`);
}
for (const name of ["CACHE_TTL_SECONDS", "HTTP_TIMEOUT_MS"]) {
  for (const value of ["", "-1", "1.5", "1e2", "9007199254740992"]) {
    assert.throws(() => buildConfig({ env: { [name]: value } }), `invalid integer ${name}=${value}`);
  }
}
console.log("ok");
