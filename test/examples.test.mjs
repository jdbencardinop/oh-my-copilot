import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveConfig } from "../plugin/com.github.copilot/extensions/omc/lib/config.mjs";
import { compileRules, evaluateRules, toHookOutput } from "../plugin/com.github.copilot/extensions/omc/lib/rules.mjs";

const load = (name) => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8"));

test("examples/rules.json compiles and each rule fires as documented", () => {
  const { rules, errors } = compileRules(load("rules.json"), "example");
  assert.deepEqual(errors, []);
  assert.equal(rules.length, 3);
  const decide = (tool, args) => toHookOutput(evaluateRules(rules, tool, args));

  assert.equal(decide("bash", { command: "git push --force origin main" }).permissionDecision, "ask");
  assert.equal(decide("bash", { command: "git push -f" }).permissionDecision, "ask");
  assert.equal(decide("bash", { command: "git push origin main" }), undefined);

  const key = "-----BEGIN RSA PRIVATE KEY-----\nabc";
  assert.equal(decide("create", { path: "id_rsa", file_text: key }).permissionDecision, "deny");

  assert.match(decide("edit", { path: "src/a.ts", old_str: "x", new_str: "console.log(x)" }).additionalContext, /logger/);
  assert.equal(decide("edit", { path: "src/a.py", old_str: "x", new_str: "console.log(x)" }), undefined);
});

test("examples/config.json matches the defaults", () => {
  const cfg = resolveConfig({ layers: [{ source: "example", data: load("config.json") }] });
  assert.equal(cfg.enabled, true);
  assert.deepEqual(cfg.features, { hashline: true, nudge: true, rules: true, conflicts: true });
  assert.equal(cfg.circuitBreakerThreshold, 3);
});
