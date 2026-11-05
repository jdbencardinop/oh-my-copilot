import assert from "node:assert/strict";
import { test } from "node:test";
import { createBreaker } from "../plugin/com.github.copilot/extensions/omc/lib/guard.mjs";
import { compileRules } from "../plugin/com.github.copilot/extensions/omc/lib/rules.mjs";
import {
  LIMITS,
  createArgsScanner,
  createStreamRules,
  isOwnPrompt,
  matchDelta,
  reminderFor,
} from "../plugin/com.github.copilot/extensions/omc/lib/stream.mjs";

const compile = (rules) => {
  const c = compileRules({ rules });
  assert.deepEqual(c.errors, []);
  return c.rules;
};
const freshState = () => ({ text: new Map(), tools: new Map() });
const text = (deltaContent, messageId = "m1") => ({ type: "assistant.message_delta", data: { messageId, deltaContent } });
const reasoning = (deltaContent) => ({ type: "assistant.reasoning_delta", data: { reasoningId: "r1", deltaContent } });
const toolDelta = (inputDelta, toolName, toolCallId = "c1") => ({
  type: "assistant.tool_call_delta",
  data: { toolCallId, inputDelta, ...(toolName ? { toolName } : {}) },
});
const chunks = (s, n) => {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
};

test("args scanner decodes split JSON strings, escapes, and keys", () => {
  const json = JSON.stringify({ path: "a\\b.js", old_str: "x", new_str: 'say("hi")\n\u00e9\ud83d\ude00', edits: [{ content: "one" }, { content: "two" }] });
  for (const size of [1, 2, 3, 7, json.length]) {
    const s = createArgsScanner();
    chunks(json, size).forEach((c) => s.push(c));
    assert.equal(s.fields.get("path"), "a\\b.js");
    assert.equal(s.fields.get("old_str"), "x");
    assert.equal(s.fields.get("new_str"), 'say("hi")\n\u00e9\ud83d\ude00');
    assert.equal(s.fields.get("content"), "one\ntwo");
    assert.ok(s.complete.has("path"));
  }
  const partial = createArgsScanner();
  partial.push('{"path":"a.js","file_text":"con');
  assert.deepEqual(partial.args(), { path: "a.js", file_text: "con" });
  assert.deepEqual(partial.args({ completeOnly: true }), { path: "a.js" });
  const capped = createArgsScanner(10);
  capped.push(`{"file_text":"${"a".repeat(50)}console"`);
  assert.equal(capped.fields.get("file_text").length, 10);
});

test("text rules match across split deltas; reasoning only when scoped", () => {
  const rules = compile([{ id: "no-log", pattern: "console\\.log", action: "interrupt" }]);
  const st = freshState();
  assert.equal(matchDelta(st, text("use cons"), rules), undefined);
  assert.equal(matchDelta(st, text("ole."), rules), undefined);
  assert.equal(matchDelta(st, text("log("), rules).rule.id, "no-log");
  assert.equal(matchDelta(freshState(), reasoning("console.log"), rules), undefined);
  const rsn = compile([{ id: "r", pattern: "console\\.log", action: "interrupt", scope: "reasoning" }]);
  assert.equal(matchDelta(freshState(), reasoning("console.log"), rsn).where, "reasoning");
  assert.equal(matchDelta(freshState(), text("console.log"), rsn), undefined);
  // Separate messages have separate buffers.
  const st2 = freshState();
  matchDelta(st2, text("console", "a"), rules);
  assert.equal(matchDelta(st2, text(".log", "b"), rules), undefined);
});

test("tool rules match what the tool would write, not the text it replaces", () => {
  const rules = compile([{ id: "no-log", pattern: "console\\.log", action: "interrupt", tools: ["edit", "create"] }]);
  const run = (args, tool, size = 3) => {
    const st = freshState();
    let hit;
    chunks(JSON.stringify(args), size).forEach((c, i) => {
      hit ??= matchDelta(st, toolDelta(c, i === 0 ? tool : undefined), rules);
    });
    return hit;
  };
  assert.equal(run({ path: "a.js", file_text: "console.log(1)" }, "create").where, "tool create");
  assert.equal(run({ path: "a.js", old_str: "console.log(1)", new_str: "log(1)" }, "edit"), undefined);
  assert.equal(run({ path: "a.js", old_str: "x", new_str: "console.log(1)" }, "edit").rule.id, "no-log");
  assert.equal(run({ command: "console.log" }, "bash"), undefined, "tools filter");
  assert.equal(matchDelta(freshState(), text("console.log"), rules), undefined, "tool-bound rules skip text");
});

test("tool rules with paths wait for the path to be complete", () => {
  const rules = compile([{ id: "gen", paths: "src/generated/**", pattern: "x", action: "interrupt" }]);
  const st = freshState();
  assert.equal(matchDelta(st, toolDelta('{"file_text":"x","path":"src/gen', "create"), rules), undefined);
  assert.equal(matchDelta(st, toolDelta('erated/a.ts"}'), rules).rule.id, "gen");
  const st2 = freshState();
  assert.equal(matchDelta(st2, toolDelta('{"path":"src/a.ts","file_text":"x"}', "create"), rules), undefined);
});

test("sub-agent deltas are ignored (agentId is on the event)", () => {
  const rules = compile([{ id: "no-log", pattern: "console\\.log", action: "interrupt" }]);
  for (const ev of [text("console.log"), toolDelta('{"command":"console.log()"}', "bash")]) {
    ev.agentId = "sub-1";
    assert.equal(matchDelta(freshState(), ev, rules), undefined);
  }
  assert.equal(matchDelta(freshState(), text("console.log"), rules).rule.id, "no-log");
});

// ---- controller ------------------------------------------------------------

function harness({ rules, active = true, abort, send, truncate, limits, noIdle = false, onTurnStart, onTruncated } = {}) {
  const calls = [];
  const logs = [];
  let listener;
  const session = {
    abort: async () => {
      calls.push("abort");
      if (abort) await abort();
      // The runtime reports idle once the turn stops.
      if (!noIdle) queueMicrotask(() => listener({ type: "session.idle", data: { aborted: true } }));
    },
    send: async (opts) => {
      calls.push(["send", opts.prompt]);
      if (send) await send(opts);
      return "msg";
    },
    rpc: {
      history: {
        truncate: async (p) => {
          calls.push(["truncate", p.eventId]);
          if (truncate) await truncate(p);
          return { eventsRemoved: 3 };
        },
      },
    },
  };
  const state = { active };
  const breaker = createBreaker({ threshold: 3 });
  const compiled = compile(rules ?? [{ id: "no-log", pattern: "console\\.log", action: "interrupt", message: "Use the logger." }]);
  const sr = createStreamRules({
    getSession: () => session,
    getRules: () => compiled,
    isActive: () => state.active,
    log: (m, level = "info") => logs.push({ m, level }),
    breaker,
    limits: { ...LIMITS, idleTimeoutMs: 200, ...limits },
    onTurnStart,
    onTruncated,
  });
  listener = sr.handleEvent;
  const settle = () => new Promise((r) => setTimeout(r, 20));
  const turn = async (id, ...events) => {
    listener({ type: "assistant.turn_start", id, data: { turnId: id } });
    for (const ev of events) listener(ev);
    await settle();
  };
  return { sr, calls, logs, state, breaker, turn };
}

test("a match aborts, truncates to the turn start, and resends the rule once per prompt", async () => {
  const h = harness();
  h.sr.handlePrompt("write a hello world script");
  await h.turn("t1", text("I'll use cons"), text("ole.log"), text(" more console.log"));
  assert.deepEqual(h.calls, ["abort", ["truncate", "t1"], ["send", reminderFor({ id: "no-log", message: "Use the logger." })]]);
  assert.ok(isOwnPrompt(h.calls[2][1]));
  assert.match(h.calls[2][1], /^<system-reminder>\[omc rule no-log\] Use the logger\./);
  assert.equal(h.sr.stats.fires, 1);
  assert.equal(h.sr.stats.last.truncated, true);
  assert.equal(h.sr.stats.last.resent, true);

  // Our own retry prompt does not reset the budget; the rule stays quiet.
  h.sr.handlePrompt(h.calls[2][1]);
  await h.turn("t2", text("console.log again"));
  assert.equal(h.calls.length, 3);

  // A new user prompt resets it.
  h.sr.handlePrompt("next task");
  await h.turn("t3", text("console.log"));
  assert.equal(h.calls.filter((c) => c === "abort").length, 2);
  assert.equal(h.sr.stats.byRule.get("no-log"), 2);
});

test("caps: at most perPrompt fires per prompt and perSession overall", async () => {
  const rules = ["a", "b", "c", "d"].map((id) => ({ id, pattern: `\\b${id}${id}${id}\\b`, action: "interrupt" }));
  const h = harness({ rules, limits: { perPrompt: 2, perSession: 3 } });
  h.sr.handlePrompt("go");
  await h.turn("t1", text("aaa"));
  await h.turn("t2", text("bbb"));
  await h.turn("t3", text("ccc"));
  assert.equal(h.sr.stats.fires, 2);
  h.sr.handlePrompt("again");
  await h.turn("t4", text("ccc"));
  await h.turn("t5", text("ddd"));
  assert.equal(h.sr.stats.fires, 3);
});

test("a rule whose pattern is in the user's prompt is skipped for that prompt", async () => {
  const h = harness();
  h.sr.handlePrompt("Why does console.log print undefined here?");
  await h.turn("t1", text("Because console.log returns undefined"));
  assert.deepEqual(h.calls, []);
});

test("inactive feature: deltas are ignored", async () => {
  const h = harness({ active: false });
  h.sr.handlePrompt("go");
  await h.turn("t1", text("console.log"));
  assert.deepEqual(h.calls, []);
});

test("failed truncate still resends; failed abort counts toward the breaker and changes nothing", async () => {
  const t = harness({ truncate: async () => { throw new Error("nope"); } });
  t.sr.handlePrompt("go");
  await t.turn("t1", text("console.log"));
  assert.deepEqual(t.calls.map((c) => (Array.isArray(c) ? c[0] : c)), ["abort", "truncate", "send"]);
  assert.match(t.logs.find((l) => l.level === "warning").m, /could not drop/);

  const rules = ["a", "b", "c"].map((id) => ({ id, pattern: `\\b${id}${id}${id}\\b`, action: "interrupt" }));
  const a = harness({ rules, abort: async () => { throw new Error("abort failed"); } });
  a.sr.handlePrompt("go");
  await a.turn("t1", text("aaa"));
  assert.deepEqual(a.calls, ["abort"]);
  assert.equal(a.breaker.failures("streamRules"), 1);
  await a.turn("t2", text("bbb"));
  await a.turn("t3", text("ccc"));
  assert.ok(a.breaker.tripped.has("streamRules"));
  a.sr.handlePrompt("next");
  await a.turn("t4", text("aaa"));
  assert.equal(a.calls.length, 3, "tripped: no more aborts");
});

test("failed send after abort trips the breaker at once and warns loudly", async () => {
  const h = harness({ send: async () => { throw new Error("disconnected"); } });
  h.sr.handlePrompt("go");
  await h.turn("t1", text("console.log"));
  assert.ok(h.breaker.tripped.has("streamRules"));
  assert.match(h.logs.at(-1).m, /retry could not be sent.*Send your prompt again/);
  assert.equal(h.logs.at(-1).level, "warning");
});

test("no idle event: no truncate or retry; breaker failure and a re-prompt notice", async () => {
  const h = harness({ noIdle: true });
  h.sr.handlePrompt("go");
  await h.turn("t1", text("console.log"));
  await new Promise((r) => setTimeout(r, 250));
  assert.deepEqual(h.calls, ["abort"]);
  assert.equal(h.breaker.failures("streamRules"), 1);
  assert.equal(h.sr.stats.last.resent, false);
  const w = h.logs.at(-1);
  assert.equal(w.level, "warning");
  assert.match(w.m, /rule no-log fired and stopped the response, but the session did not report idle in time, so no retry was sent\. Send your prompt again\./);
});

test("a sub-agent turn_start does not move the truncation point", async () => {
  const starts = [];
  const h = harness({ onTurnStart: () => starts.push(1) });
  h.sr.handlePrompt("go");
  h.sr.handleEvent({ type: "assistant.turn_start", id: "main-1", data: {} });
  h.sr.handleEvent({ type: "assistant.turn_start", id: "sub-1", agentId: "sub", data: {} });
  const sub = text("console.log");
  sub.agentId = "sub";
  h.sr.handleEvent(sub);
  h.sr.handleEvent(text("console.log"));
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(h.calls[1], ["truncate", "main-1"]);
  assert.equal(starts.length, 1);
});

test("onTruncated runs only after a successful truncate", async () => {
  let n = 0;
  const ok = harness({ onTruncated: () => n++ });
  ok.sr.handlePrompt("go");
  await ok.turn("t1", text("console.log"));
  assert.equal(n, 1);
  const bad = harness({ onTruncated: () => n++, truncate: async () => { throw new Error("x"); } });
  bad.sr.handlePrompt("go");
  await bad.turn("t1", text("console.log"));
  assert.equal(n, 1);
});

const hang = () => new Promise(() => {});

test("hung abort times out, counts toward the breaker, and frees the controller", async () => {
  const rules = ["a", "b"].map((id) => ({ id, pattern: `\\b${id}${id}${id}\\b`, action: "interrupt" }));
  const h = harness({ rules, abort: hang, noIdle: true, limits: { callTimeoutMs: 30 } });
  h.sr.handlePrompt("go");
  await h.turn("t1", text("aaa"));
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(h.calls, ["abort"]);
  assert.equal(h.breaker.failures("streamRules"), 1);
  await h.turn("t2", text("bbb"));
  assert.equal(h.calls.length, 2, "not stuck: the next rule can still fire");
});

test("hung truncate: no retry (a late truncate could erase it); breaker failure and a re-prompt notice", async () => {
  let n = 0;
  const h = harness({ truncate: hang, limits: { callTimeoutMs: 30 }, onTruncated: () => n++ });
  h.sr.handlePrompt("go");
  await h.turn("t1", text("console.log"));
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(h.calls, ["abort", ["truncate", "t1"]]);
  assert.equal(h.sr.stats.last.truncated, false);
  assert.equal(n, 0, "glob marks are kept");
  assert.equal(h.breaker.failures("streamRules"), 1);
  assert.ok(!h.breaker.tripped.has("streamRules"));
  assert.match(h.logs.at(-1).m, /rule no-log fired and stopped the response, but dropping the interrupted turn from history timed out, so no retry was sent\. Send your prompt again\./);
});

test("hung send times out and trips the breaker", async () => {
  const h = harness({ send: hang, limits: { callTimeoutMs: 30 } });
  h.sr.handlePrompt("go");
  await h.turn("t1", text("console.log"));
  await new Promise((r) => setTimeout(r, 60));
  assert.ok(h.breaker.tripped.has("streamRules"));
  assert.match(h.logs.at(-1).m, /retry could not be sent \(send timed out/);
});

test("free-form tool input is matched as plain text", () => {
  const rules = compile([{ id: "no-log", pattern: "console\\.log", action: "interrupt", tools: ["apply_patch"] }]);
  const st = freshState();
  assert.equal(matchDelta(st, toolDelta("*** Begin Patch\n-console.log(1)\n", "apply_patch"), rules), undefined);
  assert.equal(matchDelta(st, toolDelta("+console.lo"), rules), undefined);
  assert.equal(matchDelta(st, toolDelta("g(2)\n"), rules).rule.id, "no-log");
});

test("event-handling errors count toward the breaker and never throw", async () => {
  const breaker = createBreaker({ threshold: 2 });
  const sr = createStreamRules({
    getSession: () => ({}),
    getRules: () => {
      throw new Error("bad rules");
    },
    isActive: () => true,
    breaker,
  });
  sr.handleEvent({ type: "assistant.turn_start", id: "t" });
  sr.handleEvent(text("x"));
  sr.handleEvent({ type: "assistant.turn_start", id: "t2" });
  sr.handleEvent(text("y"));
  assert.ok(breaker.tripped.has("streamRules"));
  assert.doesNotThrow(() => sr.handleEvent(null));
});
