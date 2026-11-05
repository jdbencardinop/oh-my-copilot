import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compileRules,
  evaluatePostRules,
  evaluateRules,
  matchText,
  postMatchText,
  projectPath,
  resultText,
  targetPaths,
  toHookOutput,
  toPostHookOutput,
} from "../plugin/com.github.copilot/extensions/omc/lib/rules.mjs";

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

test("paths: globs relative to the project root, with ! exclusions", () => {
  const { rules, errors } = compileRules({
    rules: [
      { id: "ts-only", tools: ["edit", "create"], paths: ["src/**/*.ts", "!**/*.test.ts"], pattern: "any\\b", message: "no any" },
      { id: "lock", tools: ["edit", "create"], paths: "migrations/**", message: "migrations are append-only" },
    ],
  });
  assert.deepEqual(errors, []);
  const opts = { cwd: "/repo/src", root: "/repo" };
  const hit = (tool, args) => evaluateRules(rules, tool, args, opts).deny.map((r) => r.id);
  assert.deepEqual(hit("create", { path: "x/a.ts", file_text: "let a: any" }), ["ts-only"], "relative to cwd, matched from root");
  assert.deepEqual(hit("create", { path: "/repo/src/a.ts", file_text: "let a: any" }), ["ts-only"]);
  assert.deepEqual(hit("create", { path: "/repo/src/a.test.ts", file_text: "let a: any" }), [], "excluded");
  assert.deepEqual(hit("create", { path: "/repo/lib/a.ts", file_text: "let a: any" }), []);
  assert.deepEqual(hit("edit", { path: "/repo/migrations/001.sql", old_str: "a", new_str: "b" }), ["lock"], "no pattern: any change matches");
  assert.deepEqual(hit("view", { path: "/repo/migrations/001.sql" }), [], "tools filter still applies");
  assert.deepEqual(hit("bash", { command: "any" }), [], "a paths rule needs a target path");
  assert.deepEqual(evaluateRules(rules, "create", { path: "src/a.ts", file_text: "any" }).deny.map((r) => r.id), ["ts-only"], "no opts: paths used as given");
});

test("projectPath", () => {
  assert.equal(projectPath("a/b.ts", { cwd: "/r/sub", root: "/r" }), "sub/a/b.ts");
  assert.equal(projectPath("/r/a.ts", { cwd: "/r", root: "/r" }), "a.ts");
  assert.equal(projectPath("/elsewhere/a.ts", { cwd: "/r", root: "/r" }), "/elsewhere/a.ts");
  assert.equal(projectPath("./x\\y.ts"), "x/y.ts");
});

test("compileRules validates when, paths, and post actions; existing files keep working", () => {
  const { rules, errors } = compileRules(
    {
      rules: [
        { id: "post-ok", when: "post", tools: ["bash"], pattern: "FAIL" },
        { id: "post-deny", when: "post", pattern: "x", action: "deny" },
        { id: "post-ask", when: "post", pattern: "x", action: "ask" },
        { id: "bad-when", when: "later", pattern: "x" },
        { id: "bad-paths", paths: [], pattern: "x" },
        { id: "bad-paths2", paths: ["ok", 3], pattern: "x" },
        { id: "bad-glob", paths: ["{a,b}{c,d}{e,f}{g,h}{i,j}{k,l}{m,n}{o,p}{q,r}"], pattern: "x" },
        { id: "empty-pattern", pattern: "" },
        { id: "path-only", pathPattern: "\\.env$" },
      ],
    },
    "t",
  );
  assert.deepEqual(rules.map((r) => [r.id, r.when, r.action]), [
    ["post-ok", "post", "context"],
    ["path-only", "pre", "deny"],
  ]);
  assert.equal(errors.length, 7);
  assert.ok(errors.some((e) => /post-deny.*"when": "post"/.test(e)));
  assert.equal(evaluateRules(rules, "bash", { command: "FAIL" }).context.length, 0, "post rules never run pre");
});

test("post rules match the tool result, arguments, or the resulting file", () => {
  const { rules } = compileRules({
    rules: [
      { id: "tests-failed", when: "post", tools: ["bash"], pattern: "\\bFAIL\\b", message: "Tests failed: fix them first." },
      { id: "npm-test", when: "post", tools: ["bash"], field: "command", pattern: "npm test", message: "ran tests" },
      { id: "file-todo", when: "post", tools: ["edit"], paths: ["**/*.ts"], field: "file", pattern: "TODO", message: "file still has a TODO" },
      { id: "all", when: "post", field: "all", pattern: "needle", message: "found" },
    ],
  });
  const ids = (tool, args, text, opts) => evaluatePostRules(rules, tool, args, text, opts).map((r) => r.id);
  assert.deepEqual(ids("bash", { command: "npm test" }, "1 passed\nFAIL a.test.js"), ["tests-failed", "npm-test"]);
  assert.deepEqual(ids("bash", { command: "ls" }, "FAILURE"), []);
  const files = { "/r/a.ts": "x\n// TODO", "/r/b.ts": "clean" };
  const opts = { cwd: "/r", root: "/r", fileText: (p) => files[p.startsWith("/") ? p : `/r/${p}`] };
  assert.deepEqual(ids("edit", { path: "a.ts", old_str: "TODO", new_str: "x" }, "ok", opts), ["file-todo"]);
  assert.deepEqual(ids("edit", { path: "b.ts", old_str: "a", new_str: "TODO" }, "ok", opts), [], "matches the file, not the edit");
  assert.deepEqual(ids("edit", { path: "a.ts" }, "ok", {}), [], "no file reader: no file text");
  assert.deepEqual(ids("view", { path: "needle.txt" }, "ok"), ["all"]);
  assert.equal(postMatchText("x", { a: "arg" }, "out", "result"), "out");
  assert.equal(postMatchText("x", { a: "arg" }, undefined, "auto"), "");
  assert.deepEqual(toPostHookOutput([]), undefined);
  assert.deepEqual(toPostHookOutput(evaluatePostRules(rules, "bash", { command: "x" }, "FAIL")), {
    additionalContext: "[omc rule tests-failed] Tests failed: fix them first.",
  });
});

test("resultText reads tool result objects and strings", () => {
  assert.equal(resultText({ textResultForLlm: "out", resultType: "success" }), "out");
  assert.equal(resultText({ textResultForLlm: "", error: "boom", resultType: "failure" }), "boom");
  assert.equal(resultText("plain"), "plain");
  assert.equal(resultText(null), "");
});
