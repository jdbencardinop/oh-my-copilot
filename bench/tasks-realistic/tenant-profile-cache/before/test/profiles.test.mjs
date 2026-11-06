import assert from "node:assert/strict";
import test from "node:test";
import { makeProfiles } from "../src/profiles.mjs";

test("reuses a successful profile lookup", async () => {
  let calls = 0;
  const profiles = makeProfiles(async () => {
    calls++;
    return { name: "Ada" };
  });
  assert.deepEqual(await profiles.get("acme", "42"), { name: "Ada" });
  assert.deepEqual(await profiles.get("acme", "42"), { name: "Ada" });
  assert.equal(calls, 1);
});
