// Pattern rules checked before tool calls ("TTSR-lite"), and after them
// ("when": "post"). A rule costs no context until a tool call matches it.
// "interrupt" rules are also watched in the model's stream (stream.mjs); here
// they act as "deny" for tool calls.

import { isAbsolute, relative, resolve } from "node:path";
import { compileGlobs, normalizePath } from "./glob.mjs";

export const ACTIONS = ["deny", "ask", "context", "interrupt"];
export const SCOPES = ["text", "tools", "reasoning"];
const SCOPE_ALIASES = { tool_args: "tools", tool: "tools", message: "text" };
export const POST_ACTIONS = ["context"];
export const WHEN = ["pre", "post"];

export const COMMAND_TOOLS = new Set(["bash", "powershell", "shell", "run_in_terminal"]);
export const REPLACE_TOOLS = new Set(["edit", "str_replace", "str_replace_editor", "multi_edit"]);
export const CREATE_TOOLS = new Set(["create", "write", "write_file"]);

/** Validate raw rule objects. Invalid rules are skipped and reported, never thrown. */
export function compileRules(raw, source = "rules") {
  const rules = [];
  const errors = [];
  const list = Array.isArray(raw) ? raw : raw?.rules;
  if (!Array.isArray(list)) {
    if (raw !== undefined && raw !== null) errors.push(`${source}: expected { "rules": [...] }`);
    return { rules, errors };
  }
  list.forEach((r, i) => {
    const id = typeof r?.id === "string" && r.id ? r.id : `${source}#${i}`;
    try {
      if (!r || typeof r !== "object") throw new Error("rule must be an object");
      if (r.enabled === false) return;
      const when = r.when ?? "pre";
      if (!WHEN.includes(when)) throw new Error(`"when" must be one of ${WHEN.join(", ")}`);
      if (r.pattern !== undefined && (typeof r.pattern !== "string" || !r.pattern)) {
        throw new Error('"pattern" must be a non-empty string');
      }
      if (r.paths !== undefined && !isGlobList(r.paths)) {
        throw new Error('"paths" must be a glob string or an array of glob strings');
      }
      if (r.pathPattern !== undefined && (typeof r.pathPattern !== "string" || !r.pathPattern)) {
        throw new Error('"pathPattern" must be a non-empty string');
      }
      if (r.pattern === undefined && r.paths === undefined && r.pathPattern === undefined) {
        throw new Error('"pattern" is required (or "paths"/"pathPattern" to match by file)');
      }
      const allowed = when === "post" ? POST_ACTIONS : ACTIONS;
      const action = r.action ?? (when === "post" ? "context" : "deny");
      if (!allowed.includes(action)) {
        throw new Error(`"action" must be one of ${allowed.join(", ")}${when === "post" ? ' for "when": "post" (the tool already ran)' : ""}`);
      }
      if (r.tools !== undefined && !(Array.isArray(r.tools) && r.tools.every((t) => typeof t === "string"))) {
        throw new Error('"tools" must be an array of tool names');
      }
      if (r.scope !== undefined && action !== "interrupt") throw new Error('"scope" only applies to "action": "interrupt"');
      rules.push({
        id,
        source,
        when,
        action,
        message: typeof r.message === "string" && r.message ? r.message : `Matched rule ${id}.`,
        tools: r.tools && r.tools.length && !r.tools.includes("*") ? new Set(r.tools) : null,
        field: typeof r.field === "string" && r.field ? r.field : "auto",
        regex: r.pattern === undefined ? null : new RegExp(r.pattern, sanitizeFlags(r.flags)),
        pathRegex: r.pathPattern ? new RegExp(r.pathPattern) : null,
        pathGlob: r.paths === undefined ? null : compileGlobs(r.paths),
        scope: action === "interrupt" ? compileScope(r) : null,
      });
    } catch (err) {
      errors.push(`${source}: rule "${id}" skipped: ${err.message}`);
    }
  });
  return { rules, errors };
}

/**
 * Where an interrupt rule is watched. Default: text and tool arguments, or
 * tool arguments only when the rule is about specific tools or files.
 */
function compileScope(r) {
  if (r.scope === undefined) {
    const toolBound = r.pattern === undefined || r.paths !== undefined || r.pathPattern !== undefined ||
      (Array.isArray(r.tools) && r.tools.length && !r.tools.includes("*"));
    return new Set(toolBound ? ["tools"] : ["text", "tools"]);
  }
  const list = typeof r.scope === "string" ? [r.scope] : r.scope;
  if (!Array.isArray(list) || !list.length) throw new Error(`"scope" must be one or more of ${SCOPES.join(", ")}`);
  const out = new Set();
  for (const item of list) {
    const name = typeof item === "string" ? SCOPE_ALIASES[item] ?? item : item;
    if (!SCOPES.includes(name)) throw new Error(`"scope" must be one or more of ${SCOPES.join(", ")}`);
    out.add(name);
  }
  if (r.pattern === undefined && (out.has("text") || out.has("reasoning"))) {
    throw new Error('"pattern" is required for the "text" and "reasoning" scopes');
  }
  return out;
}

function isGlobList(v) {
  if (typeof v === "string") return v.trim() !== "";
  return Array.isArray(v) && v.length > 0 && v.every((g) => typeof g === "string" && g.trim() !== "");
}

function sanitizeFlags(flags) {
  if (typeof flags !== "string") return "";
  return [...new Set(flags.replace(/[^imsu]/g, ""))].join("");
}

function stringLeaves(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringLeaves(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => stringLeaves(v, out));
  return out;
}

function getPath(obj, dotted) {
  return dotted.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function addedPatchLines(patch) {
  return patch
    .split(/\r?\n/)
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1))
    .join("\n");
}

/**
 * Text a rule is matched against. "auto" targets what the tool would write or
 * run (new content, not the text being replaced); "all" uses every string arg.
 */
export function matchText(toolName, args, field = "auto") {
  if (args == null) return "";
  if (field === "all") return stringLeaves(args).join("\n");
  if (field !== "auto") return stringLeaves(getPath(args, field)).join("\n");

  if (COMMAND_TOOLS.has(toolName) && typeof args.command === "string") return args.command;
  if (REPLACE_TOOLS.has(toolName) && typeof args.new_str === "string") return args.new_str;
  if (CREATE_TOOLS.has(toolName)) {
    const text = args.file_text ?? args.content;
    if (typeof text === "string") return text;
  }
  if (toolName === "edit_anchored" && Array.isArray(args.edits)) {
    return args.edits.map((e) => (typeof e?.content === "string" ? e.content : "")).join("\n");
  }
  if (toolName === "apply_patch") {
    const patch = typeof args === "string" ? args : args.input ?? args.patch;
    if (typeof patch === "string") return addedPatchLines(patch);
  }
  return stringLeaves(args).join("\n");
}

/** File paths a tool call targets, used by "paths" and "pathPattern". */
export function targetPaths(toolName, args) {
  if (args == null) return [];
  const paths = [];
  for (const key of ["path", "file_path", "filePath"]) {
    for (const p of [].concat(args[key] ?? [])) if (typeof p === "string" && p) paths.push(p);
  }
  if (toolName === "resolve_conflicts" && Array.isArray(args.resolutions)) {
    // Ids are "[conflict://]PATH#N@HASH"; the path itself may contain "#".
    for (const r of args.resolutions) {
      const m = typeof r?.id === "string" && /^(?:conflict:\/\/)?(.+)#\d+@[0-9a-z]+$/i.exec(r.id.trim());
      if (m && !paths.includes(m[1])) paths.push(m[1]);
    }
  }
  if (toolName === "apply_patch") {
    const patch = typeof args === "string" ? args : args.input ?? args.patch;
    if (typeof patch === "string") {
      for (const m of patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) paths.push(m[1].trim());
    }
  }
  return paths;
}

/**
 * Map a tool's target path to the form globs are matched against: relative to
 * the project root with "/" separators. Paths outside the root stay absolute.
 */
export function projectPath(p, { cwd, root } = {}) {
  if (!cwd && !root) return normalizePath(p);
  const abs = isAbsolute(p) ? p : resolve(cwd || root, p);
  const rel = relative(root || cwd, abs);
  if (!rel) return ".";
  if (rel.startsWith("..") || isAbsolute(rel)) return normalizePath(abs);
  return normalizePath(rel);
}

function pathFilter(rule, paths, globPaths) {
  if (rule.pathRegex && !paths().some((p) => rule.pathRegex.test(p))) return false;
  if (rule.pathGlob && !globPaths().some((p) => rule.pathGlob(p))) return false;
  return true;
}

/** True when a rule's "paths"/"pathPattern" filters accept the tool call (or it has none). */
export function ruleMatchesPaths(rule, toolName, args, opts = {}) {
  const paths = lazy(() => targetPaths(toolName, args));
  return pathFilter(rule, paths, lazy(() => paths().map((p) => projectPath(p, opts))));
}

function lazy(fn) {
  let value;
  let done = false;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value;
  };
}

/**
 * Return the pre-tool rules that match a tool call, grouped by action.
 * "interrupt" rules with the "tools" scope are reported as "deny".
 * opts.cwd / opts.root make "paths" globs project-relative.
 */
export function evaluateRules(rules, toolName, args, opts = {}) {
  const result = { deny: [], ask: [], context: [] };
  const paths = lazy(() => targetPaths(toolName, args));
  const globPaths = lazy(() => paths().map((p) => projectPath(p, opts)));
  for (const rule of rules) {
    if (rule.when === "post") continue;
    if (rule.scope && !rule.scope.has("tools")) continue;
    if (rule.tools && !rule.tools.has(toolName)) continue;
    if (!pathFilter(rule, paths, globPaths)) continue;
    const bucket = rule.action === "interrupt" ? "deny" : rule.action;
    if (!rule.regex || rule.regex.test(matchText(toolName, args, rule.field))) result[bucket].push(rule);
  }
  return result;
}

/**
 * Text a post rule is matched against. "auto"/"result": the tool's output
 * (or error); "all": arguments plus output; "file": the target files as they
 * are after the tool ran (opts.fileText reads them); anything else is a
 * dotted argument path, as for pre rules.
 */
export function postMatchText(toolName, args, resultText, field = "auto", opts = {}) {
  const out = typeof resultText === "string" ? resultText : "";
  if (field === "auto" || field === "result") return out;
  if (field === "all") return [...stringLeaves(args ?? {}), out].join("\n");
  if (field === "file") {
    if (typeof opts.fileText !== "function") return "";
    return targetPaths(toolName, args)
      .map((p) => opts.fileText(p))
      .filter((t) => typeof t === "string")
      .join("\n");
  }
  return matchText(toolName, args, field);
}

/** Return the post-tool rules that match a finished tool call. */
export function evaluatePostRules(rules, toolName, args, resultText, opts = {}) {
  const matched = [];
  const paths = lazy(() => targetPaths(toolName, args));
  const globPaths = lazy(() => paths().map((p) => projectPath(p, opts)));
  for (const rule of rules) {
    if (rule.when !== "post") continue;
    if (rule.tools && !rule.tools.has(toolName)) continue;
    if (!pathFilter(rule, paths, globPaths)) continue;
    if (!rule.regex || rule.regex.test(postMatchText(toolName, args, resultText, rule.field, opts))) matched.push(rule);
  }
  return matched;
}

/** Text of a tool result object, as the model sees it. */
export function resultText(result) {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  return [result.textResultForLlm, result.error].filter((t) => typeof t === "string" && t).join("\n");
}

/** Convert post-rule matches into a postToolUse hook result, or undefined. */
export function toPostHookOutput(matched) {
  if (!matched.length) return undefined;
  return { additionalContext: matched.map((r) => `[omc rule ${r.id}] ${r.message}`).join("\n") };
}

/** Convert matches into a preToolUse hook result, or undefined when nothing matched. */
export function toHookOutput(matches) {
  const fmt = (r) => `[omc rule ${r.id}] ${r.message}`;
  if (matches.deny.length) {
    return { permissionDecision: "deny", permissionDecisionReason: matches.deny.map(fmt).join("\n") };
  }
  const context = matches.context.map(fmt).join("\n") || undefined;
  if (matches.ask.length) {
    return { permissionDecision: "ask", permissionDecisionReason: matches.ask.map(fmt).join("\n"), additionalContext: context };
  }
  return context ? { additionalContext: context } : undefined;
}
