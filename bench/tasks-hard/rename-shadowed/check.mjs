import { count, eq, fail, functionText, load, read, readBefore, taskDir } from "../_lib/check.mjs";

const dir = taskDir(import.meta.url);
const before = readBefore(dir, "jobs.mjs");
const after = read("jobs.mjs");
const fnBefore = functionText(before, "runWithRetry");
const fnAfter = functionText(after, "runWithRetry");
if (!fnAfter) fail("runWithRetry not found");
if (/\bcount\b/.test(fnAfter)) fail("runWithRetry still uses count");
const norm = (s) => s.replace(/[ \t]+$/gm, "");
if (norm(fnAfter) !== norm(fnBefore.replace(/\bcount\b/g, "retryCount"))) fail("runWithRetry has changes beyond the rename");
if (after.replace(fnAfter, "") !== before.replace(fnBefore, "")) fail("code outside runWithRetry changed");
if (count(after, /\bcount\b/) !== count(before.replace(fnBefore, ""), /\bcount\b/)) fail("other functions lost their count variables");

const m = await load("jobs.mjs");
const waits = [];
const retries = [];
let calls = 0;
const ok = await m.runWithRetry(
  async (n) => {
    calls += 1;
    if (n < 3) throw new Error(`boom ${n}`);
    return `done on ${n}`;
  },
  { wait: async (ms) => waits.push(ms), onRetry: (e, n) => retries.push([e.message, n]) },
);
eq(ok, { value: "done on 3", attempts: 3 }, "runWithRetry result");
eq(waits, [100, 200], "runWithRetry waits");
eq(retries, [["boom 1", 1], ["boom 2", 2]], "runWithRetry onRetry");
let err;
try {
  await m.runWithRetry(async (n) => { throw new Error(`nope ${n}`); }, { retries: 2, wait: async () => {} });
} catch (e) {
  err = e;
}
eq(err?.message, "job failed after 3 attempts: nope 3", "runWithRetry gives up");

eq(m.countByStatus([{ status: "done" }, { status: "queued" }, { status: "done" }]), { done: 2, queued: 1 }, "countByStatus");
eq(await m.runPool([1, 2, 3].map((v) => async () => v * 10), 2), { results: [10, 20, 30], count: 3 }, "runPool");
eq([m.pluralJobs(1), m.pluralJobs(4)], ["1 job", "4 jobs"], "pluralJobs");
eq(m.pruneFinished([{ id: 1, status: "done", finishedAt: 5 }, { id: 2, status: "done", finishedAt: 1 }, { id: 3, status: "running" }], 1).map((j) => j.id), [1, 3], "pruneFinished");
console.log("ok");
