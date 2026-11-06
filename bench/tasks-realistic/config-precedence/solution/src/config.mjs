import { defaults } from "./defaults.mjs";
import { parseEnv } from "./parse-env.mjs";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function copy(value) {
  if (Array.isArray(value)) return value.map(copy);
  if (isObject(value)) return merge({}, value);
  return value;
}

function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const existing = Object.hasOwn(target, key) ? target[key] : undefined;
    const next = isObject(value) ? merge(isObject(existing) ? existing : {}, value) : copy(value);
    Object.defineProperty(target, key, { value: next, enumerable: true, writable: true, configurable: true });
  }
  return target;
}

export function buildConfig({ project = {}, env = {}, overrides = {} } = {}) {
  return [defaults, project, parseEnv(env), overrides].reduce(merge, {});
}
