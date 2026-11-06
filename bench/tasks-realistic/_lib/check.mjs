import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function assertUnchanged(metaUrl, files) {
  const taskDir = dirname(fileURLToPath(metaUrl));
  for (const file of files) {
    assert.equal(
      readFileSync(join(process.cwd(), file), "utf8"),
      readFileSync(join(taskDir, "before", file), "utf8"),
      `${file} must not change`,
    );
  }
}

export function load(file) {
  return import(pathToFileURL(join(process.cwd(), file)).href);
}
