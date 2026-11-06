import * as cfg from "./config.mjs";
import { configFromEnv } from "./env.mjs";

export function parseArgs(argv) {
  const overrides = {};
  for (const arg of argv) {
    const m = /^--([a-zA-Z]+)=(.*)$/.exec(arg);
    if (!m) continue;
    const type = cfg.loadConfigSchema()[m[1]];
    if (!type) throw new Error(`unknown option --${m[1]}`);
    overrides[m[1]] = type === "number" ? Number(m[2]) : m[2];
  }
  return overrides;
}

export function main(argv, env = {}) {
  const base = configFromEnv(env);
  const config = cfg.loadConfig({ ...base, ...parseArgs(argv) });
  return cfg.describeConfig(config);
}
