// Stream rules ("TTSR"): watch the model's output as it streams, and when an
// "interrupt" rule matches, stop the turn, drop it from history, and ask the
// model to redo it with the rule. Needs `streaming: true` at join time.
// Every step fails open: if abort fails the turn simply continues, and the
// rule still denies matching tool calls in preToolUse.

import { COMMAND_TOOLS, CREATE_TOOLS, REPLACE_TOOLS, matchText, ruleMatchesPaths } from "./rules.mjs";

export const LIMITS = {
  perPrompt: 3, // fires per user prompt, all rules together
  perSession: 20,
  bufferChars: 16_384, // tail kept per streamed message / tool-argument field
  idleTimeoutMs: 5_000,
  callTimeoutMs: 5_000,
};

const MARKER = "<system-reminder>[omc rule ";

export const reminderFor = (rule) =>
  `${MARKER}${rule.id}] ${rule.message}\n` +
  "oh-my-copilot stopped your previous response because it broke this rule. Redo it, following the rule.</system-reminder>";

/** True for the retry prompts this module sends, so they do not reset the budget. */
export const isOwnPrompt = (prompt) => typeof prompt === "string" && prompt.includes(MARKER);

const tail = (s, max) => (s.length > max ? s.slice(s.length - max) : s);

/**
 * Incremental decoder for streamed JSON tool arguments. It keeps the decoded
 * text of every string value, grouped by the name of the key that holds it
 * (array items use the array's key), so rules can match `new_str` without
 * matching `old_str`. Keys whose value string has closed are in `complete`.
 */
export function createArgsScanner(maxChars = LIMITS.bufferChars) {
  const fields = new Map();
  const complete = new Set();
  const stack = []; // { type: "{" | "[", key }
  let expectKey = false;
  let inString = false;
  let isKey = false;
  let escape = null; // null, "" after a backslash, or collected \u hex digits
  let str = "";
  let field = "";

  const currentKey = () => stack.at(-1)?.key ?? "";
  const append = (text) => {
    fields.set(field, tail((fields.get(field) ?? "") + text, maxChars));
  };
  const flush = () => {
    if (!str) return;
    if (isKey) return; // keys are tiny and kept in `str` until they close
    append(str);
    str = "";
  };

  let raw; // undefined until the first non-space character decides JSON or raw text

  function push(chunk) {
    if (typeof chunk !== "string") return;
    if (raw === undefined) {
      const first = chunk.trimStart()[0];
      if (first === undefined) return;
      // Free-form tools (for example some apply_patch variants) stream plain text.
      raw = !'{["'.includes(first);
    }
    if (raw) {
      fields.set("", tail((fields.get("") ?? "") + chunk, maxChars));
      return;
    }
    for (const ch of chunk) {
      if (inString) {
        if (escape !== null) {
          if (escape === "" && ch !== "u") {
            str += { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" }[ch] ?? ch;
            escape = null;
          } else if (escape === "") {
            escape = "u";
          } else {
            escape += ch;
            if (escape.length === 5) {
              const code = parseInt(escape.slice(1), 16);
              str += Number.isNaN(code) ? "" : String.fromCharCode(code);
              escape = null;
            }
          }
          continue;
        }
        if (ch === "\\") {
          escape = "";
        } else if (ch === '"') {
          inString = false;
          if (isKey) {
            if (stack.length) stack.at(-1).key = str;
            str = "";
          } else {
            flush();
            complete.add(field);
          }
        } else {
          str += ch;
        }
        continue;
      }
      switch (ch) {
        case '"':
          inString = true;
          isKey = stack.at(-1)?.type === "{" && expectKey;
          str = "";
          if (!isKey) {
            field = currentKey();
            // Several strings under one key (array items) are joined by newlines.
            if (fields.has(field)) append("\n");
            else fields.set(field, "");
            complete.delete(field);
          }
          break;
        case "{":
          stack.push({ type: "{", key: "" });
          expectKey = true;
          break;
        case "[":
          stack.push({ type: "[", key: currentKey() });
          expectKey = false;
          break;
        case "}":
        case "]":
          stack.pop();
          expectKey = false;
          break;
        case ",":
          expectKey = stack.at(-1)?.type === "{";
          break;
        case ":":
          expectKey = false;
          break;
        default:
          break;
      }
    }
    if (inString) flush();
  }

  return {
    push,
    fields,
    complete,
    /** Arguments rebuilt from what has streamed so far (complete: closed strings only). */
    args({ completeOnly = false } = {}) {
      const keys = [...fields.keys()].filter((k) => !completeOnly || complete.has(k));
      if (keys.length === 1 && keys[0] === "" && (raw || !stack.length)) return fields.get("");
      return Object.fromEntries(keys.map((k) => [k, fields.get(k)]));
    },
  };
}

/**
 * Text a tool rule is matched against while the arguments are still streaming.
 * With field "auto", nothing matches until the argument that "auto" reads has
 * started, so an `edit` is not stopped for the `old_str` it is removing.
 */
export function streamedMatchText(toolName, scanner, field = "auto") {
  if (field !== "auto") return matchText(toolName, scanner.args(), field);
  const f = scanner.fields;
  const pick = (...keys) => {
    const found = keys.filter((k) => f.has(k));
    return found.length ? Object.fromEntries(found.map((k) => [k, f.get(k)])) : undefined;
  };
  let args;
  if (COMMAND_TOOLS.has(toolName)) args = pick("command");
  else if (REPLACE_TOOLS.has(toolName)) args = pick("new_str");
  else if (CREATE_TOOLS.has(toolName)) args = pick("file_text", "content");
  else if (toolName === "edit_anchored") args = f.has("content") ? { edits: [{ content: f.get("content") }] } : undefined;
  else if (toolName === "apply_patch") args = f.has("") ? f.get("") : pick("input", "patch");
  else args = scanner.args();
  return args === undefined ? "" : matchText(toolName, args, "auto");
}

// Sub-agent output is not ours to interrupt. The SDK puts `agentId` on the
// event itself; `data.parentToolCallId` is a deprecated marker on some events.
const isSubAgent = (ev) => Boolean(ev?.agentId || ev?.data?.agentId || ev?.data?.parentToolCallId);

// Rejects if `promise` has not settled within `ms`, so a hung call cannot
// leave the controller stuck mid-fire.
export function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${what} timed out after ${ms} ms`), { timedOut: true })), ms);
    timer.unref?.();
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Check the rules against one delta. Pure apart from the buffers it updates.
 * Returns the first rule that matches and is allowed to fire, or undefined.
 */
export function matchDelta(state, ev, rules, { pathOpts = {}, canFire = () => true } = {}) {
  const d = ev?.data ?? {};
  if (isSubAgent(ev)) return undefined;
  if (ev.type === "assistant.message_delta" || ev.type === "assistant.reasoning_delta") {
    const scope = ev.type === "assistant.message_delta" ? "text" : "reasoning";
    if (typeof d.deltaContent !== "string" || !d.deltaContent) return undefined;
    const key = `${scope}:${d.messageId ?? d.reasoningId ?? ""}`;
    const text = tail((state.text.get(key) ?? "") + d.deltaContent, LIMITS.bufferChars);
    state.text.set(key, text);
    for (const rule of rules) {
      if (!rule.regex || !rule.scope?.has(scope) || !canFire(rule)) continue;
      if (rule.regex.test(text)) return { rule, where: scope };
    }
    return undefined;
  }
  if (ev.type === "assistant.tool_call_delta") {
    const id = d.toolCallId ?? "";
    let call = state.tools.get(id);
    if (!call) {
      call = { name: undefined, scanner: createArgsScanner() };
      state.tools.set(id, call);
    }
    if (typeof d.toolName === "string" && d.toolName) call.name = d.toolName;
    if (typeof d.inputDelta !== "string" || !d.inputDelta) return undefined;
    call.scanner.push(d.inputDelta);
    for (const rule of rules) {
      if (!rule.scope?.has("tools") || !canFire(rule)) continue;
      if (rule.tools && !rule.tools.has(call.name)) continue;
      if (rule.pathRegex || rule.pathGlob) {
        const done = call.scanner.args({ completeOnly: true });
        if (!ruleMatchesPaths(rule, call.name, done, pathOpts)) continue;
        if (!rule.regex) return { rule, where: `tool ${call.name}` };
      }
      if (!rule.regex) continue;
      if (rule.regex.test(streamedMatchText(call.name, call.scanner, rule.field))) {
        return { rule, where: `tool ${call.name}` };
      }
    }
  }
  return undefined;
}

/**
 * Stream-rule controller. `getSession` returns the joined session, `getRules`
 * the compiled rules, `isActive` whether the feature may act right now.
 */
export function createStreamRules({
  getSession,
  getRules,
  isActive,
  pathOpts = () => ({}),
  log = () => {},
  breaker,
  limits: limitsIn,
  onTurnStart = () => {},
  onTruncated = () => {},
}) {
  const limits = { ...LIMITS, ...limitsIn };
  const state = { text: new Map(), tools: new Map() };
  const firedThisPrompt = new Set();
  const suppressed = new Set();
  const stats = { watching: false, fires: 0, byRule: new Map(), last: null };
  let promptFires = 0;
  let turnId = null;
  let turnRules;
  let turnPathOpts = {};
  let firing = false;
  let idleWaiters = [];

  const interruptRules = () => getRules().filter((r) => r.action === "interrupt" && r.when !== "post");
  const canFire = (rule) => {
    if (firedThisPrompt.has(rule.id) || suppressed.has(rule.id)) return false;
    return promptFires < limits.perPrompt && stats.fires < limits.perSession;
  };
  const resetTurn = () => {
    state.text.clear();
    state.tools.clear();
    turnRules = undefined;
  };

  const waitIdle = () => {
    let done;
    const promise = new Promise((resolve) => {
      done = resolve;
    });
    const timer = setTimeout(() => done(false), limits.idleTimeoutMs);
    timer.unref?.();
    idleWaiters.push((v) => {
      clearTimeout(timer);
      done(v);
    });
    return promise;
  };

  const fire = async (rule, where) => {
    try {
      if (breaker.tripped.has("streamRules") || !isActive()) return;
      const session = getSession();
      const cut = turnId;
      firing = true;
      firedThisPrompt.add(rule.id);
      promptFires++;
      stats.fires++;
      stats.byRule.set(rule.id, (stats.byRule.get(rule.id) ?? 0) + 1);
      const last = { id: rule.id, where, at: new Date().toISOString(), truncated: false, resent: false };
      stats.last = last;
      try {
        const idle = waitIdle();
        await withTimeout(session.abort(), limits.callTimeoutMs, "abort");
        resetTurn();
        // Without a clean stop, or with a truncate that may still land later
        // and erase the retry, it is safer to leave the next step to the user.
        const giveUp = (why) => {
          log(
            `oh-my-copilot: rule ${rule.id} fired and stopped the response, but ${why}, so no retry was sent. ` +
              `Send your prompt again.`,
            "warning",
          );
          breaker.fail("streamRules", new Error(why));
        };
        if (!(await idle)) {
          giveUp("the session did not report idle in time");
          return;
        }
        if (cut && typeof session.rpc?.history?.truncate === "function") {
          try {
            await withTimeout(session.rpc.history.truncate({ eventId: cut }), limits.callTimeoutMs, "history.truncate");
            last.truncated = true;
            try {
              onTruncated();
            } catch {}
          } catch (err) {
            if (err?.timedOut) {
              giveUp(`dropping the interrupted turn from history timed out`);
              return;
            }
            log(`oh-my-copilot: could not drop the interrupted turn from history (${err?.message ?? err}); retrying anyway.`, "warning");
          }
        }
        try {
          await withTimeout(
            session.send({ prompt: reminderFor(rule), displayPrompt: `[omc rule ${rule.id}] interrupted; retrying with the rule` }),
            limits.callTimeoutMs,
            "send",
          );
          last.resent = true;
        } catch (err) {
          // The turn is already stopped, so this is the one path that cannot
          // fall back silently. Switch the feature off and tell the user.
          log(
            `oh-my-copilot: rule ${rule.id} stopped the response but the retry could not be sent ` +
              `(${err?.message ?? err}). Send your prompt again. Stream rules are off for this session.`,
            "warning",
          );
          breaker.trip("streamRules", err);
          return;
        }
        log(`oh-my-copilot: rule ${rule.id} interrupted the response (${where}); retrying with the rule.`);
      } finally {
        firing = false;
      }
    } catch (err) {
      // Usually a failed abort: the turn just continues as stock Copilot.
      breaker.fail("streamRules", err);
    }
  };

  // Errors count toward the breaker and are never reset by later successes,
  // so a feature that keeps failing in one session switches itself off.
  const handleEvent = (ev) => {
    if (breaker.tripped.has("streamRules")) return;
    try {
      if (!ev || typeof ev.type !== "string") return;
      if (ev.type === "session.idle") {
        const waiters = idleWaiters;
        idleWaiters = [];
        waiters.forEach((w) => w(true));
        return;
      }
      if (ev.type === "assistant.turn_start") {
        if (!isSubAgent(ev)) {
          turnId = ev.id ?? null;
          resetTurn();
          onTurnStart();
        }
        return;
      }
      if (!ev.type.endsWith("_delta") || firing) return;
      if (turnRules === undefined) {
        turnRules = isActive() ? interruptRules() : [];
        turnPathOpts = turnRules.some((r) => r.pathGlob) ? pathOpts() : {};
      }
      if (!turnRules.length) return;
      const hit = matchDelta(state, ev, turnRules, { pathOpts: turnPathOpts, canFire });
      if (hit) void fire(hit.rule, hit.where);
    } catch (err) {
      breaker.fail("streamRules", err);
    }
  };

  /** Call from onUserPromptSubmitted: a real user prompt starts a new budget. */
  const handlePrompt = (prompt) => {
    if (isOwnPrompt(prompt)) return;
    firedThisPrompt.clear();
    suppressed.clear();
    promptFires = 0;
    if (typeof prompt !== "string" || !prompt || !isActive()) return;
    // A rule whose pattern the user typed would only fire on the model echoing it.
    for (const rule of interruptRules()) {
      if (rule.regex?.test(prompt)) suppressed.add(rule.id);
    }
  };

  return { handleEvent, handlePrompt, stats, limits };
}
