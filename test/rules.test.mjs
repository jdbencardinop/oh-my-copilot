import assert from "node:assert/strict";
import { test } from "node:test";
import { compileRules, evaluateRules, matchText, targetPaths, toHookOutput } from "../plugin/com.github.copilot/extensions/omc/lib/rules.mjs";

const RULES = {
  rules: [
    { id: "no-rm-root", tools: ["bash"], pattern: "rm\\s+-rf\\s+/(\\s|$)", message: "Never delete the root." },
    { id: "no-console", tools: ["edit", "create", "edit_anchored"], pathPattern: "\\.ts$", pattern: "console\\.log\\(", action: "context", message: "Use the logger." },
    { id: "ask-push", tools: ["bash"], pattern: "git\\s+push\\b.*--force", action: "ask", message: "Force push needs approval." },
    { id: "off", pattern: "x", enabled: false },
  ],
};

test("compileRules keeps valid rules and reports invalid ones without throwing", () => {
  const { rules, errors } = compileRules(
    { rules: [...RULES.rules, { id: "bad-regex", pattern: "(" }, { id: "bad-action", pattern: "x", action: "nuke" }, { id: "no-pattern" }, 5] },
    "test",
  );
  assert.deepEqual(rules.map((r) => r.id), ["no-rm-root", "no-console", "ask-push"]);
  assert.equal(errors.length, 4);
  assert.ok(errors.every((e) => e.startsWith("test: rule")));
  assert.deepEqual(compileRules({ nope: true }).errors.length, 1);
  assert.deepEqual(compileRules(undefined), { rules: [], errors: [] });
});

test("matchText targets what the tool writes or runs", () => {
  assert.equal(matchText("bash", { command: "ls", description: "rm -rf /" }), "ls");
  assert.equal(matchText("edit", { path: "a", old_str: "console.log(1)", new_str: "log(1)" }), "log(1)");
  assert.equal(matchText("create", { path: "a", file_text: "body" }), "body");
  assert.equal(matchText("edit_anchored", { path: "a", edits: [{ op: "delete", start: "1:aa" }, { op: "replace", content: "z" }] }), "\nz");
  assert.equal(matchText("apply_patch", { input: "*** Update File: a\n-old\n+new\n context" }), "new");
  assert.equal(matchText("unknown", { a: "x", b: ["y", { c: "z" }] }), "x\ny\nz");
  assert.equal(matchText("edit", { old_str: "q", new_str: "r" }, "all"), "q\nr");
  assert.equal(matchText("edit", { nested: { v: "deep" } }, "nested.v"), "deep");
});

test("targetPaths reads path args and apply_patch headers", () => {
  assert.deepEqual(targetPaths("edit", { path: "/x/a.ts" }), ["/x/a.ts"]);
  assert.deepEqual(targetPaths("apply_patch", { input: "*** Add File: b.ts\n+x\n*** Delete File: c.js" }), ["b.ts", "c.js"]);
});

test("evaluateRules filters by tool, path, and pattern", () => {
  const { rules } = compileRules(RULES);
  const deny = evaluateRules(rules, "bash", { command: "sudo rm -rf / " });
  assert.deepEqual(deny.deny.map((r) => r.id), ["no-rm-root"]);
  assert.equal(evaluateRules(rules, "bash", { command: "rm -rf /tmp/x" }).deny.length, 0);
  assert.equal(evaluateRules(rules, "create", { path: "a.ts", file_text: "console.log(1)" }).context.length, 1);
  assert.equal(evaluateRules(rules, "create", { path: "a.js", file_text: "console.log(1)" }).context.length, 0);
  assert.equal(evaluateRules(rules, "edit", { path: "a.ts", old_str: "console.log(1)", new_str: "" }).context.length, 0);
  assert.equal(evaluateRules(rules, "view", { path: "a.ts" }).context.length, 0);
});

test("toHookOutput: deny wins, ask carries context, context alone adds context", () => {
  const { rules } = compileRules(RULES);
  const [rm, cons, push] = rules;
  assert.equal(toHookOutput({ deny: [], ask: [], context: [] }), undefined);
  const d = toHookOutput({ deny: [rm], ask: [push], context: [cons] });
  assert.equal(d.permissionDecision, "deny");
  assert.match(d.permissionDecisionReason, /\[omc rule no-rm-root\] Never delete the root\./);
  const a = toHookOutput({ deny: [], ask: [push], context: [cons] });
  assert.equal(a.permissionDecision, "ask");
  assert.match(a.additionalContext, /Use the logger/);
  assert.deepEqual(toHookOutput({ deny: [], ask: [], context: [cons] }), { additionalContext: "[omc rule no-console] Use the logger." });
});

test("flags are sanitized so stateful regexes cannot skip matches", () => {
  const { rules } = compileRules({ rules: [{ id: "g", pattern: "abc", flags: "gyi" }] });
  assert.equal(rules[0].regex.flags, "i");
  assert.equal(evaluateRules(rules, "bash", { command: "ABC" }).deny.length, 1);
  assert.equal(evaluateRules(rules, "bash", { command: "ABC" }).deny.length, 1);
});
