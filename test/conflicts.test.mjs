import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import {
  ConflictError,
  parseConflictId,
  parseConflicts,
  resolveText,
} from "../plugin/com.github.copilot/extensions/omc/lib/conflicts.mjs";
import { parseDocument } from "../plugin/com.github.copilot/extensions/omc/lib/hashline.mjs";
import { NUDGE, start } from "../plugin/com.github.copilot/extensions/omc/lib/main.mjs";

const DIFF3 = [
  "head",
  "<<<<<<< HEAD",
  "ours 1",
  "ours 2",
  "||||||| base-label",
  "base 1",
  "=======",
  "theirs 1",
  ">>>>>>> feature",
  "middle",
  "<<<<<<< HEAD",
  "second ours",
  "=======",
  "second theirs",
  ">>>>>>> feature",
  "tail",
  "",
].join("\n");

const lines = (src) => parseDocument(src).lines;
const ids = (src, path = "f.txt") => parseConflicts(lines(src)).hunks.map((h) => `${path}#${h.index}@${h.hash}`);
const resolve = (src, items) => resolveText(src, items.map((it, i) => ({ ...it, label: `resolutions[${i}]` })));

test("parse: diff3 and plain hunks with labels, sections, and line ranges", () => {
  const { hunks, problems } = parseConflicts(lines(DIFF3));
  assert.deepEqual(problems, []);
  assert.equal(hunks.length, 2);
  const [a, b] = hunks;
  assert.deepEqual([a.startLine, a.endLine, a.index], [2, 9, 1]);
  assert.deepEqual([a.oursLabel, a.baseLabel, a.theirsLabel], ["HEAD", "base-label", "feature"]);
  assert.deepEqual(a.ours, ["ours 1", "ours 2"]);
  assert.deepEqual(a.base, ["base 1"]);
  assert.deepEqual(a.theirs, ["theirs 1"]);
  assert.equal(b.base, null, "plain style has no base");
  assert.deepEqual([b.startLine, b.endLine], [11, 15]);
  assert.match(a.hash, /^[0-9a-z]{6}$/);
  assert.notEqual(a.hash, b.hash);
});

test("parse: longer nested-looking markers are content; unterminated hunks are problems", () => {
  const src = [
    "<<<<<<< HEAD",
    "<<<<<<<<< inner",
    "=========",
    ">>>>>>>>> inner",
    "=======",
    "x ======= y",
    ">>>>>>> other",
    "<<<<<<< dangling",
    "a",
  ].join("\n");
  const { hunks, problems } = parseConflicts(lines(src));
  assert.equal(hunks.length, 1);
  assert.deepEqual(hunks[0].ours, ["<<<<<<<<< inner", "=========", ">>>>>>>>> inner"]);
  assert.deepEqual(hunks[0].theirs, ["x ======= y"]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /line 8/);
});

test("parse: a custom marker size (conflict-marker-size) is honored", () => {
  const { hunks } = parseConflicts(lines("<<<<<<<<<< A\n=======\na\n==========\nb\n>>>>>>>>>> B\n"));
  assert.equal(hunks.length, 1);
  assert.deepEqual(hunks[0].ours, ["=======", "a"]);
  assert.deepEqual(hunks[0].theirs, ["b"]);
});

test("resolve: each resolution kind", () => {
  const [first, second] = ids(DIFF3);
  const cases = [
    ["ours", "ours 1\nours 2"],
    ["theirs", "theirs 1"],
    ["base", "base 1"],
    ["both-ours-first", "ours 1\nours 2\ntheirs 1"],
    ["both-theirs-first", "theirs 1\nours 1\nours 2"],
  ];
  for (const [resolution, expected] of cases) {
    const r = resolve(DIFF3, [{ id: first, resolution }]);
    assert.equal(r.applied, 1);
    assert.equal(r.remaining, 1);
    assert.ok(r.output.startsWith(`head\n${expected}\nmiddle\n<<<<<<< HEAD`), resolution);
  }
  const both = resolve(DIFF3, [
    { id: second, resolution: "custom", content: "merged\n" },
    { id: first, resolution: "custom", content: "" },
  ]);
  assert.equal(both.output, "head\nmiddle\nmerged\ntail\n");
  assert.equal(both.remaining, 0);
});

test("resolve: CRLF, BOM, and a missing final newline are preserved", () => {
  const src = "\ufeffa\r\n<<<<<<< ours\r\nx\r\n=======\r\ny\r\n>>>>>>> theirs\r\nz";
  const [id] = ids(src);
  assert.equal(resolve(src, [{ id, resolution: "theirs" }]).output, "\ufeffa\r\ny\r\nz");
  assert.equal(resolve(src, [{ id, resolution: "custom", content: "p\nq\n" }]).output, "\ufeffa\r\np\r\nq\r\nz");
});

test("resolve: ids survive resolving an earlier hunk; changed hunks are stale", () => {
  const [first, second] = ids(DIFF3);
  const step1 = resolve(DIFF3, [{ id: first, resolution: "ours" }]).output;
  const step2 = resolve(step1, [{ id: second, resolution: "theirs" }]);
  assert.equal(step2.output, "head\nours 1\nours 2\nmiddle\nsecond theirs\ntail\n");

  const edited = DIFF3.replace("second ours", "second ours (edited)");
  assert.throws(() => resolve(edited, [{ id: second, resolution: "ours" }]), /stale/);
  assert.throws(() => resolve(step2.output, [{ id: first, resolution: "ours" }]), /no conflicts left/);
});

test("resolve: atomic on errors (invalid resolution, missing base, missing content, duplicates)", () => {
  const [first, second] = ids(DIFF3);
  const bad = [
    [[{ id: first, resolution: "ours" }, { id: second, resolution: "mine" }], /unknown resolution "mine"/],
    [[{ id: first, resolution: "ours" }, { id: second, resolution: "base" }], /resolutions\[1\].*no base section/],
    [[{ id: first, resolution: "custom" }], /requires "content"/],
    [[{ id: first, resolution: "ours" }, { id: first, resolution: "theirs" }], /resolved twice/],
    [[{ id: "f.txt#1", resolution: "ours" }], /Malformed conflict id/],
  ];
  for (const [items, re] of bad) {
    assert.throws(() => resolve(DIFF3, items), (err) => err instanceof ConflictError && re.test(err.message));
  }
});

test("resolve: identical hunks are never matched at the wrong place after an earlier resolve", () => {
  const dup = "<<<<<<< HEAD\nsame ours\n=======\nsame theirs\n>>>>>>> feature";
  const src = `top\n<<<<<<< HEAD\na\n=======\nb\n>>>>>>> feature\nsep\n${dup}\nsep\n${dup}\nsep\n`;
  const [first, second, third] = ids(src);
  assert.notEqual(second.split("@")[1], third.split("@")[1], "duplicates get distinct ids");

  const fresh = resolve(src, [
    { id: second, resolution: "ours" },
    { id: third, resolution: "theirs" },
  ]);
  assert.match(fresh.output, /sep\nsame ours\nsep\nsame theirs\nsep/, "fresh duplicate ids resolve in place");

  const step1 = resolve(src, [{ id: first, resolution: "ours" }]).output;
  for (const id of [second, third]) {
    assert.throws(() => resolve(step1, [{ id, resolution: "theirs" }]), /stale|ambiguous/, id);
  }
  const [, relisted] = ids(step1);
  const step2 = resolve(step1, [{ id: relisted, resolution: "theirs" }]).output;
  assert.equal(step2, `top\na\nsep\n${dup}\nsep\nsame theirs\nsep\n`);
});

test("parse: a lone 8+ '<' content line does not hide later conflicts", () => {
  const src = "<<<<<<<<\nx\n<<<<<<< HEAD\no\n=======\nt\n>>>>>>> f\n<<<<<<< tail\n";
  const { hunks, problems } = parseConflicts(lines(src));
  assert.equal(hunks.length, 1);
  assert.deepEqual([hunks[0].startLine, hunks[0].ours, hunks[0].theirs], [3, ["o"], ["t"]]);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /line 1\b/);
  assert.match(problems[1], /line 8\b/);
});

test("resolve: a stale id never lands on an identical hunk whose neighbors changed (review repro)", () => {
  const hunk = (o, t) => ["<<<<<<< HEAD", o, "=======", t, ">>>>>>> feature"];
  const src = [
    "top",
    ...hunk("w", "w2"), // W, ends right where X starts
    ...hunk("p", "q"), // X
    "k",
    "mid",
    ...hunk("v", "v2"), // V, ends right where Z starts
    ...hunk("p", "q"), // Z, ends right where Y starts
    ...hunk("k", "y"), // Y
    "end",
    "",
  ].join("\n");
  const [w, x, , , y] = ids(src);
  const step1 = resolve(src, [
    { id: w, resolution: "ours" },
    { id: y, resolution: "ours" },
  ]).output;
  assert.throws(() => resolve(step1, [{ id: x, resolution: "theirs" }]), /stale|ambiguous/);
});

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("property: across random calls, every resolution lands on its listed hunk or is rejected", () => {
  const rand = rng(12345);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const variants = [["p", "q"], ["k", "y"], ["r", "s"]];
  let checked = 0;
  for (let trial = 0; trial < 400; trial++) {
    const segments = [];
    const nHunks = 2 + Math.floor(rand() * 5);
    for (let i = 0; i < nHunks; i++) {
      const gap = Math.floor(rand() * 3);
      for (let g = 0; g < gap; g++) segments.push(pick(["a", "k", "p"]));
      const [o, t] = pick(variants);
      segments.push({ ours: [o], theirs: [t], raw: ["<<<<<<< HEAD", o, "=======", t, ">>>>>>> feature"] });
    }
    segments.push("end");
    const originals = segments.filter((x) => typeof x === "object");
    const build = (done) =>
      segments.flatMap((x) => (typeof x === "string" ? [x] : done.has(x) ? done.get(x) : x.raw)).join("\n") + "\n";
    const src = build(new Map());
    const firstIds = ids(src);
    assert.equal(firstIds.length, originals.length);

    let current = src;
    const done = new Map();
    for (let call = 0; call < 4; call++) {
      const fresh = rand() < 0.3;
      const open = originals.filter((h) => !done.has(h));
      const freshIds = ids(current);
      const pool = fresh ? open : originals;
      if (pool.length === 0) break;
      const targets = [...new Set(Array.from({ length: 1 + Math.floor(rand() * 2) }, () => pick(pool)))];
      const items = targets.map((h) => ({
        id: fresh ? freshIds[open.indexOf(h)] : firstIds[originals.indexOf(h)],
        resolution: pick(["ours", "theirs"]),
      }));
      let r;
      try {
        r = resolve(current, items);
      } catch (err) {
        assert.ok(err instanceof ConflictError, err.message);
        continue;
      }
      targets.forEach((h, i) => {
        assert.ok(!done.has(h), `trial ${trial}: an already-resolved hunk's id was accepted`);
        done.set(h, h[items[i].resolution]);
      });
      assert.equal(r.output, build(done), `trial ${trial} call ${call}: a resolution landed on the wrong hunk`);
      current = r.output;
      checked++;
    }
  }
  assert.ok(checked > 200, `enough successful calls were exercised (${checked})`);
});

test("parse: many unclosed markers are linear and their problems are capped", () => {
  const many = Array.from({ length: 40_000 }, () => "<<<<<<< x");
  for (const tail of [[], [">>>>>>>"], ["=======", "|||||||"], ["<<<<<<<< HEAD", "o", "========", "t", ">>>>>>>> f"]]) {
    const t0 = performance.now();
    const { hunks, problems } = parseConflicts([...many, ...tail]);
    const ms = performance.now() - t0;
    assert.ok(ms < 1000, `${JSON.stringify(tail)} took ${ms.toFixed(0)}ms`);
    assert.equal(hunks.length, tail.length === 5 ? 1 : 0);
    assert.equal(problems.length, 21);
    assert.match(problems.at(-1), /and 39980 more/);
  }
});

test("parse+resolve: many identical hunks stay fast", () => {
  const src = "<<<<<<< HEAD\np\n=======\nq\n>>>>>>> feature\n".repeat(10_000);
  const t0 = performance.now();
  const first = ids(src);
  const r = resolve(src, first.map((id) => ({ id, resolution: "ours" })));
  const ms = performance.now() - t0;
  assert.equal(r.output, "p\n".repeat(10_000));
  assert.ok(ms < 1000, `took ${ms.toFixed(0)}ms`);
});

test("resolve: custom content with conflict markers is rejected (cannot recreate a hunk)", () => {
  const src = "a\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> feature\nb\n";
  const [id] = ids(src);
  for (const content of [
    "<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> feature",
    "z\n=======\n",
    ">>>>>>>>",
    "<<<<<<<",
  ]) {
    assert.throws(() => resolve(src, [{ id, resolution: "custom", content }]), /looks like a conflict marker/);
  }
  assert.equal(resolve(src, [{ id, resolution: "custom", content: "<<<<<< six\n=== x\n" }]).output, "a\n<<<<<< six\n=== x\nb\n");
});

test("parseConflictId accepts a conflict:// prefix and paths containing #", () => {
  assert.deepEqual(parseConflictId("conflict://src/a#b.js#2@AB12"), { path: "src/a#b.js", index: 2, hash: "ab12" });
});

// ---- fake-session integration ------------------------------------------------

let root;
let repo;
const savedHome = process.env.COPILOT_HOME;

const git = (...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "init.defaultBranch=main", ...args], {
    cwd: repo,
    stdio: ["ignore", "pipe", "pipe"],
  }).toString();

before(() => {
  root = mkdtempSync(join(tmpdir(), "omc-conflicts-"));
  repo = join(root, "repo");
  mkdirSync(join(root, "home"), { recursive: true });
  mkdirSync(repo, { recursive: true });
  process.env.COPILOT_HOME = join(root, "home");
  git("init", "-q");
  git("config", "merge.conflictStyle", "diff3");
  writeFileSync(join(repo, "app.txt"), "a\ncolor = red\nb\nsize = 1\nc\n");
  writeFileSync(join(repo, "outside-ok.txt"), "x\n");
  git("add", ".");
  git("commit", "-qm", "base");
  git("checkout", "-qb", "feature");
  writeFileSync(join(repo, "app.txt"), "a\ncolor = blue\nb\nsize = 2\nc\n");
  git("commit", "-qam", "feature");
  git("checkout", "-q", "main");
  writeFileSync(join(repo, "app.txt"), "a\ncolor = green\nb\nsize = 3\nc\n");
  git("commit", "-qam", "main");
  try {
    git("merge", "-q", "feature");
  } catch {
    // The conflict is the point.
  }
});

after(() => {
  if (savedHome === undefined) delete process.env.COPILOT_HOME;
  else process.env.COPILOT_HOME = savedHome;
  rmSync(root, { recursive: true, force: true });
});

async function boot() {
  const logs = [];
  let config;
  await start(async (c) => {
    config = c;
    return { log: async (message, opts) => logs.push({ message, level: opts?.level }), setTools: async () => {} };
  });
  await config.hooks.onPreToolUse({ toolName: "view", toolArgs: {}, workingDirectory: repo });
  const tool = (name) => config.tools.find((t) => t.name === name);
  const prompt = async (sessionId = "s1", workingDirectory = repo) =>
    (await config.hooks.onUserPromptSubmitted({ prompt: "merge", workingDirectory }, { sessionId }))
      ?.additionalContext;
  return { config, logs, tool, prompt, command: (args) => config.commands.find((c) => c.name === "omc").handler({ args }) };
}

test("hint: during a merge the prompt context points at the conflict tools, once per file set", async () => {
  const h = await boot();
  const first = await h.prompt();
  assert.ok(first.startsWith(NUDGE), "the anchored nudge still comes first");
  assert.match(first, /unresolved merge conflicts in: app\.txt\. To resolve them, call `list_conflicts`/);
  assert.match(first, /not available or report that they are turned off/);
  assert.equal(await h.prompt(), undefined, "not repeated");

  // No merge in progress: no hint, even though the index still has unmerged entries.
  const mergeHead = join(repo, ".git", "MERGE_HEAD");
  renameSync(mergeHead, `${mergeHead}.bak`);
  try {
    assert.match(git("ls-files", "-u"), /app\.txt/);
    assert.equal(await h.prompt(), undefined);
  } finally {
    renameSync(`${mergeHead}.bak`, mergeHead);
  }
  assert.match(await h.prompt(), /conflicts in: app\.txt/, "a later merge with the same files hints again");

  // Linked worktree: the merge state lives in .git/worktrees/<name>.
  const wt = join(root, "wt");
  git("worktree", "add", "-q", "-b", "wt-branch", wt, "HEAD");
  try {
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "merge", "-q", "feature"], { cwd: wt, stdio: "ignore" });
  } catch {
    // Expected conflict.
  }
  assert.match(await h.prompt("wt-session", wt), /conflicts in: app\.txt/);

  for (const off of ["off conflicts", "off nudge", "off"]) {
    const o = await boot();
    await o.command(off);
    assert.doesNotMatch((await o.prompt()) ?? "", /list_conflicts/, off);
  }
});

test("tools: list_conflicts finds the unmerged file via git; resolve_conflicts writes and reports", async () => {
  const h = await boot();
  assert.deepEqual(
    h.config.tools.filter((t) => t.name.endsWith("_conflicts")).map((t) => [t.name, t.defer]),
    [["list_conflicts", "never"], ["resolve_conflicts", "never"]],
  );
  const listing = await h.tool("list_conflicts").handler({}, {});
  assert.equal(typeof listing, "string", JSON.stringify(listing));
  assert.match(listing, /^2 conflict\(s\) in 1 file\(s\)/);
  assert.match(listing, /--- ours \(HEAD\): 1 line\(s\) ---\ncolor = green\n--- base \(\w+\): 1 line\(s\) ---\ncolor = red\n/);
  assert.match(listing, /--- theirs \(feature\): 1 line\(s\) ---\ncolor = blue\n--- end ---\n  9\| b\n###/);
  const [id, id2] = [...listing.matchAll(/^### (app\.txt#\d@\w{6}) \(lines \d+-\d+\)$/gm)].map((m) => m[1]);

  const r = await h.tool("resolve_conflicts").handler({ resolutions: [{ id, resolution: "theirs" }] }, {});
  assert.equal(typeof r, "string", JSON.stringify(r));
  assert.match(r, /app\.txt: resolved 1 conflict\(s\), 1 remaining/);
  assert.doesNotMatch(r, /git add/);
  const r2 = await h.tool("resolve_conflicts").handler({ resolutions: [{ id: id2, resolution: "base" }] }, {});
  assert.match(r2, /app\.txt: resolved 1 conflict\(s\), 0 remaining/);
  assert.match(r2, /git add -- app\.txt/);
  assert.equal(readFileSync(join(repo, "app.txt"), "utf8"), "a\ncolor = blue\nb\nsize = 1\nc\n");
  assert.match(git("status", "--porcelain"), /^UU app\.txt/m, "not staged by default");

  const stale = await h.tool("resolve_conflicts").handler({ resolutions: [{ id, resolution: "ours" }], stage: true }, {});
  assert.equal(stale.resultType, "failure");
  assert.match(stale.textResultForLlm, /no conflicts left/);

  assert.match(await h.tool("list_conflicts").handler({}, {}), /No conflicts found[\s\S]*no conflict markers/);
});

test("tools: stage: true runs git add; outside paths and bad input are refused", async () => {
  writeFileSync(join(repo, "app.txt"), "a\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> feature\nc\n");
  const h = await boot();
  const listing = await h.tool("list_conflicts").handler({ path: "app.txt" }, {});
  const id = /^### (\S+)/m.exec(listing)[1];
  const r = await h.tool("resolve_conflicts").handler({ resolutions: [{ id, resolution: "both-ours-first" }], stage: true }, {});
  assert.match(r, /Staged with git add: app\.txt/);
  assert.equal(readFileSync(join(repo, "app.txt"), "utf8"), "a\nx\ny\nc\n");
  assert.doesNotMatch(git("status", "--porcelain"), /^UU/m);

  for (const [name, args, re] of [
    ["list_conflicts", { path: "../elsewhere.txt" }, /outside the project root/],
    ["list_conflicts", { path: "/etc/hostname" }, /outside the project root/],
    ["resolve_conflicts", { resolutions: [{ id: "../x.txt#1@abcd", resolution: "ours" }] }, /outside the project root/],
    ["resolve_conflicts", { resolutions: [] }, /non-empty array/],
    ["resolve_conflicts", { resolutions: [{ id: "app.txt#1@abcd", resolution: "nope" }] }, /unknown resolution/],
    ["list_conflicts", { path: "missing.txt" }, /File not found/],
  ]) {
    const res = await h.tool(name).handler(args, {});
    assert.equal(res.resultType, "failure", `${name} ${JSON.stringify(args)}`);
    assert.match(res.textResultForLlm, re);
  }
});

test("tools: list_conflicts caps notes for files with many unclosed markers", async () => {
  const file = join(repo, "many.txt");
  writeFileSync(file, "<<<<<<< x\n".repeat(500));
  try {
    const h = await boot();
    const out = await h.tool("list_conflicts").handler({ path: "many.txt" }, {});
    assert.equal((out.match(/Unterminated/g) ?? []).length, 20);
    assert.match(out, /and 480 more/);
  } finally {
    rmSync(file);
  }
});

test("tools: refuse while conflicts is off; not listed when off at join", async () => {
  const h = await boot();
  await h.command("off conflicts");
  const refused = await h.tool("list_conflicts").handler({}, {});
  assert.equal(refused.resultType, "failure");
  assert.match(refused.textResultForLlm, /conflict tools are turned off/);
  await h.command("on conflicts");
  assert.equal(typeof (await h.tool("list_conflicts").handler({}, {})), "string");

  const saved = process.env.OMC_DISABLE_FEATURES;
  process.env.OMC_DISABLE_FEATURES = "conflicts";
  try {
    const off = await boot();
    assert.deepEqual(off.config.tools.map((t) => t.name), ["read_anchored", "edit_anchored"]);
  } finally {
    if (saved === undefined) delete process.env.OMC_DISABLE_FEATURES;
    else process.env.OMC_DISABLE_FEATURES = saved;
  }
});

test("tools: internal errors fail open and trip only the conflicts breaker", async () => {
  const h = await boot();
  const boom = {
    get resolutions() {
      throw new Error("boom");
    },
  };
  for (let i = 0; i < 3; i++) {
    const r = await h.tool("resolve_conflicts").handler(boom, {});
    assert.match(r.textResultForLlm, /internal error/);
  }
  assert.ok(h.logs.some((l) => /"conflicts" is off/.test(l.message)));
  assert.equal(typeof (await h.tool("read_anchored").handler({ path: join(repo, "app.txt") }, {})), "string");
});
