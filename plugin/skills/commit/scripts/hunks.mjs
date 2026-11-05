#!/usr/bin/env node
// Hunk-level staging helper for the commit skill. Zero dependencies.
//
//   node hunks.mjs list [--json]        List unstaged hunks and whole-file changes with stable ids.
//   node hunks.mjs show <id>...         Print the patch for the given ids.
//   node hunks.mjs stage <id>...        Stage exactly those hunks/files.
//   node hunks.mjs snapshot             Record the full working tree; prints a tree id.
//   node hunks.mjs verify <tree-id>     Check nothing was lost since the snapshot.
//
// Ids are content hashes, so they stay valid after other hunks are staged or committed.
// `stage` only touches the index; no command modifies the working tree, commits, or refs.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Paths are always literal (no glob magic), and diff output ignores user diff settings that
// would change its format (prefixes, colors, external tools, quoting).
const git = (args, opts = {}) =>
  execFileSync("git", ["--literal-pathspecs", "-c", "core.quotepath=off", ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
    ...opts,
  });

const DIFF = ["-c", "diff.suppressBlankEmpty=false", "diff", "--no-color", "--no-ext-diff", "--no-textconv", "--no-relative", "--src-prefix=a/", "--dst-prefix=b/"];

const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 8);

const WHOLE_FILE = /^(new file|deleted file|old mode|new mode|rename from|rename to|copy from|copy to|similarity index|Binary files|GIT binary patch)/;

// Parses `git diff` output (index vs worktree) into files, each with header lines and hunks.
export function parseDiff(text) {
  const files = [];
  let file = null;
  let hunk = null;
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      file = { header: [line], hunks: [], path: null, whole: false };
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (m && !file.whole) {
      hunk = { oldStart: +m[1], oldLines: m[2] === undefined ? 1 : +m[2], newStart: +m[3], newLines: m[4] === undefined ? 1 : +m[4], head: line, body: [] };
      file.hunks.push(hunk);
      continue;
    }
    if (hunk) {
      hunk.body.push(line);
      continue;
    }
    file.header.push(line);
    if (line.startsWith("+++ ") && !line.endsWith("/dev/null")) file.path = unquote(line.slice(4)).replace(/^b\//, "");
    else if (line.startsWith("--- ") && !file.path && !line.endsWith("/dev/null")) file.path = unquote(line.slice(4)).replace(/^a\//, "");
    else if (line.startsWith("rename to ")) file.path = unquote(line.slice(10));
    if (WHOLE_FILE.test(line)) file.whole = true;
  }
  for (const f of files) {
    if (!f.path) {
      const m = /^diff --git (?:"?a\/)(.*?)"? (?:"?b\/)(.*?)"?$/.exec(f.header[0]);
      f.path = m ? m[2] : f.header[0];
    }
    if (f.hunks.length === 0) f.whole = true;
  }
  return files;
}

function unquote(p) {
  p = p.replace(/\t.*$/, "");
  if (p.startsWith('"') && p.endsWith('"')) {
    try { return JSON.parse(p); } catch { return p.slice(1, -1); }
  }
  return p;
}

export function entries(files, untracked = []) {
  const out = [];
  const seen = new Map();
  // Identical changes hash alike; later copies get an ordinal suffix (`-2`, `-3`) in diff order.
  const unique = (id) => {
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n === 1 ? id : `${id}-${n}`;
  };
  for (const f of files) {
    if (f.whole) {
      const summary = f.header.filter((l) => WHOLE_FILE.test(l)).map((l) => (l.startsWith("Binary files") ? "binary" : l)).join("; ") || "whole file";
      out.push({ id: unique("f" + hash(f.path + "\0" + f.header.join("\n") + "\0" + f.hunks.map((h) => h.body.join("\n")).join("\n"))), kind: "file", path: f.path, file: f, summary });
      continue;
    }
    for (const h of f.hunks) {
      const add = h.body.filter((l) => l.startsWith("+")).length;
      const del = h.body.filter((l) => l.startsWith("-")).length;
      out.push({ id: unique("h" + hash(f.path + "\0" + h.body.join("\n"))), kind: "hunk", path: f.path, file: f, hunk: h, summary: `${h.head} +${add} -${del}` });
    }
  }
  for (const p of untracked) out.push({ id: unique("u" + hash(p)), kind: "untracked", path: p, summary: "untracked file" });
  return out;
}

// Builds a patch with only the chosen hunks of one file. Old-side numbers refer to the index
// and stay as-is; new-side starts are shifted to drop the line-count changes of skipped hunks.
export function buildPatch(file, chosen) {
  const out = [...file.header];
  let skipped = 0;
  for (const h of file.hunks) {
    if (!chosen.has(h)) {
      skipped += h.newLines - h.oldLines;
      continue;
    }
    const tail = h.head.replace(/^@@ [^@]* @@/, "");
    out.push(`@@ -${h.oldStart},${h.oldLines} +${h.newStart - skipped},${h.newLines} @@${tail}`);
    out.push(...h.body);
  }
  return out.join("\n") + "\n";
}

const toplevel = () => git(["rev-parse", "--show-toplevel"]).trim();

function load() {
  const cwd = toplevel();
  const diff = git([...DIFF, "--no-renames", "--binary", "-U3"], { cwd });
  const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"], { cwd }).split("\0").filter(Boolean);
  return entries(parseDiff(diff), untracked);
}

function pick(all, ids) {
  const byId = new Map(all.map((e) => [e.id, e]));
  const missing = ids.filter((id) => !byId.has(id));
  if (new Set(ids).size !== ids.length) throw new Error("duplicate id(s) in the arguments");
  if (missing.length) throw new Error(`unknown id(s): ${missing.join(", ")}. Run "list" again; staged or edited hunks drop out of the list.`);
  return ids.map((id) => byId.get(id));
}

export function patchFor(selected) {
  const perFile = new Map();
  for (const e of selected) {
    if (e.kind !== "hunk") continue;
    if (!perFile.has(e.file)) perFile.set(e.file, new Set());
    perFile.get(e.file).add(e.hunk);
  }
  return [...perFile].map(([f, set]) => buildPatch(f, set)).join("");
}

const emptyTree = (cwd) => git(["hash-object", "-t", "tree", "--stdin"], { input: "", cwd }).trim();

function headTree(cwd) {
  try {
    return git(["rev-parse", "--verify", "-q", "HEAD^{tree}"], { cwd }).trim();
  } catch {
    return emptyTree(cwd);
  }
}

function snapshotTree() {
  const cwd = toplevel();
  const gitDir = git(["rev-parse", "--absolute-git-dir"], { cwd }).trim();
  const index = join(gitDir, `omc-snapshot-index-${process.pid}`);
  try {
    const env = { ...process.env, GIT_INDEX_FILE: index };
    git(["read-tree", headTree(cwd)], { env, cwd });
    git(["add", "-A", "--", "."], { env, cwd });
    return git(["write-tree"], { env, cwd }).trim();
  } finally {
    rmSync(index, { force: true });
  }
}

export function main(argv, write = (s) => process.stdout.write(s)) {
  const [cmd, ...rest] = argv;
  const ids = rest.filter((a) => !a.startsWith("--"));
  switch (cmd) {
    case "list": {
      const all = load();
      if (rest.includes("--json")) write(JSON.stringify(all.map(({ id, kind, path, summary }) => ({ id, kind, path, summary })), null, 2) + "\n");
      else if (all.length === 0) write("No unstaged changes.\n");
      else for (const e of all) write(`${e.id}  ${e.kind.padEnd(9)} ${e.path}  ${e.summary}\n`);
      return 0;
    }
    case "show": {
      for (const e of pick(load(), ids)) {
        if (e.kind === "hunk") write(`# ${e.id} ${e.path}\n${e.hunk.head}\n${e.hunk.body.join("\n")}\n`);
        else if (e.kind === "file") write(`# ${e.id} ${e.path}\n${e.file.header.join("\n")}\n${e.file.hunks.map((h) => h.head + "\n" + h.body.join("\n")).join("\n")}\n`);
        else write(`# ${e.id} ${e.path} (untracked, staged as a whole file)\n`);
      }
      return 0;
    }
    case "stage": {
      if (ids.length === 0) throw new Error("stage needs at least one id");
      const cwd = toplevel();
      const selected = pick(load(), ids);
      const patch = patchFor(selected);
      const paths = selected.filter((e) => e.kind !== "hunk").map((e) => e.path);
      if (patch) git(["apply", "--cached", "--check", "--whitespace=nowarn", "-"], { input: patch, cwd });
      if (paths.length) git(["add", "-A", "--dry-run", "--", ...paths], { cwd });
      // All or nothing: restore the previous index if any step fails.
      const saved = git(["write-tree"], { cwd }).trim();
      try {
        if (patch) git(["apply", "--cached", "--whitespace=nowarn", "-"], { input: patch, cwd });
        if (paths.length) git(["add", "-A", "--", ...paths], { cwd });
      } catch (err) {
        git(["read-tree", saved], { cwd });
        throw err;
      }
      write(`Staged ${selected.length} item(s). Check with: git diff --cached --stat\n`);
      return 0;
    }
    case "snapshot":
      write(snapshotTree() + "\n");
      return 0;
    case "verify": {
      const [before] = ids;
      if (!before) throw new Error("verify needs the tree id printed by snapshot");
      const cwd = toplevel();
      const now = snapshotTree();
      const lost = git(["diff", "--no-ext-diff", "--no-color", "--stat", before, now], { cwd }).trim();
      if (lost) {
        write(`FAIL: the working tree differs from the snapshot:\n${lost}\n`);
        return 1;
      }
      const left = git(["diff", "--no-ext-diff", "--no-color", "--stat", headTree(cwd), now], { cwd }).trim();
      write("OK: the working tree matches the snapshot; nothing was lost.\n");
      write(left ? `Still uncommitted (relative to HEAD):\n${left}\n` : "Everything is committed: HEAD matches the snapshot.\n");
      return 0;
    }
    default:
      process.stderr.write("usage: hunks.mjs list [--json] | show <id>... | stage <id>... | snapshot | verify <tree-id>\n");
      return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`hunks.mjs: ${String(err.stderr || err.message || err).trim()}\n`);
    process.exitCode = 1;
  }
}
