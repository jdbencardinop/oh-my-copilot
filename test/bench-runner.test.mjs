import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, watch, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runner = join(root, "bench", "run.mjs");
const report = join(root, "bench", "report.mjs");

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "omc-bench-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const home = join(dir, "home");
  const bin = join(dir, "bin");
  const task = join(dir, "tasks", "sample");
  mkdirSync(home);
  mkdirSync(bin);
  mkdirSync(join(task, "before"), { recursive: true });
  mkdirSync(join(task, "after"));
  writeFileSync(join(home, "config.json"), "{}");
  writeFileSync(join(home, "settings.json"), "{}");
  writeFileSync(join(task, "task.json"), JSON.stringify({ id: "sample", file: "file.txt", prompt: "Fix the file." }));
  writeFileSync(join(task, "before", "file.txt"), "bad\n");
  writeFileSync(join(task, "after", "file.txt"), "good\n");
  const fake = join(bin, "copilot");
  writeFileSync(fake, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (process.env.FAKE_MODE === "hang") process.on("SIGTERM", () => {});
if (process.env.FAKE_CAPTURE) fs.writeFileSync(process.env.FAKE_CAPTURE, args[args.indexOf("-p") + 1]);
if (process.env.FAKE_PID) fs.writeFileSync(process.env.FAKE_PID, String(process.pid));
if (process.env.FAKE_ENV_CAPTURE) fs.writeFileSync(process.env.FAKE_ENV_CAPTURE, JSON.stringify({
  disable: process.env.OMC_DISABLE,
  features: process.env.OMC_DISABLE_FEATURES,
  instructions: process.env.COPILOT_CUSTOM_INSTRUCTIONS_DIRS,
}));
if (process.env.FAKE_MODE !== "missing") {
  console.log(JSON.stringify({ type: "session.usage_checkpoint", data: {
    accountingSnapshot: { totalNanoAiu: Number(process.env.FAKE_CREDIT || "1") * 1e9 }
  }}));
}
if (process.env.FAKE_MODE === "hang") {
  setInterval(() => {}, 1000);
} else {
  const finish = () => {
    fs.writeFileSync("file.txt", "good\\n");
    console.log(JSON.stringify({ type: "result", exitCode: 0 }));
    if (process.env.FAKE_MODE === "nonzero") process.exitCode = 7;
  };
  if (process.env.FAKE_DELAY_MS) setTimeout(finish, Number(process.env.FAKE_DELAY_MS));
  else finish();
}
`);
  chmodSync(fake, 0o755);
  return {
    dir, home, task,
    output: join(dir, "results.jsonl"),
    env: { ...process.env, COPILOT_HOME: home, PATH: `${bin}${delimiter}${process.env.PATH}` },
  };
}

function run(f, args = [], extraEnv = {}) {
  return spawnSync(process.execPath, [
    runner, "--tasks-dir", join(f.dir, "tasks"), "--models", "fake", "--arms", "stock-default",
    "--out", f.output, ...args,
  ], { encoding: "utf8", env: { ...f.env, ...extraEnv }, timeout: 15_000 });
}

function rows(f) {
  return readFileSync(f.output, "utf8").trim().split("\n").map(JSON.parse);
}

function stopFakeIfRunning(f, pidFile) {
  if (!f || !pidFile || !existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, "utf8"));
  if (!Number.isSafeInteger(pid) || pid <= 0) return;
  try {
    const command = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
    if (command.includes(join(f.dir, "bin", "copilot"))) process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH" && error.code !== "ENOENT") throw error;
  }
}

test("plan validates the experiment without reading a profile or creating output", (t) => {
  const f = fixture(t);
  const result = run(f, ["--plan", "--reps", "2"], { COPILOT_HOME: join(f.dir, "missing-profile") });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 runs/);
  assert.match(result.stdout, /no Copilot sessions started/);
  assert.equal(existsSync(f.output), false);
});

test("invalid scheduling options are rejected before starting a session", (t) => {
  const f = fixture(t);
  const captured = join(f.dir, "prompt");
  for (const [option, value] of [
    ["--run-cost", "NaN"], ["--max-credits", ""], ["--concurrency", "0"],
    ["--reps", "1.5"], ["--reps", "9007199254740992"], ["--timeout", "-1"],
  ]) {
    const args = value.startsWith("-") ? [`${option}=${value}`] : [option, value];
    const result = run(f, args, { FAKE_CAPTURE: captured });
    assert.notEqual(result.status, 0, `${option} should fail validation`);
    assert.match(result.stderr, /must be a positive/);
    assert.equal(existsSync(captured), false);
  }
  const tooLong = run(f, ["--timeout", "2147484"], { FAKE_CAPTURE: captured });
  assert.notEqual(tooLong.status, 0);
  assert.match(tooLong.stderr, /--timeout must be at most/);
  assert.equal(existsSync(captured), false);
});

test("profile initialization errors do not leave disposable credentials on disk", (t) => {
  const f = fixture(t);
  const temporary = join(f.dir, "temporary");
  mkdirSync(temporary);
  const result = run(f, [], { COPILOT_HOME: join(f.dir, "missing-profile"), TMPDIR: temporary });
  assert.notEqual(result.status, 0);
  assert.deepEqual(readdirSync(temporary), []);
});

test("the scheduling reserve never falls below the requested per-run estimate", (t) => {
  const f = fixture(t);
  const result = run(f, ["--reps", "2", "--concurrency", "1", "--max-credits", "5", "--run-cost", "5"], { FAKE_CREDIT: "0.1" });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(rows(f).length, 1);
  assert.match(result.stderr, /stopping new runs/);
});

test("missing accounting stops the experiment instead of being counted as zero", (t) => {
  const f = fixture(t);
  const result = run(f, ["--reps", "3", "--concurrency", "1", "--max-credits", "20"], { FAKE_MODE: "missing" });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(rows(f).length, 1);
  assert.equal(rows(f)[0].credits, null);
  assert.match(result.stderr, /no valid credit accounting/);
});

test("concurrent sessions reserve budget and missing accounting prevents later starts", (t) => {
  const f = fixture(t);
  const result = run(f, ["--reps", "6", "--concurrency", "4", "--max-credits", "10", "--run-cost", "5"], {
    FAKE_MODE: "missing", FAKE_DELAY_MS: "100",
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(rows(f).length, 2);
  assert.match(result.stdout, /total may be higher/);
});

test("an unexpectedly expensive run reports a threshold overrun", (t) => {
  const f = fixture(t);
  const result = run(f, ["--max-credits", "1", "--run-cost", "1"], { FAKE_CREDIT: "3" });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(rows(f)[0].credits, 3);
  assert.match(result.stderr, /exceeded threshold/);
});

test("an unsuccessful Copilot process cannot pass despite editing the file", (t) => {
  const f = fixture(t);
  const result = run(f, [], { FAKE_MODE: "nonzero" });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(rows(f)[0].pass, false);
  assert.equal(rows(f)[0].processExitCode, 7);
  assert.match(result.stderr, /stopping new runs/);
});

test("timeouts wait for the Copilot process to exit and retain accounting", (t) => {
  let f;
  let pidFile;
  t.after(() => stopFakeIfRunning(f, pidFile));
  f = fixture(t);
  pidFile = join(f.dir, "pid");
  const result = run(f, ["--timeout", "0.3"], { FAKE_MODE: "hang", FAKE_PID: pidFile, FAKE_CREDIT: "0.25" });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(rows(f)[0].pass, false);
  assert.equal(rows(f)[0].timedOut, true);
  assert.equal(rows(f)[0].credits, 0.25);
  assert.match(result.stderr, /reported usage may be incomplete/);
  assert.throws(() => process.kill(Number(readFileSync(pidFile, "utf8")), 0), { code: "ESRCH" });
});

test("SIGTERM stops the active session before the runner exits", {
  timeout: 15_000,
  skip: process.platform !== "linux" && "the fallback cleanup identifies the child via /proc",
}, async (t) => {
  let f;
  let pidFile;
  let child;
  t.after(() => {
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    stopFakeIfRunning(f, pidFile);
  });
  f = fixture(t);
  pidFile = join(f.dir, "pid");
  const temporary = join(f.dir, "temporary");
  mkdirSync(temporary);
  const ready = new Promise((ok, fail) => {
    const timer = setTimeout(() => {
      watcher.close();
      fail(new Error("fake Copilot did not start"));
    }, 5000);
    const watcher = watch(f.dir, (_, name) => {
      if (name !== "pid" || !existsSync(pidFile) || !readFileSync(pidFile, "utf8").trim()) return;
      clearTimeout(timer);
      watcher.close();
      ok();
    });
  });
  child = spawn(process.execPath, [
    runner, "--tasks-dir", join(f.dir, "tasks"), "--models", "fake", "--arms", "stock-default", "--out", f.output,
  ], {
    env: { ...f.env, TMPDIR: temporary, FAKE_MODE: "hang", FAKE_PID: pidFile },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (data) => (stderr += data));
  child.stdout.resume();
  const closed = new Promise((ok, fail) => {
    child.once("error", fail);
    child.once("close", (code) => ok(code));
  });
  await ready;
  child.kill("SIGTERM");
  assert.equal(await closed, 143, stderr);
  assert.match(stderr, /interrupted by SIGTERM/);
  assert.throws(() => process.kill(Number(readFileSync(pidFile, "utf8")), 0), { code: "ESRCH" });
  assert.deepEqual(readdirSync(temporary), []);
});

test("existing output requires explicit append before starting a session", (t) => {
  const f = fixture(t);
  writeFileSync(f.output, '{"old":true}\n');
  const captured = join(f.dir, "prompt");
  const result = run(f, [], { FAKE_CAPTURE: captured });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /already contains results/);
  assert.equal(existsSync(captured), false);
  const appended = run(f, ["--append"], { FAKE_CAPTURE: captured });
  assert.equal(appended.status, 0, appended.stderr);
  assert.equal(rows(f).length, 2);
});

test("stock-default has no tool hint and task metadata can allow tests", (t) => {
  const f = fixture(t);
  const meta = join(f.task, "task.json");
  const task = JSON.parse(readFileSync(meta, "utf8"));
  task.allowTests = true;
  writeFileSync(meta, JSON.stringify(task));
  const captured = join(f.dir, "prompt");
  const result = run(f, [], { FAKE_CAPTURE: captured });
  assert.equal(result.status, 0, result.stderr);
  const prompt = readFileSync(captured, "utf8");
  assert.match(prompt, /may run the existing tests/i);
  assert.doesNotMatch(prompt, /Use the view and edit tools/);
});

test("inherited plugin switches and custom instruction paths do not change the selected arm", (t) => {
  const f = fixture(t);
  const captured = join(f.dir, "environment");
  const result = run(f, ["--arms", "omc"], {
    FAKE_ENV_CAPTURE: captured,
    OMC_DISABLE: "1",
    OMC_DISABLE_FEATURES: "all",
    COPILOT_CUSTOM_INSTRUCTIONS_DIRS: "/unrelated/user/instructions",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(captured, "utf8")), { features: "nudge" });
});

test("reports omit missing usage from averages and show coverage", (t) => {
  const f = fixture(t);
  const base = { task: "sample", model: "fake", arm: "stock", rep: 1, pass: true, wallMs: 1000, tools: {}, tokens: {}, credits: null };
  writeFileSync(f.output, `${JSON.stringify(base)}\n${JSON.stringify({ ...base, credits: 2 })}\n`);
  const result = spawnSync(process.execPath, [report, f.output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2\.00 \(1\/2\)/);
  assert.match(result.stdout, /Missing metrics are omitted/);
});
