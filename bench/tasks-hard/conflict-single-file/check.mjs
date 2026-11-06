import { eq, fail, load, noConflictMarkers, read } from "../_lib/check.mjs";

noConflictMarkers(["logger.mjs"]);
const text = read("logger.mjs");
if (/LOG_LEVEL/.test(text)) fail("the LOG_LEVEL default should have been dropped");
if (!/^\/\/ Levels, lowest first: trace, debug/m.test(text)) fail("the non-conflicting comment from the current branch was lost");

delete process.env.LOG_LEVEL;
const m = await load("logger.mjs");
eq(m.LEVELS, ["trace", "debug", "info", "warn", "error", "fatal"], "LEVELS");
eq(m.format("api", "info", "saved", { user: "jo smith", id: 7, note: "x\ty" }), '[api] INFO saved user="jo smith" id=7 note="x\\ty"', "format quotes whitespace");
eq(m.format("api", "warn", "odd", { missing: undefined }), "[api] WARN odd missing=undefined", "format keeps undefined as is");
eq(m.format("api", "error", "plain"), "[api] ERROR plain", "format without fields");

const lines = [];
const log = m.createLogger({ name: "shop", sink: (l) => lines.push(l) });
for (const lvl of m.LEVELS) {
  if (typeof log[lvl] !== "function") fail(`logger has no ${lvl} method`);
  log[lvl](`${lvl} message`);
}
eq(lines, ["[shop] WARN warn message", "[shop] ERROR error message", "[shop] FATAL fatal message"], "default level is warn");

if (typeof m.isEnabled !== "function") fail("isEnabled from the incoming branch is missing");
const traceLog = m.createLogger({ level: "trace", sink: (l) => lines.push(l) });
eq([m.isEnabled(traceLog, "trace"), m.isEnabled(log, "info"), m.isEnabled(log, "fatal")], [true, false, true], "isEnabled");
const child = traceLog.child("db");
lines.length = 0;
child.trace("query", { ms: 3 });
eq(lines, ["[app:db] TRACE query ms=3"], "child logger");
console.log("ok");
