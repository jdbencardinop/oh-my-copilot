// Pattern rules checked before tool calls ("TTSR-lite").
// A rule costs no context until a tool call matches it.

export const ACTIONS = ["deny", "ask", "context"];

const COMMAND_TOOLS = new Set(["bash", "powershell", "shell", "run_in_terminal"]);
const REPLACE_TOOLS = new Set(["edit", "str_replace", "str_replace_editor", "multi_edit"]);
const CREATE_TOOLS = new Set(["create", "write", "write_file"]);

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
      if (typeof r.pattern !== "string" || !r.pattern) throw new Error('"pattern" is required');
      const action = r.action ?? "deny";
      if (!ACTIONS.includes(action)) throw new Error(`"action" must be one of ${ACTIONS.join(", ")}`);
      if (r.tools !== undefined && !(Array.isArray(r.tools) && r.tools.every((t) => typeof t === "string"))) {
        throw new Error('"tools" must be an array of tool names');
      }
      rules.push({
        id,
        source,
        action,
        message: typeof r.message === "string" && r.message ? r.message : `Matched rule ${id}.`,
        tools: r.tools && r.tools.length && !r.tools.includes("*") ? new Set(r.tools) : null,
        field: typeof r.field === "string" && r.field ? r.field : "auto",
        regex: new RegExp(r.pattern, sanitizeFlags(r.flags)),
        pathRegex: typeof r.pathPattern === "string" && r.pathPattern ? new RegExp(r.pathPattern) : null,
      });
    } catch (err) {
      errors.push(`${source}: rule "${id}" skipped: ${err.message}`);
    }
  });
  return { rules, errors };
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

/** File paths a tool call targets, used by "pathPattern". */
export function targetPaths(toolName, args) {
  if (args == null) return [];
  const paths = [];
  for (const key of ["path", "file_path", "filePath"]) {
    if (typeof args[key] === "string") paths.push(args[key]);
  }
  if (toolName === "apply_patch") {
    const patch = typeof args === "string" ? args : args.input ?? args.patch;
    if (typeof patch === "string") {
      for (const m of patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) paths.push(m[1].trim());
    }
  }
  return paths;
}

/** Return the rules that match a tool call, grouped by action. */
export function evaluateRules(rules, toolName, args) {
  const result = { deny: [], ask: [], context: [] };
  let paths;
  for (const rule of rules) {
    if (rule.tools && !rule.tools.has(toolName)) continue;
    if (rule.pathRegex) {
      paths ??= targetPaths(toolName, args);
      if (!paths.some((p) => rule.pathRegex.test(p))) continue;
    }
    if (rule.regex.test(matchText(toolName, args, rule.field))) result[rule.action].push(rule);
  }
  return result;
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
