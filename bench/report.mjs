#!/usr/bin/env node
// Summarize bench/run.mjs results as Markdown tables.
// Usage: node bench/report.mjs <results.jsonl> [more.jsonl ...]

import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node bench/report.mjs <results.jsonl> ...");
  process.exit(1);
}
const rows = files.flatMap((f) =>
  readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)),
);

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const num = (v) => (typeof v === "number" ? v : 0);
const sum = (o) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);
const EDIT_TOOLS = new Set(["edit", "create", "edit_anchored", "apply_patch"]);
const editCalls = (r) => Object.entries(r.tools).filter(([k]) => EDIT_TOOLS.has(k)).reduce((a, [, v]) => a + v, 0);
const anchoredCalls = (r) => num(r.tools.read_anchored) + num(r.tools.edit_anchored);

function group(keyFn) {
  const g = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(r);
  }
  return [...g.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function stats(rs) {
  return {
    n: rs.length,
    pass: rs.filter((r) => r.pass).length,
    wall: median(rs.map((r) => r.wallMs / 1000)),
    api: mean(rs.map((r) => num(r.apiMs) / 1000)),
    out: mean(rs.map((r) => num(r.tokens.output))),
    fresh: mean(rs.map((r) => num(r.tokens.input) + num(r.tokens.cacheWrite))),
    cached: mean(rs.map((r) => num(r.tokens.cacheRead))),
    credits: mean(rs.map((r) => num(r.credits))),
    requests: mean(rs.map((r) => num(r.requests))),
    calls: mean(rs.map((r) => sum(r.tools))),
    edits: mean(rs.map(editCalls)),
    failed: mean(rs.map((r) => sum(r.toolFailures))),
    anchoredShare: rs.filter((r) => anchoredCalls(r) > 0).length / rs.length,
  };
}

const f0 = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString("en-US") : "-");
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "-");
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "-");
const pct = (a, b) => `${Math.round((100 * a) / b)}%`;

function table(title, groups) {
  console.log(`\n### ${title}\n`);
  console.log("| Group | Runs | Pass | Median wall (s) | Mean API (s) | Output tokens | Fresh input tokens | Cached input tokens | Credits | Model calls | Tool calls | Edit calls | Failed tool calls | Runs using anchored tools |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const [k, rs] of groups) {
    const s = stats(rs);
    console.log(
      `| ${k} | ${s.n} | ${s.pass}/${s.n} (${pct(s.pass, s.n)}) | ${f1(s.wall)} | ${f1(s.api)} | ${f0(s.out)} | ${f0(s.fresh)} | ${f0(s.cached)} | ${f2(s.credits)} | ${f1(s.requests)} | ${f1(s.calls)} | ${f1(s.edits)} | ${f1(s.failed)} | ${pct(s.anchoredShare * s.n, s.n)} |`,
    );
  }
}

table("By model and arm", group((r) => `${r.model} / ${r.arm}`));
table("By task, model and arm", group((r) => `${r.task} / ${r.model} / ${r.arm}`));

const failures = rows.filter((r) => !r.pass || sum(r.toolFailures) > 0);
if (failures.length) {
  console.log("\n### Failed runs and failed tool calls\n");
  for (const r of failures) {
    console.log(`- ${r.pass ? "pass" : "**FAIL**"} ${r.task} / ${r.model} / ${r.arm} #${r.rep}${r.timedOut ? " (timed out)" : ""}: ${r.failureSamples?.join("; ") || "wrong file content"}`);
  }
}
