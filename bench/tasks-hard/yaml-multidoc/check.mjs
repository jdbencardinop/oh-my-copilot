import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fail, read, taskDir } from "../_lib/check.mjs";

// No YAML parser is available, so compare text, ignoring trailing whitespace,
// trailing blank lines and double quotes around simple scalar values.
const norm = (s) =>
  s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, "").replace(/: "([^"\\]*)"$/, ": $1"))
    .join("\n")
    .replace(/\n+$/, "");

const expected = norm(readFileSync(join(taskDir(import.meta.url), "expected", "shop.yaml"), "utf8")).split("\n");
const actual = norm(read("shop.yaml")).split("\n");
for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
  if (expected[i] !== actual[i]) {
    fail(`shop.yaml line ${i + 1}: expected ${JSON.stringify(expected[i] ?? "<end of file>")}, got ${JSON.stringify(actual[i] ?? "<end of file>")}`);
  }
}
console.log("ok");
