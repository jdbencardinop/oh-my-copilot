import { assertUnchanged, count, eq, fail, load, read, readBefore, taskDir, throws } from "../_lib/check.mjs";

const dir = taskDir(import.meta.url);
const files = ["config.mjs", "env.mjs", "server.mjs", "cli.mjs", "validate.mjs", "index.mjs"];

for (const f of files) {
  const text = read(f);
  if (/\bloadConfig\b/.test(text)) fail(`${f} still mentions loadConfig`);
  const schemaBefore = count(readBefore(dir, f), /\bloadConfigSchema\b/);
  if (count(text, /\bloadConfigSchema\b/) !== schemaBefore) fail(`${f}: loadConfigSchema references changed`);
  const renamed = count(readBefore(dir, f), /\bloadConfig\b/);
  if (count(text, /\bresolveConfig\b/) !== renamed) fail(`${f}: expected ${renamed} resolveConfig references`);
  const norm = (s) => s.replace(/[ \t]+$/gm, "").trimEnd();
  if (norm(text) !== norm(readBefore(dir, f).replace(/\bloadConfig\b/g, "resolveConfig"))) fail(`${f}: changes beyond the rename`);
}

const lib = await load("index.mjs");
if ("loadConfig" in lib) fail("index.mjs still exports loadConfig");
if (typeof lib.resolveConfig !== "function") fail("index.mjs does not export resolveConfig");
if (typeof lib.loadConfigSchema !== "function") fail("index.mjs no longer exports loadConfigSchema");
eq(lib.resolveConfig({ replicas: 5 }).replicas, 5, "resolveConfig override");
throws(() => lib.resolveConfig({ replicas: "x" }), "resolveConfig validation");
eq(Object.keys(lib.loadConfigSchema()), ["region", "replicas", "logLevel", "timeoutSeconds"], "loadConfigSchema");
eq(lib.configFromEnv({ DEPLOY_LOG_LEVEL: "debug", DEPLOY_REPLICAS: "3" }).logLevel, "debug", "configFromEnv");
eq(lib.startServer({ region: "westeurope" }).banner, "server region=westeurope replicas=1 logLevel=info timeoutSeconds=30", "startServer");
eq(lib.reloadServer(lib.startServer(), { replicas: 4 }).config.replicas, 4, "reloadServer");
eq(lib.main(["--timeoutSeconds=60"], { DEPLOY_REGION: "westus" }), "region=westus replicas=2 logLevel=info timeoutSeconds=60", "main");
eq(lib.listProblems({ replicas: "two", color: "red" }), ["replicas: expected number", "color: unknown setting"], "listProblems");
console.log("ok");
