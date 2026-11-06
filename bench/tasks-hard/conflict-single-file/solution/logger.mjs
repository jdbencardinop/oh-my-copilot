// Minimal structured logger used by the shop services.
// Levels, lowest first: trace, debug, info, warn, error.

export const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"];

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
    .map(([k, v]) => `${k}=${typeof v === "string" && /\s/.test(v) ? JSON.stringify(v) : v}`)
    .join(" ");
  return `[${name}] ${level.toUpperCase()} ${message}${extra ? " " + extra : ""}`;
}

export function createLogger(options = {}) {
  const name = options.name ?? "app";
  const sink = options.sink ?? console.log;
  const level = options.level ?? "warn";
  const threshold = levelIndex(level);

  const logger = {};
  for (const lvl of LEVELS) {
    logger[lvl] = levelIndex(lvl) < threshold ? NOOP : (message, fields) => sink(format(name, lvl, message, fields));
  }
  logger.child = (suffix) => createLogger({ ...options, name: `${name}:${suffix}` });
  return logger;
}

export function isEnabled(logger, level) {
  return logger[level] !== NOOP;
}
