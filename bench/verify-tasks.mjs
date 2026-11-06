#!/usr/bin/env node
// Checks check-based benchmark tasks without calling Copilot (free).
// The untouched fixture must fail its hidden check, and the reference solution
// must pass. Optional visible tests must pass both; optional mutations of the
// reference must remain syntactically valid and fail the hidden check.
//
// Usage: node bench/verify-tasks.mjs [tasks-dir] [task-id ...]

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [dirArg, ...only] = process.argv.slice(2);
const tasksDir = resolve(dirArg ?? join(ROOT, "bench", "tasks-hard"));
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "bench",
  GIT_AUTHOR_EMAIL: "bench@example.com",
  GIT_COMMITTER_NAME: "bench",
  GIT_COMMITTER_EMAIL: "bench@example.com",
  PYTHONDONTWRITEBYTECODE: "1",
};
const runner = (f) => (f.endsWith(".py") ? "python3" : f.endsWith(".sh") ? "bash" : "node");
function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, env, encoding: "utf8", timeout: 60_000 });
  if (result.error || result.signal || result.status === null) {
    throw new Error(`${cmd} could not complete: ${result.error?.message ?? result.signal ?? "unknown error"}`);
  }
  return result;
}
const tail = (result) => (result.stdout + result.stderr).trim().split("\n").slice(-5).join(" | ");

function fixture(task) {
  const work = mkdtempSync(join(tmpdir(), `omc-verify-${task.id}-`));
  try {
    cpSync(join(task.dir, "before"), work, { recursive: true });
    for (const args of [["init", "-q"], ["add", "-A"], ["commit", "-qm", "fixture"]]) {
      const result = run("git", args, work);
      if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${tail(result)}`);
    }
    if (task.setup) {
      const result = run(runner(task.setup), [join(task.dir, task.setup)], work);
      if (result.status !== 0) throw new Error(`setup failed: ${tail(result)}`);
    }
  } catch (error) {
    rmSync(work, { recursive: true, force: true });
    throw error;
  }
  return work;
}

function withFixture(task, fn) {
  const work = fixture(task);
  try {
    return fn(work);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const check = (task, work) => run(runner(task.check), [join(task.dir, task.check)], work);

function runVisible(task, work, stage, problems) {
  if (task.visibleTest === undefined) return;
  if (!Array.isArray(task.visibleTest) || !task.visibleTest.length || task.visibleTest.some((part) => typeof part !== "string" || !part)) {
    throw new Error("visibleTest must be a nonempty array of command arguments");
  }
  const [cmd, ...args] = task.visibleTest;
  const result = run(cmd, args, work);
  if (result.status !== 0) problems.push(`${stage} visible tests failed: ${tail(result)}`);
}

function mutate(work, mutation) {
  if (typeof mutation.id !== "string" || !mutation.id || typeof mutation.file !== "string" || isAbsolute(mutation.file)
      || typeof mutation.from !== "string" || !mutation.from || typeof mutation.to !== "string" || mutation.from === mutation.to) {
    throw new Error("each mutation needs an id, a relative file, and distinct from/to strings");
  }
  const file = realpathSync(resolve(work, mutation.file));
  const rel = relative(realpathSync(work), file);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`${mutation.id}: file is outside the fixture`);
  const text = readFileSync(file, "utf8");
  const position = text.indexOf(mutation.from);
  if (position === -1 || position !== text.lastIndexOf(mutation.from)) {
    throw new Error(`${mutation.id}: replacement must match exactly once`);
  }
  writeFileSync(file, text.slice(0, position) + mutation.to + text.slice(position + mutation.from.length));
  let syntax;
  if (file.endsWith(".py")) {
    syntax = run("python3", ["-c", "import sys; p=sys.argv[1]; compile(open(p, encoding='utf-8').read(), p, 'exec')", file], work);
  } else if (file.endsWith(".mjs") || file.endsWith(".js")) {
    syntax = run("node", ["--check", file], work);
  } else {
    throw new Error(`${mutation.id}: unsupported mutation file type`);
  }
  if (syntax.status !== 0) throw new Error(`${mutation.id}: mutation is not syntactically valid: ${tail(syntax)}`);
}

let failures = 0;
const ids = readdirSync(tasksDir).filter((d) => existsSync(join(tasksDir, d, "task.json"))).sort();
if (!ids.length) throw new Error(`no benchmark tasks found in ${tasksDir}`);
for (const id of only.length ? only : ids) {
  const problems = [];
  let mutations = [];
  try {
    if (!ids.includes(id)) throw new Error(`unknown task ${id}`);
    const task = { ...JSON.parse(readFileSync(join(tasksDir, id, "task.json"), "utf8")), dir: join(tasksDir, id) };
    if (task.id !== id || !task.check) throw new Error("task.json needs a matching id and a check script");
    withFixture(task, (work) => {
      runVisible(task, work, "baseline", problems);
      if (check(task, work).status === 0) problems.push("the untouched fixture passes its hidden check");
    });
    withFixture(task, (work) => {
      cpSync(join(task.dir, "solution"), work, { recursive: true });
      runVisible(task, work, "solution", problems);
      const result = check(task, work);
      if (result.status !== 0) problems.push(`the solution fails its hidden check: ${tail(result)}`);
    });
    const mutationFile = join(task.dir, "mutations.json");
    if (existsSync(mutationFile)) {
      mutations = JSON.parse(readFileSync(mutationFile, "utf8"));
      if (!Array.isArray(mutations) || new Set(mutations.map((m) => m.id)).size !== mutations.length) {
        throw new Error("mutations.json must contain an array with unique ids");
      }
      for (const mutation of mutations) {
        withFixture(task, (work) => {
          cpSync(join(task.dir, "solution"), work, { recursive: true });
          mutate(work, mutation);
          if (check(task, work).status === 0) problems.push(`${mutation.id}: hidden check accepted the mutation`);
        });
      }
    }
  } catch (error) {
    problems.push(error.message);
  }
  failures += problems.length ? 1 : 0;
  const suffix = mutations.length ? ` (${mutations.length} mutations)` : "";
  console.log(`${problems.length ? "FAIL" : "ok  "} ${id}${suffix}${problems.length ? `: ${problems.join("; ")}` : ""}`);
}
process.exit(failures ? 1 : 0);
