import { loadConfig, loadConfigSchema } from "./config.mjs";

// Reads DEPLOY_* variables and converts them to the types the schema expects.
export function configFromEnv(env) {
  const schema = loadConfigSchema();
  const overrides = {};
  for (const key of Object.keys(schema)) {
    const name = "DEPLOY_" + key.replace(/[A-Z]/g, (c) => "_" + c).toUpperCase();
    if (env[name] === undefined) continue;
    overrides[key] = schema[key] === "number" ? Number(env[name]) : env[name];
  }
  return loadConfig(overrides);
}
