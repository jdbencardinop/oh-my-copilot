import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { start } from "../plugin/com.github.copilot/extensions/omc/lib/main.mjs";

let root;
let project;
let home;
const savedHome = process.env.COPILOT_HOME;

before(() => {
  root = mkdtempSync(join(tmpdir(), "omc-main-"));
  home = join(root, "home");
  project = join(root, "repo");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(join(project, ".github", "omc"), { recursive: true });
  mkdirSync(home, { recursive: true });
  process.env.COPILOT_HOME = home;
  writeFileSync(
    join(project, ".github", "omc", "rules.json"),
    JSON.stringify({
      rules: [
        { id: "no-token", tools: ["bash"], pattern: "FORBIDDEN", message: "blocked" },
        { id: "ctx", tools: ["edit_anchored"], pattern: "TODO", action: "context", message: "file an issue" },
      ],
    }),
  );
  writeFileSync(join(project, "a.txt"), "one\ntwo\nthree\n");
});

after(() => {
  if (savedHome === undefined) delete process.env.COPILOT_HOME;
  else process.env.COPILOT_HOME = savedHome;
  rmSync(root, { recursive: true, force: true });
});

async function boot({ rejectSetTools = false } = {}) {
  const logs = [];
  const toolSets = [];
  let joins = 0;
  let config;
  const session = {
    log: async (message, opts) => logs.push({ message, level: opts?.level ?? "info" }),
    setTools: async (tools) => {
      toolSets.push(tools.map((t) => t.name));
      if (rejectSetTools) throw new Error("Extension connections cannot replace SDK external tools");
    },
  };
  await start(async (c) => {
    joins++;
    config = c;
    return session;
  });
  const tool = (name) => config.tools.find((t) => t.name === name) ?? null;
  const pre = (toolName, toolArgs) => config.hooks.onPreToolUse({ toolName, toolArgs, workingDirectory: project });
  const command = (args) => config.commands.find((c) => c.name === "omc").handler({ args });
  return { config, logs, toolSets, joins: () => joins, tool, pre, command };
}

test("joins exactly once and registers tools, hook, and /omc", async () => {
  const h = await boot();
  assert.equal(h.joins(), 1);
  assert.deepEqual(h.config.tools.map((t) => t.name), ["read_anchored", "edit_anchored"]);
  assert.equal(typeof h.config.hooks.onPreToolUse, "function");
  assert.deepEqual(h.config.commands.map((c) => c.name), ["omc"]);
});

test("rules hook denies and adds context from project rules", async () => {
  const h = await boot();
  const deny = await h.pre("bash", { command: "echo FORBIDDEN" });
  assert.equal(deny.permissionDecision, "deny");
  assert.match(deny.permissionDecisionReason, /\[omc rule no-token\] blocked/);
  assert.equal(await h.pre("bash", { command: "echo fine" }), undefined);
  const ctx = await h.pre("edit_anchored", { path: "a.txt", edits: [{ op: "replace", start: "1:aa", content: "TODO" }] });
  assert.deepEqual(ctx, { additionalContext: "[omc rule ctx] file an issue" });
});

test("read_anchored then edit_anchored round-trips; stale anchors fail without writing", async () => {
  const h = await boot();
  await h.pre("view", { path: "a.txt" });
  const read = await h.tool("read_anchored").handler({ path: "a.txt" }, {});
  assert.equal(typeof read, "string");
  const two = /^(2:\w{2})\|two$/m.exec(read)[1];
  const edited = await h.tool("edit_anchored").handler({ path: "a.txt", edits: [{ op: "replace", start: two, content: "TWO" }] }, {});
  assert.match(edited, /Applied 1 edit/);
  assert.equal(readFileSync(join(project, "a.txt"), "utf8"), "one\nTWO\nthree\n");

  const stale = await h.tool("edit_anchored").handler({ path: "a.txt", edits: [{ op: "delete", start: two }] }, {});
  assert.equal(stale.resultType, "failure");
  assert.match(stale.textResultForLlm, /stale/);
  assert.equal(readFileSync(join(project, "a.txt"), "utf8"), "one\nTWO\nthree\n");

  const missing = await h.tool("read_anchored").handler({ path: "nope.txt" }, {});
  assert.equal(missing.resultType, "failure");
  assert.match(missing.textResultForLlm, /File not found/);
});

test("/omc off removes tools and silences rules; /omc on restores them", async () => {
  const h = await boot();
  await h.command("off");
  assert.deepEqual(h.toolSets.at(-1), []);
  assert.equal(await h.pre("bash", { command: "echo FORBIDDEN" }), undefined);
  const refused = await h.tool("read_anchored").handler({ path: "a.txt" }, {});
  assert.equal(refused.resultType, "failure");
  assert.match(refused.textResultForLlm, /built-in view and edit/);

  await h.command("on");
  assert.deepEqual(h.toolSets.at(-1), ["read_anchored", "edit_anchored"]);
  assert.equal((await h.pre("bash", { command: "echo FORBIDDEN" })).permissionDecision, "deny");

  await h.command("off rules");
  assert.equal(await h.pre("bash", { command: "echo FORBIDDEN" }), undefined);
  await h.command("status");
  assert.match(h.logs.at(-1).message, /rules\s+off\s+\(\/omc\)/);
  assert.match(h.logs.at(-1).message, /plugin:oh-my-copilot:omc/);
  await h.command("bogus");
  assert.equal(h.logs.at(-1).level, "warning");
});

test("a runtime that rejects setTools gets one warning and handlers still refuse while off", async () => {
  const h = await boot({ rejectSetTools: true });
  await h.command("off");
  await h.pre("bash", { command: "echo hi" });
  await h.command("on");
  await h.command("off");
  assert.equal(h.toolSets.length, 1, "setTools is not retried after a rejection");
  const warnings = h.logs.filter((l) => l.level === "warning");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /stay listed until restart/);
  const refused = await h.tool("read_anchored").handler({ path: "a.txt" }, {});
  assert.equal(refused.resultType, "failure");
  await h.command("on");
  assert.equal(typeof (await h.tool("read_anchored").handler({ path: "a.txt" }, {})), "string");
});

test("project config applies once the session reports its working directory", async () => {
  writeFileSync(join(project, ".github", "omc", "config.json"), JSON.stringify({ features: { hashline: false } }));
  try {
    const h = await boot();
    assert.equal((await h.pre("bash", { command: "FORBIDDEN" })).permissionDecision, "deny");
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(h.toolSets.at(-1), [], "anchored tools removed");
    const refused = await h.tool("read_anchored").handler({ path: "a.txt" }, {});
    assert.equal(refused.resultType, "failure");
  } finally {
    rmSync(join(project, ".github", "omc", "config.json"));
  }
});

test("OMC_DISABLE_FEATURES turns a feature off and /omc cannot override it", async () => {
  const saved = process.env.OMC_DISABLE_FEATURES;
  process.env.OMC_DISABLE_FEATURES = "rules";
  try {
    const h = await boot();
    assert.equal(h.config.tools.length, 2);
    assert.equal(await h.pre("bash", { command: "FORBIDDEN" }), undefined);
    await h.command("on rules");
    assert.equal(await h.pre("bash", { command: "FORBIDDEN" }), undefined);
  } finally {
    if (saved === undefined) delete process.env.OMC_DISABLE_FEATURES;
    else process.env.OMC_DISABLE_FEATURES = saved;
  }
});

test("invalid project config is ignored with a warning", async () => {
  writeFileSync(join(project, ".github", "omc", "config.json"), "{ not json");
  try {
    const h = await boot();
    assert.equal(h.config.tools.length, 2);
    await h.pre("bash", { command: "echo ok" });
    assert.ok(h.logs.some((l) => l.level === "warning" && /invalid config/.test(l.message)));
  } finally {
    rmSync(join(project, ".github", "omc", "config.json"));
  }
});
