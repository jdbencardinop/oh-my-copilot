import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { NUDGE, NUDGE_OFF, start } from "../plugin/com.github.copilot/extensions/omc/lib/main.mjs";

let root;
let project;
let home;
const savedHome = process.env.COPILOT_HOME;
const ANCHORED = ["read_anchored", "edit_anchored"];
const CONFLICT_TOOLS = ["list_conflicts", "resolve_conflicts"];
const ALL_TOOLS = [...ANCHORED, ...CONFLICT_TOOLS];

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
  const prompt = async (sessionId = "s1") =>
    (await config.hooks.onUserPromptSubmitted({ prompt: "fix it", workingDirectory: project }, { sessionId }))
      ?.additionalContext;
  return { config, logs, toolSets, joins: () => joins, tool, pre, command, prompt };
}

test("joins exactly once and registers tools, hook, and /omc", async () => {
  const h = await boot();
  assert.equal(h.joins(), 1);
  assert.deepEqual(h.config.tools.map((t) => t.name), ALL_TOOLS);
  assert.equal(typeof h.config.hooks.onPreToolUse, "function");
  assert.equal(typeof h.config.hooks.onUserPromptSubmitted, "function");
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
  assert.deepEqual(h.toolSets.at(-1), ALL_TOOLS);
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
    assert.deepEqual(h.toolSets.at(-1), CONFLICT_TOOLS, "anchored tools removed");
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
    assert.equal(h.config.tools.length, 4);
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
    assert.equal(h.config.tools.length, 4);
    await h.pre("bash", { command: "echo ok" });
    assert.ok(h.logs.some((l) => l.level === "warning" && /invalid config/.test(l.message)));
  } finally {
    rmSync(join(project, ".github", "omc", "config.json"));
  }
});

async function withEnv(name, value, fn) {
  const saved = process.env[name];
  process.env[name] = value;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env[name];
    else process.env[name] = saved;
  }
}

test("nudge: sent once per session while hashline is active", async () => {
  const h = await boot();
  assert.equal(await h.prompt(), NUDGE);
  assert.match(NUDGE, /read_anchored/);
  assert.match(NUDGE, /not available/, "keeps the fallback sentence");
  assert.equal(await h.prompt(), undefined, "later prompts add nothing");
  assert.equal(await h.prompt("s2"), NUDGE, "a new session gets its own nudge");
});

test("nudge: absent when hashline, nudge, or omc is disabled by env", async () => {
  for (const [name, value] of [
    ["OMC_DISABLE_FEATURES", "hashline"],
    ["OMC_DISABLE_FEATURES", "nudge"],
    ["OMC_DISABLE_FEATURES", "all"],
    ["OMC_DISABLE", "1"],
  ]) {
    await withEnv(name, value, async () => {
      const h = await boot();
      assert.equal(await h.prompt(), undefined, `${name}=${value}`);
      await h.command("on hashline");
      await h.command("on nudge");
      assert.equal(await h.prompt(), undefined, `/omc on cannot override ${name}=${value}`);
    });
  }
});

test("nudge: absent when project config turns hashline or nudge off", async () => {
  for (const features of [{ hashline: false }, { nudge: false }]) {
    writeFileSync(join(project, ".github", "omc", "config.json"), JSON.stringify({ features }));
    try {
      const h = await boot();
      assert.equal(await h.prompt(), undefined, JSON.stringify(features));
    } finally {
      rmSync(join(project, ".github", "omc", "config.json"));
    }
  }
});

test("nudge: /omc off before the first prompt sends nothing; off after it sends a retraction", async () => {
  for (const off of ["off", "off hashline", "off nudge"]) {
    const h = await boot();
    await h.command(off);
    assert.equal(await h.prompt(), undefined, `/omc ${off}`);
  }

  const h = await boot();
  assert.equal(await h.prompt(), NUDGE);
  await h.command("off hashline");
  assert.equal(await h.prompt(), NUDGE_OFF);
  assert.equal(await h.prompt(), undefined, "retraction is sent once");
  await h.command("on hashline");
  assert.equal(await h.prompt(), NUDGE, "guidance returns when turned back on");
});

test("nudge: absent when the hashline circuit breaker has tripped; retracted if already sent", async () => {
  const boom = {
    get path() {
      throw new Error("boom");
    },
  };
  const trip = async (h) => {
    for (let i = 0; i < 3; i++) {
      const r = await h.tool("read_anchored").handler(boom, {});
      assert.match(r.textResultForLlm, /internal error/);
    }
    assert.ok(h.logs.some((l) => /"hashline" is off/.test(l.message)));
  };

  const fresh = await boot();
  await trip(fresh);
  assert.equal(await fresh.prompt(), undefined, "never sent after a trip");

  const h = await boot();
  assert.equal(await h.prompt(), NUDGE);
  await trip(h);
  assert.equal(await h.prompt(), NUDGE_OFF, "retraction after the breaker trips");
  assert.equal(await h.prompt(), undefined);
});

test("nudge: not sent when the anchored tools were not registered at join", async () => {
  const userConfig = join(home, "omc", "config.json");
  mkdirSync(join(home, "omc"), { recursive: true });
  writeFileSync(userConfig, JSON.stringify({ features: { hashline: false } }));
  let h;
  try {
    h = await boot({ rejectSetTools: true });
    assert.deepEqual(h.config.tools.map((t) => t.name), CONFLICT_TOOLS);
    assert.equal(await h.prompt(), undefined);
  } finally {
    rmSync(userConfig);
  }
  await h.command("reload");
  assert.equal(await h.prompt(), undefined, "hashline is on again, but the tools are not listed");
});
