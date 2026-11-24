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
  assert.deepEqual(parseAnchor(" 12:AB "), { line: 12, lineLabel: "12", hash: "ab" });
  assert.deepEqual(parseAnchor("3:x9|  return x;"), { line: 3, lineLabel: "3", hash: "x9" });
  assert.deepEqual(parseAnchor("007:ab"), { line: 7, lineLabel: "7", hash: "ab" });
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

function rejectionMessage(lines, start) {
  try {
    applyEdits(lines, [{ op: "delete", start }]);
  } catch (err) {
    assert.ok(err instanceof AnchorError);
    return err.message;
  }
  assert.fail(`Expected rejection of ${start}`);
}

test("rejected anchors show only current rows around the mismatch or nearest file boundary", () => {
  const lines = ["first", "  indented", "", "changed", "trailing  ", "sixth", "last"];
  for (const [n, first, last] of [[4, 2, 6], [1, 1, 3], [7, 5, 7], [0, 1, 3], [999, 5, 7]]) {
    const msg = rejectionMessage(lines, `${n}:${lineHash("obsolete")}`);
    assert.match(msg, n === 0 || n > lines.length ? /out of range.*7 line/ : /stale/);
    assert.deepEqual(
      msg.split("\n").filter((row) => /^\d+:\w{2}\|/.test(row)),
      lines.slice(first - 1, last).map((text, i) => formatLine(first + i, text)),
    );
  }
});

test("an empty file has no numbered retry anchor", () => {
  const msg = rejectionMessage([], "1:ab");
  assert.match(msg, /out of range.*empty/);
  assert.match(msg, /insert_after.*BOF/);
  assert.doesNotMatch(msg, /^\d+:\w{2}\|/m);
});

test("huge lines have bounded previews with full-line hashes and no unbounded echo", () => {
  const prefix = "x".repeat(159);
  const lines = Array.from({ length: 5 }, (_, i) => prefix + "🙂" + String(i).repeat(100_000));
  const msg = rejectionMessage(lines, `3:${lineHash("obsolete")}|${lines[2]}`);
  assert.ok(msg.length < 1500, `error contained ${msg.length} characters`);
  const rows = msg.split("\n").filter((row) => /^\d+:\w{2}\|/.test(row));
  assert.deepEqual(rows, lines.map((_, i) => `${anchor(lines, i + 1)}|${prefix}… [truncated]`));
  assert.equal(msg.split(prefix).length - 1, rows.length, "no second preview in the error header");
});

test("nearby matching hashes are hints even when different lines collide", () => {
  const lines = ["item 44", "item 31", "third", "changed", "fifth", "item 44", "item 31"];
  const hash = lineHash("item 31");
  assert.equal(lineHash("item 44"), hash);
  const msg = rejectionMessage(lines, `4:${hash}`);
  assert.ok(msg.includes(`The same hash appears at 2:${hash}, 6:${hash}, 1:${hash} (possible matches only)`));
  const [, outside] = msg.split("\nPossible matches outside these lines (verify before using):\n");
  assert.equal(outside, formatLine(1, "item 44"), "only matches outside the shown window get an extra row");
});

test("possible matches outside the shown window include their current content", () => {
  const lines = Array.from({ length: 30 }, (_, i) => `row number ${i + 1}`);
  lines[19] = "moved target";
  const hash = lineHash("moved target");
  const collisions = lines.flatMap((text, i) => (i !== 19 && lineHash(text) === hash ? [i + 1] : []));
  assert.deepEqual(collisions, [], "fixture must have a single possible match");
  const msg = rejectionMessage(lines, `5:${hash}`);
  assert.ok(msg.includes(`The same hash appears at 20:${hash} (possible matches only).`));
  const [current, outside] = msg.split("\nPossible matches outside these lines (verify before using):\n");
  assert.deepEqual(
    current.split("\n").filter((row) => /^\d+:\w{2}\|/.test(row)),
    lines.slice(2, 7).map((text, i) => formatLine(3 + i, text)),
  );
  assert.equal(outside, formatLine(20, "moved target"));
  assert.equal(applyEdits(lines, [{ op: "delete", start: `20:${hash}` }]).lines.length, 29, "the shown anchor is current");
});

test("malformed anchors are echoed briefly, on one line", () => {
  const long = "x".repeat(79) + "🙂" + "y".repeat(5000);
  const msg = rejectionMessage(["a"], long);
  assert.ok(msg.length < 250, `error contained ${msg.length} characters`);
  assert.ok(msg.includes(`Malformed anchor "${"x".repeat(79)}…" (${long.length} characters, truncated).`));
  assert.doesNotMatch(msg, /\\ud83d/i, "no half of a split emoji");

  const pasted = rejectionMessage(["a"], "1:zz\n2:ab|spoofed row");
  assert.ok(pasted.includes(String.raw`Malformed anchor "1:zz\n2:ab|spoofed row"`));
  assert.doesNotMatch(pasted, /^\d+:\w{2}\|/m, "a pasted newline must not look like a current row");
});

test("huge line numbers are echoed as written, within a bound", () => {
  const lines = ["a", "b", "c"];
  const big = rejectionMessage(lines, "100000000000000000000000:ab");
  assert.match(big, /^edits\[0\]: Anchor 100000000000000000000000:ab is out of range; the file has 3 line\(s\)\./);
  assert.doesNotMatch(big, /e\+/);
  assert.match(rejectionMessage(lines, "9007199254740993:ab"), /Anchor 9007199254740993:ab is out of range/);

  const enormous = rejectionMessage(lines, `${"9".repeat(5000)}:ab`);
  assert.ok(enormous.includes(`Anchor ${"9".repeat(32)}…:ab is out of range`));
  assert.doesNotMatch(enormous, /Infinity/);
  assert.ok(enormous.length < 400, `error contained ${enormous.length} characters`);
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
