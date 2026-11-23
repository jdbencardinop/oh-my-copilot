#!/usr/bin/env node
// Offline plugin-discovery probe.
//
// Starts Copilot CLI headless in a throwaway COPILOT_HOME, loads ./plugin with
// --plugin-dir semantics, and checks that Copilot discovers the reviewer agent,
// the commit skill, and the omc extension with its tools. No model is called:
// the provider points at a local server that rejects every request, and the
// probe fails if that server receives any request.
//
// Usage: node scripts/discovery-probe.mjs [--require]
//   COPILOT_BIN  path to the copilot binary (default: `copilot` on PATH)
//   --require    fail instead of skipping when Copilot CLI is not installed

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = join(root, "plugin");
const requireCli = process.argv.includes("--require");

const EXPECTED = {
  agents: ["oh-my-copilot:reviewer"],
  skills: ["oh-my-copilot:commit"],
  extensions: ["plugin:oh-my-copilot:omc"],
  tools: ["read_anchored", "edit_anchored", "list_conflicts", "resolve_conflicts"],
};

function findCopilot() {
  let bin = process.env.COPILOT_BIN;
  if (!bin) {
    const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
    bin = dirs.map((d) => join(d, "copilot")).find((f) => existsSync(f));
    if (!bin) return null;
  }
  bin = resolve(bin);
  const r = spawnSync(bin, ["--version"], { encoding: "utf8" });
  return r.status === 0 ? { bin, version: r.stdout.trim().split("\n")[0] } : null;
}

const cli = findCopilot();
if (!cli) {
  const msg = "Copilot CLI not found (set COPILOT_BIN or install @github/copilot).";
  if (requireCli) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`SKIP: ${msg}`);
  process.exit(0);
}

const { CopilotClient, RuntimeConnection } = await import("@microsoft/copilot-sdk");

let modelRequests = 0;
const server = http.createServer((_req, res) => {
  modelRequests++;
  res.writeHead(503);
  res.end("discovery probe: model calls are not allowed");
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;

const home = mkdtempSync(join(tmpdir(), "omc-discovery-"));
writeFileSync(join(home, "settings.json"), JSON.stringify({ experimental: true }));

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const failures = [];
const found = {};
let client;
let session;

try {
  client = new CopilotClient({
    mode: "coding-agent",
    runtime: RuntimeConnection.forSpawnedStdio({
      path: cli.bin,
      env: {
        ...process.env,
        COPILOT_HOME: home,
        COPILOT_OFFLINE: "true",
        COPILOT_PROVIDER_BASE_URL: baseUrl,
        COPILOT_PROVIDER_API_KEY: "probe",
        COPILOT_MODEL: "probe-model",
      },
    }),
    github: { useLoggedInUser: false },
    observability: { logLevel: "error" },
  });
  await client.start();

  session = await client.createSession({
    model: "probe-model",
    github: { capi: { enabled: false } },
    inference: {
      providers: [{ name: "probe", type: "openai", baseUrl, apiKey: "probe" }],
      defaultProvider: "probe",
    },
    plugins: { directories: [pluginDir] },
    experiments: { enableExperimentalMode: true },
    extensions: { enabled: true },
    workingDirectory: home,
    // Allow only the extension to load; refuse every tool or shell request.
    permissions: {
      onRequest: (req) => ({
        kind: req.kind === "extension-permission-access" ? "approve-once" : "reject",
      }),
    },
  });

  let extensions = [];
  for (let i = 0; i < 80; i++) {
    extensions = (await session.rpc.extensions.list()).extensions ?? [];
    if (extensions.length && extensions.every((e) => e.status !== "starting")) break;
    await sleep(250);
  }

  found.agents = ((await session.rpc.agent.list()).agents ?? []).map((a) => a.id ?? a.name);
  found.skills = ((await session.rpc.skills.list()).skills ?? []).map((s) => s.commandName ?? s.name);
  found.extensions = extensions.filter((e) => e.status === "running").map((e) => e.id);
  const metadata = await session.rpc.tools.getCurrentMetadata();
  found.tools = (metadata.tools ?? []).map((t) => t.name);

  for (const [kind, names] of Object.entries(EXPECTED)) {
    for (const name of names) {
      if (!found[kind].includes(name)) failures.push(`missing ${kind.replace(/s$/, "")}: ${name}`);
    }
  }
  const notRunning = extensions.filter((e) => e.id.startsWith("plugin:oh-my-copilot:") && e.status !== "running");
  for (const e of notRunning) failures.push(`extension ${e.id} is ${e.status}`);
} catch (err) {
  failures.push(`probe error: ${err?.message ?? err}`);
} finally {
  await session?.disconnect?.().catch(() => {});
  await client?.stop().catch(() => {});
  server.close();
  rmSync(home, { recursive: true, force: true });
}

if (modelRequests > 0) failures.push(`model provider received ${modelRequests} request(s); expected 0`);

console.log(`Copilot CLI ${cli.version}`);
for (const kind of Object.keys(EXPECTED)) {
  const ours = found[kind]?.filter((n) => EXPECTED[kind].includes(n)) ?? [];
  console.log(`  ${kind}: ${ours.join(", ") || "(none)"}`);
}
console.log(`  model requests: ${modelRequests}`);

if (failures.length) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  process.exit(1);
}
console.log("PASS: plugin discovered offline");
