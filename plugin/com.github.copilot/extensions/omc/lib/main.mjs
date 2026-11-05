// oh-my-copilot runtime: hash-anchored edit tools, pattern rules, and the
// /omc control command. Every hook and tool fails open.

import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { FEATURES, featureActive, resolveConfig } from "./config.mjs";
import { ConflictError, conflictHint, createConflictTools } from "./conflicts.mjs";
import { createJsonCache, findProjectOmcDir, userOmcDir } from "./files.mjs";
import { createBreaker } from "./guard.mjs";
import * as hl from "./hashline.mjs";
import { compileRules, evaluateRules, toHookOutput } from "./rules.mjs";

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

  const overrides = { enabled: undefined, features: {} };
  const tripped = new Set();

  const loadConfig = () => {
    const layers = [];
    for (const [scope, dir] of [["user", userOmcDir()], ["project", findProjectOmcDir(cwd)]]) {
      if (!dir) continue;
      const r = cache.read(join(dir, "config.json"));
      if (r.error) warnOnce(`ignoring invalid config ${r.error}`);
      else if (r.data !== undefined) layers.push({ source: `${scope} config`, data: r.data });
    }
    return resolveConfig({ env: process.env, layers });
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

  const evaluate = breaker.wrap(
    "rules",
    async (input) => {
      const { rules } = loadRules(input.workingDirectory || cwd);
      if (rules.length === 0) return undefined;
      return toHookOutput(evaluateRules(rules, input.toolName, input.toolArgs));
    },
    undefined,
  );

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

  const statusText = () => {
    const st = currentState();
    const { sources } = loadRules(cwd);
    const feature = (f) => {
      const on = featureActive(st, f);
      const why = tripped.has(f) ? "tripped by circuit breaker" : st.featureOrigin[f];
      return `  ${f.padEnd(10)}${on ? "on " : "off"}  (${why})`;
    };
    return [
      `oh-my-copilot ${VERSION}: ${st.enabled ? "active" : "OFF"} (${st.enabledOrigin})`,
      ...FEATURES.map(feature),
      `  working directory: ${cwd}`,
      `  rules files: ${sources.length ? sources.join(", ") : "none"}`,
      `  circuit breaker: trips after ${breaker.threshold} consecutive errors`,
      "Fallback: /omc off (this session), OMC_DISABLE=1 (next start), " +
        `"extensions": {"disabledExtensions": ["${EXTENSION_ID}"]} in ~/.copilot/settings.json, ` +
        "or copilot plugin disable oh-my-copilot.",
    ].join("\n");
  };

  const usage =
    "Usage: /omc [status|on|off|reload|reset|help], /omc on <feature>, /omc off <feature>. " +
    `Features: ${FEATURES.join(", ")}.`;

  const handleCommand = async ({ args }) => {
    const [verb = "status", feature] = (args ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (feature && !FEATURES.includes(feature)) return log(`Unknown feature "${feature}". ${usage}`, "warning");
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
        return log(
          `${target} is ${value ? "on" : "off"} for this session.` +
            (value ? "" : " Copilot's built-in tools and behavior are unaffected."),
        );
      }
      case "reload":
        cache.clear();
        reported.clear();
        overrides.enabled = undefined;
        overrides.features = {};
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

  session = await joinSession({
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
      onPreToolUse: async (input) => {
        try {
          if (input?.workingDirectory) cwd = input.workingDirectory;
          void syncTools();
          if (!active("rules")) return undefined;
          return await evaluate(input);
        } catch (err) {
          warnOnce(`rules hook error: ${err?.message ?? err}`);
          return undefined;
        }
      },
      onUserPromptSubmitted: async (input, invocation) => {
        try {
          if (input?.workingDirectory) cwd = input.workingDirectory;
          void syncTools();
          const parts = [(await nudgeContext(input, invocation))?.additionalContext];
          parts.push(await conflictContext(input, invocation));
          const text = parts.filter(Boolean).join("\n\n");
          return text ? { additionalContext: text } : undefined;
        } catch (err) {
          warnOnce(`nudge hook error: ${err?.message ?? err}`);
          return undefined;
        }
      },
    },
  });
  for (const [message, level, ephemeral] of pending.splice(0)) log(message, level, ephemeral);
  return session;
}
