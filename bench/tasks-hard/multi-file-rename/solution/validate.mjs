import { loadConfigSchema } from "./config.mjs";

/**
 * Lists problems in a raw settings object without throwing. Unlike
 * resolveConfig(), this does not apply defaults.
 */
export function listProblems(settings) {
  const problems = [];
  for (const [key, type] of Object.entries(loadConfigSchema())) {
    if (key in settings && typeof settings[key] !== type) problems.push(`${key}: expected ${type}`);
  }
  for (const key of Object.keys(settings)) {
    if (!(key in loadConfigSchema())) problems.push(`${key}: unknown setting`);
  }
  return problems;
}
