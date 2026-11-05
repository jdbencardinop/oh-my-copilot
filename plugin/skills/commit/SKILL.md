---
name: commit
description: Split the working tree into ordered, atomic git commits with validated messages that follow the repository's conventions (like `omp commit`). Use when the user asks to commit their changes, split changes into commits, make atomic commits, or clean up a messy working tree into logical commits.
---

# Atomic commits

Turn the current uncommitted changes into a short series of small, logical commits. Each commit
should do one thing, have a message that matches the repository's style, and, where feasible,
leave the project building and passing tests.

## Hard rules

- **Never push**, never create or switch branches, and never rewrite existing history: no
  `commit --amend`, `rebase`, `reset` to another commit, `checkout -- <file>`,
  `restore` of working-tree files, `stash`, `clean`, or `push`. To unstage something you staged
  by mistake, use `git restore --staged -- <path>`; it only touches the index.
- **Never lose work.** Only the index and new commits change. Do not edit, revert, or delete
  files in the working tree.
- **Never commit secrets.** Before each commit, scan the staged diff for private keys, tokens,
  passwords, `.env` files, and credentials. Leave such changes unstaged and tell the user.
- **Never bypass hooks** (`--no-verify`) unless the user asks. If a hook fails, fix the message
  or report the failure; do not retry blindly.
- **Ask first.** Show the plan and wait for the user's approval before the first commit, unless
  the user said to go ahead without asking (for example "just do it", "don't ask"). In
  non-interactive runs where nobody can answer, proceed only if the user's request allows it.
- Do not use interactive commands (`git add -p`, `git add -i`, `git commit` without `-m`/`-F`,
  editors). Use the helper below or file-level `git add`.

## Helper

`scripts/hunks.mjs` in this skill's directory stages individual hunks without interactive
prompts. Resolve its absolute path from this skill's directory and run it with `node` from
anywhere inside the repository:

```text
node <skill-dir>/scripts/hunks.mjs snapshot          # prints a tree id; save it
node <skill-dir>/scripts/hunks.mjs list              # unstaged hunks, whole-file changes, untracked files
node <skill-dir>/scripts/hunks.mjs show <id>...      # print the patch for ids
node <skill-dir>/scripts/hunks.mjs stage <id>...     # stage exactly those items into the index
node <skill-dir>/scripts/hunks.mjs verify <tree-id>  # confirm nothing was lost
```

- Ids are content hashes (`h…` hunk, `f…` whole file such as a deletion, binary or mode change,
  `u…` untracked file). They stay valid after other items are staged or committed. An id
  disappears once its change is staged. Identical changes get a suffix (`h1a2b3c4d-2`); run
  `list` again after staging one of them.
- `stage` is all or nothing: if any item fails, the index is left as it was.
- `stage` uses `git apply --cached`, so the working tree is never touched.
- If a single hunk mixes two concerns, commit it with the concern it mostly belongs to and say so
  in the summary. Do not edit files to split it.
- If the helper cannot run (permission denied because the skill directory is outside the
  allowed paths, old Node, unusual diff), fall back:
  - whole files: `git add -- <path>`;
  - part of a file: write a patch with only the wanted hunk(s), copied verbatim from
    `git diff -- <path>` including the `diff --git`, `---` and `+++` lines, and apply it to the
    index from stdin: `git apply --cached --recount - <<'PATCH' … PATCH`. Do not write patch
    files to `/tmp` or the repository;
  - instead of `snapshot`/`verify`, record `git rev-parse HEAD`, `git diff HEAD --stat` and the
    untracked files from `git status --short` before you start, and at the end check that
    `git diff <start> HEAD --stat` plus anything left in `git status --short` covers exactly
    those files and line counts.

## Workflow

1. **Inspect.**
   - `git status --short`, `git diff --cached --stat`, `git diff --stat`, then read the diffs.
   - If changes are already staged, ask whether to keep that staging as the first commit. When
     told to proceed without asking, keep it as the first commit and split the rest.
   - Stop and report if there is a merge, rebase, cherry-pick or bisect in progress, or if there
     are unresolved conflicts.
   - Run `snapshot` and keep the tree id.
2. **Learn the message conventions.** Run `git log -n 20 --format=%s` (skip if there are no
   commits).
   - If most subjects look like Conventional Commits (`type(scope): subject`), use them with the
     types the repo already uses (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, …).
   - Otherwise match the observed style: mood, capitalization, prefixes, ticket references,
     length.
   - With no history, use short imperative subjects ("Fix off-by-one in pager").
   - Check `CONTRIBUTING.md` or a commit template (`git config commit.template`) if present.
3. **Plan.** Group hunks into commits by intent, not by file: a bug fix, a refactor, a feature,
   docs, tests, formatting, dependency bumps. Keep a feature and its tests together. Keep
   generated files (lockfiles) with the change that produced them.
4. **Order.** Put commits in dependency order so each one stands on its own: refactors and
   helpers before the code that uses them, fixes before features that rely on them, unrelated
   docs or chores in any order. A commit must not reference a symbol added in a later commit.
5. **Show the plan** as a numbered list: message, then the ids and paths in each commit. Wait for
   approval unless told not to ask.
6. **Commit, one group at a time.**
   - `stage <ids>` (or `git add -- <paths>`), then check `git diff --cached --stat` matches the
     plan and nothing unrelated is staged.
   - Scan the staged diff for secrets.
   - Where it is cheap and the project has a fast check (a build, a type check, a test
     command), run it on the staged state only when the unstaged changes cannot affect it;
     otherwise skip it and say so. Never stash to test.
   - Commit with `git commit -m "<subject>" [-m "<body>"]`. Keep the subject at 72 characters
     or less, without a trailing period. Add a body only when the reason is not obvious.
   - Add any trailers that the user's or the repository's instructions require.
7. **Validate.**
   - `node <skill-dir>/scripts/hunks.mjs verify <tree-id>` must print `OK` (or run the fallback
     check above). If it prints `FAIL`, stop and report; do not try to repair history.
   - `git status --short` should be empty, except for changes you deliberately left out
     (secrets, or changes the user excluded).
   - `git log --oneline -n <k>` shows the new commits in order; check each subject against the
     conventions.
8. **Report** the commits (hash and subject), anything left uncommitted and why, and any check
   you skipped.
