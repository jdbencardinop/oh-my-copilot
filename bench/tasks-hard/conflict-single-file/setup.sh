# Leaves a merge of branch `feature/levels` into the current branch in
# progress, with three conflicting hunks in logger.mjs.
set -e
base=$(git rev-parse --abbrev-ref HEAD)
git checkout -q -b feature/levels

# theirs
python3 - <<'PY'
p = "logger.mjs"
s = open(p).read()
s = s.replace('export const LEVELS = ["debug", "info", "warn", "error"];', 'export const LEVELS = ["debug", "info", "warn", "error", "fatal"];')
s = s.replace('    .map(([k, v]) => `${k}=${v}`)', '    .map(([k, v]) => `${k}=${v === undefined ? "-" : v}`)')
s = s.replace('  const level = options.level ?? "info";', '  const level = options.level ?? "warn";')
s += '''
export function isEnabled(logger, level) {
  return logger[level] !== NOOP;
}
'''
open(p, "w").write(s)
PY
git commit -qam "Add fatal level, isEnabled() and a warn default"

git checkout -q "$base"
# ours
python3 - <<'PY'
p = "logger.mjs"
s = open(p).read()
s = s.replace('export const LEVELS = ["debug", "info", "warn", "error"];', 'export const LEVELS = ["trace", "debug", "info", "warn", "error"];')
s = s.replace('    .map(([k, v]) => `${k}=${v}`)', '    .map(([k, v]) => `${k}=${typeof v === "string" && /\\s/.test(v) ? JSON.stringify(v) : v}`)')
s = s.replace('  const level = options.level ?? "info";', '  const level = options.level ?? process.env.LOG_LEVEL ?? "debug";')
s = s.replace("// Minimal structured logger used by the shop services.", "// Minimal structured logger used by the shop services.\n// Levels, lowest first: trace, debug, info, warn, error.")
open(p, "w").write(s)
PY
git commit -qam "Add trace level, quote values with spaces, LOG_LEVEL default"

if git merge -q --no-edit feature/levels >/dev/null 2>&1; then
  echo "expected merge conflicts" >&2
  exit 1
fi
test "$(grep -c '^<<<<<<<' logger.mjs)" = 3
exit 0
