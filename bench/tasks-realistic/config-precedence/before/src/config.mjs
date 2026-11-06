import { defaults } from "./defaults.mjs";
import { parseEnv } from "./parse-env.mjs";

export function buildConfig({ project = {}, env = {}, overrides = {} } = {}) {
  return { ...defaults, ...project, ...parseEnv(env), ...overrides };
}
