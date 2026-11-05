import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveConfig } from "../plugin/com.github.copilot/extensions/omc/lib/config.mjs";
import { parseMdc } from "../plugin/com.github.copilot/extensions/omc/lib/imports.mjs";
import { compileRules, evaluatePostRules, evaluateRules, toHookOutput, toPostHookOutput } from "../plugin/com.github.copilot/extensions/omc/lib/rules.mjs";

const load = (name) => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), "utf8"));

test("examples/rules.json compiles and each rule fires as documented", () => {
  const { rules, errors } = compileRules(load("rules.json"), "example");
  assert.deepEqual(errors, []);
  assert.equal(rules.length, 5);
  const decide = (tool, args) => toHookOutput(evaluateRules(rules, tool, args, { cwd: "/repo", root: "/repo" }));

  assert.equal(decide("bash", { command: "git push --force origin main" }).permissionDecision, "ask");
  assert.equal(decide("bash", { command: "git push -f" }).permissionDecision, "ask");
  assert.equal(decide("bash", { command: "git push origin main" }), undefined);

  const key = "-----BEGIN RSA PRIVATE KEY-----\nabc";
  assert.equal(decide("create", { path: "id_rsa", file_text: key }).permissionDecision, "deny");

  assert.match(decide("edit", { path: "src/a.ts", old_str: "x", new_str: "console.log(x)" }).additionalContext, /logger/);
  assert.equal(decide("edit", { path: "src/a.py", old_str: "x", new_str: "console.log(x)" }), undefined);
  assert.equal(decide("edit", { path: "src/a.test.ts", old_str: "x", new_str: "console.log(x)" }), undefined);

  assert.equal(decide("edit", { path: "/repo/src/generated/api.ts", old_str: "a", new_str: "b" }).permissionDecision, "deny");
  assert.equal(decide("edit", { path: "/repo/src/api.ts", old_str: "a", new_str: "b" }), undefined);

  const after = (out) => toPostHookOutput(evaluatePostRules(rules, "bash", { command: "npm test" }, out));
  assert.match(after("FAIL src/a.test.ts\nTests: 1 failed, 3 passed").additionalContext, /tests-failed/);
  assert.match(after("ok 1 - a\nnot ok 2 - b").additionalContext, /tests-failed/);
  assert.equal(after("Tests: 0 failed, 4 passed"), undefined);
});

test("examples/config.json matches the defaults", () => {
  const cfg = resolveConfig({ layers: [{ source: "example", data: load("config.json") }] });
  assert.equal(cfg.enabled, true);
  assert.deepEqual(cfg.features, { hashline: true, nudge: true, rules: true, imports: true });
  assert.equal(cfg.circuitBreakerThreshold, 3);
});

test("examples/cursor-rules parse as one always rule and one glob-scoped rule", () => {
  const read = (name) => readFileSync(new URL(`../examples/cursor-rules/${name}`, import.meta.url), "utf8");
  const project = parseMdc(read("project.mdc"), "project.mdc").rule;
  assert.equal(project.kind, "always");
  const ts = parseMdc(read("typescript.mdc"), "typescript.mdc").rule;
  assert.equal(ts.kind, "glob");
  assert.ok(ts.match("src/ui/App.tsx"));
  assert.ok(!ts.match("src/a.test.ts"));
});
