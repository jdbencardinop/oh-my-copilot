// Import natural-language rules from Cursor (.cursor/rules/*.mdc, .cursorrules)
// and Cline (.clinerules file or directory). Copilot CLI 1.0.105 does not read
// these files itself. Parsing is pure; loadImportedRules does the file I/O.
// Nothing here throws on bad input: problems come back as `errors`.

import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { compileGlobs, normalizePath } from "./glob.mjs";

export const LIMITS = {
  // Hidden context sent once per session for always-on rules (plus the index).
  alwaysChars: 12_000,
  // One glob-scoped rule when a matching file is touched.
  globRuleChars: 6_000,
  // All glob-scoped rules together, per session.
  globSessionChars: 24_000,
  fileBytes: 256 * 1024,
  files: 200,
  depth: 6,
};

/**
 * Minimal YAML frontmatter: `key: value` lines, quoted strings, booleans,
 * flow lists `[a, b]`, and block lists (`key:` followed by `- item` lines).
 */
export function parseFrontmatter(text) {
  const src = String(text).replace(/^\uFEFF/, "");
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) {
    if (/^---[ \t]*\r?\n/.test(src)) return { data: {}, body: src, error: "frontmatter has no closing ---" };
    return { data: {}, body: src };
  }
  const data = {};
  let listKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const item = /^\s*-\s*(.*)$/.exec(line);
    if (item && listKey) {
      data[listKey].push(scalar(item[1]));
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) {
      listKey = null;
      continue;
    }
    const [, key, value] = kv;
    if (value === "") {
      data[key] = [];
      listKey = key;
      continue;
    }
    listKey = null;
    const flow = /^\[(.*)\]$/.exec(value.trim());
    data[key] = flow ? splitList(flow[1]).map(scalar) : scalar(value);
  }
  return { data, body: src.slice(m[0].length) };
}

function scalar(v) {
  const t = String(v).trim();
  const q = /^(["'])(.*)\1$/.exec(t);
  if (q) return q[2];
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  return t;
}

// Split on commas that are not inside {...} so "{a,b}.ts, c" stays two items.
function splitList(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const c of String(s)) {
    if (c === "{") depth++;
    if (c === "}") depth = Math.max(0, depth - 1);
    if (c === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function globList(value) {
  if (value === undefined || value === null || value === "" || value === false) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.flatMap((v) => (typeof v === "string" ? splitList(v).map((x) => String(scalar(x))) : [])).filter(Boolean);
}

function buildRule({ file, origin, data, body, globs, always }) {
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const text = body.trim();
  if (!text) return { error: `${file}: empty rule skipped` };
  let kind;
  let match = null;
  if (always) kind = "always";
  else if (globs.length) {
    try {
      match = compileGlobs(globs);
      kind = "glob";
    } catch (err) {
      return { error: `${file}: invalid globs skipped (${err.message})` };
    }
  } else if (description) kind = "requested";
  else kind = "manual";
  return { rule: { file, origin, kind, description, globs, match, body: text } };
}

/**
 * Cursor .mdc rule. Types: alwaysApply -> "always"; globs -> "glob" (auto
 * attached); description only -> "requested" (listed so the model can read
 * it); neither -> "manual" (not imported; Cursor needs an @-mention).
 */
export function parseMdc(text, file) {
  const fm = parseFrontmatter(text);
  if (fm.error) return { error: `${file}: ${fm.error}; skipped` };
  return buildRule({
    file,
    origin: "cursor",
    data: fm.data,
    body: fm.body,
    globs: globList(fm.data.globs),
    always: fm.data.alwaysApply === true,
  });
}

/** Legacy .cursorrules or a Cline rule file. Cline "paths:" frontmatter scopes it. */
export function parsePlainRule(text, file, origin) {
  const fm = parseFrontmatter(text);
  if (fm.error) return { error: `${file}: ${fm.error}; skipped` };
  const globs = globList(fm.data.paths ?? fm.data.globs);
  return buildRule({ file, origin, data: fm.data, body: fm.body, globs, always: globs.length === 0 });
}

// Imported files come from the repository, which may be untrusted. Symlinks
// are never followed, and every path must resolve inside the project root,
// so a rule file cannot pull in e.g. ~/.aws/credentials.
function contained(path, rootReal) {
  try {
    const real = realpathSync(path);
    return real === rootReal || real.startsWith(rootReal.endsWith(sep) ? rootReal : rootReal + sep);
  } catch {
    return false;
  }
}

function kindOf(path, rootReal) {
  let st;
  try {
    st = lstatSync(path);
  } catch {
    return null;
  }
  if (st.isSymbolicLink()) return "symlink";
  if (!contained(path, rootReal)) return "outside";
  return st.isDirectory() ? "dir" : st.isFile() ? "file" : "other";
}

function walk(dir, ext, depth, out, errors, ctx) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    errors.push(`${ctx.rel(dir)}: ${err.code ?? err.message}`);
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    if (out.length >= LIMITS.files) return;
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) errors.push(`${ctx.rel(p)}: symlink; skipped`);
    else if (e.isDirectory() && depth > 0) walk(p, ext, depth - 1, out, errors, ctx);
    else if (e.isFile() && ext.some((x) => e.name.toLowerCase().endsWith(x))) out.push(p);
  }
}

function readSmall(path, errors, label, rootReal) {
  try {
    const st = lstatSync(path);
    if (!st.isFile() || !contained(path, rootReal)) {
      errors.push(`${label}: not a regular file inside the project; skipped`);
      return null;
    }
    if (st.size > LIMITS.fileBytes) {
      errors.push(`${label}: larger than ${LIMITS.fileBytes} bytes; skipped`);
      return null;
    }
    const buf = readFileSync(path);
    if (buf.subarray(0, 8192).includes(0)) {
      errors.push(`${label}: looks binary; skipped`);
      return null;
    }
    return { text: buf.toString("utf8"), stamp: `${label}:${st.mtimeMs}:${st.size}` };
  } catch (err) {
    errors.push(`${label}: ${err.code ?? err.message}`);
    return null;
  }
}

/**
 * Read Cursor and Cline rule files under a project root.
 * Returns { rules, errors, sources, key } where key changes when any file does.
 */
export function loadImportedRules(root) {
  const rules = [];
  const errors = [];
  const sources = [];
  const stamps = [];
  if (!root) return { rules, errors, sources, key: "" };
  let rootReal;
  try {
    rootReal = realpathSync(root);
  } catch {
    return { rules, errors, sources, key: "" };
  }
  const rel = (p) => normalizePath(relative(root, p)) || p;
  const ctx = { rel };
  const add = (path, parse) => {
    const label = rel(path);
    const read = readSmall(path, errors, label, rootReal);
    if (read === null) return;
    stamps.push(read.stamp);
    const r = parse(read.text, label);
    if (r.error) errors.push(r.error);
    else rules.push(r.rule);
  };

  const skip = (path, kind) => {
    if (kind === "symlink") errors.push(`${rel(path)}: symlink; skipped`);
    else if (kind === "outside") errors.push(`${rel(path)}: resolves outside the project; skipped`);
  };
  const cursorDir = join(root, ".cursor", "rules");
  const cursorKind = kindOf(cursorDir, rootReal);
  skip(cursorDir, cursorKind);
  if (cursorKind === "dir") {
    const files = [];
    walk(cursorDir, [".mdc"], LIMITS.depth, files, errors, ctx);
    files.forEach((f) => add(f, parseMdc));
    sources.push(`.cursor/rules (${files.length})`);
  }
  const cursorLegacy = join(root, ".cursorrules");
  const legacyKind = kindOf(cursorLegacy, rootReal);
  skip(cursorLegacy, legacyKind);
  if (legacyKind === "file") {
    add(cursorLegacy, (t, f) => parsePlainRule(t, f, "cursor"));
    sources.push(".cursorrules");
  }
  const cline = join(root, ".clinerules");
  const clineKind = kindOf(cline, rootReal);
  skip(cline, clineKind);
  if (clineKind === "file") {
    add(cline, (t, f) => parsePlainRule(t, f, "cline"));
    sources.push(".clinerules");
  } else if (clineKind === "dir") {
    const files = [];
    walk(cline, [".md", ".txt"], 0, files, errors, ctx);
    files.forEach((f) => add(f, (t, l) => parsePlainRule(t, l, "cline")));
    sources.push(`.clinerules/ (${files.length})`);
  }
  return { rules, errors, sources, key: stamps.join("|") };
}

function truncate(body, max, file) {
  if (body.length <= max) return { text: body, truncated: false };
  const note = `\n[truncated by oh-my-copilot; read ${file} for the full rule]`;
  return { text: body.slice(0, Math.max(0, max - note.length)) + note, truncated: true };
}

const wrap = (file, body) => `<rule source="${file}">\n${body}\n</rule>`;

/**
 * Hidden context for always-on rules plus an index of on-request rules,
 * capped at maxChars. Rules that do not fit are cut, or listed by path.
 */
export function renderAlways(rules, maxChars = LIMITS.alwaysChars) {
  const always = rules.filter((r) => r.kind === "always");
  const requested = rules.filter((r) => r.kind === "requested");
  if (!always.length && !requested.length) return { text: "", truncated: [], omitted: [] };
  const truncated = [];
  const omitted = [];
  const notFit = [];
  const parts = always.length
    ? ["oh-my-copilot imported these project rules from Cursor and Cline rule files. Follow them like project instructions."]
    : [];
  let index = "";
  if (requested.length) {
    const lines = ["These project rules apply only when relevant. Read the file when its description fits the task:"];
    let size = lines[0].length;
    for (const [i, r] of requested.entries()) {
      const line = `- ${r.file}: ${r.description.replace(/\s+/g, " ").slice(0, 200)}`;
      // Keep room for the "and N more" line below.
      if (size + line.length + 1 + 60 > maxChars / 2) {
        lines.push(`- and ${requested.length - i} more; list them with glob.`);
        requested.slice(i).forEach((x) => omitted.push(x.file));
        break;
      }
      lines.push(line);
      size += line.length + 1;
    }
    index = lines.join("\n");
  }
  const omitNote = "More project rules did not fit; read them if relevant: ";
  // Room for a short "did not fit" line; longer lists end with "and N more".
  const reserve = always.length > 1 ? omitNote.length + 400 : 0;
  let budget = maxChars - (parts[0]?.length ?? 0) - index.length - reserve - 4;
  for (const r of always) {
    const overhead = wrap(r.file, "").length + 2;
    if (budget - overhead < 200) {
      notFit.push(r.file);
      continue;
    }
    const t = truncate(r.body, budget - overhead, r.file);
    if (t.truncated) truncated.push(r.file);
    const block = wrap(r.file, t.text);
    parts.push(block);
    budget -= block.length + 2;
  }
  if (notFit.length) {
    const used = parts.join("\n\n").length + (index ? index.length + 2 : 0) + 2;
    const note = listWithin(omitNote, notFit, maxChars - used);
    if (note) parts.push(note);
  }
  omitted.unshift(...notFit);
  if (index) parts.push(index);
  let text = parts.join("\n\n");
  if (text.length > maxChars) text = text.slice(0, maxChars); // backstop; the budget above should prevent it
  return { text, truncated, omitted };
}

// "prefix a, b, c" within max characters, ending with ", and N more" when cut.
// Returns "" when not even the prefix fits.
function listWithin(prefix, items, max) {
  let out = prefix;
  for (const [i, item] of items.entries()) {
    const next = out + (i ? ", " : "") + item;
    const rest = items.length - i - 1;
    if (next.length + (rest ? `, and ${rest} more`.length : 0) > max) {
      const cut = i ? `${out}, and ${items.length - i} more` : `${prefix}${items.length} files`;
      return cut.length <= max ? cut : "";
    }
    out = next;
  }
  return out;
}

const shortGlobs = (globs) => {
  const s = globs.join(", ");
  return s.length > 300 ? `${s.slice(0, 300)}...` : s;
};

/**
 * Hidden context for one glob-scoped rule, never longer than maxChars.
 * With too little room it only points at the file; with less than that, text is "".
 */
export function renderGlobRule(rule, maxChars = LIMITS.globRuleChars) {
  const head = `oh-my-copilot: project rule for files matching ${shortGlobs(rule.globs)} (from ${rule.file}). Follow it for these files.`;
  const overhead = head.length + wrap(rule.file, "").length + 2;
  if (maxChars - overhead < 200) {
    const pointer = `oh-my-copilot: project rule ${rule.file} applies to files you are working on; read it.`;
    return { text: pointer.length <= maxChars ? pointer : "", truncated: true };
  }
  const t = truncate(rule.body, maxChars - overhead, rule.file);
  return { text: `${head}\n${wrap(rule.file, t.text)}`, truncated: t.truncated };
}
