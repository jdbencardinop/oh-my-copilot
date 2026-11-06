// Minimal structured logger used by the shop services.

export const LEVELS = ["debug", "info", "warn", "error"];

const NOOP = () => {};

function levelIndex(level) {
  const i = LEVELS.indexOf(level);
  if (i < 0) throw new RangeError(`unknown log level ${level}`);
  return i;
}

/**
 * Formats one log line: `[name] LEVEL message key=value ...`.
 */
export function format(name, level, message, fields = {}) {
  const extra = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  return `[${name}] ${level.toUpperCase()} ${message}${extra ? " " + extra : ""}`;
}

export function createLogger(options = {}) {
  const name = options.name ?? "app";
  const sink = options.sink ?? console.log;
  const level = options.level ?? "info";
  const threshold = levelIndex(level);

  const logger = {};
  for (const lvl of LEVELS) {
    logger[lvl] = levelIndex(lvl) < threshold ? NOOP : (message, fields) => sink(format(name, lvl, message, fields));
  }
  logger.child = (suffix) => createLogger({ ...options, name: `${name}:${suffix}` });
  return logger;
}
