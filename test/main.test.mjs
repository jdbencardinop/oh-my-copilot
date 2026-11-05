import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { IMPORTS_OFF, NUDGE, NUDGE_OFF, start } from "../plugin/com.github.copilot/extensions/omc/lib/main.mjs";

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

async function boot({ rejectSetTools = false, noOn = false } = {}) {
  const logs = [];
  const toolSets = [];
  const calls = [];
  const listeners = [];
  let joins = 0;
  let config;
  const emit = (ev) => listeners.forEach((l) => l(ev));
  const session = {
    on: (handler) => {
      listeners.push(handler);
      return () => {};
    },
    abort: async () => {
      calls.push("abort");
      queueMicrotask(() => emit({ type: "session.idle", data: { aborted: true } }));
    },
    send: async (opts) => {
      calls.push(["send", opts.prompt]);
      return "m";
    },
    rpc: { history: { truncate: async ({ eventId }) => calls.push(["truncate", eventId]) } },
    log: async (message, opts) => logs.push({ message, level: opts?.level ?? "info" }),
    setTools: async (tools) => {
      toolSets.push(tools.map((t) => t.name));
      if (rejectSetTools) throw new Error("Extension connections cannot replace SDK external tools");
    },
  };
  if (noOn) session.on = () => {
    throw new Error("not supported");
  };
  await start(async (c) => {
    joins++;
    config = c;
    return session;
  });
  const tool = (name) => config.tools.find((t) => t.name === name) ?? null;
  const pre = (toolName, toolArgs, sessionId = "s1") =>
    config.hooks.onPreToolUse({ toolName, toolArgs, workingDirectory: project, sessionId }, { sessionId });
  const post = (toolName, toolArgs, text) =>
    config.hooks.onPostToolUse(
      { toolName, toolArgs, toolResult: { textResultForLlm: text, resultType: "success" }, workingDirectory: project },
      { sessionId: "s1" },
    );
  const postFail = (toolName, toolArgs, error) =>
    config.hooks.onPostToolUseFailure({ toolName, toolArgs, error, workingDirectory: project }, { sessionId: "s1" });
  const command = (args) => config.commands.find((c) => c.name === "omc").handler({ args });
  const prompt = async (sessionId = "s1") =>
    (await config.hooks.onUserPromptSubmitted({ prompt: "fix it", workingDirectory: project }, { sessionId }))
      ?.additionalContext;
  const promptText = (text, sessionId = "s1") =>
    config.hooks.onUserPromptSubmitted({ prompt: text, workingDirectory: project }, { sessionId });
  return { config, logs, toolSets, calls, emit, listeners, joins: () => joins, tool, pre, post, postFail, command, prompt, promptText };
}

test("joins exactly once and registers tools, hook, and /omc", async () => {
  const h = await boot();
  assert.equal(h.joins(), 1);
  assert.deepEqual(h.config.tools.map((t) => t.name), ALL_TOOLS);
  assert.equal(typeof h.config.hooks.onPreToolUse, "function");
  assert.equal(typeof h.config.hooks.onUserPromptSubmitted, "function");
  assert.equal(typeof h.config.hooks.onPostToolUse, "function");
  assert.equal(typeof h.config.hooks.onPostToolUseFailure, "function");
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

// ---- richer rules: path globs, post rules, imported Cursor/Cline rules ----

const RULES_FILE = () => join(project, ".github", "omc", "rules.json");

async function withRules(rules, fn) {
  const saved = readFileSync(RULES_FILE(), "utf8");
  writeFileSync(RULES_FILE(), JSON.stringify({ rules }));
  try {
    return await fn();
  } finally {
    writeFileSync(RULES_FILE(), saved);
  }
}

async function withFiles(files, fn) {
  const made = [];
  for (const [rel, text] of Object.entries(files)) {
    const p = join(project, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, text);
    made.push(p);
  }
  try {
    return await fn();
  } finally {
    for (const dir of [".cursor", ".clinerules", ".cursorrules", "src"]) rmSync(join(project, dir), { recursive: true, force: true });
  }
}

test("paths: glob-scoped deny is relative to the project root, with exclusions", async () => {
  await withRules(
    [{ id: "no-gen", tools: ["edit", "create"], paths: ["src/gen/**", "!**/*.keep"], message: "generated code" }],
    async () => {
      const h = await boot();
      const deny = await h.pre("create", { path: join(project, "src", "gen", "a.ts"), file_text: "x" });
      assert.equal(deny.permissionDecision, "deny");
      assert.match(deny.permissionDecisionReason, /\[omc rule no-gen\] generated code/);
      assert.equal(await h.pre("create", { path: "src/gen/b.ts", file_text: "x" }).then((r) => r?.permissionDecision), "deny");
      assert.equal(await h.pre("create", { path: "src/gen/.keep", file_text: "" }), undefined);
      assert.equal(await h.pre("create", { path: "src/a.ts", file_text: "x" }), undefined);
    },
  );
});

test("post rules add context after a tool ran, also for failures, and follow the rules switch", async () => {
  await withRules(
    [
      { id: "tests-failed", when: "post", tools: ["bash"], pattern: "\\bFAIL\\b", message: "Tests failed. Fix them first." },
      { id: "pre-still-works", tools: ["bash"], pattern: "FORBIDDEN" },
    ],
    async () => {
      const h = await boot();
      assert.deepEqual(await h.post("bash", { command: "npm test" }, "FAIL a.test.js"), {
        additionalContext: "[omc rule tests-failed] Tests failed. Fix them first.",
      });
      assert.equal(await h.post("bash", { command: "npm test" }, "all passed"), undefined);
      assert.match((await h.postFail("bash", { command: "npm test" }, "exit 1: FAIL x")).additionalContext, /tests-failed/);
      assert.equal(await h.pre("bash", { command: "echo FAIL" }), undefined, "post rules do not run before the tool");
      assert.equal((await h.pre("bash", { command: "FORBIDDEN" })).permissionDecision, "deny");
      await h.command("status");
      assert.match(h.logs.at(-1).message, /rules\.json \(2\) \(1 pre, 1 post\)/);
      await h.command("off rules");
      assert.equal(await h.post("bash", { command: "npm test" }, "FAIL"), undefined);
      assert.equal(await h.postFail("bash", {}, "FAIL"), undefined);
    },
  );
});

test("post rule with field file reads the file as written", async () => {
  await withRules(
    [{ id: "todo-left", when: "post", tools: ["edit"], paths: "*.txt", field: "file", pattern: "TODO", message: "TODO left" }],
    async () => {
      const h = await boot();
      writeFileSync(join(project, "todo.txt"), "a\nTODO b\n");
      try {
        assert.match((await h.post("edit", { path: "todo.txt" }, "ok")).additionalContext, /todo-left/);
        assert.equal(await h.post("edit", { path: "a.txt" }, "ok TODO"), undefined);
        assert.equal(await h.post("edit", { path: "missing.txt" }, "ok"), undefined, "missing file: no match, no error");
      } finally {
        rmSync(join(project, "todo.txt"));
      }
    },
  );
});

test("hooks never throw on odd input", async () => {
  await withRules([{ id: "p", when: "post", pattern: "x" }], async () => {
    const h = await boot();
    assert.equal(await h.config.hooks.onPostToolUse({ toolName: "bash", toolArgs: null, workingDirectory: project }), undefined);
    assert.equal(await h.config.hooks.onPostToolUseFailure({}), undefined);
    await h.config.hooks.onPreToolUse({ toolName: "view", toolArgs: null, workingDirectory: project });
    assert.ok(!h.logs.some((l) => /error/.test(l.message)));
  });
});

const CURSOR = {
  ".cursor/rules/style.mdc": "---\ndescription: Style\nalwaysApply: true\n---\nAlways answer in British English.",
  ".cursor/rules/ts.mdc": "---\ndescription: TS rules\nglobs: src/**/*.ts, !**/*.test.ts\nalwaysApply: false\n---\nPrefer type aliases over interfaces.",
  ".cursor/rules/db.mdc": "---\ndescription: Database migrations\nalwaysApply: false\n---\nNever edit old migrations.",
  ".cursor/rules/manual.mdc": "---\nalwaysApply: false\n---\nManual only.",
  ".clinerules/01-tests.md": "Run npm test after changes.",
};

test("imports: always rules and the on-request index ride along with the nudge, once per session", async () => {
  await withFiles(CURSOR, async () => {
    const h = await boot();
    const ctx = await h.prompt();
    assert.ok(ctx.startsWith(NUDGE), "nudge first");
    assert.match(ctx, /<rule source="\.cursor\/rules\/style\.mdc">\nAlways answer in British English\.\n<\/rule>/);
    assert.match(ctx, /<rule source="\.clinerules\/01-tests\.md">/);
    assert.match(ctx, /- \.cursor\/rules\/db\.mdc: Database migrations/);
    assert.doesNotMatch(ctx, /Never edit old migrations|Manual only|Prefer type aliases/);
    assert.equal(await h.prompt(), undefined, "sent once");
    assert.match(await h.prompt("s2"), /British English/, "per session");

    await h.command("status");
    const status = h.logs.at(-1).message;
    assert.match(status, /imports\s+on\s+\(default\)/);
    assert.match(status, /imported rules: \.cursor\/rules \(4\), \.clinerules\/ \(1\): 2 always, 1 glob-scoped, 1 on request, 1 manual/);
    assert.match(status, /imported context: sent in 2 session\(s\)/);
  });
});

test("imports: glob-scoped rules are added once per session when a matching file is read or written", async () => {
  await withFiles(CURSOR, async () => {
    const h = await boot();
    assert.equal(await h.pre("create", { path: "src/a.test.ts", file_text: "x" }), undefined, "excluded by !glob");
    assert.equal(await h.pre("bash", { command: "cat src/a.ts" }), undefined, "bash does not trigger");
    const first = await h.pre("view", { path: join(project, "src", "a.ts") });
    assert.match(first.additionalContext, /files matching src\/\*\*\/\*\.ts, !\*\*\/\*\.test\.ts \(from \.cursor\/rules\/ts\.mdc\)/);
    assert.match(first.additionalContext, /Prefer type aliases/);
    assert.equal(first.permissionDecision, undefined);
    assert.equal(await h.pre("create", { path: "src/b.ts", file_text: "x" }), undefined, "once per session");
    assert.match((await h.pre("create", { path: "src/b.ts", file_text: "x" }, "s2")).additionalContext, /Prefer type aliases/);
  });
});

test("imports: glob context merges with rules output", async () => {
  await withFiles(CURSOR, async () => {
    const h = await boot();
    const ctx = await h.pre("edit_anchored", { path: "src/a.ts", edits: [{ op: "replace", start: "1:aa", content: "TODO" }] });
    assert.match(ctx.additionalContext, /^\[omc rule ctx\] file an issue\n\noh-my-copilot: project rule/);
    const deny = await h.pre("create", { path: "src/c.ts", file_text: "FORBIDDEN" }, "s3");
    assert.equal(deny?.permissionDecision, undefined, "no-token only applies to bash");
  });
});

test("imports: kill switches stop injection; /omc off after sending retracts once", async () => {
  await withFiles(CURSOR, async () => {
    await withEnv("OMC_DISABLE_FEATURES", "imports", async () => {
      const h = await boot();
      assert.equal(await h.prompt(), NUDGE);
      assert.equal(await h.pre("view", { path: "src/a.ts" }), undefined);
      await h.command("on imports");
      assert.equal(await h.pre("view", { path: "src/a.ts" }), undefined, "/omc cannot override env");
    });
    await withEnv("OMC_DISABLE", "1", async () => {
      const h = await boot();
      assert.equal(await h.prompt(), undefined);
      assert.equal(await h.pre("view", { path: "src/a.ts" }), undefined);
    });
    writeFileSync(join(project, ".github", "omc", "config.json"), JSON.stringify({ features: { imports: false } }));
    try {
      const h = await boot();
      assert.equal(await h.prompt(), NUDGE);
    } finally {
      rmSync(join(project, ".github", "omc", "config.json"));
    }

    const h = await boot();
    assert.match(await h.prompt(), /British English/);
    await h.command("off imports");
    assert.equal(await h.prompt(), IMPORTS_OFF);
    assert.equal(await h.prompt(), undefined, "retraction is sent once");
    assert.equal(await h.pre("view", { path: "src/a.ts" }), undefined);
    await h.command("on imports");
    assert.match(await h.prompt(), /British English/, "sent again when turned back on");

    const quiet = await boot();
    await quiet.command("off imports");
    assert.equal(await quiet.prompt(), NUDGE, "nothing to retract if nothing was sent");
  });
});

test("imports: oversized rules are truncated and reported in /omc status", async () => {
  await withFiles({ ".cursorrules": "R".repeat(20_000) }, async () => {
    const h = await boot();
    const ctx = await h.prompt();
    assert.ok(ctx.length < NUDGE.length + 12_100);
    assert.match(ctx, /truncated by oh-my-copilot; read \.cursorrules/);
    await h.command("status");
    assert.match(h.logs.at(-1).message, /truncated: \.cursorrules/);
  });
});

test("imports: invalid rule files are skipped with a warning", async () => {
  await withFiles({ ".cursor/rules/bad.mdc": "---\nalwaysApply: true\n", ".cursor/rules/ok.mdc": "---\nalwaysApply: true\n---\nOK rule" }, async () => {
    const h = await boot();
    assert.match(await h.prompt(), /OK rule/);
    assert.ok(h.logs.some((l) => l.level === "warning" && /bad\.mdc.*no closing/.test(l.message)));
  });
});

test("imports: internal errors fail open and trip only the breaker", async () => {
  await withFiles(CURSOR, async () => {
    const h = await boot();
    const boom = {
      get path() {
        throw new Error("boom");
      },
    };
    for (let i = 0; i < 3; i++) assert.equal(await h.pre("view", boom), undefined);
    assert.ok(h.logs.some((l) => /"imports" is off/.test(l.message)));
    await h.command("status");
    assert.match(h.logs.at(-1).message, /imports\s+off\s+\(tripped by circuit breaker\)/);
    assert.equal(await h.prompt(), NUDGE, "the nudge is unaffected");
    await h.command("reset");
    assert.match((await h.pre("view", { path: "src/a.ts" })).additionalContext, /Prefer type aliases/);
  });
});

test("post rule with field file ignores devices and FIFOs instead of blocking", { timeout: 5000 }, async () => {
  await withRules([{ id: "f", when: "post", tools: ["edit"], field: "file", pattern: "x", message: "m" }], async () => {
    const h = await boot();
    assert.equal(await h.post("edit", { path: "/dev/zero" }, "ok"), undefined);
    assert.equal(await h.post("edit", { path: "/dev/null" }, "ok"), undefined);
    const fifo = join(project, "pipe.txt");
    try {
      execFileSync("mkfifo", [fifo]);
    } catch {
      return; // no mkfifo on this platform
    }
    try {
      assert.equal(await h.post("edit", { path: fifo }, "ok"), undefined);
    } finally {
      rmSync(fifo, { force: true });
    }
  });
});

test("imports: a symlinked .cursorrules is not followed", async () => {
  const secret = join(root, "secret.txt");
  writeFileSync(secret, "aws_secret_access_key=SECRET");
  symlinkSync(secret, join(project, ".cursorrules"));
  try {
    const h = await boot();
    assert.equal(await h.prompt(), NUDGE);
    assert.ok(h.logs.some((l) => l.level === "warning" && /\.cursorrules: symlink; skipped/.test(l.message)));
  } finally {
    rmSync(join(project, ".cursorrules"), { force: true });
    rmSync(secret, { force: true });
  }
});

test("imports: rule files are read once per session", async () => {
  await withFiles({ ".cursor/rules/style.mdc": CURSOR[".cursor/rules/style.mdc"] }, async () => {
    const h = await boot();
    assert.match(await h.prompt(), /British English/);
    writeFileSync(join(project, ".cursor", "rules", "ts.mdc"), CURSOR[".cursor/rules/ts.mdc"]);
    assert.equal(await h.pre("view", { path: "src/a.ts" }), undefined, "session s1 keeps the rules it read first");
    assert.match((await h.pre("view", { path: "src/a.ts" }, "s2")).additionalContext, /Prefer type aliases/, "a new session reads again");
    rmSync(join(project, ".cursor", "rules", "ts.mdc"));
    assert.equal(await h.pre("create", { path: "src/b.ts", file_text: "" }, "s2"), undefined, "s2 already had it");
    assert.equal(await h.pre("view", { path: "src/a.ts" }, "s3"), undefined, "deleted rules are gone for new sessions");
  });
});

test("imports: a breaker trip after sending still retracts once", async () => {
  await withFiles(CURSOR, async () => {
    const h = await boot();
    assert.match(await h.prompt(), /British English/);
    const boom = {
      get path() {
        throw new Error("boom");
      },
    };
    for (let i = 0; i < 3; i++) await h.pre("view", boom);
    assert.ok(h.logs.some((l) => /"imports" is off/.test(l.message)));
    assert.equal(await h.prompt(), `${IMPORTS_OFF}`);
    assert.equal(await h.prompt(), undefined, "retracted once");
  });
});

test("imports: the per-session glob budget is a hard cap", async () => {
  const files = {};
  for (let i = 0; i < 12; i++)
    files[`.cursor/rules/g${String(i).padStart(2, "0")}.mdc`] = `---\nglobs: src/**\n---\n${"G".repeat(5000)}`;
  await withFiles(files, async () => {
    const h = await boot();
    const ctx = (await h.pre("view", { path: "src/a.ts" })).additionalContext;
    assert.ok(ctx.length <= 24_000, `length ${ctx.length}`);
    assert.equal(await h.pre("view", { path: "src/b.ts" }), undefined, "skipped rules are not retried");
    await h.command("status");
    assert.match(h.logs.at(-1).message, /left out \(size limit\): .*g11\.mdc/);
  });
});

// ---- stream rules ------------------------------------------------------------

const USER_CONFIG = () => join(home, "omc", "config.json");
const NO_LOG = { id: "no-log", pattern: "console\\.log", action: "interrupt", message: "Use the logger." };
const delta = (deltaContent) => ({ type: "assistant.message_delta", data: { messageId: "m1", deltaContent } });
const toolDelta = (inputDelta, toolName) => ({ type: "assistant.tool_call_delta", data: { toolCallId: "c1", toolName, inputDelta } });
const tick = () => new Promise((r) => setTimeout(r, 20));

async function withStreamRules(fn) {
  mkdirSync(join(home, "omc"), { recursive: true });
  writeFileSync(USER_CONFIG(), JSON.stringify({ features: { streamRules: true } }));
  try {
    return await withRules([NO_LOG], fn);
  } finally {
    rmSync(USER_CONFIG());
  }
}

test("stream rules off by default: no streaming requested; interrupt rules deny tool calls only", async () => {
  await withRules([NO_LOG], async () => {
    const h = await boot();
    assert.equal(Object.hasOwn(h.config, "streaming"), false);
    assert.equal(Object.hasOwn(h.config, "includeSubAgentStreamingEvents"), false);
    assert.equal(h.listeners.length, 0);
    const out = await h.pre("create", { path: "a.js", file_text: "console.log(1)" });
    assert.equal(out.permissionDecision, "deny");
    assert.match(out.permissionDecisionReason, /\[omc rule no-log\] Use the logger\./);
    assert.equal(await h.pre("create", { path: "a.js", file_text: "log(1)" }), undefined);
    await h.command("on streamRules");
    assert.match(h.logs.at(-1).message, /Restart Copilot to watch the stream/);
    await h.command("status");
    assert.match(h.logs.at(-1).message, /streamRules\s+on\s+\(\/omc\)/);
    assert.match(h.logs.at(-1).message, /stream rules: not watching \(streamRules was off when Copilot started/);
    assert.match(h.logs.at(-1).message, /1 interrupt/);
  });
});

test("stream rules on: a streamed match aborts, drops the turn, and retries with the rule", async () => {
  await withStreamRules(async () => {
    const h = await boot();
    assert.equal(h.config.streaming, true);
    assert.equal(h.config.includeSubAgentStreamingEvents, false);
    await h.promptText("write a hello world script");
    h.emit({ type: "assistant.turn_start", id: "turn-1", data: {} });
    h.emit(toolDelta('{"path":"hello.js","file_text":"conso', "create"));
    h.emit(toolDelta('le.log(1)"}'));
    await tick();
    assert.deepEqual(h.calls.slice(0, 2), ["abort", ["truncate", "turn-1"]]);
    assert.match(h.calls[2][1], /^<system-reminder>\[omc rule no-log\] Use the logger\./);
    assert.match(h.logs.at(-1).message, /rule no-log interrupted the response \(tool create\)/);

    // The retry prompt passes through the prompt hook without resetting the budget.
    await h.promptText(h.calls[2][1]);
    h.emit({ type: "assistant.turn_start", id: "turn-2", data: {} });
    h.emit(delta("console.log again"));
    await tick();
    assert.equal(h.calls.length, 3);
    // The preToolUse deny still backs it up.
    assert.equal((await h.pre("create", { path: "a.js", file_text: "console.log(1)" })).permissionDecision, "deny");

    await h.command("status");
    assert.match(h.logs.at(-1).message, /stream rules: watching the stream; fired 1 time\(s\) this session \(no-log x1\)/);
  });
});

test("stream rules: /omc off, rules off, and OMC_DISABLE_FEATURES stop interruptions", async () => {
  await withStreamRules(async () => {
    const h = await boot();
    const fire = async (id) => {
      await h.promptText(`task ${id}`);
      h.emit({ type: "assistant.turn_start", id, data: {} });
      h.emit(delta("console.log"));
      await tick();
    };
    await h.command("off streamRules");
    await fire("t1");
    await h.command("on streamRules");
    await h.command("off rules");
    await fire("t2");
    await h.command("on rules");
    await h.command("off");
    await fire("t3");
    assert.deepEqual(h.calls, []);
    await h.command("on");
    await fire("t4");
    assert.equal(h.calls[0], "abort");
  });
  await withStreamRules(() =>
    withEnv("OMC_DISABLE_FEATURES", "streamrules", async () => {
      const h = await boot();
      assert.equal(Object.hasOwn(h.config, "streaming"), false);
      assert.equal((await h.pre("create", { path: "a.js", file_text: "console.log(1)" })).permissionDecision, "deny");
    }),
  );
});

test("stream rules: sub-agent deltas never interrupt the main session", async () => {
  await withStreamRules(async () => {
    const h = await boot();
    await h.promptText("go");
    h.emit({ type: "assistant.turn_start", id: "turn-1", data: {} });
    h.emit({ ...delta("console.log"), agentId: "sub-1" });
    h.emit({ ...toolDelta('{"file_text":"console.log(1)"}', "create"), agentId: "sub-1" });
    await tick();
    assert.deepEqual(h.calls, []);
  });
});

test("stream rules: glob context sent in a truncated turn is sent again", async () => {
  await withStreamRules(() =>
    withFiles(CURSOR, async () => {
      const h = await boot();
      await h.promptText("go");
      h.emit({ type: "assistant.turn_start", id: "turn-1", data: {} });
      assert.match((await h.pre("view", { path: "src/a.ts" })).additionalContext, /Prefer type aliases/);
      h.emit(delta("console.log"));
      await tick();
      assert.deepEqual(h.calls[1], ["truncate", "turn-1"]);
      h.emit({ type: "assistant.turn_start", id: "turn-2", data: {} });
      assert.match((await h.pre("view", { path: "src/a.ts" })).additionalContext, /Prefer type aliases/, "re-sent after truncate");
      // Marks from earlier, untruncated turns stay.
      h.emit({ type: "assistant.turn_start", id: "turn-3", data: {} });
      assert.equal(await h.pre("view", { path: "src/a.ts" }), undefined);
      await h.command("status");
      assert.match(h.logs.at(-1).message, /fired 1 time/);
    }),
  );
});

test("stream rules: a session without event support falls back to deny with a warning", async () => {
  await withStreamRules(async () => {
    const h = await boot({ noOn: true });
    assert.ok(h.logs.some((l) => l.level === "warning" && /cannot watch this session/.test(l.message)));
    assert.equal((await h.pre("create", { path: "a.js", file_text: "console.log(1)" })).permissionDecision, "deny");
  });
});
