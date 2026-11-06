import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const verifier = join(root, "bench", "verify-tasks.mjs");

function fixture(t, replacement) {
  const dir = mkdtempSync(join(tmpdir(), "omc-verify-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const task = join(dir, "sample");
  mkdirSync(join(task, "before", "src"), { recursive: true });
  mkdirSync(join(task, "solution", "src"), { recursive: true });
  writeFileSync(join(task, "task.json"), JSON.stringify({ id: "sample", check: "check.mjs", visibleTest: ["node", "test.mjs"] }));
  writeFileSync(join(task, "before", "src", "value.mjs"), "export const value = 0;\n");
  writeFileSync(join(task, "before", "test.mjs"), "console.log('visible test');\n");
  writeFileSync(join(task, "solution", "src", "value.mjs"), "export const value = 42;\n");
  writeFileSync(join(task, "check.mjs"), `
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const { value } = await import(pathToFileURL(join(process.cwd(), "src/value.mjs")));
assert.equal(value, 42);
`);
  writeFileSync(join(task, "mutations.json"), JSON.stringify([{
    id: "wrong-value", file: "src/value.mjs", from: "42", to: replacement,
  }]));
  return dir;
}

function verify(dir) {
  return spawnSync(process.execPath, [verifier, dir], { encoding: "utf8", timeout: 15_000 });
}

test("the verifier accepts a reference and rejects a behavioral mutation", (t) => {
  const result = verify(fixture(t, "41"));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ok\s+sample \(1 mutations\)/);
});

test("the verifier fails when a mutation is not detected", (t) => {
  const result = verify(fixture(t, "42 + 0"));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /hidden check accepted the mutation/);
});

test("the verifier does not count a syntax error as a valid mutation", (t) => {
  const result = verify(fixture(t, "("));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /mutation is not syntactically valid/);
});

test("the verifier fails if a declared visible test fails on the baseline", (t) => {
  const dir = fixture(t, "41");
  writeFileSync(join(dir, "sample", "before", "test.mjs"), "process.exit(1);\n");
  const result = verify(dir);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /baseline visible tests failed/);
});
