import assert from "node:assert/strict";
import { test } from "node:test";
import { compileGlobs, expandBraces, globMatcher, MAX_PATH_LENGTH, MAX_PATH_SEGMENTS, normalizePath } from "../plugin/com.github.copilot/extensions/omc/lib/glob.mjs";

const m = (glob, path) => globMatcher(glob)(path);

test("* and ? stay inside one path segment", () => {
  assert.ok(m("src/*.ts", "src/a.ts"));
  assert.ok(!m("src/*.ts", "src/x/a.ts"));
  assert.ok(m("src/?.ts", "src/a.ts"));
  assert.ok(!m("src/?.ts", "src/ab.ts"));
  assert.ok(!m("src/?.ts", "src//.ts"));
  assert.ok(m("src/*", "src/.hidden"), "dotfiles are not special");
});

test("** matches zero or more segments", () => {
  assert.ok(m("src/**/*.ts", "src/a.ts"));
  assert.ok(m("src/**/*.ts", "src/x/y/a.ts"));
  assert.ok(!m("src/**/*.ts", "lib/a.ts"));
  assert.ok(m("src/**", "src/x/y"));
  assert.ok(m("**", "a/b/c"));
  assert.ok(m("a/**/b", "a/b"));
  assert.ok(m("a/**/b", "a/x/y/b"));
  assert.ok(!m("a/**/b", "a/xb"));
  assert.ok(m("a**b/c", "axyb/c"), "** inside a segment acts like *");
  assert.ok(!m("a**b/c", "ax/yb/c"));
});

test("patterns without a slash match the file name at any depth; ./ and / anchor", () => {
  assert.ok(m("*.ts", "a.ts"));
  assert.ok(m("*.ts", "deep/dir/a.ts"));
  assert.ok(!m("*.ts", "a.tsx"));
  assert.ok(m("./*.ts", "a.ts"));
  assert.ok(!m("./*.ts", "deep/a.ts"));
  assert.ok(m("/Makefile", "Makefile"));
  assert.ok(!m("/Makefile", "sub/Makefile"));
  assert.ok(m("dist/", "dist/a/b.js"), "trailing slash means everything below");
});

test("braces, classes, and escapes", () => {
  assert.deepEqual(expandBraces("a.{ts,tsx}"), ["a.ts", "a.tsx"]);
  assert.deepEqual(expandBraces("{a,b{c,d}}x"), ["ax", "bcx", "bdx"]);
  assert.deepEqual(expandBraces("{a}"), ["{a}"], "a brace with no comma is literal");
  assert.deepEqual(expandBraces("{a,b"), ["{a,b"], "unbalanced braces are literal");
  assert.ok(m("src/**/*.{ts,tsx}", "src/x/a.tsx"));
  assert.ok(m("{src,lib}/**/*.js", "lib/a.js"));
  assert.ok(!m("{src,lib}/**/*.js", "test/a.js"));
  assert.ok(m("file[0-9].txt", "file7.txt"));
  assert.ok(!m("file[!0-9].txt", "file7.txt"));
  assert.ok(m("file[!0-9].txt", "filex.txt"));
  assert.ok(!m("a[/]b", "a/b"), "classes never match /");
  assert.ok(m("lit\\*.md", "lit*.md"));
  assert.ok(!m("lit\\*.md", "litx.md"));
  assert.ok(m("a.b+(c)", "a.b+(c)"), "regex characters are literal");
  assert.ok(m("[abc", "x/[abc"), "an unclosed class is literal");
  assert.throws(() => expandBraces("{a,b}{c,d}{e,f}{g,h}{i,j}{k,l}{m,n}{o,p}{q,r}"), /too many/);
});

test("compileGlobs: include and ! exclude, order-independent", () => {
  const ts = compileGlobs(["src/**/*.ts", "!**/*.test.ts"]);
  assert.ok(ts("src/a.ts"));
  assert.ok(!ts("src/a.test.ts"));
  assert.ok(!ts("lib/a.ts"));
  const sameReversed = compileGlobs(["!**/*.test.ts", "src/**/*.ts"]);
  assert.ok(!sameReversed("src/x/a.test.ts"));
  const onlyExclude = compileGlobs(["!vendor/**"]);
  assert.ok(onlyExclude("src/a.js"));
  assert.ok(!onlyExclude("vendor/a.js"));
  assert.ok(compileGlobs("*.md")("docs/a.md"), "a single string is accepted");
  assert.ok(ts("./src\\win\\a.ts"), "paths are normalized");
  assert.throws(() => compileGlobs([]));
  assert.throws(() => compileGlobs([""]));
  assert.throws(() => compileGlobs([5]));
  assert.throws(() => compileGlobs(null));
});

test("normalizePath", () => {
  assert.equal(normalizePath("./a//b\\c"), "a/b/c");
  assert.equal(normalizePath("/abs/x"), "/abs/x");
});

test("classes: escaped ] and leading ] are members, not the end", () => {
  assert.ok(m("[\\]]", "]"));
  assert.ok(m("x[a\\]]", "x]"));
  assert.ok(m("x[a\\]]", "xa"));
  assert.ok(!m("x[a\\]]", "xb"));
  assert.ok(m("x[]a]", "x]"));
  assert.ok(m("x[!\\]]", "xb"));
  assert.ok(!m("x[!\\]]", "x]"));
  assert.ok(m("x[a-c]y", "xby"));
  assert.ok(m("x[a\\-c]y", "x-y"));
  assert.ok(!m("x[a\\-c]y", "xby"));
});

test("no catastrophic backtracking: hostile globs finish quickly", () => {
  const cases = [
    ["*a*a*a*a*a*a*a*a*a*a*b", "a".repeat(4000)],
    ["**/**/**/**/**/**/**/**/x", "a/".repeat(2000) + "y"],
    ["**/a/**/a/**/a/**/a/**/a/**/b", "a/".repeat(2000) + "c"],
    ["{a,b}*{a,b}*{a,b}*{a,b}*c", "ab".repeat(2000)],
  ];
  for (const [glob, path] of cases) {
    const t0 = performance.now();
    assert.equal(m(glob, path), false);
    assert.ok(performance.now() - t0 < 500, `${glob} took ${performance.now() - t0}ms`);
  }
  assert.ok(m("**/**/x", "a/b/x"), "stacked ** still work");
  assert.ok(!m("**", "a".repeat(MAX_PATH_LENGTH + 1)), "over-long paths never match");
  assert.throws(() => globMatcher("a".repeat(2000)), /longer than/);
});

test("brace expansion cannot multiply matching cost", () => {
  const wide = "{a,b}{c,d}{e,f}{g,h}{i,j}{k,l}{m,n}{o,p}/" + "*/".repeat(20) + "x";
  assert.throws(() => globMatcher(wide), /more than 2048 path segments/);
  const t0 = performance.now();
  assert.throws(() => globMatcher("{a,b}{c,d}{e,f}{g,h}{i,j}{k,l}{m,n}{o,p}/" + "**/a*b/".repeat(140) + "x"), /segments|longer/);
  assert.ok(performance.now() - t0 < 1000);
  const t1 = performance.now();
  const live = globMatcher("{a,a}{a,a}{a,a}{a,a}{a,a}{a,a}/" + "**/*a*a*/".repeat(10) + "**/b");
  assert.equal(live("aaaaaa/" + "aa/".repeat(MAX_PATH_SEGMENTS - 2) + "c"), false);
  assert.ok(performance.now() - t1 < 1000, `${performance.now() - t1}ms`);
  assert.ok(!globMatcher("**")("a/".repeat(MAX_PATH_SEGMENTS) + "b"), "paths with too many segments never match");
  assert.ok(globMatcher("**")("a/".repeat(MAX_PATH_SEGMENTS - 2) + "b"));
});

test("many unclosed braces compile in linear time and stay literal", () => {
  const t0 = performance.now();
  const g = "{".repeat(1000);
  assert.deepEqual(expandBraces(g), [g]);
  assert.ok(m("x{{{,a", "x{{{,a"));
  assert.ok(m("{{a,b}", "{a"), "the inner pair expands, the outer brace is literal");
  assert.ok(m("{a{b,c}", "{ac"));
  assert.ok(performance.now() - t0 < 200);
});
