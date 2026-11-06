import assert from "node:assert/strict";
import test from "node:test";
import { buildConfig } from "../src/config.mjs";

test("provides basic defaults", () => {
  const config = buildConfig();
  assert.equal(config.cache.enabled, true);
  assert.equal(config.http.timeoutMs, 2000);
});
