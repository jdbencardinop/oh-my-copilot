// Hash-anchored line addressing ("hashline"), modeled on oh-my-pi.
// Pure functions only: no file system access, so they are easy to test.

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const STALE_CONTEXT_RADIUS = 2;
const STALE_PREVIEW_CHARS = 160;
const MALFORMED_ECHO_CHARS = 80;
const LINE_NUMBER_ECHO_DIGITS = 32;

export class AnchorError extends Error {
  constructor(message) {
    super(message);
    this.name = "AnchorError";
  }
}

/** Two-character content hash of a line. Trailing whitespace is ignored. */
export function lineHash(text) {
  const s = text.replace(/\s+$/, "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h >>>= 0;
  return ALPHABET[h & 31] + ALPHABET[(h >>> 5) & 31];
}

export function parseDocument(src) {
  let bom = "";
  if (src.charCodeAt(0) === 0xfeff) {
    bom = "\ufeff";
    src = src.slice(1);
  }
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  if (src.length === 0) return { lines: [], eol, hasFinalNewline: true, bom };
  const hasFinalNewline = src.endsWith("\n");
  const body = hasFinalNewline ? src.replace(/\r?\n$/, "") : src;
  return { lines: body.split(/\r?\n/), eol, hasFinalNewline, bom };
}

export function serializeDocument({ lines, eol, hasFinalNewline, bom }) {
  if (lines.length === 0) return bom;
  return bom + lines.join(eol) + (hasFinalNewline ? eol : "");
}

function clip(text, maxChars) {
  return text.slice(0, maxChars).replace(/[\uD800-\uDBFF]$/, "");
}

export function formatLine(lineNumber, text, maxContentChars = Infinity) {
  const preview = text.length > maxContentChars ? clip(text, maxContentChars) + "… [truncated]" : text;
  return `${lineNumber}:${lineHash(text)}|${preview}`;
}

// JSON quoting keeps a pasted newline from passing as an anchored row in the error.
function quoteMalformed(raw) {
  if (raw.length <= MALFORMED_ECHO_CHARS) return JSON.stringify(raw);
  return `${JSON.stringify(clip(raw, MALFORMED_ECHO_CHARS) + "…")} (${raw.length} characters, truncated)`;
}

/** Render lines [start, end] (1-based, inclusive) with anchors. */
export function renderAnchored(lines, start = 1, end = lines.length, maxContentChars) {
  const out = [];
  for (let n = Math.max(1, start); n <= Math.min(end, lines.length); n++) {
    out.push(formatLine(n, lines[n - 1], maxContentChars));
  }
  return out.join("\n");
}

/** Parse "12:ab", tolerating a pasted "12:ab|content" suffix and whitespace. */
export function parseAnchor(raw) {
  if (typeof raw !== "string") throw new AnchorError(`Anchor must be a string, got ${typeof raw}.`);
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  if (upper === "BOF" || upper === "EOF") return { special: upper };
  const m = /^(\d+)\s*:\s*([0-9a-z]{2})(?:\|.*)?$/is.exec(trimmed);
  if (!m) throw new AnchorError(`Malformed anchor ${quoteMalformed(raw)}. Expected LINE:HASH, for example "12:ab".`);
  // Echo the digits as written: Number() would print huge values as "1e+23".
  const digits = m[1].replace(/^0+(?=\d)/, "");
  const lineLabel = digits.length > LINE_NUMBER_ECHO_DIGITS ? `${digits.slice(0, LINE_NUMBER_ECHO_DIGITS)}…` : digits;
  return { line: Number(digits), lineLabel, hash: m[2].toLowerCase() };
}

function describeStale(lines, anchor) {
  const { line, lineLabel, hash } = anchor;
  const label = `Anchor ${lineLabel}:${hash}`;
  if (!lines.length) {
    return `${label} is out of range: the file is empty. To add content, use insert_after with anchor BOF.`;
  }
  const center = Math.max(1, Math.min(line, lines.length));
  const first = Math.max(1, center - STALE_CONTEXT_RADIUS);
  const last = Math.min(lines.length, center + STALE_CONTEXT_RADIUS);
  let msg;
  const nearby = [];
  if (line !== center) {
    msg = `${label} is out of range; the file has ${lines.length} line(s).`;
  } else {
    msg = `${label} is stale.`;
    for (let d = 1; d <= 50 && nearby.length < 3; d++) {
      for (const n of [line - d, line + d]) {
        if (n >= 1 && n <= lines.length && lineHash(lines[n - 1]) === hash) {
          nearby.push(n);
          if (nearby.length === 3) break;
        }
      }
    }
    if (nearby.length) msg += ` The same hash appears at ${nearby.map((n) => `${n}:${hash}`).join(", ")} (possible matches only).`;
  }
  let context = renderAnchored(lines, first, last, STALE_PREVIEW_CHARS);
  const outside = nearby.filter((n) => n < first || n > last);
  if (outside.length) {
    const rows = outside.map((n) => formatLine(n, lines[n - 1], STALE_PREVIEW_CHARS)).join("\n");
    context += `\nPossible matches outside these lines (verify before using):\n${rows}`;
  }
  return `${msg} No edits applied. Check the target before retrying; use read_anchored if unsure.\nCurrent lines:\n${context}`;
}

/** Verify an anchor against the current lines and return its 1-based line number. */
export function resolveAnchor(lines, raw) {
  const anchor = parseAnchor(raw);
  if (anchor.special) throw new AnchorError(`${anchor.special} is only valid for insert operations.`);
  if (anchor.line < 1 || anchor.line > lines.length || lineHash(lines[anchor.line - 1]) !== anchor.hash) {
    throw new AnchorError(describeStale(lines, anchor));
  }
  return anchor.line;
}

/** Content string to lines: "" -> [], "a\n" -> ["a"], "\n" -> [""]. */
export function contentToLines(content) {
  if (content === undefined || content === null || content === "") return [];
  if (typeof content !== "string") throw new AnchorError("content must be a string.");
  return content.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
}

function insertionPoint(lines, raw, after) {
  const anchor = parseAnchor(raw);
  if (anchor.special === "BOF") return 0;
  if (anchor.special === "EOF") return lines.length;
  const n = resolveAnchor(lines, raw);
  return after ? n : n - 1;
}

/** Turn one edit into a splice { start, end, newLines } over 0-based indices. */
function normalizeEdit(lines, edit, index) {
  const label = `edits[${index}]`;
  try {
    if (!edit || typeof edit !== "object") throw new AnchorError("must be an object.");
    const op = edit.op;
    switch (op) {
      case "replace":
      case "delete": {
        if (edit.start === undefined) throw new AnchorError(`"${op}" requires "start".`);
        const s = resolveAnchor(lines, edit.start);
        const hasEnd = edit.end !== undefined && edit.end !== null && edit.end !== "";
        const e = hasEnd ? resolveAnchor(lines, edit.end) : s;
        if (e < s) throw new AnchorError(`"end" (line ${e}) is before "start" (line ${s}).`);
        const newLines = op === "delete" ? [] : contentToLines(edit.content);
        return { start: s - 1, end: e, newLines, index };
      }
      case "insert_after":
      case "insert_before": {
        if (edit.anchor === undefined) throw new AnchorError(`"${op}" requires "anchor".`);
        const p = insertionPoint(lines, edit.anchor, op === "insert_after");
        const newLines = contentToLines(edit.content);
        if (newLines.length === 0) throw new AnchorError(`"${op}" requires non-empty "content".`);
        return { start: p, end: p, newLines, index };
      }
      default:
        throw new AnchorError(`unknown op "${op}". Use replace, delete, insert_after, or insert_before.`);
    }
  } catch (err) {
    if (err instanceof AnchorError) throw new AnchorError(`${label}: ${err.message}`);
    throw err;
  }
}

/**
 * Apply anchored edits atomically. Every anchor is validated against the
 * original lines first; if any is stale or edits overlap, nothing changes.
 * Returns the new lines plus the changed regions in new-file coordinates.
 */
export function applyEdits(lines, edits) {
  if (!Array.isArray(edits) || edits.length === 0) throw new AnchorError("edits must be a non-empty array.");
  const ops = edits.map((e, i) => normalizeEdit(lines, e, i));
  // Inserts sort before a range that starts at the same point; ties keep request order.
  ops.sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start) || a.index - b.index);

  const out = [];
  const regions = [];
  let cursor = 0;
  let prev = null;
  for (const op of ops) {
    if (op.start < cursor) {
      throw new AnchorError(`edits[${op.index}] overlaps edits[${prev.index}]. Merge them into one edit.`);
    }
    for (let i = cursor; i < op.start; i++) out.push(lines[i]);
    regions.push({ start: out.length, count: op.newLines.length });
    out.push(...op.newLines);
    cursor = op.end;
    prev = op;
  }
  for (let i = cursor; i < lines.length; i++) out.push(lines[i]);
  return { lines: out, regions };
}

/** Anchored snippets around changed regions (0-based region starts), merged when close. */
export function renderRegions(lines, regions, context = 2) {
  if (lines.length === 0) return "(file is now empty)";
  const windows = regions
    .map((r) => [Math.max(1, r.start + 1 - context), Math.min(lines.length, r.start + Math.max(r.count, 1) + context)])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && w[0] <= last[1] + 1) last[1] = Math.max(last[1], w[1]);
    else merged.push([...w]);
  }
  return merged.map(([s, e]) => renderAnchored(lines, s, e)).join("\n...\n");
}
