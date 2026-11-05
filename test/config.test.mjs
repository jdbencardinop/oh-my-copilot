import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { featureActive, parseFeatureList, resolveConfig } from "../plugin/com.github.copilot/extensions/omc/lib/config.mjs";
import { createJsonCache, findProjectOmcDir } from "../plugin/com.github.copilot/extensions/omc/lib/files.mjs";
import { createBreaker } from "../plugin/com.github.copilot/extensions/omc/lib/guard.mjs";

test("defaults: everything on", () => {
  const cfg = resolveConfig();
  assert.equal(cfg.enabled, true);
  assert.deepEqual(cfg.features, { hashline: true, nudge: true, rules: true, imports: true });
  assert.equal(cfg.circuitBreakerThreshold, 3);
});

test("later layers win and record their origin", () => {
  const cfg = resolveConfig({
    layers: [
      { source: "user config", data: { features: { rules: false }, circuitBreakerThreshold: 5 } },
      { source: "project config", data: { enabled: false, features: { rules: true, unknown: false } } },
    ],
  });
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.enabledOrigin, "project config");
  assert.equal(cfg.features.rules, true);
  assert.equal(cfg.featureOrigin.rules, "project config");
  assert.equal(cfg.circuitBreakerThreshold, 5);
  assert.equal(Object.hasOwn(cfg.features, "unknown"), false);
});

test("env kill switches only turn things off", () => {
  const cfg = resolveConfig({
    env: { OMC_DISABLE: "true", OMC_DISABLE_FEATURES: "rules, bogus" },
    layers: [{ source: "project config", data: { enabled: true } }],
  });
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.enabledOrigin, "env OMC_DISABLE");
  assert.equal(cfg.features.rules, false);
  assert.equal(cfg.features.hashline, true);
  assert.equal(resolveConfig({ env: { OMC_DISABLE: "0" } }).enabled, true);
  assert.deepEqual(parseFeatureList("all"), ["hashline", "nudge", "rules", "imports"]);
});

test("featureActive requires master switch, feature switch, and an untripped breaker", () => {
  const state = { enabled: true, features: { hashline: true, rules: true }, tripped: new Set() };
  assert.equal(featureActive(state, "hashline"), true);
  state.tripped.add("hashline");
  assert.equal(featureActive(state, "hashline"), false);
  assert.equal(featureActive({ ...state, enabled: false }, "rules"), false);
});

test("circuit breaker fails open and trips after consecutive errors", async () => {
  const events = [];
  const breaker = createBreaker({ threshold: 2, onTrip: (f) => events.push(`trip:${f}`) });
  let shouldThrow = true;
  const fn = breaker.wrap("x", async () => {
    if (shouldThrow) throw new Error("boom");
    return "ok";
  }, "fallback");
  assert.equal(await fn(), "fallback");
  shouldThrow = false;
  assert.equal(await fn(), "ok");
  assert.equal(breaker.failures("x"), 0);
  shouldThrow = true;
  await fn();
  await fn();
  assert.deepEqual(events, ["trip:x"]);
  shouldThrow = false;
  assert.equal(await fn(), "fallback", "tripped feature stays off");
  breaker.reset("x");
  assert.equal(await fn(), "ok");
});

test("breaker survives throwing callbacks", async () => {
  const breaker = createBreaker({ threshold: 1, onError: () => { throw new Error("x"); }, onTrip: () => { throw new Error("y"); } });
  const fn = breaker.wrap("f", async () => { throw new Error("boom"); }, (_a, err) => `handled ${err.message}`);
  assert.equal(await fn("a"), "handled boom");
});

test("findProjectOmcDir walks up to the git root; json cache tracks changes", () => {
  const root = mkdtempSync(join(tmpdir(), "omc-test-"));
  try {
    mkdirSync(join(root, "repo", ".git"), { recursive: true });
    mkdirSync(join(root, "repo", "src", "deep"), { recursive: true });
    assert.equal(findProjectOmcDir(join(root, "repo", "src", "deep")), null);
    mkdirSync(join(root, "repo", ".github", "omc"), { recursive: true });
    assert.equal(findProjectOmcDir(join(root, "repo", "src", "deep")), join(root, "repo", ".github", "omc"));

    const cache = createJsonCache();
    const file = join(root, "c.json");
    assert.deepEqual(cache.read(file), { data: undefined });
    writeFileSync(file, '{"a":1}');
    const first = cache.read(file);
    assert.deepEqual(first.data, { a: 1 });
    assert.equal(cache.read(file), first, "unchanged file is served from cache");
    writeFileSync(file, "{bad json");
    utimesSync(file, new Date(), new Date(Date.now() + 5000));
    assert.match(cache.read(file).error, /c\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
