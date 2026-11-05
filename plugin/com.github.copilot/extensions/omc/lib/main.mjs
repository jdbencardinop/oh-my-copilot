// oh-my-copilot runtime: hash-anchored edit tools, pattern rules, imported
// project instructions from other agents, and the /omc control command.

import { readFileSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { FEATURES, IMPORT_ROOTS, canonicalFeature, featureActive, importPathEnabled, normalizeImportPath, resolveConfig } from "./config.mjs";
import { ConflictError, conflictHint, createConflictTools } from "./conflicts.mjs";
import { createJsonCache, findProjectOmcDir, findProjectRoot, userOmcDir } from "./files.mjs";
import { createBreaker } from "./guard.mjs";
import * as hl from "./hashline.mjs";
import { LIMITS as IMPORT_LIMITS, loadImportedRules, renderAlways, renderGlobRule } from "./imports.mjs";
import {
  compileRules,
  evaluatePostRules,
  evaluateRules,
  projectPath,
  resultText,
  targetPaths,
  toHookOutput,
  toPostHookOutput,
} from "./rules.mjs";
import { createStreamRules } from "./stream.mjs";

export const VERSION = "0.1.0";
export const EXTENSION_ID = "plugin:oh-my-copilot:omc";
const MAX_READ_LINES = 2000;
const MAX_READ_CHARS = 200_000;

// Hidden context added to a prompt so the model picks the anchored tools
// without a user-written instructions file. It is the instructions-file text
// from the benchmark spot check, plus "or report that they are turned off".
export const NUDGE =
  "Use `read_anchored` and `edit_anchored` to read and edit existing text files, instead of `view` and `edit`. " +
  "Read the file with `read_anchored` first, then edit it with `edit_anchored` using the `LINE:HASH` anchors it returns. " +
  "If an anchored edit is rejected as stale, read the file again. " +
  "If these tools are not available or report that they are turned off, use `view` and `edit` as usual. " +
  "Use `create` only for new files.";
export const NUDGE_OFF =
  "oh-my-copilot: ignore the earlier guidance about `read_anchored` and `edit_anchored`. " +
  "Use Copilot's built-in tools (`view`, `edit`, `create`) as usual.";

export const IMPORTS_OFF =
  "oh-my-copilot: the imported project rules it added earlier in this conversation are turned off. " +
  "Do not treat them as instructions any more unless the user asks.";

// Tools whose target file pulls in glob-scoped imported rules. Reads are
// included so the rule usually arrives before the model writes the file.
const IMPORT_TRIGGER_TOOLS = new Set([
  "view",
  "read_anchored",
  "edit",
  "str_replace",
  "str_replace_editor",
  "multi_edit",
  "create",
  "write",
  "write_file",
  "edit_anchored",
  "apply_patch",
  "resolve_conflicts",
]);
const MAX_POST_FILE_BYTES = 1024 * 1024;

const sessionKey = (input, invocation) => invocation?.sessionId ?? input?.sessionId ?? "";
const joinContext = (...parts) => parts.filter(Boolean).join("\n\n") || undefined;

class UserError extends Error {}

const failure = (text) => ({ textResultForLlm: text, resultType: "failure", error: text });

export async function start(joinSession) {
  const cache = createJsonCache();
  const compiled = new WeakMap();
  const reported = new Set();
  let cwd = process.cwd();
  let session = null;
  const pending = [];

  // Messages raised before the session exists are queued and flushed after join.
  const log = (message, level = "info", ephemeral = false) => {
    if (!session) {
      pending.push([message, level, ephemeral]);
      return;
    }
    session.log(message, { level, ephemeral }).catch(() => {});
  };
  const warnOnce = (message) => {
    if (reported.has(message)) return;
    reported.add(message);
    log(`oh-my-copilot: ${message}`, "warning");
  };

  // ---- configuration -------------------------------------------------------
  // Effective state = config files + env kill switches, then /omc overrides.
  // Files are mtime-cached, so resolving on demand is cheap and picks up edits.

  const overrides = { enabled: undefined, features: {}, importPaths: {}, importDefault: undefined, replaceImportPaths: false };
  const tripped = new Set();

  const loadConfig = () => {
    const layers = [];
    for (const [scope, dir] of [["user", userOmcDir()], ["project", findProjectOmcDir(cwd)]]) {
      if (!dir) continue;
      const r = cache.read(join(dir, "config.json"));
      if (r.error) warnOnce(`ignoring invalid config ${r.error}`);
      else if (r.data !== undefined) layers.push({ source: `${scope} config`, data: r.data });
    }
    const cfg = resolveConfig({ env: process.env, layers });
    cfg.importPathErrors.forEach(warnOnce);
    return cfg;
  };

  const currentState = () => {
    const cfg = loadConfig();
    if (overrides.enabled !== undefined) {
      cfg.enabled = overrides.enabled;
      cfg.enabledOrigin = "/omc";
    }
    for (const [f, value] of Object.entries(overrides.features)) {
      if (cfg.featureOrigin[f].startsWith("env")) continue;
      cfg.features[f] = value;
      cfg.featureOrigin[f] = "/omc";
    }
    cfg.importPaths = { ...(overrides.replaceImportPaths ? {} : cfg.importPaths), ...overrides.importPaths };
    cfg.importDefault = overrides.importDefault ?? cfg.importDefault;
    if (!cfg.featureOrigin.imports.startsWith("env")) {
      if (overrides.features.imports !== undefined) cfg.importDefault = overrides.features.imports;
      if (overrides.features.imports !== false) {
        cfg.features.imports = cfg.importDefault || Object.values(cfg.importPaths).includes(true);
        if (Object.keys(overrides.importPaths).length) cfg.featureOrigin.imports = "/omc paths";
      }
    }
    breaker.threshold = cfg.circuitBreakerThreshold;
    return { ...cfg, tripped };
  };
  const active = (feature) => featureActive(currentState(), feature);

  const breaker = createBreaker({
    tripped,
    onError: (feature, err, count) =>
      log(`oh-my-copilot ${feature} error (${count}/${breaker.threshold}): ${err?.message ?? err}`, "warning"),
    onTrip: (feature) => {
      log(
        `oh-my-copilot: "${feature}" is off for this session after repeated errors. ` +
          `Copilot's built-in behavior continues. Run /omc reset to retry.`,
        "warning",
      );
      void syncTools();
    },
  });

  // ---- rules ---------------------------------------------------------------

  const loadRules = (dir) => {
    const rules = [];
    const sources = [];
    const projectDir = findProjectOmcDir(dir);
    for (const [scope, base] of [["user", userOmcDir()], ["project", projectDir]]) {
      if (!base) continue;
      const path = join(base, "rules.json");
      const r = cache.read(path);
      if (r.error) {
        warnOnce(`ignoring invalid rules ${r.error}`);
        continue;
      }
      if (r.data === undefined) continue;
      let c = compiled.get(r);
      if (!c) {
        c = compileRules(r.data, `${scope} rules`);
        compiled.set(r, c);
        c.errors.forEach(warnOnce);
      }
      rules.push(...c.rules);
      sources.push(`${path} (${c.rules.length})`);
    }
    return { rules, sources };
  };

  const pathOpts = (dir) => ({ cwd: dir, root: findProjectRoot(dir) });

  const evaluate = breaker.wrap(
    "rules",
    async (input) => {
      const dir = input.workingDirectory || cwd;
      const { rules } = loadRules(dir);
      if (rules.length === 0) return undefined;
      return toHookOutput(evaluateRules(rules, input.toolName, input.toolArgs, pathOpts(dir)));
    },
    undefined,
  );

  // Target files as they are after the tool ran, for post rules with field "file".
  const fileTextFor = (dir) => (p) => {
    try {
      const abs = isAbsolute(p) ? p : resolve(dir, p);
      // Regular files only: devices and FIFOs report size 0 and can block forever.
      const st = statSync(abs);
      if (!st.isFile() || st.size > MAX_POST_FILE_BYTES) return undefined;
      const buf = readFileSync(abs);
      return buf.subarray(0, 8192).includes(0) ? undefined : buf.toString("utf8");
    } catch {
      return undefined;
    }
  };

  // onPostToolUse passes toolResult; onPostToolUseFailure passes only error.
  const evaluatePost = breaker.wrap(
    "rules",
    async (input) => {
      const dir = input.workingDirectory || cwd;
      const { rules } = loadRules(dir);
      if (!rules.some((r) => r.when === "post")) return undefined;
      const text = input.toolResult !== undefined ? resultText(input.toolResult) : String(input.error ?? "");
      const opts = { ...pathOpts(dir), fileText: fileTextFor(dir) };
      return toPostHookOutput(evaluatePostRules(rules, input.toolName, input.toolArgs, text, opts));
    },
    undefined,
  );

  // ---- stream rules ----------------------------------------------------------
  // "interrupt" rules watched in the model's stream. Streaming is requested
  // only when the feature is on at join (the join config cannot change later),
  // so with it off the session is exactly as before.

  // Glob-scoped imported rules marked as sent during the current main-agent
  // turn. If a stream rule truncates that turn, their context is gone from
  // history, so they are unmarked to be sent again.
  const turnGlobMarks = [];
  const streamActive = () => active("rules") && active("streamRules");
  const stream = createStreamRules({
    getSession: () => session,
    getRules: () => loadRules(cwd).rules,
    isActive: streamActive,
    pathOpts: () => pathOpts(cwd),
    log,
    breaker,
    onTurnStart: () => {
      turnGlobMarks.length = 0;
    },
    onTruncated: () => {
      for (const m of turnGlobMarks.splice(0)) {
        m.st.globs.delete(m.file);
        m.st.globChars = Math.max(0, m.st.globChars - m.chars);
      }
    },
  });

  // ---- imported project rules ----------------------------------------------

  // Cache selected files per session; a selection change reloads them. Track
  // delivery per file so toggles retract only the affected instructions.
  const importSessions = new Map();
  const importStats = { sessions: 0, alwaysChars: 0, truncated: new Set(), omitted: new Set() };
  const importState = (id) => {
    let st = importSessions.get(id);
    if (!st) {
      st = { loaded: null, selection: null, always: new Set(), alwaysChars: 0, sent: new Set(), globs: new Set(), globChars: 0 };
      importSessions.set(id, st);
    }
    return st;
  };

  const loadImports = (dir) => {
    const root = findProjectRoot(dir);
    const cfg = currentState();
    const r = loadImportedRules(root, { enabled: (path) =>
      featureActive(cfg, "imports") && importPathEnabled(path, cfg.importDefault, cfg.importPaths) });
    r.errors.forEach((e) => warnOnce(`imported rules: ${e}`));
    return { ...r, root };
  };
  const sessionImports = (st, dir) => {
    const cfg = currentState();
    const selection = JSON.stringify([findProjectRoot(dir), cfg.importDefault, cfg.importPaths]);
    if (st.selection !== selection) {
      st.loaded = loadImports(dir);
      st.selection = selection;
    }
    return st.loaded;
  };

  // Always-on rules go into the first prompt of a session, like the nudge.
  const importsPrompt = breaker.wrap(
    "imports",
    async (input, invocation) => {
      const st = importState(sessionKey(input, invocation));
      const { rules } = sessionImports(st, input?.workingDirectory || cwd);
      const candidates = rules.filter((r) => !st.always.has(r.file) && (r.kind === "always" || r.kind === "requested"));
      const r = renderAlways(candidates, Math.max(0, IMPORT_LIMITS.alwaysChars - st.alwaysChars));
      r.truncated.forEach((f) => importStats.truncated.add(f));
      r.omitted.forEach((f) => importStats.omitted.add(f));
      if (!r.text) return undefined;
      candidates.forEach((r) => { st.always.add(r.file); st.sent.add(r.file); });
      if (st.alwaysChars === 0) importStats.sessions++;
      st.alwaysChars += r.text.length;
      importStats.alwaysChars = st.alwaysChars;
      return r.text;
    },
    undefined,
  );

  // Glob-scoped rules are added once per rule per session, when a read or
  // write tool targets a matching file.
  const importsPre = breaker.wrap(
    "imports",
    async (input, invocation) => {
      if (!IMPORT_TRIGGER_TOOLS.has(input.toolName)) return undefined;
      const paths = targetPaths(input.toolName, input.toolArgs);
      if (!paths.length) return undefined;
      const dir = input.workingDirectory || cwd;
      const st = importState(sessionKey(input, invocation));
      const { rules, root } = sessionImports(st, dir);
      const globRules = rules.filter((r) => r.kind === "glob");
      if (!globRules.length) return undefined;
      const rel = paths.map((p) => projectPath(p, { cwd: dir, root }));
      const out = [];
      for (const rule of globRules) {
        if (st.globs.has(rule.file) || !rel.some((p) => rule.match(p))) continue;
        // The per-session budget is a hard cap, separators included. A rule
        // that no longer fits is skipped and listed as left out in /omc status.
        const sep = out.length ? 2 : 0;
        const room = Math.min(IMPORT_LIMITS.globRuleChars, IMPORT_LIMITS.globSessionChars - st.globChars - sep);
        st.globs.add(rule.file);
        const mark = { st, file: rule.file, chars: 0 };
        turnGlobMarks.push(mark);
        const r = room > 0 ? renderGlobRule(rule, room) : { text: "" };
        if (!r.text) {
          importStats.omitted.add(rule.file);
          continue;
        }
        mark.chars = r.text.length + sep;
        st.globChars += mark.chars;
        st.sent.add(rule.file);
        if (r.truncated) importStats.truncated.add(rule.file);
        out.push(r.text);
      }
      return joinContext(...out);
    },
    undefined,
  );

  // Turning the feature off after something was sent (by any switch, including
  // the circuit breaker) sends a one-line retraction. This check sits outside
  // the breaker so it still runs once "imports" has tripped.
  const importsContext = async (input, invocation) => {
    const id = sessionKey(input, invocation);
    const st = importSessions.get(id);
    const cfg = currentState();
    const enabled = featureActive(cfg, "imports");
    const removed = st ? [...st.sent].filter((file) =>
      !enabled || !importPathEnabled(file, cfg.importDefault, cfg.importPaths)) : [];
    for (const file of removed) {
      st.sent.delete(file);
      st.always.delete(file);
      st.globs.delete(file);
    }
    const retraction = removed.length ? enabled
      ? `oh-my-copilot: stop following the imported rules from these files unless the user asks: ${removed.join(", ")}.`
      : IMPORTS_OFF : undefined;
    return joinContext(retraction, enabled ? await importsPrompt(input, invocation) : undefined);
  };

  // ---- hashline tools ------------------------------------------------------

  const resolvePath = (p) => {
    if (typeof p !== "string" || !p.trim()) throw new UserError('"path" must be a non-empty string.');
    return isAbsolute(p) ? p : resolve(cwd, p);
  };

  const readText = async (path) => {
    let buf;
    try {
      buf = await readFile(path);
    } catch (err) {
      if (err?.code === "ENOENT") throw new UserError(`File not found: ${path}`);
      if (err?.code === "EISDIR") throw new UserError(`${path} is a directory. Use glob or view to list it.`);
      if (err?.code) throw new UserError(`Cannot read ${path}: ${err.code}`);
      throw err;
    }
    if (buf.subarray(0, 8192).includes(0)) throw new UserError(`${path} looks binary; anchored tools only handle text.`);
    return buf.toString("utf8");
  };

  const disabledResult = () =>
    failure("oh-my-copilot anchored editing is turned off. Use the built-in view and edit tools instead.");

  const guardTool = (fn) =>
    breaker.wrap(
      "hashline",
      async (args, invocation) => {
        if (!active("hashline")) return disabledResult();
        try {
          return await fn(args ?? {}, invocation);
        } catch (err) {
          if (err instanceof UserError || err instanceof hl.AnchorError) return failure(err.message);
          throw err;
        }
      },
      (_args, _invocation, err) =>
        err
          ? failure(`oh-my-copilot internal error (${err?.message ?? err}). Use the built-in view and edit tools instead.`)
          : disabledResult(),
    );

  const readAnchored = async (args) => {
    const path = resolvePath(args.path);
    const doc = hl.parseDocument(await readText(path));
    const total = doc.lines.length;
    if (total === 0) return `${path} is empty. Use edit_anchored with op "insert_after" and anchor "BOF" to add content.`;

    const start = args.start_line ?? 1;
    if (!Number.isInteger(start) || start < 1) throw new UserError('"start_line" must be a positive integer.');
    if (start > total) throw new UserError(`start_line ${start} is past the end of the file (${total} lines).`);
    let end = args.end_line ?? total;
    if (!Number.isInteger(end) || end < start) throw new UserError('"end_line" must be an integer >= start_line.');
    end = Math.min(end, total, start + MAX_READ_LINES - 1);

    const out = [];
    let chars = 0;
    let last = start - 1;
    for (let n = start; n <= end; n++) {
      const line = hl.formatLine(n, doc.lines[n - 1]);
      if (chars + line.length > MAX_READ_CHARS && out.length > 0) break;
      out.push(line);
      chars += line.length + 1;
      last = n;
    }
    const header = `${path} (lines ${start}-${last} of ${total}; format LINE:HASH|content)`;
    const footer = last < total ? `\n[more: call read_anchored with start_line=${last + 1}]` : "";
    return `${header}\n${out.join("\n")}${footer}`;
  };

  const editAnchored = async (args) => {
    const path = resolvePath(args.path);
    let edits = args.edits;
    if (typeof edits === "string") {
      try {
        edits = JSON.parse(edits);
      } catch {
        throw new UserError('"edits" must be an array of edit objects.');
      }
    }
    const src = await readText(path);
    const doc = hl.parseDocument(src);
    const { lines, regions } = hl.applyEdits(doc.lines, edits);
    const output = hl.serializeDocument({ ...doc, lines });
    if (output === src) return `No change: ${path} already has this content.`;
    await writeFile(path, output);
    return (
      `Applied ${edits.length} edit(s) to ${path} (${doc.lines.length} -> ${lines.length} lines). ` +
      `Anchors after the edit (older anchors below the change are now invalid):\n` +
      hl.renderRegions(lines, regions)
    );
  };

  const tools = [
    {
      name: "read_anchored",
      description:
        "Read a text file with a short content hash on every line, formatted LINE:HASH|content " +
        '(for example "12:ab|  return x;"). Use it before edit_anchored. Optional start_line/end_line ' +
        `(1-based, inclusive) select a range; at most ${MAX_READ_LINES} lines are returned per call.`,
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path, or a path relative to the working directory." },
          start_line: { type: "integer", minimum: 1, description: "First line to return. Default 1." },
          end_line: { type: "integer", minimum: 1, description: "Last line to return. Default: end of file." },
        },
        required: ["path"],
      },
      defer: "never",
      handler: guardTool(readAnchored),
    },
    {
      name: "edit_anchored",
      description:
        "Edit an existing text file by line anchors from read_anchored, without retyping the old text. " +
        'An anchor is "LINE:HASH" (for example "12:ab"). Ops: ' +
        '{op:"replace", start, end?, content} replaces lines start..end (inclusive); ' +
        '{op:"delete", start, end?}; {op:"insert_after", anchor, content}; {op:"insert_before", anchor, content}. ' +
        'Inserts also accept anchor "BOF" or "EOF". content is the full new text of those lines, newline-separated. ' +
        "All anchors refer to the file as last read and are checked first; if any line changed, nothing is written " +
        "and you should read_anchored again. Edits in one call must not overlap. Returns fresh anchors around each change.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path, or a path relative to the working directory." },
          edits: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                op: { type: "string", enum: ["replace", "delete", "insert_after", "insert_before"] },
                start: { type: "string", description: 'First line anchor for replace/delete, e.g. "12:ab".' },
                end: { type: "string", description: "Last line anchor for replace/delete. Default: same as start." },
                anchor: { type: "string", description: 'Anchor for inserts, or "BOF"/"EOF".' },
                content: { type: "string", description: "New lines for replace/insert." },
              },
              required: ["op"],
            },
          },
        },
        required: ["path", "edits"],
      },
      defer: "never",
      handler: guardTool(editAnchored),
    },
  ];

  // ---- conflict tools ------------------------------------------------------

  const conflictsDisabled = () =>
    failure("oh-my-copilot conflict tools are turned off. Resolve conflicts with the built-in view and edit tools.");
  const conflictKit = createConflictTools({ getCwd: () => cwd });
  const conflictTools = conflictKit.tools.map((t) => ({
    ...t,
    handler: breaker.wrap(
      "conflicts",
      async (args) => {
        if (!active("conflicts")) return conflictsDisabled();
        try {
          return await t.handler(args ?? {});
        } catch (err) {
          if (err instanceof ConflictError) return failure(err.message);
          throw err;
        }
      },
      (_args, _invocation, err) =>
        err
          ? failure(`oh-my-copilot internal error (${err?.message ?? err}). Resolve conflicts with the built-in view and edit tools.`)
          : conflictsDisabled(),
    ),
  }));

  // ---- tool registration ---------------------------------------------------

  // Copilot 1.0.105 rejects setTools from extension connections, so the tool
  // list is fixed at join time there. After the first rejection we stop trying
  // and rely on the handlers refusing calls while their feature is off.
  const toolGroups = [["hashline", tools], ["conflicts", conflictTools]];
  const wantedTools = () => toolGroups.flatMap(([feature, list]) => (active(feature) ? list : []));
  const names = (list) => list.map((t) => t.name).join(",");
  let listed = wantedTools();
  let registered = listed.includes(tools[0]);
  let setToolsSupported = true;
  async function syncTools() {
    const want = wantedTools();
    if (!session || !setToolsSupported || names(want) === names(listed)) return;
    try {
      await session.setTools(want);
      listed = want;
      registered = want.includes(tools[0]);
    } catch (err) {
      setToolsSupported = false;
      log(
        want.some((t) => !listed.includes(t))
          ? `oh-my-copilot: could not register tools mid-session (${err?.message ?? err}). Restart Copilot to use them.`
          : `oh-my-copilot: its tools stay listed until restart (${err?.message ?? err}). While off, they refuse calls.`,
        "warning",
      );
    }
  }

  // ---- nudge ---------------------------------------------------------------

  // The guidance is sent once per session as prompt context and stays in the
  // conversation, so later prompts add nothing. If the anchored tools are
  // switched off after that, the next prompt carries a one-line retraction;
  // switching them back on sends the guidance again.
  const nudged = new Map();
  const nudgeWanted = () => registered && active("hashline") && active("nudge");
  const nudgeContext = breaker.wrap(
    "nudge",
    async (_input, invocation) => {
      const id = invocation?.sessionId ?? "";
      const sent = nudged.get(id) === true;
      const want = nudgeWanted();
      if (want === sent) return undefined;
      nudged.set(id, want);
      return { additionalContext: want ? NUDGE : NUDGE_OFF };
    },
    undefined,
  );

  // During a merge, point the model at the conflict tools. Sent again only
  // when the set of conflicted files changes.
  const conflictHinted = new Map();
  const conflictContext = breaker.wrap(
    "conflicts",
    async (_input, invocation) => {
      if (!listed.includes(conflictTools[0]) || !active("conflicts") || !active("nudge")) return undefined;
      const id = invocation?.sessionId ?? "";
      const paths = await conflictKit.unmergedPaths(cwd);
      if (paths === null) return undefined;
      if (paths.length === 0) {
        conflictHinted.delete(id);
        return undefined;
      }
      const key = paths.join("\0");
      if (conflictHinted.get(id) === key) return undefined;
      conflictHinted.set(id, key);
      return conflictHint(paths);
    },
    undefined,
  );

  // ---- /omc command --------------------------------------------------------

  const importSummary = () => {
    if (!active("imports")) return "off (no rule contents read)";
    const { rules, sources, errors } = loadImports(cwd);
    if (!sources.length) return "none";
    const count = (k) => rules.filter((r) => r.kind === k).length;
    const parts = [
      `${count("always")} always`,
      `${count("glob")} glob-scoped`,
      `${count("requested")} on request`,
      `${count("manual")} manual (not imported)`,
    ];
    if (errors.length) parts.push(`${errors.length} skipped`);
    return `${sources.join(", ")}: ${parts.join(", ")}`;
  };

  const statusText = () => {
    const st = currentState();
    const { rules, sources } = loadRules(cwd);
    const postCount = rules.filter((r) => r.when === "post").length;
    const interruptCount = rules.filter((r) => r.action === "interrupt").length;
    const fires = [...stream.stats.byRule].map(([id, n]) => `${id} x${n}`).join(", ");
    const streamNote = !stream.stats.watching
      ? featureActive(st, "streamRules")
        ? "not watching (streamRules was off when Copilot started; restart to watch). Interrupt rules still deny matching tool calls"
        : "not watching. Interrupt rules deny matching tool calls only"
      : featureActive(st, "streamRules") && featureActive(st, "rules")
        ? "watching the stream"
        : "paused (streamRules or rules is off)";
    const limitNote = [
      importStats.truncated.size ? `truncated: ${[...importStats.truncated].join(", ")}` : "",
      importStats.omitted.size ? `left out (size limit): ${[...importStats.omitted].join(", ")}` : "",
    ].filter(Boolean);
    const feature = (f) => {
      const on = featureActive(st, f);
      const why = tripped.has(f) ? "tripped by circuit breaker" : st.featureOrigin[f];
      return `  ${f.padEnd(12)}${on ? "on " : "off"}  (${why})`;
    };
    return [
      `oh-my-copilot ${VERSION}: ${st.enabled ? "active" : "OFF"} (${st.enabledOrigin})`,
      ...FEATURES.map(feature),
      `  working directory: ${cwd}`,
      `  rules files: ${sources.length ? sources.join(", ") : "none"}` +
        (sources.length
          ? ` (${rules.length - postCount} pre, ${postCount} post${interruptCount ? `; ${interruptCount} interrupt` : ""})`
          : ""),
      `  stream rules: ${streamNote}; fired ${stream.stats.fires} time(s) this session` +
        (fires ? ` (${fires})` : "") +
        ` (caps: ${stream.limits.perPrompt} per prompt, ${stream.limits.perSession} per session)`,
      `  imported rules: ${importSummary()}`,
      `  import selections (default ${st.importDefault ? "on" : "off"}): ` +
        [...new Set([...IMPORT_ROOTS, ...Object.keys(st.importPaths)])]
          .map((p) => `${p}=${featureActive(st, "imports") && importPathEnabled(p, st.importDefault, st.importPaths) ? "on" : "off"}`).join(", "),
      `  imported context: ${importStats.sessions ? `sent in ${importStats.sessions} session(s), last ${importStats.alwaysChars} chars` : "not sent yet"}` +
        ` (caps: ${IMPORT_LIMITS.alwaysChars} chars at start, ${IMPORT_LIMITS.globRuleChars} per glob rule, ${IMPORT_LIMITS.globSessionChars} per session)` +
        (limitNote.length ? `; ${limitNote.join("; ")}` : ""),
      `  circuit breaker: trips after ${breaker.threshold} consecutive errors`,
      "Fallback: /omc off (this session), OMC_DISABLE=1 (next start), " +
        `"extensions": {"disabledExtensions": ["${EXTENSION_ID}"]} in ~/.copilot/settings.json, ` +
        "or copilot plugin disable oh-my-copilot.",
    ].join("\n");
  };

  const usage =
    "Usage: /omc [status|on|off|reload|reset|help], /omc on|off <feature>, /omc on|off imports <path>. " +
    `Features: ${FEATURES.join(", ")}.`;

  const handleCommand = async ({ args }) => {
    const [, rawVerb = "status", name, importPath] =
      /^(\S+)(?:\s+(\S+))?(?:\s+([\s\S]+))?$/.exec((args ?? "").trim()) ?? [];
    const verb = rawVerb.toLowerCase();
    const feature = name && canonicalFeature(name);
    if (name && !feature) return log(`Unknown feature "${name}". ${usage}`, "warning");
    if (importPath !== undefined) {
      if (!["on", "off"].includes(verb) || feature !== "imports") return log(usage, "warning");
      const path = normalizeImportPath(importPath.replace(/^(["'])(.*)\1$/, "$2"));
      const cfg = currentState();
      if (cfg.featureOrigin.imports.startsWith("env")) return log("Imports are disabled by OMC_DISABLE_FEATURES; path switches cannot override it.", "warning");
      const value = verb === "on";
      if (value && overrides.features.imports === false) {
        delete overrides.features.imports;
        overrides.importDefault = false;
        overrides.importPaths = {};
        overrides.replaceImportPaths = true;
      }
      overrides.importPaths[path] = value;
      if (value) breaker.reset("imports");
      return log(`Import path "${path}" is ${value ? "on" : "off"} for this session. ` +
        "The most specific path wins; changes apply on the next prompt. Context already sent cannot be erased.");
    }
    switch (verb) {
      case "status":
        return log(statusText());
      case "on":
      case "off": {
        const value = verb === "on";
        if (feature) {
          overrides.features[feature] = value;
          if (value) breaker.reset(feature);
        } else {
          overrides.enabled = value;
        }
        await syncTools();
        const target = feature ? `"${feature}"` : "oh-my-copilot";
        const restart =
          value && feature === "streamRules" && !stream.stats.watching
            ? " Restart Copilot to watch the stream; until then interrupt rules only deny matching tool calls."
            : "";
        return log(
          `${target} is ${value ? "on" : "off"} for this session.` +
            (value ? restart : " Copilot's built-in tools and behavior are unaffected."),
        );
      }
      case "reload":
        cache.clear();
        reported.clear();
        overrides.enabled = undefined;
        overrides.features = {};
        overrides.importPaths = {};
        overrides.importDefault = undefined;
        overrides.replaceImportPaths = false;
        breaker.reset();
        await syncTools();
        return log(`Reloaded configuration and rules; /omc overrides cleared.\n${statusText()}`);
      case "reset":
        breaker.reset();
        await syncTools();
        return log("Circuit breaker reset.");
      case "help":
        return log(usage);
      default:
        return log(`Unknown subcommand "${verb}". ${usage}`, "warning");
    }
  };

  // ---- join ----------------------------------------------------------------

  const watchStream = streamActive();
  session = await joinSession({
    // Sub-agent deltas are left out: the SDK default would include them.
    ...(watchStream ? { streaming: true, includeSubAgentStreamingEvents: false } : {}),
    tools: listed,
    commands: [
      {
        name: "omc",
        description: "oh-my-copilot: status, on, off, reload, reset (add a feature name to target one feature)",
        handler: async (ctx) => {
          try {
            await handleCommand(ctx);
          } catch (err) {
            log(`oh-my-copilot: /omc failed: ${err?.message ?? err}`, "warning");
          }
        },
      },
    ],
    hooks: {
      onPreToolUse: async (input, invocation) => {
        let out;
        try {
          if (input?.workingDirectory) cwd = input.workingDirectory;
          void syncTools();
          if (active("rules")) out = await evaluate(input);
        } catch (err) {
          warnOnce(`rules hook error: ${err?.message ?? err}`);
        }
        try {
          const ctx = active("imports") ? await importsPre(input, invocation) : undefined;
          if (ctx) out = { ...out, additionalContext: joinContext(out?.additionalContext, ctx) };
        } catch (err) {
          warnOnce(`imported rules hook error: ${err?.message ?? err}`);
        }
        return out;
      },
      onPostToolUse: async (input) => {
        try {
          if (!active("rules")) return undefined;
          return await evaluatePost(input);
        } catch (err) {
          warnOnce(`post rules hook error: ${err?.message ?? err}`);
          return undefined;
        }
      },
      onPostToolUseFailure: async (input) => {
        try {
          if (!active("rules")) return undefined;
          return await evaluatePost(input);
        } catch (err) {
          warnOnce(`post rules hook error: ${err?.message ?? err}`);
          return undefined;
        }
      },
      onUserPromptSubmitted: async (input, invocation) => {
        if (input?.workingDirectory) cwd = input.workingDirectory;
        void syncTools();
        try {
          if (stream.stats.watching) stream.handlePrompt(input?.prompt);
        } catch (err) {
          warnOnce(`stream rules hook error: ${err?.message ?? err}`);
        }
        let nudge;
        let imported;
        try {
          nudge = (await nudgeContext(input, invocation))?.additionalContext;
        } catch (err) {
          warnOnce(`nudge hook error: ${err?.message ?? err}`);
        }
        try {
          imported = await importsContext(input, invocation);
        } catch (err) {
          warnOnce(`imported rules hook error: ${err?.message ?? err}`);
        }
        let conflict;
        try {
          conflict = await conflictContext(input, invocation);
        } catch (err) {
          warnOnce(`conflict hint hook error: ${err?.message ?? err}`);
        }
        const additionalContext = joinContext(nudge, conflict, imported);
        return additionalContext ? { additionalContext } : undefined;
      },
    },
  });
  if (watchStream) {
    try {
      session.on((ev) => stream.handleEvent(ev));
      stream.stats.watching = true;
    } catch (err) {
      log(`oh-my-copilot: stream rules cannot watch this session (${err?.message ?? err}); interrupt rules only deny tool calls.`, "warning");
    }
  }
  for (const [message, level, ephemeral] of pending.splice(0)) log(message, level, ephemeral);
  return session;
}
