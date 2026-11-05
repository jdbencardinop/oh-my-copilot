import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnchorError,
  applyEdits,
  contentToLines,
  formatLine,
  lineHash,
  parseAnchor,
  parseDocument,
  renderAnchored,
  renderRegions,
  serializeDocument,
} from "../plugin/com.github.copilot/extensions/omc/lib/hashline.mjs";

const anchor = (lines, n) => `${n}:${lineHash(lines[n - 1])}`;

test("lineHash is short, stable, and ignores trailing whitespace", () => {
  assert.match(lineHash("const x = 1;"), /^[0-9a-z]{2}$/);
  assert.equal(lineHash("const x = 1;"), lineHash("const x = 1;"));
  assert.equal(lineHash("const x = 1;  "), lineHash("const x = 1;"));
  assert.equal(lineHash("a\r"), lineHash("a"));
  assert.notEqual(lineHash("  x"), lineHash("x"));
});

test("lineHash spreads across the hash space", () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) seen.add(lineHash(`line ${i} of some file`));
  assert.ok(seen.size > 900, `only ${seen.size} distinct hashes`);
});

test("parseDocument/serializeDocument round-trip EOL, final newline, and BOM", () => {
  for (const src of ["", "\n", "a", "a\n", "a\nb", "a\r\nb\r\n", "\ufeffx\ny\n", "a\n\n"]) {
    assert.equal(serializeDocument(parseDocument(src)), src, JSON.stringify(src));
  }
  assert.deepEqual(parseDocument("a\r\nb\r\n").lines, ["a", "b"]);
});

test("parseAnchor accepts pasted display lines and special anchors", () => {
  assert.deepEqual(parseAnchor(" 12:AB "), { line: 12, hash: "ab" });
  assert.deepEqual(parseAnchor("3:x9|  return x;"), { line: 3, hash: "x9" });
  assert.deepEqual(parseAnchor("eof"), { special: "EOF" });
  assert.throws(() => parseAnchor("12"), AnchorError);
  assert.throws(() => parseAnchor(12), AnchorError);
});

test("contentToLines treats one trailing newline as a terminator", () => {
  assert.deepEqual(contentToLines(""), []);
  assert.deepEqual(contentToLines("a"), ["a"]);
  assert.deepEqual(contentToLines("a\n"), ["a"]);
  assert.deepEqual(contentToLines("\n"), [""]);
  assert.deepEqual(contentToLines("a\r\nb"), ["a", "b"]);
});

test("renderAnchored formats LINE:HASH|content", () => {
  const lines = ["function hello() {", '  return "world";', "}"];
  const out = renderAnchored(lines).split("\n");
  assert.equal(out.length, 3);
  assert.equal(out[1], formatLine(2, lines[1]));
  assert.match(out[1], /^2:[0-9a-z]{2}\| {2}return "world";$/);
});

test("applyEdits replaces, deletes, and inserts against original line numbers", () => {
  const lines = ["a", "b", "c", "d", "e"];
  const { lines: out } = applyEdits(lines, [
    { op: "replace", start: anchor(lines, 2), content: "B1\nB2" },
    { op: "delete", start: anchor(lines, 4), end: anchor(lines, 5) },
    { op: "insert_before", anchor: anchor(lines, 1), content: "top" },
    { op: "insert_after", anchor: "EOF", content: "end" },
  ]);
  assert.deepEqual(out, ["top", "a", "B1", "B2", "c", "end"]);
});

test("applyEdits orders an insert before a range starting at the same line", () => {
  const lines = ["a", "b", "c"];
  const { lines: out } = applyEdits(lines, [
    { op: "replace", start: anchor(lines, 2), content: "B" },
    { op: "insert_before", anchor: anchor(lines, 2), content: "pre" },
    { op: "insert_after", anchor: anchor(lines, 2), content: "post" },
  ]);
  assert.deepEqual(out, ["a", "pre", "B", "post", "c"]);
});

test("applyEdits keeps request order for inserts at the same point", () => {
  const lines = ["a"];
  const { lines: out } = applyEdits(lines, [
    { op: "insert_after", anchor: anchor(lines, 1), content: "1" },
    { op: "insert_after", anchor: anchor(lines, 1), content: "2" },
  ]);
  assert.deepEqual(out, ["a", "1", "2"]);
});

test("applyEdits rejects stale anchors and writes nothing", () => {
  const lines = ["alpha", "beta", "gamma"];
  const stale = `2:${lineHash("BETA")}`;
  assert.notEqual(stale, anchor(lines, 2));
  assert.throws(
    () =>
      applyEdits(lines, [
        { op: "replace", start: anchor(lines, 1), content: "ok" },
        { op: "replace", start: stale, content: "bad" },
      ]),
    (err) => err instanceof AnchorError && /edits\[1\].*stale/.test(err.message),
  );
  assert.deepEqual(lines, ["alpha", "beta", "gamma"]);
});

test("stale anchor error points at a moved line", () => {
  const before = ["x", "target", "y"];
  const after = ["inserted", "x", "target", "y"];
  const old = anchor(before, 2);
  assert.throws(
    () => applyEdits(after, [{ op: "delete", start: old }]),
    (err) => err.message.includes(`3:${old.split(":")[1]}`),
  );
});

test("applyEdits rejects overlaps, reversed ranges, out-of-range anchors, bad ops", () => {
  const lines = ["a", "b", "c", "d"];
  assert.throws(
    () =>
      applyEdits(lines, [
        { op: "replace", start: anchor(lines, 1), end: anchor(lines, 3), content: "x" },
        { op: "delete", start: anchor(lines, 2) },
      ]),
    /overlaps/,
  );
  assert.throws(
    () =>
      applyEdits(lines, [
        { op: "replace", start: anchor(lines, 1), end: anchor(lines, 3), content: "x" },
        { op: "insert_after", anchor: anchor(lines, 1), content: "y" },
      ]),
    /overlaps/,
  );
  assert.throws(() => applyEdits(lines, [{ op: "delete", start: anchor(lines, 3), end: anchor(lines, 1) }]), /before/);
  assert.throws(() => applyEdits(lines, [{ op: "delete", start: "99:aa" }]), /out of range/);
  assert.throws(() => applyEdits(lines, [{ op: "replace", start: "BOF", content: "x" }]), /only valid for insert/);
  assert.throws(() => applyEdits(lines, [{ op: "move" }]), /unknown op/);
  assert.throws(() => applyEdits(lines, []), /non-empty/);
  assert.throws(() => applyEdits(lines, [{ op: "insert_after", anchor: "EOF", content: "" }]), /non-empty "content"/);
});

test("applyEdits inserts into an empty file", () => {
  const { lines } = applyEdits([], [{ op: "insert_after", anchor: "BOF", content: "first\nsecond\n" }]);
  assert.deepEqual(lines, ["first", "second"]);
  const doc = parseDocument("");
  assert.equal(serializeDocument({ ...doc, lines }), "first\nsecond\n");
});

test("renderRegions returns fresh anchors that resolve on the new file", () => {
  const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
  const { lines: out, regions } = applyEdits(lines, [
    { op: "replace", start: anchor(lines, 3), content: "THREE" },
    { op: "insert_after", anchor: anchor(lines, 15), content: "new\nlines" },
  ]);
  const text = renderRegions(out, regions);
  assert.match(text, /\n\.\.\.\n/);
  for (const row of text.split("\n").filter((r) => r !== "...")) {
    const [, n, h] = /^(\d+):(\w{2})\|/.exec(row);
    assert.equal(lineHash(out[Number(n) - 1]), h);
  }
  const followUp = /(\d+:\w{2})\|THREE/.exec(text)[1];
  assert.deepEqual(applyEdits(out, [{ op: "delete", start: followUp }]).lines.slice(0, 3), ["line 1", "line 2", "line 4"]);
});
