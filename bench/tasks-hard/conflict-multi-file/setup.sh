# Leaves a merge of branch `feature/suspend` into the current branch in
# progress, with conflicts in limits.mjs, users.mjs and teams.mjs.
set -e
base=$(git rev-parse --abbrev-ref HEAD)
git checkout -q -b feature/suspend

# theirs: hide suspended records, raise the maximum page size, 404 on missing records
python3 - <<'PY'
import re
s = open("limits.mjs").read()
s = s.replace("export const MAX_LIMIT = 100;", "export const MAX_LIMIT = 200;")
open("limits.mjs", "w").write(s)
for kind in ("user", "team"):
    p = f"{kind}s.mjs"
    s = open(p).read()
    s = s.replace(f"filter(({kind}) => !{kind}.deleted);", f"filter(({kind}) => !{kind}.deleted && !{kind}.suspended);")
    s = s.replace(f"  return {kind} ? present({kind}) : null;", f"  if (!{kind}) throw new NotFoundError(`{kind} ${{id}} not found`);\n  return present({kind});")
    open(p, "w").write(s)
PY
git commit -qam "Hide suspended users and teams; throw NotFoundError"

git checkout -q "$base"
# ours: sort lists by name, larger default page, email on user details
python3 - <<'PY'
s = open("limits.mjs").read()
s = s.replace("export const DEFAULT_LIMIT = 25;", "export const DEFAULT_LIMIT = 50;")
open("limits.mjs", "w").write(s)
for kind in ("user", "team"):
    p = f"{kind}s.mjs"
    s = open(p).read()
    s = s.replace("export class NotFoundError extends Error {}\n", "export class NotFoundError extends Error {}\n\nconst byName = (a, b) => a.name.localeCompare(b.name);\n")
    s = s.replace(f"filter(({kind}) => !{kind}.deleted);", f"filter(({kind}) => !{kind}.deleted).sort(byName);")
    if kind == "user":
        s = s.replace("  return user ? present(user) : null;", "  return user ? { ...present(user), email: user.email } : null;")
    open(p, "w").write(s)
PY
git commit -qam "Sort lists by name, default page of 50, user email"

if git merge -q --no-edit feature/suspend >/dev/null 2>&1; then
  echo "expected merge conflicts" >&2
  exit 1
fi
test "$(grep -c '^<<<<<<<' limits.mjs)" = 1
test "$(grep -c '^<<<<<<<' users.mjs)" = 2
test "$(grep -c '^<<<<<<<' teams.mjs)" = 1
exit 0
