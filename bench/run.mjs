#!/usr/bin/env node
// Edit benchmark: stock Copilot vs Copilot with oh-my-copilot.
//
// Each run copies a task's "before" file into a fresh git repo, runs
// `copilot -p` with an isolated COPILOT_HOME, then compares the file with the
// task's "after" file. Metrics come from Copilot's --output-format json events.
//
// Usage: node bench/run.mjs [--models a,b] [--arms stock,omc] [--tasks id,...]
//                           [--reps 1] [--concurrency 3] [--timeout 300] [--keep]

import { spawn } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TASKS_DIR = join(ROOT, "bench", "tasks");
const PLUGIN_DIR = join(ROOT, "plugin");

const COMMON =
  "Make the change by editing the file with your file tools. Do not modify files with shell commands, " +
  "do not create other files, and do not run tests. Reply with one short sentence when done.";

// Written to the run's personal copilot-instructions.md in the instruction arms.
export const INSTRUCTIONS =
  "Use `read_anchored` and `edit_anchored` to read and edit existing text files, instead of `view` and `edit`. " +
  "Read the file with `read_anchored` first, then edit it with `edit_anchored` using the `LINE:HASH` anchors it returns. " +
  "If an anchored edit is rejected as stale, read the file again. " +
  "If these tools are not available, use `view` and `edit` as usual. Use `create` only for new files.\n";

export const ARMS = {
  stock: { plugin: false, hint: "Use the view and edit tools to read and edit files." },
  omc: { plugin: true, hint: "Use the read_anchored and edit_anchored tools to read and edit files." },
  "omc-nohint": { plugin: true, hint: "" },
  "omc-instructions": { plugin: true, hint: "", instructions: INSTRUCTIONS },
  // The plugin is loaded but switched off, while the instructions still mention its tools.
  "omc-off-instructions": { plugin: true, hint: "", instructions: INSTRUCTIONS, env: { OMC_DISABLE: "1" } },
};

const { values: opt } = parseArgs({
  options: {
    models: { type: "string", default: "claude-haiku-4.5" },
    arms: { type: "string", default: "stock,omc" },
    tasks: { type: "string", default: "" },
    reps: { type: "string", default: "1" },
    concurrency: { type: "string", default: "3" },
    timeout: { type: "string", default: "300" },
    out: { type: "string", default: "" },
    keep: { type: "boolean", default: false },
  },
});

const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
const models = list(opt.models);
const arms = list(opt.arms);
for (const a of arms) if (!ARMS[a]) throw new Error(`unknown arm ${a}; use ${Object.keys(ARMS).join(", ")}`);
const allTasks = readdirSync(TASKS_DIR).sort();
const taskIds = opt.tasks ? list(opt.tasks) : allTasks;
const tasks = taskIds.map((id) => ({ ...JSON.parse(readFileSync(join(TASKS_DIR, id, "task.json"), "utf8")), dir: join(TASKS_DIR, id) }));
const reps = Number(opt.reps);
const timeoutMs = Number(opt.timeout) * 1000;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = opt.out || join(ROOT, "bench", "results", `${stamp}.jsonl`);
mkdirSync(dirname(outFile), { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "omc-bench-"));

// A clean Copilot home: the user's auth and model settings, without hooks,
// plugins, MCP config, or custom instructions.
const baseHome = join(scratch, "base-home");
mkdirSync(baseHome);
const userHome = process.env.COPILOT_HOME || join(homedir(), ".copilot");
cpSync(join(userHome, "config.json"), join(baseHome, "config.json"));
const settings = existsSync(join(userHome, "settings.json")) ? JSON.parse(readFileSync(join(userHome, "settings.json"), "utf8")) : {};
for (const k of ["hooks", "extensions", "enabledPlugins", "model"]) delete settings[k];
settings.experimental = true;
writeFileSync(join(baseHome, "settings.json"), JSON.stringify(settings, null, 2));

// Interleave arms and models so drift in API latency hits every arm equally.
const runs = [];
for (let r = 0; r < reps; r++) for (const task of tasks) for (const model of models) for (const arm of arms) runs.push({ task, model, arm, rep: r + 1 });
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
for (let i = runs.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [runs[i], runs[j]] = [runs[j], runs[i]];
}

const normalize = (s, mode) =>
  mode === "exact" ? s : s.split(/\r?\n/).map((l) => l.trimEnd()).join("\n").replace(/\n+$/, "");

function git(cwd, ...args) {
  return new Promise((ok, fail) => {
    const p = spawn("git", args, { cwd, stdio: "ignore" });
    p.on("close", (c) => (c === 0 ? ok() : fail(new Error(`git ${args[0]} failed`))));
  });
}

function parseEvents(text) {
  const m = { tools: {}, toolFailures: {}, failureSamples: [] };
  const names = new Map();
  let checkpoint = null;
  let result = null;
  for (const line of text.split("\n")) {
    if (!line.startsWith("{")) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type === "tool.execution_start") {
      names.set(e.data.toolCallId, e.data.toolName);
      m.tools[e.data.toolName] = (m.tools[e.data.toolName] ?? 0) + 1;
    } else if (e.type === "tool.execution_complete" && e.data.success === false) {
      const name = names.get(e.data.toolCallId) ?? "?";
      m.toolFailures[name] = (m.toolFailures[name] ?? 0) + 1;
      const msg = e.data.error?.message ?? e.data.result?.content ?? "";
      if (m.failureSamples.length < 3) m.failureSamples.push(`${name}: ${String(msg).slice(0, 160)}`);
    } else if (e.type === "session.usage_checkpoint") {
      checkpoint = e.data;
    } else if (e.type === "result") {
      result = e;
    }
  }
  const acct = checkpoint?.accountingSnapshot;
  const td = acct?.tokenDetails ?? {};
  const model = Object.values(acct?.modelMetrics ?? {})[0];
  return {
    ...m,
    exitCode: result?.exitCode ?? null,
    apiMs: result?.usage?.totalApiDurationMs ?? acct?.totalApiDurationMs ?? null,
    sessionMs: result?.usage?.sessionDurationMs ?? null,
    requests: model?.requests?.count ?? null,
    tokens: {
      input: td.input?.tokenCount ?? null,
      cacheRead: td.cache_read?.tokenCount ?? null,
      cacheWrite: td.cache_write?.tokenCount ?? null,
      output: td.output?.tokenCount ?? null,
    },
    credits: acct?.totalNanoAiu != null ? acct.totalNanoAiu / 1e9 : null,
  };
}

async function runOne(run, index) {
  const { task, model, arm, rep } = run;
  const dir = join(scratch, `run-${index}`);
  const work = join(dir, "work");
  const home = join(dir, "home");
  mkdirSync(work, { recursive: true });
  cpSync(baseHome, home, { recursive: true });
  if (ARMS[arm].instructions) writeFileSync(join(home, "copilot-instructions.md"), ARMS[arm].instructions);
  cpSync(join(task.dir, "before"), work, { recursive: true });
  await git(work, "init", "-q");
  await git(work, "add", "-A");
  await git(work, "-c", "user.email=bench@example.com", "-c", "user.name=bench", "commit", "-qm", "fixture");

  const prompt = [task.prompt, ARMS[arm].hint, COMMON].filter(Boolean).join("\n\n");
  const args = ["--model", model, "--allow-all-tools", "--no-color", "--output-format", "json", "--disable-builtin-mcps", "--no-auto-update", "--experimental"];
  if (ARMS[arm].plugin) args.push("--plugin-dir", PLUGIN_DIR);
  args.push("-p", prompt);

  const started = Date.now();
  let stdout = "";
  let stderr = "";
  const timedOut = await new Promise((ok) => {
    const p = spawn("copilot", args, { cwd: work, env: { ...process.env, ...ARMS[arm].env, COPILOT_HOME: home }, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      p.kill("SIGTERM");
      ok(true);
    }, timeoutMs);
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("close", () => {
      clearTimeout(timer);
      ok(false);
    });
  });
  const wallMs = Date.now() - started;

  const expected = readFileSync(join(task.dir, "after", task.file), "utf8");
  const actualPath = join(work, task.file);
  const actual = existsSync(actualPath) ? readFileSync(actualPath, "utf8") : "";
  const pass = !timedOut && normalize(actual, task.compare) === normalize(expected, task.compare);

  const row = { task: task.id, model, arm, rep, pass, timedOut, wallMs, ...parseEvents(stdout) };
  if (!pass) {
    writeFileSync(join(dir, "actual"), actual);
    row.stderrTail = stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 300);
  }
  appendFileSync(outFile, JSON.stringify(row) + "\n");
  if (!opt.keep) rmSync(dir, { recursive: true, force: true });
  else writeFileSync(join(dir, "events.jsonl"), stdout);
  const t = row.tokens;
  console.log(
    `[${String(index + 1).padStart(3)}/${runs.length}] ${pass ? "PASS" : "FAIL"} ${task.id} ${model} ${arm} #${rep} ` +
      `${(wallMs / 1000).toFixed(1)}s out=${t.output} in=${(t.input ?? 0) + (t.cacheWrite ?? 0)}+${t.cacheRead}cached ` +
      `credits=${row.credits?.toFixed(2)} tools=${JSON.stringify(row.tools)}` +
      (Object.keys(row.toolFailures).length ? ` failed=${JSON.stringify(row.toolFailures)}` : ""),
  );
}

console.log(`${runs.length} runs: ${tasks.length} tasks x ${models.length} models x ${arms.length} arms x ${reps} reps -> ${outFile}`);
let next = 0;
const workers = Array.from({ length: Math.min(Number(opt.concurrency), runs.length) }, async () => {
  while (next < runs.length) {
    const i = next++;
    try {
      await runOne(runs[i], i);
    } catch (err) {
      console.error(`run ${i + 1} crashed: ${err.stack ?? err}`);
    }
  }
});
await Promise.all(workers);
if (!opt.keep) rmSync(scratch, { recursive: true, force: true });
else console.log(`kept run directories in ${scratch}`);
console.log(`done. Report: node bench/report.mjs ${outFile}`);
