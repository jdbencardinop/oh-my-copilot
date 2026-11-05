// Small, dependency-free glob matcher for project-relative paths.
//
// Supported: `*` (any characters except "/"), `**` (any number of path
// segments), `?` (one character except "/"), `[abc]`, `[a-z]`, `[!abc]`,
// `{a,b}` (nestable), and `\` to escape the next character.
// A pattern without "/" matches the file name at any depth ("*.ts" == "**/*.ts").
// A trailing "/" matches everything below a directory ("dist/" == "dist/**").
// A leading "/" or "./" anchors the pattern at the project root.

const MAX_EXPANSIONS = 256;

/** Expand `{a,b}` alternations into separate patterns. */
export function expandBraces(pattern) {
  const out = [];
  const queue = [pattern];
  while (queue.length) {
    const p = queue.shift();
    const open = findBrace(p);
    if (!open) {
      out.push(p);
      if (out.length > MAX_EXPANSIONS) throw new Error(`glob "${pattern}" expands to too many patterns`);
      continue;
    }
    const { start, end, alternatives } = open;
    for (const alt of alternatives) queue.push(p.slice(0, start) + alt + p.slice(end + 1));
    if (out.length + queue.length > MAX_EXPANSIONS) throw new Error(`glob "${pattern}" expands to too many patterns`);
  }
  return out;
}

// First "{...}" with a top-level comma; unbalanced or comma-less braces stay literal.
// One pass with a stack, so many unclosed "{" cost linear time.
function findBrace(p) {
  const stack = [];
  let best = null;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\") {
      i++;
    } else if (c === "{") {
      stack.push({ start: i, commas: [] });
    } else if (c === "," && stack.length) {
      stack[stack.length - 1].commas.push(i);
    } else if (c === "}" && stack.length) {
      const open = stack.pop();
      if (open.commas.length && (!best || open.start < best.start)) best = { ...open, end: i };
    }
  }
  if (!best) return null;
  const parts = [];
  let from = best.start + 1;
  for (const k of best.commas) {
    parts.push(p.slice(from, k));
    from = k + 1;
  }
  parts.push(p.slice(from, best.end));
  return { start: best.start, end: best.end, alternatives: parts };
}

// Matching does not use regular expressions: a path is split into segments
// and matched with memoized dynamic programming, so the cost is bounded by
// (pattern length x path length) whatever the pattern. Patterns come from
// repository files, so they must not be able to stall the extension.
export const MAX_PATH_LENGTH = 4096;
export const MAX_GLOB_LENGTH = 1024;
// Matching cost grows with (segments in all brace alternatives) x (path segments).
export const MAX_GLOB_SEGMENTS = 2048;
export const MAX_PATH_SEGMENTS = 256;

const GLOBSTAR = Symbol("**");
const STAR = Symbol("*");
const QMARK = Symbol("?");

// Parse "[...]" starting at glob[i] === "[". Returns null when unclosed.
// "]" right after "[" or "[!" is a literal, and "\]" never closes the class.
function parseClass(glob, i) {
  let j = i + 1;
  let negate = false;
  if (glob[j] === "!" || glob[j] === "^") {
    negate = true;
    j++;
  }
  const chars = [];
  let first = true;
  for (; j < glob.length; j++) {
    let c = glob[j];
    if (c === "]" && !first) {
      const items = [];
      for (let k = 0; k < chars.length; k++) {
        if (chars[k + 1]?.c === "-" && !chars[k + 1].escaped && k + 2 < chars.length) {
          items.push([chars[k].c, chars[k + 2].c]);
          k += 2;
        } else items.push([chars[k].c, chars[k].c]);
      }
      return { token: { items, negate }, end: j };
    }
    first = false;
    let escaped = false;
    if (c === "\\" && j + 1 < glob.length) {
      c = glob[++j];
      escaped = true;
    }
    chars.push({ c, escaped });
  }
  return null;
}

// One brace-free path segment -> list of tokens (characters, STAR, QMARK, classes).
function parseSegment(seg) {
  const tokens = [];
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (c === "\\") {
      if (i + 1 < seg.length) tokens.push(seg[++i]);
      continue;
    }
    if (c === "*") {
      while (seg[i + 1] === "*") i++; // "a**b" and "***" behave like "*"
      if (tokens[tokens.length - 1] !== STAR) tokens.push(STAR);
      continue;
    }
    if (c === "?") {
      tokens.push(QMARK);
      continue;
    }
    if (c === "[") {
      const cls = parseClass(seg, i);
      if (cls) {
        tokens.push(cls.token);
        i = cls.end;
        continue;
      }
    }
    tokens.push(c);
  }
  return tokens;
}

// Split on "/" that is not escaped and not inside a class.
function splitSegments(glob) {
  const out = [];
  let cur = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "\\" && i + 1 < glob.length) {
      cur += c + glob[++i];
    } else if (c === "[") {
      const cls = parseClass(glob, i);
      const end = cls ? cls.end : i;
      cur += glob.slice(i, end + 1);
      i = end;
    } else if (c === "/") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const classMatches = (cls, ch) => {
  if (ch === "/") return false;
  const hit = cls.items.some(([lo, hi]) => ch >= lo && ch <= hi);
  return cls.negate ? !hit : hit;
};

// Wildcard match of one segment. Greedy with single-star backtracking:
// O(tokens x chars) worst case, never exponential.
function matchSegment(tokens, s) {
  let t = 0;
  let i = 0;
  let starT = -1;
  let starI = 0;
  while (i < s.length) {
    const tok = tokens[t];
    if (tok === STAR) {
      starT = t++;
      starI = i;
      continue;
    }
    if (t < tokens.length && (tok === QMARK || (typeof tok === "string" ? tok === s[i] : classMatches(tok, s[i])))) {
      t++;
      i++;
      continue;
    }
    if (starT === -1) return false;
    t = starT + 1;
    i = ++starI;
  }
  while (tokens[t] === STAR) t++;
  return t === tokens.length;
}

// Compile one brace-free glob into a list of segment matchers.
function compileOne(glob) {
  let p = glob;
  let anchored = false;
  if (p.startsWith("./")) {
    p = p.slice(2);
    anchored = true;
  } else if (p.startsWith("/")) {
    p = p.replace(/^\/+/, "");
    anchored = true;
  }
  if (p.endsWith("/")) p += "**";
  if (!anchored && splitSegments(p).length === 1) p = `**/${p}`;
  const segs = [];
  for (const seg of splitSegments(p)) {
    const tok = seg === "**" ? GLOBSTAR : parseSegment(seg);
    if (tok === GLOBSTAR && segs[segs.length - 1] === GLOBSTAR) continue; // "**/**" == "**"
    segs.push(tok);
  }
  // A trailing "**" after other segments needs at least one more segment ("src/**" != "src").
  const trailing = segs.length > 1 && segs[segs.length - 1] === GLOBSTAR;
  const match = (parts) => {
    const memo = new Map();
    const go = (pi, si) => {
      if (pi === segs.length) return si === parts.length;
      const key = pi * (parts.length + 1) + si;
      if (memo.has(key)) return memo.get(key);
      let ok;
      const seg = segs[pi];
      if (seg === GLOBSTAR) {
        if (pi === segs.length - 1) ok = trailing ? si < parts.length : true;
        else ok = go(pi + 1, si) || (si < parts.length && go(pi, si + 1));
      } else ok = si < parts.length && matchSegment(seg, parts[si]) && go(pi + 1, si + 1);
      memo.set(key, ok);
      return ok;
    };
    return go(0, 0);
  };
  match.segments = segs.length;
  return match;
}

/** Compile one glob (without a leading "!") to a function over "/"-separated relative paths. */
export function globMatcher(glob) {
  if (typeof glob !== "string" || !glob.trim()) throw new Error("glob must be a non-empty string");
  if (glob.length > MAX_GLOB_LENGTH) throw new Error(`glob is longer than ${MAX_GLOB_LENGTH} characters`);
  const matchers = expandBraces(glob.trim()).map(compileOne);
  const segments = matchers.reduce((n, m) => n + m.segments, 0);
  if (segments > MAX_GLOB_SEGMENTS) throw new Error(`glob expands to more than ${MAX_GLOB_SEGMENTS} path segments`);
  return (path) => {
    const p = String(path);
    if (p.length > MAX_PATH_LENGTH) return false;
    const parts = p.split("/");
    if (parts.length > MAX_PATH_SEGMENTS) return false;
    return matchers.some((m) => m(parts));
  };
}

/** Normalize a path for matching: forward slashes, no "./" prefix, no duplicate slashes. */
export function normalizePath(p) {
  return String(p).replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^(\.\/)+/, "");
}

/**
 * Compile a list of globs. A path matches when it matches at least one
 * positive pattern and no "!" pattern. A list of only "!" patterns matches
 * every path that none of them exclude. Order does not matter.
 */
export function compileGlobs(globs) {
  const list = typeof globs === "string" ? [globs] : globs;
  if (!Array.isArray(list) || list.length === 0) throw new Error("expected a glob string or a non-empty array of globs");
  const include = [];
  const exclude = [];
  for (const g of list) {
    if (typeof g !== "string" || !g.trim()) throw new Error("globs must be non-empty strings");
    const t = g.trim();
    if (t.startsWith("!")) exclude.push(globMatcher(t.slice(1)));
    else include.push(globMatcher(t));
  }
  return (path) => {
    const p = normalizePath(path);
    if (include.length && !include.some((m) => m(p))) return false;
    return !exclude.some((m) => m(p));
  };
}
