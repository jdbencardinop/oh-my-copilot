import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  LIMITS,
  loadImportedRules,
  parseFrontmatter,
  parseMdc,
  parsePlainRule,
  parseWindsurf,
  renderAlways,
  renderGlobRule,
} from "../plugin/com.github.copilot/extensions/omc/lib/imports.mjs";
import { importPathEnabled } from "../plugin/com.github.copilot/extensions/omc/lib/config.mjs";

test("parseWindsurf preserves activation modes instead of promoting manual rules", () => {
  const parse = (front) => parseWindsurf(`---\n${front}\n---\nUse typed APIs.`, ".windsurf/rules/api.md");
  assert.equal(parse("trigger: always_on\nglobs: *.ts").rule.kind, "always");
  const glob = parse("trigger: glob\nglobs: src/**/*.ts").rule;
  assert.equal(glob.kind, "glob");
  assert.ok(glob.match("src/a.ts"));
  assert.ok(!glob.match("src/a.js"));
  assert.equal(parse("trigger: model_decision\ndescription: API design").rule.kind, "requested");
  assert.equal(parse("trigger: agent\ndescription: API design").rule.kind, "requested");
  assert.equal(parse("trigger: manual\ndescription: API design\nglobs: *.ts").rule.kind, "manual");
  assert.equal(parseWindsurf("Plain text", "api.md").rule.kind, "manual");
  assert.match(parse("trigger: glob").error, /needs globs/);
  assert.match(parse("trigger: model_decision").error, /needs a description/);
  assert.match(parse("trigger: surprising").error, /unsupported.*trigger/);
});

test("Windsurf discovery and path selection exclude disabled contents before parsing", () => {
  const root = mkdtempSync(join(tmpdir(), "omc-windsurf-"));
  try {
    mkdirSync(join(root, ".windsurf", "rules", "nested"), { recursive: true });
    writeFileSync(join(root, ".windsurf", "rules", "style.md"), "---\ntrigger: always_on\n---\nWindsurf style");
    writeFileSync(join(root, ".windsurf", "rules", "nested", "ts.md"), "---\ntrigger: glob\nglobs: *.ts\n---\nTS style");
    writeFileSync(join(root, ".windsurf", "rules", "broken.md"), "---\ntrigger: always_on");
    writeFileSync(join(root, ".windsurf", "global_rules.md"), "Global project style");
    writeFileSync(join(root, ".windsurfrules"), "Legacy style");
    writeFileSync(join(root, ".cursorrules"), "---\nbroken");
    const all = loadImportedRules(root);
    assert.equal(all.rules.length, 4);
    assert.equal(all.errors.length, 2);
    const selected = loadImportedRules(root, {
      enabled: (path) => importPathEnabled(path, false, {
        ".windsurf/rules": true, ".windsurf/rules/broken.md": false,
      }),
    });
    assert.deepEqual(selected.rules.map((r) => r.kind), ["glob", "always"]);
    assert.deepEqual(selected.errors, [], "disabled files were not read or parsed");
    symlinkSync(join(root, ".windsurfrules"), join(root, ".windsurf", "rules", "link.md"));
    assert.ok(loadImportedRules(root).errors.some((e) => /link.md: symlink/.test(e)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("parseFrontmatter: scalars, quotes, booleans, flow and block lists, comments", () => {
  const { data, body } = parseFrontmatter(
    '---\ndescription: "Use: tabs"\nglobs: *.ts, src/**/*.{js,jsx}\nalwaysApply: false\ntags: [a, "b"]\npaths:\n  - "src/**"\n  - lib/** # comment\n---\nBody\n',
  );
  assert.deepEqual(data, {
    description: "Use: tabs",
    globs: "*.ts, src/**/*.{js,jsx}",
    alwaysApply: false,
    tags: ["a", "b"],
    paths: ["src/**", "lib/**"],
  });
  assert.equal(body, "Body\n");
  assert.deepEqual(parseFrontmatter("no frontmatter"), { data: {}, body: "no frontmatter" });
  assert.match(parseFrontmatter("---\nkey: v\nbody without end").error, /no closing/);
  assert.equal(parseFrontmatter("\uFEFF---\na: 1\n---\nx").body, "x", "BOM is ignored");
  assert.equal(parseFrontmatter("---\r\na: 1\r\n---\r\nx").data.a, "1", "CRLF");
});

test("parseMdc maps Cursor rule types", () => {
  const always = parseMdc("---\nalwaysApply: true\nglobs: *.ts\n---\nAlways rule", "a.mdc").rule;
  assert.equal(always.kind, "always", "alwaysApply wins over globs");
  const glob = parseMdc("---\ndescription: TS\nglobs: src/**/*.ts, !**/*.test.ts\nalwaysApply: false\n---\nTS rule", "g.mdc").rule;
  assert.equal(glob.kind, "glob");
  assert.deepEqual(glob.globs, ["src/**/*.ts", "!**/*.test.ts"]);
  assert.ok(glob.match("src/a.ts"));
  assert.ok(!glob.match("src/a.test.ts"));
  const listed = parseMdc('---\nglobs: ["*.{ts,tsx}", "*.md"]\n---\nx', "l.mdc").rule;
  assert.deepEqual(listed.globs, ["*.{ts,tsx}", "*.md"]);
  assert.equal(parseMdc("---\ndescription: DB migrations\nglobs:\nalwaysApply: false\n---\nx", "r.mdc").rule.kind, "requested");
  assert.equal(parseMdc("---\nalwaysApply: false\n---\nx", "m.mdc").rule.kind, "manual");
  assert.equal(parseMdc("No frontmatter at all", "n.mdc").rule.kind, "manual");
  assert.match(parseMdc("---\nalwaysApply: true\n---\n   \n", "e.mdc").error, /empty/);
  assert.match(parseMdc("---\nalwaysApply: true\nbody", "u.mdc").error, /no closing/);
  assert.match(parseMdc("---\nglobs: {a,b}{c,d}{e,f}{g,h}{i,j}{k,l}{m,n}{o,p}{q,r}\n---\nx", "b.mdc").error, /invalid globs/);
});

test("parsePlainRule: Cline files are always-on unless paths frontmatter scopes them", () => {
  const plain = parsePlainRule("# Style\nUse tabs.", ".clinerules", "cline").rule;
  assert.equal(plain.kind, "always");
  assert.equal(plain.body, "# Style\nUse tabs.");
  const scoped = parsePlainRule("---\npaths:\n  - src/**/*.py\n---\nPEP 8", ".clinerules/py.md", "cline").rule;
  assert.equal(scoped.kind, "glob");
  assert.ok(scoped.match("src/x/a.py"));
});

test("loadImportedRules reads .cursor/rules (nested), .cursorrules, and a .clinerules directory", () => {
  const root = mkdtempSync(join(tmpdir(), "omc-imports-"));
  try {
    assert.deepEqual(loadImportedRules(root), { rules: [], errors: [], sources: [], key: "" });
    mkdirSync(join(root, ".cursor", "rules", "nested"), { recursive: true });
    writeFileSync(join(root, ".cursor", "rules", "always.mdc"), "---\nalwaysApply: true\n---\nAlways A");
    writeFileSync(join(root, ".cursor", "rules", "nested", "ts.mdc"), "---\nglobs: *.ts\n---\nTS B");
    writeFileSync(join(root, ".cursor", "rules", "broken.mdc"), "---\nalwaysApply: true\n");
    writeFileSync(join(root, ".cursor", "rules", "notes.txt"), "ignored");
    writeFileSync(join(root, ".cursor", "rules", "bin.mdc"), Buffer.from([0, 1, 2]));
    writeFileSync(join(root, ".cursorrules"), "Legacy C");
    mkdirSync(join(root, ".clinerules", "sub"), { recursive: true });
    writeFileSync(join(root, ".clinerules", "01-style.md"), "Cline D");
    writeFileSync(join(root, ".clinerules", "sub", "deep.md"), "not read: Cline reads the top level only");
    const r = loadImportedRules(root);
    assert.deepEqual(
      r.rules.map((x) => [x.file, x.kind, x.origin]),
      [
        [".cursor/rules/always.mdc", "always", "cursor"],
        [".cursor/rules/nested/ts.mdc", "glob", "cursor"],
        [".cursorrules", "always", "cursor"],
        [".clinerules/01-style.md", "always", "cline"],
      ],
    );
    assert.equal(r.errors.length, 2);
    assert.ok(r.errors.some((e) => /broken\.mdc.*no closing/.test(e)));
    assert.ok(r.errors.some((e) => /bin\.mdc.*binary/.test(e)));
    assert.deepEqual(r.sources, [".cursor/rules (4)", ".cursorrules", ".clinerules/ (1)"]);
    assert.ok(r.key.includes(".cursorrules:"));

    rmSync(join(root, ".clinerules"), { recursive: true });
    writeFileSync(join(root, ".clinerules"), "Single file E");
    writeFileSync(join(root, ".cursorrules"), "x".repeat(LIMITS.fileBytes + 1));
    const r2 = loadImportedRules(root);
    assert.ok(r2.rules.some((x) => x.file === ".clinerules" && x.body === "Single file E"));
    assert.ok(r2.errors.some((e) => /\.cursorrules: larger than/.test(e)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const rule = (file, kind, body, extra = {}) => ({ file, kind, body, description: "", globs: [], ...extra });

test("renderAlways: always rules, then an index of on-request rules, within the cap", () => {
  assert.deepEqual(renderAlways([]), { text: "", truncated: [], omitted: [] });
  assert.deepEqual(renderAlways([rule("m.mdc", "manual", "x"), rule("g.mdc", "glob", "y")]).text, "");
  const r = renderAlways([
    rule("a.mdc", "always", "Use tabs."),
    rule("db.mdc", "requested", "Long db rule", { description: "Database\nmigrations" }),
  ]);
  assert.match(r.text, /^oh-my-copilot imported these project rules/);
  assert.match(r.text, /<rule source="a\.mdc">\nUse tabs\.\n<\/rule>/);
  assert.match(r.text, /- db\.mdc: Database migrations/);
  assert.doesNotMatch(r.text, /Long db rule/);
  const onlyIndex = renderAlways([rule("db.mdc", "requested", "x", { description: "DB" })]);
  assert.doesNotMatch(onlyIndex.text, /imported these/);
  assert.match(onlyIndex.text, /apply only when relevant/);
});

test("renderAlways truncates or leaves out rules over the cap and says where to read them", () => {
  const big = rule("big.mdc", "always", "B".repeat(5000));
  const next = rule("next.mdc", "always", "N".repeat(100));
  const r = renderAlways([big, next], 2000);
  assert.ok(r.text.length <= 2000, `length ${r.text.length}`);
  assert.deepEqual(r.truncated, ["big.mdc"]);
  assert.deepEqual(r.omitted, ["next.mdc"]);
  assert.match(r.text, /truncated by oh-my-copilot; read big\.mdc/);
  assert.match(r.text, /did not fit.*next\.mdc/);
});

test("renderGlobRule names the globs and respects its cap", () => {
  const g = rule("ts.mdc", "glob", "Prefer type over interface.", { globs: ["*.ts"] });
  const r = renderGlobRule(g);
  assert.equal(r.truncated, false);
  assert.match(r.text, /files matching \*\.ts \(from ts\.mdc\)/);
  assert.match(r.text, /Prefer type over interface/);
  const long = renderGlobRule({ ...g, body: "x".repeat(10_000) }, 1000);
  assert.ok(long.truncated && long.text.length <= 1000);
  const pointer = renderGlobRule(g, 120);
  assert.ok(pointer.truncated && pointer.text.length <= 120);
  assert.match(pointer.text, /read it/);
  assert.deepEqual(renderGlobRule(g, 50), { text: "", truncated: true }, "nothing when even a pointer does not fit");
});

test("renderAlways caps the on-request index at half the budget", () => {
  const many = Array.from({ length: 100 }, (_, i) => rule(`r${i}.mdc`, "requested", "x", { description: "d".repeat(150) }));
  const r = renderAlways(many, 4000);
  assert.ok(r.text.length <= 2100, `length ${r.text.length}`);
  assert.match(r.text, /and \d+ more; list them with glob/);
  assert.ok(r.omitted.length > 80);
});

test("loadImportedRules never follows symlinks or leaves the project root", () => {
  const base = mkdtempSync(join(tmpdir(), "omc-imports-link-"));
  try {
    const root = join(base, "repo");
    const outside = join(base, "outside");
    mkdirSync(join(outside, "rules"), { recursive: true });
    writeFileSync(join(outside, "secret"), "aws_secret_access_key=SECRET");
    writeFileSync(join(outside, "rules", "x.mdc"), "---\nalwaysApply: true\n---\nSECRET");
    mkdirSync(join(root, ".cursor", "rules"), { recursive: true });
    mkdirSync(join(root, ".clinerules"), { recursive: true });
    symlinkSync(join(outside, "secret"), join(root, ".cursorrules"));
    symlinkSync(join(outside, "secret"), join(root, ".cursor", "rules", "link.mdc"));
    symlinkSync(join(outside, "rules"), join(root, ".cursor", "rules", "linkdir"));
    symlinkSync(join(outside, "secret"), join(root, ".clinerules", "link.md"));
    writeFileSync(join(root, ".clinerules", "ok.md"), "OK");
    const r = loadImportedRules(root);
    assert.deepEqual(r.rules.map((x) => x.file), [".clinerules/ok.md"]);
    assert.ok(!JSON.stringify(r.rules).includes("SECRET"));
    for (const f of [".cursorrules", ".cursor/rules/link.mdc", ".cursor/rules/linkdir", ".clinerules/link.md"])
      assert.ok(r.errors.some((e) => e.startsWith(`${f}: symlink`)), f);

    // Symlinked rule directories themselves, and parents that resolve outside.
    rmSync(join(root, ".clinerules"), { recursive: true });
    symlinkSync(outside, join(root, ".clinerules"));
    rmSync(join(root, ".cursor"), { recursive: true });
    symlinkSync(outside, join(root, ".cursor"));
    const r2 = loadImportedRules(root);
    assert.deepEqual(r2.rules, []);
    assert.ok(r2.errors.some((e) => e.startsWith(".clinerules: symlink")));
    assert.ok(r2.errors.some((e) => e.startsWith(".cursor/rules: resolves outside")));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("loadImportedRules skips non-regular files such as FIFOs", { timeout: 5000 }, () => {
  const root = mkdtempSync(join(tmpdir(), "omc-imports-fifo-"));
  try {
    try {
      execFileSync("mkfifo", [join(root, ".cursorrules")]);
    } catch {
      return; // no mkfifo on this platform
    }
    const r = loadImportedRules(root);
    assert.deepEqual(r.rules, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("renderAlways: the cap is hard even when many rules do not fit", () => {
  const many = Array.from({ length: 200 }, (_, i) =>
    rule(`.cursor/rules/some/deep/folder/rule-number-${String(i).padStart(3, "0")}.mdc`, "always", "R".repeat(400)),
  );
  const requested = Array.from({ length: 100 }, (_, i) =>
    rule(`.cursor/rules/req-${i}.mdc`, "requested", "", { description: "D".repeat(150) }),
  );
  for (const max of [LIMITS.alwaysChars, 3000, 1000]) {
    const r = renderAlways([...many, ...requested], max);
    assert.ok(r.text.length <= max, `max ${max}: length ${r.text.length}`);
    const omittedAlways = r.omitted.filter((f) => f.includes("rule-number")).length;
    assert.equal(omittedAlways + (r.text.match(/<rule source=/g) ?? []).length, 200, "every always rule is sent or reported");
  }
  const r = renderAlways(many);
  assert.match(r.text, /did not fit; read them if relevant: .*, and \d+ more$/m);
});

test("renderGlobRule: a long glob list is shortened in the header", () => {
  const g = rule("x.mdc", "glob", "Body.", { globs: Array.from({ length: 200 }, (_, i) => `src/dir${i}/**/*.ts`) });
  const r = renderGlobRule(g, 1000);
  assert.ok(r.text.length <= 1000);
  assert.match(r.text, /\.\.\. \(from x\.mdc\)/);
  assert.match(r.text, /Body\./);
});
