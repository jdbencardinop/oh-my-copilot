// Shared helpers for the hard-suite check scripts. Lives outside every run's
// repository, like the checks themselves.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const fail = (msg) => {
  console.log(`FAIL: ${msg}`);
  process.exit(1);
};

export const taskDir = (metaUrl) => dirname(fileURLToPath(metaUrl));

export const read = (file) => {
  const p = join(process.cwd(), file);
  if (!existsSync(p)) fail(`${file} is missing`);
  return readFileSync(p, "utf8");
};

export const readBefore = (dir, file) => readFileSync(join(dir, "before", file), "utf8");

export function assertUnchanged(dir, files) {
  for (const f of files) if (read(f) !== readBefore(dir, f)) fail(`${f} must not change`);
}

export async function load(file) {
  const url = pathToFileURL(join(process.cwd(), file)).href + `?t=${Date.now()}${Math.random()}`;
  try {
    return await import(url);
  } catch (e) {
    fail(`cannot import ${file}: ${e.message}`);
  }
}

export function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) fail(`${what}: expected ${b}, got ${a}`);
}

export function throws(fn, what) {
  try {
    fn();
  } catch {
    return;
  }
  fail(`${what}: expected an exception`);
}

export const count = (text, re) => (text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || []).length;

const MARKER = /^(<{7}|={7}|>{7}|\|{7})( |$)/m;
export function noConflictMarkers(files) {
  for (const f of files) if (MARKER.test(read(f))) fail(`${f} still has conflict markers`);
}

// Returns the text of `export function <name>` up to the next top-level
// declaration, or null.
export function functionText(text, name) {
  const re = new RegExp(`^(export )?(async )?function ${name}\\b[\\s\\S]*?^}\\n`, "m");
  const m = text.match(re);
  return m ? m[0] : null;
}
