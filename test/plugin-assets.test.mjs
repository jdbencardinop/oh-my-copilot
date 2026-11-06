import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildPatch, parseDiff } from "../plugin/skills/commit/scripts/hunks.mjs";

const plugin = fileURLToPath(new URL("../plugin/", import.meta.url));
const hunksScript = join(plugin, "skills/commit/scripts/hunks.mjs");

// Minimal frontmatter reader: `key: value` and `key: ["a", "b"]` lines between `---` fences.
function frontmatter(path) {
  const text = readFileSync(path, "utf8");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(m, `${path} has no frontmatter`);
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-z-]+):\s*(.*)$/.exec(line);
    assert.ok(kv, `${path}: unexpected frontmatter line ${JSON.stringify(line)}`);
    data[kv[1]] = kv[2].startsWith("[") ? JSON.parse(kv[2]) : kv[2];
  }
  return { data, body: m[2] };
}

test("every plugin skill has a valid SKILL.md whose name matches its folder", () => {
  const skills = readdirSync(join(plugin, "skills"));
  assert.ok(skills.includes("commit"));
  for (const dir of skills) {
    const { data, body } = frontmatter(join(plugin, "skills", dir, "SKILL.md"));
    assert.equal(data.name, dir);
    assert.match(data.name, /^[a-z0-9-]{1,64}$/);
    assert.ok(data.description?.length > 20 && data.description.length <= 1024);
    assert.doesNotMatch(data.description, /: |^["'\[{]/, "description must be a plain YAML scalar");
    assert.ok(body.trim().length > 0);
  }
});

test("the commit skill references its helper and forbids history rewrites and pushes", () => {
  const { body } = frontmatter(join(plugin, "skills/commit/SKILL.md"));
  for (const ref of body.match(/scripts\/[\w.-]+/g)) assert.ok(existsSync(join(plugin, "skills/commit", ref)), ref);
  execFileSync(process.execPath, ["--check", hunksScript]);
  assert.match(body, /Never push/);
  assert.match(body, /Never commit secrets/);
  assert.match(body, /rewrite existing history/);
  assert.match(body, /verify <tree-id>/);
});

test("every plugin agent has valid frontmatter; the reviewer is read-only with a P0-P3 rubric and verdict", () => {
  const dir = join(plugin, "com.github.copilot/agents");
  const files = readdirSync(dir);
  assert.ok(files.includes("reviewer.agent.md"));
  for (const file of files) {
    assert.match(file, /\.agent\.md$/);
    const { data } = frontmatter(join(dir, file));
    assert.equal(`${data.name}.agent.md`, file);
    assert.ok(data.description?.length > 20);
  }
  const { data, body } = frontmatter(join(dir, "reviewer.agent.md"));
  assert.deepEqual(data.tools, ["read", "search", "execute"]);
  for (const level of ["P0", "P1", "P2", "P3"]) assert.match(body, new RegExp(`\\*\\*${level}\\*\\*`));
  for (const verdict of ["SHIP", "SHIP WITH FIXES", "DO NOT SHIP"]) assert.match(body, new RegExp(`^VERDICT: ${verdict}$`, "m"));
  assert.match(body, /Never edit, create, or delete files/);
});

test("buildPatch shifts new-side starts when earlier hunks are skipped", () => {
  const diff = [
    "diff --git a/a.txt b/a.txt",
    "index 1..2 100644",
    "--- a/a.txt",
    "+++ b/a.txt",
    "@@ -1,2 +1,4 @@",
    " a",
    "+x",
    "+y",
    " b",
    "@@ -10,3 +12,2 @@ ctx",
    " j",
    "-k",
    " l",
  ].join("\n");
  const [file] = parseDiff(diff);
  assert.equal(file.path, "a.txt");
  assert.equal(file.hunks.length, 2);
  const patch = buildPatch(file, new Set([file.hunks[1]]));
  assert.match(patch, /^@@ -10,3 \+10,2 @@ ctx$/m);
  assert.doesNotMatch(patch, /\+x/);
});

test("hunks.mjs stages chosen hunks, keeps ids stable, and verify detects loss", () => {
  const repo = mkdtempSync(join(tmpdir(), "omc-hunks-"));
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...args) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
  const run = (...args) => execFileSync(process.execPath, [hunksScript, ...args], { cwd: repo, env, encoding: "utf8" });
  try {
    git("init", "-q");
    const lines = Array.from({ length: 40 }, (_, i) => String(i + 1));
    writeFileSync(join(repo, "a.txt"), lines.join("\n") + "\n");
    writeFileSync(join(repo, "gone.txt"), "bye\n");
    git("add", "-A");
    git("commit", "-qm", "init");

    const edited = [...lines];
    edited[2] = "three";
    edited.splice(15, 0, "x1", "x2", "x3");
    edited.splice(edited.indexOf("35"), 1, "thirty-five");
    writeFileSync(join(repo, "a.txt"), edited.join("\n") + "\n");
    unlinkSync(join(repo, "gone.txt"));
    writeFileSync(join(repo, "new.txt"), "new\n");
    const snap = run("snapshot").trim();

    const items = JSON.parse(run("list", "--json"));
    const hunks = items.filter((e) => e.kind === "hunk");
    assert.equal(hunks.length, 3);
    assert.deepEqual(items.filter((e) => e.kind !== "hunk").map((e) => [e.kind, e.path]).sort(), [["file", "gone.txt"], ["untracked", "new.txt"]]);

    run("stage", hunks[0].id, hunks[2].id);
    const cached = git("diff", "--cached");
    assert.match(cached, /\+three/);
    assert.match(cached, /\+thirty-five/);
    assert.doesNotMatch(cached, /\+x1/);
    git("commit", "-qm", "part 1");

    const after = JSON.parse(run("list", "--json")).map((e) => e.id).sort();
    assert.deepEqual(after, items.filter((e) => e !== hunks[0] && e !== hunks[2]).map((e) => e.id).sort());
    assert.throws(() => run("stage", hunks[0].id), /unknown id/);

    run("stage", ...after);
    git("commit", "-qm", "part 2");
    assert.equal(git("status", "--porcelain"), "");
    assert.match(run("verify", snap), /^OK: .*\nEverything is committed/);

    writeFileSync(join(repo, "a.txt"), "clobbered\n");
    assert.throws(() => run("verify", snap), (err) => /FAIL/.test(err.stdout));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

function withRepo(fn, config = {}) {
  const repo = mkdtempSync(join(tmpdir(), "omc-hunks-"));
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...args) => execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
  const run = (...args) => execFileSync(process.execPath, [hunksScript, ...args], { cwd: repo, env, encoding: "utf8" });
  const write = (path, text) => {
    mkdirSync(join(repo, path, ".."), { recursive: true });
    writeFileSync(join(repo, path), text);
  };
  const list = () => JSON.parse(run("list", "--json"));
  const staged = () => git("diff", "--cached", "--name-only").split("\n").filter(Boolean).sort();
  try {
    git("init", "-q");
    for (const [k, v] of Object.entries(config)) git("config", k, v);
    fn({ repo, git, run, write, list, staged });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

test("hunks.mjs treats paths literally, never as globs", () =>
  withRepo(({ git, run, write, list, staged }) => {
    write("app/s/page.tsx", "old\n");
    write("a.txt", "a\n");
    git("add", "-A");
    git("commit", "-qm", "init");
    write("app/s/page.tsx", "new\n");
    write("a.txt", "a2\n");
    write("app/[slug]/page.tsx", "slug\n");
    write("[ab].txt", "ab\n");
    write("*.md", "star\n");
    const items = list();
    const ids = items.filter((e) => e.kind === "untracked").map((e) => e.id);
    assert.equal(ids.length, 3);
    run("stage", ...ids);
    assert.deepEqual(staged(), ["*.md", "[ab].txt", "app/[slug]/page.tsx"]);
  }));

for (const [key, value] of [["diff.noprefix", "true"], ["diff.mnemonicPrefix", "true"], ["color.ui", "always"], ["diff.suppressBlankEmpty", "true"], ["diff.relative", "true"]]) {
  test(`hunks.mjs ignores user diff config ${key}=${value}`, () =>
    withRepo(({ git, run, write, list }) => {
      write("f.txt", Array.from({ length: 30 }, (_, i) => (i === 3 ? "" : `l${i}`)).join("\n") + "\n");
      git("add", "-A");
      git("commit", "-qm", "init");
      const edited = readFileSync(join(git("rev-parse", "--show-toplevel").trim(), "f.txt"), "utf8").split("\n");
      edited[1] = "first";
      edited[25] = "second";
      write("f.txt", edited.join("\n"));
      const hunks = list();
      assert.deepEqual(hunks.map((e) => [e.kind, e.path]), [["hunk", "f.txt"], ["hunk", "f.txt"]]);
      run("stage", hunks[0].id);
      const cached = git("diff", "--cached", "--no-color", "--src-prefix=a/", "--dst-prefix=b/");
      assert.match(cached, /\+first/);
      assert.doesNotMatch(cached, /\+second/);
    }, { [key]: value }));
}

test("hunks.mjs gives identical hunks distinct ids and stages the one chosen", () =>
  withRepo(({ git, run, write, list }) => {
    const block = ["a", "b", "c", "OLD", "d", "e", "f"];
    const lines = [...block, ...Array.from({ length: 10 }, (_, i) => `gap${i}`), ...block];
    write("dup.txt", lines.join("\n") + "\n");
    git("add", "-A");
    git("commit", "-qm", "init");
    write("dup.txt", lines.map((l) => (l === "OLD" ? "NEW" : l)).join("\n") + "\n");
    const ids = list().map((e) => e.id);
    assert.equal(ids.length, 2);
    assert.equal(ids[1], `${ids[0]}-2`);
    run("stage", ids[1]);
    const index = git("show", ":dup.txt").split("\n");
    assert.equal(index[3], "OLD");
    assert.equal(index[20], "NEW");
    assert.deepEqual(list().map((e) => e.id), [ids[0]]);
    assert.throws(() => run("stage", ids[0], ids[0]), /duplicate id/);
  }));

test("hunks.mjs snapshot and verify work before the first commit", () =>
  withRepo(({ git, run, write }) => {
    write("a.txt", "a\n");
    write("dir/b.txt", "b\n");
    const snap = run("snapshot").trim();
    assert.match(run("verify", snap), /^OK: [\s\S]*Still uncommitted[\s\S]*a\.txt/);
    git("add", "-A");
    git("commit", "-qm", "first");
    assert.match(run("verify", snap), /Everything is committed/);
  }));

test("hunks.mjs stages binary changes as whole files", () =>
  withRepo(({ git, run, write, list, staged }) => {
    write("img.bin", Buffer.from([0, 1, 2, 3, 0, 255]));
    write("t.txt", "x\n");
    git("add", "-A");
    git("commit", "-qm", "init");
    write("img.bin", Buffer.from([0, 9, 9, 9, 0, 254, 7]));
    write("t.txt", "y\n");
    const items = list();
    const bin = items.find((e) => e.path === "img.bin");
    assert.equal(bin.kind, "file");
    assert.equal(bin.summary, "GIT binary patch");
    run("stage", bin.id);
    assert.deepEqual(staged(), ["img.bin"]);
    assert.deepEqual(list().map((e) => e.path), ["t.txt"]);
  }));

test("hunks.mjs stage is all or nothing", () =>
  withRepo(({ git, run, write, list, staged }) => {
    // A required clean filter that passes the dry run, then fails, makes the real `git add`
    // fail after the hunk was already applied to the index.
    git("config", "filter.broken.clean", "sh -c 'if [ -e .git/omc-seen ]; then exit 1; fi; touch .git/omc-seen; cat'");
    git("config", "filter.broken.required", "true");
    write(".gitattributes", "locked.txt filter=broken\n");
    write("t.txt", "x\n");
    git("add", "-A");
    git("commit", "-qm", "init");
    write("t.txt", "y\n");
    write("locked.txt", "data\n");
    const ids = list().map((e) => e.id);
    assert.equal(ids.length, 2);
    assert.throws(() => run("stage", ...ids), /broken|clean filter|locked\.txt/);
    assert.deepEqual(staged(), []);
  }));

test("the marketplace manifest points at the plugin and matches its manifest", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const market = JSON.parse(readFileSync(join(root, ".github/plugin/marketplace.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(plugin, "plugin.json"), "utf8"));
  assert.equal(market.name, "oh-my-copilot");
  assert.equal(market.plugins.length, 1);
  const [entry] = market.plugins;
  assert.equal(entry.name, manifest.name);
  assert.equal(entry.version, manifest.version);
  assert.equal(entry.description, manifest.description);
  assert.equal(market.metadata.version, manifest.version);
  assert.equal(typeof entry.source, "string");
  assert.ok(existsSync(join(root, entry.source, "plugin.json")), `${entry.source}/plugin.json is missing`);
});
