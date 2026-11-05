// Merge-conflict tools, modeled on oh-my-pi's conflict:// handles.
// The parsing and resolution functions are pure; createConflictTools adds
// file system and git access for the list_conflicts / resolve_conflicts tools.

import { execFile } from "node:child_process";
import { access, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { contentToLines, parseDocument, serializeDocument } from "./hashline.mjs";

export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictError";
  }
}

export const RESOLUTIONS = ["ours", "theirs", "base", "both-ours-first", "both-theirs-first", "custom"];
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const MAX_LIST_CHARS = 100_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function fnv32(lines) {
  const s = lines.join("\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  return h >>> 0;
}

/** Six-character (30-bit) hash of a hunk's lines (EOL-insensitive). */
export function hunkHash(lines) {
  const h = fnv32(lines);
  return [0, 5, 10, 15, 20, 25].map((shift) => ALPHABET[(h >>> shift) & 31]).join("");
}

const markerRe = (ch, size) => new RegExp(`^${ch}{${size}}(?:[ \t](.*))?$`);
const START_RE = /^(<{7,})(?:[ \t](.*))?$/;
const SEP_ANY_RE = /^(={7,})\s*$/;
const END_ANY_RE = /^(>{7,})(?:[ \t].*)?$/;
const MAX_PROBLEMS = 20;

/** Cap a list of messages at MAX_PROBLEMS, with an "and N more" line. */
export function capMessages(list, max = MAX_PROBLEMS, hidden = 0) {
  const extra = Math.max(0, list.length - max) + hidden;
  return extra ? [...list.slice(0, max), `...and ${extra} more.`] : list;
}

/**
 * For each opening marker, whether a same-size "=======" and then a same-size
 * ">>>>>>>" follow it, which is exactly when the hunk would close. One
 * backward pass, so parsing stays linear even with many unclosed markers.
 */
function closableStarts(lines) {
  const closable = new Uint8Array(lines.length);
  const nextEnd = new Map();
  const nextSepClosed = new Set();
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const c = line.charCodeAt(0);
    let m;
    if (c === 62 && (m = END_ANY_RE.exec(line))) nextEnd.set(m[1].length, i);
    else if (c === 61 && (m = SEP_ANY_RE.exec(line))) {
      if (nextEnd.has(m[1].length)) nextSepClosed.add(m[1].length);
      else nextSepClosed.delete(m[1].length);
    } else if (c === 60 && (m = START_RE.exec(line))) closable[i] = nextSepClosed.has(m[1].length) ? 1 : 0;
  }
  return closable;
}

/**
 * Find conflict hunks in document lines. Markers inside a hunk must have the
 * same size as its opening marker, so longer "nested-looking" markers are
 * content. Returns { hunks, problems }. An opening marker that can never
 * close is reported as a problem and treated as content, so later conflicts
 * are still found. Linear in the number of lines.
 */
export function parseConflicts(lines) {
  const hunks = [];
  const problems = [];
  const closable = closableStarts(lines);
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!cur) {
      const m = START_RE.exec(line);
      if (!m) continue;
      if (!closable[i]) {
        problems.push(`Unterminated conflict starting at line ${i + 1} (no matching "=======" and ">>>>>>>" markers).`);
        continue;
      }
      const size = m[1].length;
      cur = {
        startLine: i + 1,
        section: "ours",
        oursLabel: (m[2] ?? "").trim(),
        baseLabel: null,
        theirsLabel: "",
        ours: [],
        base: null,
        theirs: [],
        re: { base: markerRe("\\|", size), sep: new RegExp(`^={${size}}\\s*$`), end: markerRe(">", size) },
      };
      continue;
    }
    let m;
    if (cur.section === "ours" && (m = cur.re.base.exec(line))) {
      cur.section = "base";
      cur.base = [];
      cur.baseLabel = (m[1] ?? "").trim();
    } else if ((cur.section === "ours" || cur.section === "base") && cur.re.sep.test(line)) {
      cur.section = "theirs";
    } else if (cur.section === "theirs" && (m = cur.re.end.exec(line))) {
      const { re, section, ...hunk } = cur;
      hunk.endLine = i + 1;
      hunk.index = hunks.length + 1;
      hunk.theirsLabel = (m[1] ?? "").trim();
      hunks.push(hunk);
      cur = null;
    } else {
      cur[cur.section].push(line);
    }
  }
  assignHashes(lines, hunks);
  return { hunks, problems: capMessages(problems), problemCount: problems.length };
}

/**
 * Ids must never resolve a different hunk than the one that was listed.
 *
 * - A hunk whose content (its marker and side lines) is unique in the file
 *   gets a hash of that content plus the line just before and after it. It
 *   survives other hunks being resolved, and can only match a hunk with the
 *   same content, which is unique.
 * - A hunk whose content appears more than once gets a position-bound hash:
 *   its content, its index, and the content and context hashes of every hunk
 *   in the file. Any change to the file's conflicts makes it stale.
 */
function assignHashes(lines, hunks) {
  const content = hunks.map((h) => hunkHash(lines.slice(h.startLine - 1, h.endLine)));
  const local = hunks.map((h, i) =>
    hunkHash([lines[h.startLine - 2] ?? "\u0000bof", content[i], lines[h.endLine] ?? "\u0000eof"]),
  );
  const signature = String(fnv32([`${content.join(",")}/${local.join(",")}`]));
  const counts = new Map();
  for (const c of content) counts.set(c, (counts.get(c) ?? 0) + 1);
  hunks.forEach((h, i) => {
    h.contentHash = content[i];
    h.localHash = local[i];
    h.shared = counts.get(content[i]) > 1;
    h.hash = h.shared ? hunkHash(["\u0000pos", content[i], String(h.index), signature]) : local[i];
  });
}

export function conflictId(displayPath, hunk) {
  return `${displayPath}#${hunk.index}@${hunk.hash}`;
}

/** Parse "path#N@hash" (an optional "conflict://" prefix is ignored). */
export function parseConflictId(raw) {
  if (typeof raw !== "string") throw new ConflictError(`Conflict id must be a string, got ${typeof raw}.`);
  const m = /^(?:conflict:\/\/)?(.+)#(\d+)@([0-9a-z]{4,6})$/i.exec(raw.trim());
  if (!m) throw new ConflictError(`Malformed conflict id "${raw}". Expected PATH#N@HASH from list_conflicts.`);
  return { path: m[1], index: Number(m[2]), hash: m[3].toLowerCase() };
}

/**
 * Pick the hunk an id refers to. A content-unique hunk may have moved (other
 * hunks were resolved). If its content is now shared, or several hunks match
 * (other than a position-bound hash at its own index), the id is rejected
 * rather than guessed.
 */
function indexHunks(hunks) {
  const byHash = new Map();
  for (const h of hunks) {
    if (!byHash.has(h.hash)) byHash.set(h.hash, []);
    byHash.get(h.hash).push(h);
  }
  return { count: hunks.length, byHash, sharedLocal: new Set(hunks.filter((h) => h.shared).map((h) => h.localHash)) };
}

function findHunk(lookup, { hash, index }, raw) {
  const ambiguous = () =>
    new ConflictError(`${raw} is ambiguous: several conflicts match it. Call list_conflicts again for fresh ids.`);
  const same = lookup.byHash.get(hash) ?? [];
  if (same.length > 1) {
    // Short hashes can collide when there are many hunks. A position-bound
    // hash already includes the index, so the shared hunk at that index is
    // the one the hash was made for.
    // Only when no content-unique hunk shares the hash.
    const atIndex = same.filter((h) => h.shared && h.index === index);
    if (atIndex.length === 1 && same.every((h) => h.shared)) return atIndex[0];
    throw ambiguous();
  }
  if (same.length === 1) return same[0];
  if (lookup.sharedLocal.has(hash)) throw ambiguous();
  if (lookup.count === 0) throw new ConflictError(`${raw} is stale: the file has no conflicts left.`);
  throw new ConflictError(
    `${raw} is stale: the conflict changed or was already resolved. Call list_conflicts again for fresh ids.`,
  );
}

function resolutionLines(hunk, r, label) {
  switch (r.resolution) {
    case "ours":
      return hunk.ours;
    case "theirs":
      return hunk.theirs;
    case "base":
      if (!hunk.base) {
        throw new ConflictError(
          `${label}: this conflict has no base section. Pick another resolution, or recreate the markers with ` +
            "`git checkout --conflict=diff3 -- <path>` (this discards edits to that file).",
        );
      }
      return hunk.base;
    case "both-ours-first":
      return [...hunk.ours, ...hunk.theirs];
    case "both-theirs-first":
      return [...hunk.theirs, ...hunk.ours];
    case "custom":
      if (typeof r.content !== "string") throw new ConflictError(`${label}: "custom" requires "content" (a string).`);
    {
      const lines = contentToLines(r.content);
      const bad = lines.findIndex((l) => START_RE.test(l) || SEP_ANY_RE.test(l) || END_ANY_RE.test(l));
      if (bad >= 0) {
        throw new ConflictError(
          `${label}: "custom" content line ${bad + 1} looks like a conflict marker (${JSON.stringify(lines[bad].slice(0, 20))}). ` +
            "Content must not contain conflict markers; edit the file directly if you really need such a line.",
        );
      }
      return lines;
    }
    default:
      throw new ConflictError(`${label}: unknown resolution "${r.resolution}". Use one of: ${RESOLUTIONS.join(", ")}.`);
  }
}

/**
 * Apply resolutions to one file's text atomically: every id is checked before
 * anything changes. Each item is { id, resolution, content?, label }.
 * Returns { output, applied, remaining, problems }.
 */
export function resolveText(src, items) {
  const doc = parseDocument(src);
  const { hunks } = parseConflicts(doc.lines);
  const lookup = indexHunks(hunks);
  const chosen = new Map();
  for (const item of items) {
    const parsed = parseConflictId(item.id);
    const hunk = findHunk(lookup, parsed, item.id);
    if (chosen.has(hunk)) throw new ConflictError(`${item.label}: ${item.id} is resolved twice in this call.`);
    chosen.set(hunk, resolutionLines(hunk, item, item.label));
  }
  const out = [];
  let cursor = 0;
  for (const hunk of [...chosen.keys()].sort((a, b) => a.startLine - b.startLine)) {
    out.push(...doc.lines.slice(cursor, hunk.startLine - 1), ...chosen.get(hunk));
    cursor = hunk.endLine;
  }
  out.push(...doc.lines.slice(cursor));
  const after = parseConflicts(out);
  return {
    output: serializeDocument({ ...doc, lines: out }),
    applied: chosen.size,
    remaining: after.hunks.length,
    problems: after.problems,
  };
}

/** Text view of one file's conflicts for the model. */
export function renderConflicts(displayPath, lines, hunks, context = 2) {
  const out = [];
  for (const [i, h] of hunks.entries()) {
    // Context never reaches into a neighboring hunk.
    const lo = hunks[i - 1] ? hunks[i - 1].endLine + 1 : 1;
    const hi = hunks[i + 1] ? hunks[i + 1].startLine - 1 : lines.length;
    const show = (from, to) => {
      for (let n = Math.max(lo, from); n <= Math.min(hi, to); n++) out.push(`  ${n}| ${lines[n - 1]}`);
    };
    out.push(`### ${conflictId(displayPath, h)} (lines ${h.startLine}-${h.endLine})`);
    show(h.startLine - context, h.startLine - 1);
    const section = (name, label, body) => {
      out.push(`--- ${name}${label ? ` (${label})` : ""}: ${body.length} line(s) ---`);
      out.push(...body);
    };
    section("ours", h.oursLabel, h.ours);
    if (h.base) section("base", h.baseLabel, h.base);
    section("theirs", h.theirsLabel, h.theirs);
    out.push("--- end ---");
    show(h.endLine + 1, h.endLine + context);
  }
  return out.join("\n");
}

export function conflictHint(paths) {
  const shown = paths.length > 10 ? `${paths.slice(0, 10).join(", ")} and ${paths.length - 10} more` : paths.join(", ");
  return (
    `This repository has unresolved merge conflicts in: ${shown}. ` +
    "To resolve them, call `list_conflicts` to see each conflict with an id, then `resolve_conflicts` with one " +
    "resolution per id (ours, theirs, base, both-ours-first, both-theirs-first, or custom content), " +
    "instead of editing the conflict markers by hand. " +
    "If these tools are not available or report that they are turned off, edit the files as usual."
  );
}

// ---- file system and git ---------------------------------------------------

// --no-optional-locks keeps read-only commands from taking index.lock.
function git(args, cwd, timeout = 10_000) {
  return new Promise((done) => {
    execFile(
      "git",
      ["--no-optional-locks", ...args],
      { cwd, timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (err, stdout) => done(err ? null : stdout),
    );
  });
}

// Files in the git dir that mean a merge-like operation may have left conflicts.
const IN_PROGRESS = ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "REBASE_HEAD", "rebase-merge", "rebase-apply"];
const HINT_BUDGET_MS = 2000;

const isInside = (root, p) => {
  const rel = relative(root, p);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
};

/**
 * Build the two tools plus a git probe for the prompt hint. Handlers throw
 * ConflictError for user mistakes; the caller wraps them with the kill
 * switches and the circuit breaker.
 */
export function createConflictTools({ getCwd }) {
  // { top, gitDir } per working directory; only successful lookups are cached.
  const repos = new Map();
  const repoInfo = async (cwd, timeout) => {
    if (repos.has(cwd)) return repos.get(cwd);
    const out = await git(["rev-parse", "--show-toplevel", "--absolute-git-dir"], cwd, timeout);
    const [top, gitDir] = out?.split("\n").map((l) => l.trim()) ?? [];
    if (!top || !gitDir) return null;
    const info = { top, gitDir };
    repos.set(cwd, info);
    return info;
  };

  const projectRoot = async (cwd) => {
    const info = await repoInfo(cwd);
    return realpath(info?.top || cwd).catch(() => resolve(cwd));
  };

  // Resolve a path against the session cwd and refuse anything outside the project.
  const locate = async (p, cwd, root) => {
    if (typeof p !== "string" || !p.trim()) throw new ConflictError('"path" must be a non-empty string.');
    const abs = isAbsolute(p) ? resolve(p) : resolve(cwd, p);
    const real = await realpath(abs).catch(() => abs);
    if (!isInside(root, real)) throw new ConflictError(`${p} is outside the project root (${root}).`);
    return real;
  };

  const display = (abs, cwd) => {
    const rel = relative(cwd, abs);
    return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel.split(sep).join("/") : abs;
  };

  const readText = async (path) => {
    let buf;
    try {
      const st = await stat(path);
      if (st.size > MAX_FILE_BYTES) throw new ConflictError(`${path} is too large (${st.size} bytes).`);
      buf = await readFile(path);
    } catch (err) {
      if (err instanceof ConflictError) throw err;
      if (err?.code === "ENOENT") throw new ConflictError(`File not found: ${path}`);
      if (err?.code) throw new ConflictError(`Cannot read ${path}: ${err.code}`);
      throw err;
    }
    if (buf.subarray(0, 8192).includes(0)) throw new ConflictError(`${path} looks binary; resolve it with git instead.`);
    return buf.toString("utf8");
  };

  // Entries are "mode sha stage<TAB>path"; each unmerged path has up to three.
  const unmergedFiles = async (root, scope, timeout) => {
    const out = await git(["ls-files", "-u", "-z", "--", ...(scope ? [scope] : [])], root, timeout);
    if (out === null) return null;
    const paths = out.split("\0").map((e) => e.slice(e.indexOf("\t") + 1)).filter(Boolean);
    return [...new Set(paths)].map((f) => resolve(root, f));
  };

  /**
   * Unmerged paths for the prompt hint, relative to cwd; null when git cannot
   * tell. Skips git entirely unless a merge, cherry-pick, revert, or rebase is
   * in progress, and gives up after HINT_BUDGET_MS so prompts are not delayed.
   */
  const unmergedPaths = async (cwd) => {
    const work = (async () => {
      const info = await repoInfo(cwd, 1000);
      if (!info) return null;
      const states = await Promise.all(IN_PROGRESS.map((f) => access(join(info.gitDir, f)).then(() => true, () => false)));
      if (!states.some(Boolean)) return [];
      const files = await unmergedFiles(info.top, undefined, 1000);
      return files && files.map((f) => display(f, cwd));
    })();
    let timer;
    const timeout = new Promise((done) => {
      timer = setTimeout(() => done(null), HINT_BUDGET_MS);
      timer.unref?.();
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  const listConflicts = async (args) => {
    const cwd = resolve(getCwd());
    const root = await projectRoot(cwd);
    const context = args.context_lines ?? 2;
    if (!Number.isInteger(context) || context < 0 || context > 20) {
      throw new ConflictError('"context_lines" must be an integer from 0 to 20.');
    }
    const requested = args.path === undefined || args.path === null || args.path === "" ? [] : [].concat(args.path);
    const files = [];
    const notes = [];
    let hiddenNotes = 0;
    if (requested.length === 0) {
      const unmerged = await unmergedFiles(root);
      if (unmerged === null) throw new ConflictError('Could not ask git for unmerged files. Pass "path" explicitly.');
      files.push(...unmerged);
    } else {
      for (const p of requested) {
        const abs = await locate(p, cwd, root);
        const st = await stat(abs).catch(() => null);
        if (!st) throw new ConflictError(`File not found: ${p}`);
        if (st.isDirectory()) {
          const unmerged = await unmergedFiles(root, abs);
          if (unmerged === null) throw new ConflictError(`${p} is a directory and git is not available; pass files.`);
          files.push(...unmerged);
        } else files.push(abs);
      }
    }

    const sections = [];
    let total = 0;
    let fileCount = 0;
    for (const abs of [...new Set(files)]) {
      const shown = display(abs, cwd);
      let text;
      try {
        text = await readText(abs);
      } catch (err) {
        if (!(err instanceof ConflictError)) throw err;
        notes.push(`${shown}: ${err.message}`);
        continue;
      }
      const doc = parseDocument(text);
      const { hunks, problems, problemCount } = parseConflicts(doc.lines);
      const kept = problems.slice(0, MAX_PROBLEMS);
      for (const p of kept) notes.push(`${shown}: ${p}`);
      hiddenNotes += problemCount - kept.length;
      if (hunks.length === 0) {
        if (!problems.length) notes.push(`${shown}: no conflict markers (already resolved, or a delete/rename conflict; use git).`);
        continue;
      }
      total += hunks.length;
      fileCount++;
      sections.push(`## ${shown}: ${hunks.length} conflict(s)\n${renderConflicts(shown, doc.lines, hunks, context)}`);
    }

    const head =
      total === 0
        ? "No conflicts found."
        : `${total} conflict(s) in ${fileCount} file(s). Resolve them with resolve_conflicts using the ids after "###". ` +
          "Each section below lists the exact lines of that side.";
    const noteText = notes.length || hiddenNotes ? `Notes:\n${capMessages(notes, MAX_PROBLEMS, hiddenNotes).map((n) => `- ${n}`).join("\n")}` : "";
    const text = [head, noteText, sections.join("\n\n")].filter(Boolean).join("\n\n");
    return text.length > MAX_LIST_CHARS
      ? `${text.slice(0, MAX_LIST_CHARS)}\n[output truncated: pass "path" to list fewer files]`
      : text;
  };

  const resolveConflicts = async (args) => {
    const cwd = resolve(getCwd());
    const root = await projectRoot(cwd);
    let items = args.resolutions;
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        throw new ConflictError('"resolutions" must be an array of {id, resolution, content?} objects.');
      }
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new ConflictError('"resolutions" must be a non-empty array of {id, resolution, content?} objects.');
    }

    const byFile = new Map();
    const errors = [];
    for (const [i, item] of items.entries()) {
      const label = `resolutions[${i}]`;
      try {
        if (!item || typeof item !== "object") throw new ConflictError(`${label}: must be an object.`);
        if (!RESOLUTIONS.includes(item.resolution)) {
          throw new ConflictError(`${label}: unknown resolution "${item.resolution}". Use one of: ${RESOLUTIONS.join(", ")}.`);
        }
        const abs = await locate(parseConflictId(item.id).path, cwd, root);
        if (!byFile.has(abs)) byFile.set(abs, []);
        byFile.get(abs).push({ ...item, label });
      } catch (err) {
        if (!(err instanceof ConflictError)) throw err;
        errors.push(err.message.startsWith(label) ? err.message : `${label}: ${err.message}`);
      }
    }
    if (errors.length) throw new ConflictError(`Nothing was written.\n${errors.join("\n")}`);

    const report = [];
    const failed = [];
    const toStage = [];
    let unstaged = [];
    for (const [abs, fileItems] of byFile) {
      const shown = display(abs, cwd);
      try {
        const src = await readText(abs);
        const { output, applied, remaining, problems } = resolveText(src, fileItems);
        if (output !== src) await writeFile(abs, output);
        let line = `${shown}: resolved ${applied} conflict(s), ${remaining} remaining.`;
        if (problems.length) line += ` Warning: ${problems.join(" ")}`;
        report.push(line);
        if (remaining === 0 && !problems.length) (args.stage === true ? toStage : unstaged).push(abs);
      } catch (err) {
        if (!(err instanceof ConflictError)) throw err;
        failed.push(`${shown}: not written. ${err.message}`);
      }
    }

    if (toStage.length) {
      const ok = (await git(["add", "--", ...toStage.map((f) => relative(root, f))], root)) !== null;
      if (ok) report.push(`Staged with git add: ${toStage.map((f) => display(f, cwd)).join(", ")}.`);
      else unstaged = unstaged.concat(toStage);
    }
    if (unstaged.length) {
      report.push(
        `Not staged. When you are done, run \`git add -- ${unstaged.map((f) => display(f, cwd)).join(" ")}\` ` +
          "(or call resolve_conflicts with stage: true).",
      );
    }
    if (failed.length && report.length === 0) throw new ConflictError(failed.join("\n"));
    return [...failed.map((f) => `FAILED ${f}`), ...report].join("\n");
  };

  const tools = [
    {
      name: "list_conflicts",
      description:
        "List git merge conflicts (<<<<<<< / ||||||| / ======= / >>>>>>> markers) with an id for each hunk, its line " +
        "range, the ours / base (diff3 style only) / theirs lines with their labels, and a little context. Without " +
        '"path" it lists every unmerged file in the repository. Then call resolve_conflicts with those ids. ' +
        "Use this instead of reading conflict markers with view or read_anchored.",
      parameters: {
        type: "object",
        properties: {
          path: {
            description: "Optional file or directory (or array of them), absolute or relative to the working directory.",
            anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
          },
          context_lines: { type: "integer", minimum: 0, maximum: 20, description: "Context lines around each hunk. Default 2." },
        },
      },
      defer: "never",
      handler: listConflicts,
    },
    {
      name: "resolve_conflicts",
      description:
        "Resolve merge conflicts by id from list_conflicts, without retyping the sides. Each item is " +
        '{id, resolution, content?}; resolution is "ours", "theirs", "base" (diff3 only), "both-ours-first", ' +
        '"both-theirs-first", or "custom" with "content" (the full replacement text; "" deletes the hunk). ' +
        "Each file is written all-or-nothing; stale ids (the hunk changed) are rejected. Reports the conflicts left " +
        'per file. Files are not staged unless "stage" is true.',
      parameters: {
        type: "object",
        properties: {
          resolutions: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: 'Conflict id from list_conflicts, e.g. "src/app.js#1@k3vq".' },
                resolution: { type: "string", enum: RESOLUTIONS },
                content: { type: "string", description: 'Replacement text for "custom".' },
              },
              required: ["id", "resolution"],
            },
          },
          stage: { type: "boolean", description: "Run git add on files left with no conflicts. Default false." },
        },
        required: ["resolutions"],
      },
      defer: "never",
      handler: resolveConflicts,
    },
  ];
  return { tools, unmergedPaths };
}
