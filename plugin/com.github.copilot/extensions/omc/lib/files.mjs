// File-system helpers: config locations and an mtime-keyed JSON cache.

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export function copilotHome(env = process.env) {
  return env.COPILOT_HOME || join(homedir(), ".copilot");
}

export function userOmcDir(env = process.env) {
  return join(copilotHome(env), "omc");
}

/** Nearest ".github/omc" walking up from startDir, stopping at the git root. */
export function findProjectOmcDir(startDir) {
  if (!startDir) return null;
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, ".github", "omc");
    if (existsSync(candidate)) return candidate;
    if (existsSync(join(dir, ".git"))) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Read JSON files, re-parsing only when mtime or size changes.
 * Missing files return { data: undefined }; bad JSON returns { error }.
 */
export function createJsonCache() {
  const cache = new Map();
  return {
    read(path) {
      let st;
      try {
        st = statSync(path);
      } catch {
        cache.delete(path);
        return { data: undefined };
      }
      const key = `${st.mtimeMs}:${st.size}`;
      const hit = cache.get(path);
      if (hit && hit.key === key) return hit.value;
      let value;
      try {
        value = { data: JSON.parse(readFileSync(path, "utf8")) };
      } catch (err) {
        value = { error: `${path}: ${err.message}` };
      }
      cache.set(path, { key, value });
      return value;
    },
    clear() {
      cache.clear();
    },
  };
}
