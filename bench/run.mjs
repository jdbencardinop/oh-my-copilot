#!/usr/bin/env node
// Edit benchmark: stock Copilot vs Copilot with oh-my-copilot.
//
// Each run copies a task's "before" files into a fresh git repo, runs
// `copilot -p` with an isolated COPILOT_HOME, then scores the result.
// Metrics come from Copilot's --output-format json events.
//
// Usage: node bench/run.mjs [--models a,b] [--arms stock,omc] [--tasks id,...]
//                           [--reps 1] [--concurrency 3] [--timeout 300] [--effort level] [--keep]
//                           [--tasks-dir bench/tasks-hard] [--max-credits 40] [--run-cost 5]
//                           [--plan] [--append]
//
// A task passes when its edited file equals `after/<file>`, or, when task.json
// names a `check` script, when that script exits 0. Check scripts stay in the
// task folder, outside the run's repository, but are not sandboxed. An optional
// `setup` script runs in the repository after the fixture commit (for
// example, to leave a merge in progress). --max-credits stops starting runs once
// the spent credits plus a reserve for running ones would pass the threshold.
// This is not a hard cap: an individual run can cost more than its reserve.

import { spawn } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_DIR = join(ROOT, "plugin");

const COMMON =
  "Make the change by editing the file with your file tools. Do not modify files with shell commands, " +
  "do not create other files, and do not run tests. Reply with one short sentence when done.";
const COMMON_WITH_TESTS =
  "Make the change by editing files with your file tools. Do not modify files with shell commands, " +
  "create other files, or modify the existing tests. You may run the existing tests. " +
  "Reply with one short sentence when done.";

// Written to the run's personal copilot-instructions.md in the instruction arms.
export const INSTRUCTIONS =
  "Use `read_anchored` and `edit_anchored` to read and edit existing text files, instead of `view` and `edit`. " +
  "Read the file with `read_anchored` first, then edit it with `edit_anchored` using the `LINE:HASH` anchors it returns. " +
  "If an anchored edit is rejected as stale, read the file again. " +
  "If these tools are not available, use `view` and `edit` as usual. Use `create` only for new files.\n";

// The plugin's own nudge is switched off in the arms that predate it, so they
// keep measuring what they did when they were recorded.
const NO_NUDGE = { OMC_DISABLE_FEATURES: "nudge" };

export const ARMS = {
  stock: { plugin: false, hint: "Use the view and edit tools to read and edit files." },
  "stock-default": { plugin: false, hint: "" },
  omc: { plugin: true, hint: "Use the read_anchored and edit_anchored tools to read and edit files.", env: NO_NUDGE },
  "omc-nohint": { plugin: true, hint: "", env: NO_NUDGE },
  "omc-nudge": { plugin: true, hint: "" },
  "omc-instructions": { plugin: true, hint: "", instructions: INSTRUCTIONS, env: NO_NUDGE },
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
    effort: { type: "string", default: "" },
    "tasks-dir": { type: "string", default: "" },
    "max-credits": { type: "string" },
    "run-cost": { type: "string", default: "5" },
    keep: { type: "boolean", default: false },
    plan: { type: "boolean", default: false },
    append: { type: "boolean", default: false },
  },
});

function positiveNumber(value, option, integer = false) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || (integer && !Number.isSafeInteger(number))) {
    throw new Error(`--${option} must be a positive ${integer ? "safe integer" : "finite number"}`);
  }
  return number;
}

const TASKS_DIR = opt["tasks-dir"] ? resolve(opt["tasks-dir"]) : join(ROOT, "bench", "tasks");
const maxCredits = opt["max-credits"] === undefined ? Infinity : positiveNumber(opt["max-credits"], "max-credits");
const initialRunCost = positiveNumber(opt["run-cost"], "run-cost");
const concurrency = positiveNumber(opt.concurrency, "concurrency", true);
const reps = positiveNumber(opt.reps, "reps", true);
const timeoutMs = positiveNumber(opt.timeout, "timeout") * 1000;
if (!Number.isFinite(timeoutMs) || timeoutMs > 2_147_483_647) {
  throw new Error("--timeout must be at most 2147483.647 seconds");
}
const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
const models = list(opt.models);
const arms = list(opt.arms);
if (!models.length || !arms.length) throw new Error("--models and --arms must not be empty");
if (new Set(models).size !== models.length || new Set(arms).size !== arms.length) {
  throw new Error("--models and --arms must not contain duplicates");
}
for (const a of arms) if (!ARMS[a]) throw new Error(`unknown arm ${a}; use ${Object.keys(ARMS).join(", ")}`);
const allTasks = readdirSync(TASKS_DIR).filter((d) => existsSync(join(TASKS_DIR, d, "task.json"))).sort();
const taskIds = opt.tasks ? list(opt.tasks) : allTasks;
if (!taskIds.length) throw new Error("no benchmark tasks selected");
if (new Set(taskIds).size !== taskIds.length) throw new Error("--tasks must not contain duplicates");
const tasks = taskIds.map((id) => {
  if (!allTasks.includes(id)) throw new Error(`unknown task ${id} in ${TASKS_DIR}`);
  const dir = join(TASKS_DIR, id);
  const task = { ...JSON.parse(readFileSync(join(dir, "task.json"), "utf8")), dir };
  if (task.id !== id || typeof task.prompt !== "string" || !task.prompt.trim()) {
    throw new Error(`${id}: task.json needs a matching id and a nonempty prompt`);
  }
  if (task.allowTests !== undefined && typeof task.allowTests !== "boolean") {
    throw new Error(`${id}: allowTests must be a boolean`);
  }
  if (task.visibleTest !== undefined && (!Array.isArray(task.visibleTest) || !task.visibleTest.length
      || task.visibleTest.some((part) => typeof part !== "string" || !part))) {
    throw new Error(`${id}: visibleTest must be a nonempty array of command arguments`);
  }
  if (!existsSync(join(dir, "before")) || !statSync(join(dir, "before")).isDirectory()) {
    throw new Error(`${id}: missing before directory`);
  }
  for (const field of ["setup", "check"]) {
    if (task[field] === undefined) continue;
    if (typeof task[field] !== "string" || !task[field] || isAbsolute(task[field])) {
      throw new Error(`${id}: ${field} must name a relative script`);
    }
    const script = resolve(dir, task[field]);
    const rel = relative(dir, script);
    if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || !existsSync(script)) {
      throw new Error(`${id}: ${field} script must exist inside the task directory`);
    }
  }
  if (!task.check && (typeof task.file !== "string" || !existsSync(join(dir, "after", task.file)))) {
    throw new Error(`${id}: supply a check script or an after file`);
  }
  return task;
});

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = opt.out || join(ROOT, "bench", "results", `${stamp}.jsonl`);

// Interleave arms and models so drift in API latency hits every arm equally.
const runs = [];
for (let r = 0; r < reps; r++) for (const task of tasks) for (const model of models) for (const arm of arms) runs.push({ task, model, arm, rep: r + 1 });
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
for (let i = runs.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [runs[i], runs[j]] = [runs[j], runs[i]];
}

console.log(`${runs.length} runs: ${tasks.length} tasks x ${models.length} models x ${arms.length} arms x ${reps} reps -> ${outFile}`);
if (Number.isFinite(maxCredits)) {
  console.log(`Scheduling threshold: ${maxCredits} credits; reserve at least ${initialRunCost} per run. Actual spend can exceed this threshold.`);
}
if (opt.plan) {
  console.log(`Plan only; no Copilot sessions started. Models: ${models.join(", ")}. Arms: ${arms.join(", ")}.`);
  process.exit(0);
}
if (existsSync(outFile) && statSync(outFile).size > 0 && !opt.append) {
  throw new Error(`${outFile} already contains results; choose a new file or pass --append`);
}
mkdirSync(dirname(outFile), { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "omc-bench-"));

// A clean Copilot home: the user's auth and model settings, without hooks,
// plugins, MCP config, or custom instructions.
const baseHome = join(scratch, "base-home");
try {
  mkdirSync(baseHome);
  const userHome = process.env.COPILOT_HOME || join(homedir(), ".copilot");
  cpSync(join(userHome, "config.json"), join(baseHome, "config.json"));
  const settings = existsSync(join(userHome, "settings.json")) ? JSON.parse(readFileSync(join(userHome, "settings.json"), "utf8")) : {};
  for (const k of ["hooks", "extensions", "enabledPlugins", "model"]) delete settings[k];
  settings.experimental = true;
  writeFileSync(join(baseHome, "settings.json"), JSON.stringify(settings, null, 2));
} catch (err) {
  rmSync(scratch, { recursive: true, force: true });
  throw err;
}

const normalize = (s, mode) =>
  mode === "exact" ? s : s.split(/\r?\n/).map((l) => l.trimEnd()).join("\n").replace(/\n+$/, "");

const gitEnv = {
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "bench",
  GIT_AUTHOR_EMAIL: "bench@example.com",
  GIT_COMMITTER_NAME: "bench",
  GIT_COMMITTER_EMAIL: "bench@example.com",
  PYTHONDONTWRITEBYTECODE: "1",
};

const activeChildren = new Set();
function runProcess(cmd, args, { cwd, env, timeout }) {
  if (interruptedSignal) {
    return Promise.resolve({ code: null, signal: interruptedSignal, error: "interrupted", timedOut: false, stdout: "", stderr: "" });
  }
  return new Promise((ok) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    activeChildren.add(child);
    let stdout = "";
    let stderr = "";
    let error = null;
    let timedOut = false;
    let killTimer;
    child.stdout.setEncoding("utf8").on("data", (data) => (stdout += data));
    child.stderr.setEncoding("utf8").on("data", (data) => (stderr += data));
    child.on("error", (err) => (error = err.message));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 1000);
    }, timeout);
    child.on("close", (code, signal) => {
      activeChildren.delete(child);
      clearTimeout(timer);
      clearTimeout(killTimer);
      ok({ code, signal, error, timedOut, stdout, stderr });
    });
  });
}

async function exec(cmd, args, cwd, timeout = 60_000) {
  const result = await runProcess(cmd, args, { cwd, timeout, env: { ...process.env, ...gitEnv } });
  return { ...result, out: result.stdout + result.stderr };
}

async function git(cwd, ...args) {
  const result = await exec("git", args, cwd);
  if (result.code !== 0 || result.error || result.timedOut) {
    throw new Error(`git ${args[0]} failed: ${result.error ?? result.out.slice(-300)}`);
  }
}

const runner = (file) => (file.endsWith(".py") ? "python3" : file.endsWith(".sh") ? "bash" : "node");

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
    credits: typeof acct?.totalNanoAiu === "number" && Number.isFinite(acct.totalNanoAiu) && acct.totalNanoAiu >= 0
      ? acct.totalNanoAiu / 1e9 : null,
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
  if (task.setup) {
    const r = await exec(runner(task.setup), [join(task.dir, task.setup)], work);
    if (r.code !== 0 || r.error || r.timedOut) throw new Error(`setup failed for ${task.id}: ${r.error ?? r.out.slice(-300)}`);
  }

  const prompt = [task.prompt, ARMS[arm].hint, task.allowTests ? COMMON_WITH_TESTS : COMMON].filter(Boolean).join("\n\n");
  const args = ["--model", model, "--allow-all-tools", "--no-color", "--output-format", "json", "--disable-builtin-mcps", "--no-auto-update", "--experimental"];
  if (opt.effort) args.push("--reasoning-effort", opt.effort);
  if (ARMS[arm].plugin) args.push("--plugin-dir", PLUGIN_DIR);
  args.push("-p", prompt);

  const started = Date.now();
  const env = { ...process.env, ...gitEnv };
  delete env.OMC_DISABLE;
  delete env.OMC_DISABLE_FEATURES;
  delete env.COPILOT_CUSTOM_INSTRUCTIONS_DIRS;
  const proc = await runProcess("copilot", args, {
    cwd: work,
    env: { ...env, ...ARMS[arm].env, COPILOT_HOME: home },
    timeout: timeoutMs,
  });
  const wallMs = Date.now() - started;
  const metrics = parseEvents(proc.stdout);
  const completed = !proc.timedOut && !proc.error && proc.code === 0 && metrics.exitCode === 0;

  let pass = false;
  let actual = "";
  let checkOut = "";
  let infrastructureError;
  if (completed && task.check) {
    const r = await exec(runner(task.check), [join(task.dir, task.check)], work);
    if (r.error || r.timedOut || r.code === null) {
      infrastructureError = `check failed to run: ${r.error ?? "terminated or timed out"}`;
    } else {
      pass = r.code === 0;
    }
    checkOut = r.out;
  } else if (completed) {
    const expected = readFileSync(join(task.dir, "after", task.file), "utf8");
    const actualPath = join(work, task.file);
    actual = existsSync(actualPath) ? readFileSync(actualPath, "utf8") : "";
    pass = normalize(actual, task.compare) === normalize(expected, task.compare);
  }

  const row = {
    task: task.id, model, ...(opt.effort && { effort: opt.effort }), arm, rep,
    pass, timedOut: proc.timedOut, wallMs, processExitCode: proc.code, ...metrics,
  };
  if (!pass) {
    if (!completed) {
      infrastructureError = proc.error ?? (proc.timedOut ? "Copilot timed out; reported usage may be incomplete" : `Copilot exited with process code ${proc.code} and result code ${metrics.exitCode}`);
      row.failureReason = infrastructureError;
    } else if (infrastructureError) row.failureReason = infrastructureError;
    else if (task.check) row.checkTail = checkOut.trim().split("\n").slice(-5).join(" | ").slice(0, 400);
    else if (opt.keep) writeFileSync(join(dir, "actual"), actual);
    row.stderrTail = proc.stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 300);
  }
  if (infrastructureError) row.infrastructureError = infrastructureError;
  appendFileSync(outFile, JSON.stringify(row) + "\n");
  if (!opt.keep) rmSync(dir, { recursive: true, force: true });
  else writeFileSync(join(dir, "events.jsonl"), proc.stdout);
  const t = row.tokens;
  console.log(
    `[${String(index + 1).padStart(3)}/${runs.length}] ${pass ? "PASS" : "FAIL"} ${task.id} ${model}${opt.effort ? `@${opt.effort}` : ""} ${arm} #${rep} ` +
      `${(wallMs / 1000).toFixed(1)}s out=${t.output} in=${(t.input ?? 0) + (t.cacheWrite ?? 0)}+${t.cacheRead}cached ` +
      `credits=${row.credits?.toFixed(2)} tools=${JSON.stringify(row.tools)}` +
      (Object.keys(row.toolFailures).length ? ` failed=${JSON.stringify(row.toolFailures)}` : ""),
  );
  return row;
}

let next = 0;
let spent = 0;
let finished = 0;
let maxRunCost = initialRunCost;
let inFlight = 0;
let stopped = false;
let budgetStopped = false;
let infrastructureFailure = false;
let interruptedSignal;
const waiters = [];
const settled = () => new Promise((ok) => waiters.push(ok));
const wake = () => waiters.splice(0).forEach((ok) => ok());
function interrupt(signal) {
  if (interruptedSignal) return;
  interruptedSignal = signal;
  stopped = true;
  console.error(`interrupted by ${signal}; stopping direct child processes and collecting available usage`);
  for (const child of activeChildren) {
    child.kill("SIGTERM");
    const timer = setTimeout(() => {
      if (activeChildren.has(child) && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 1000);
    timer.unref();
  }
  wake();
}
const onSigint = () => interrupt("SIGINT");
const onSigterm = () => interrupt("SIGTERM");
process.on("SIGINT", onSigint);
process.on("SIGTERM", onSigterm);
const workers = Array.from({ length: Math.min(concurrency, runs.length) }, async () => {
  while (next < runs.length && !stopped) {
    if (spent + (inFlight + 1) * maxRunCost > maxCredits) {
      if (inFlight > 0) {
        await settled();
        continue;
      }
      console.error(`budget: stopping new runs at ${spent.toFixed(2)} known credits (threshold ${maxCredits}, reserve ${maxRunCost.toFixed(2)})`);
      budgetStopped = true;
      stopped = true;
      break;
    }
    const i = next++;
    inFlight++;
    try {
      const row = await runOne(runs[i], i);
      finished++;
      if (row.infrastructureError) {
        console.error(`run ${i + 1}: ${row.infrastructureError}; stopping new runs`);
        infrastructureFailure = true;
        stopped = true;
      }
      if (row.credits === null) {
        console.error(`run ${i + 1}: no valid credit accounting; stopping new runs`);
        infrastructureFailure = true;
        stopped = true;
      } else {
        spent += row.credits;
        maxRunCost = Math.max(maxRunCost, row.credits);
      }
    } catch (err) {
      console.error(`run ${i + 1} crashed; its spend may be unaccounted: ${err.stack ?? err}`);
      infrastructureFailure = true;
      stopped = true;
    } finally {
      inFlight--;
      wake();
    }
  }
});
await Promise.all(workers);
process.off("SIGINT", onSigint);
process.off("SIGTERM", onSigterm);
if (spent > maxCredits) {
  console.error(`budget: known spend ${spent.toFixed(2)} exceeded threshold ${maxCredits}; a run cost more than its reserve`);
  budgetStopped = true;
}
console.log(`known spend ${spent.toFixed(2)} credits${infrastructureFailure ? " (total may be higher)" : ""}; ${finished} results, ${next} started of ${runs.length} planned`);
if (!opt.keep) rmSync(scratch, { recursive: true, force: true });
else console.log(`kept run directories in ${scratch}`);
console.log(`done. Report: node bench/report.mjs ${outFile}`);
if (interruptedSignal) process.exitCode = interruptedSignal === "SIGINT" ? 130 : 143;
else if (infrastructureFailure) process.exitCode = 1;
else if (budgetStopped) process.exitCode = 2;
