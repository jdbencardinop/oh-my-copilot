import { loadConfig, describeConfig } from "./config.mjs";

export function startServer(options = {}) {
  const config = loadConfig({ replicas: 1, ...options });
  return {
    banner: `server ${describeConfig(config)}`,
    config,
  };
}

export function reloadServer(server, changes) {
  const config = loadConfig({ ...server.config, ...changes });
  return { ...server, config };
}
