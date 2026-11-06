import { resolveConfig, describeConfig } from "./config.mjs";

export function startServer(options = {}) {
  const config = resolveConfig({ replicas: 1, ...options });
  return {
    banner: `server ${describeConfig(config)}`,
    config,
  };
}

export function reloadServer(server, changes) {
  const config = resolveConfig({ ...server.config, ...changes });
  return { ...server, config };
}
