<img src="assets/icon.svg" width="64" height="64" alt="">

# oh-my-copilot

oh-my-copilot is a GitHub Copilot CLI plugin that brings ideas from [oh-my-pi](https://github.com/can1357/oh-my-pi) to Copilot. It is a proof of concept, tested on Copilot CLI 1.0.105.

It adds five things to Copilot:

- **Hash-anchored editing.** `read_anchored` shows each line as `LINE:HASH|content`. `edit_anchored` then edits by anchor, for example `12:ab`, instead of retyping the old text. If an anchor no longer matches, nothing is written. The error shows current lines you can use to retry. The plugin tells the model to prefer these tools, so you do not have to.
- **Merge-conflict tools.** `list_conflicts` gives each conflict an id and shows ours, base and theirs. `resolve_conflicts` resolves conflicts by id with `ours`, `theirs`, `base`, both sides, or custom text. See [Resolve merge conflicts](#resolve-merge-conflicts).
- **Tool-call rules.** Rules in `rules.json` run before every tool call, and optionally after it. A rule can deny the call, ask the user, or add a note for the model. Rules can be scoped to files with globs such as `src/**/*.ts`.
- **Optional rule imports.** Import Cursor, Cline and Windsurf instructions without copying them. This OMP-inspired behavior is added by OMC, not native Copilot. Imports are off by default; enable all sources or select individual files and directories.
- **A `/omc` command.** It shows status and turns features on or off for the current session.

If anything goes wrong, Copilot keeps working as normal. See [Turn it off](#turn-it-off).

For the background, comparisons, and roadmap, read [docs/investigation.md](docs/investigation.md). For measured speed and token savings, read [docs/benchmark.md](docs/benchmark.md).

## Try it

Copilot only loads extensions when experimental features are on.

Run it from this checkout:

```bash
copilot --experimental --plugin-dir ./plugin
```

Or [install it from the marketplace](#install-from-the-marketplace), then start Copilot with `--experimental`. You can also set `"experimental": true` in `~/.copilot/settings.json` instead of passing the flag.

> [!WARNING]
> `--experimental` is not limited to one session. Copilot saves it as `"experimental": true` in the profile's `settings.json`, so every later session that uses the same profile also runs with experimental features on. That includes apps that embed Copilot, such as T3 Code, which can then fail with `extensionSdkPath is required` or fail to resume sessions. To keep it contained, run with a separate profile (see [Test it without touching your setup](#test-it-without-touching-your-setup)), for example `COPILOT_HOME=~/.copilot-omc copilot --experimental …`. To undo it, set `"experimental": false` in `~/.copilot/settings.json`.

### Install from the marketplace

This repository is also a Copilot plugin marketplace. Its catalog is [`.github/plugin/marketplace.json`](.github/plugin/marketplace.json).

1. Add the marketplace:

   ```bash
   copilot plugin marketplace add jdbencardinop/oh-my-copilot
   ```

   To use a local checkout instead, pass its absolute path, such as `copilot plugin marketplace add "$PWD"`. Copilot can read a relative path as a GitHub `owner/repo`.

2. Install the plugin:

   ```bash
   copilot plugin install oh-my-copilot@oh-my-copilot
   ```

3. Start Copilot with `--experimental`, and type `/omc status` to confirm that the plugin is active.

To get a newer version, run `copilot plugin marketplace update oh-my-copilot`, then `copilot plugin update oh-my-copilot@oh-my-copilot`. A plugin installed from a local marketplace loads straight from your checkout, so code changes take effect the next time you start Copilot.

`copilot plugin install ./plugin` also still works, but Copilot warns that installing from a local path is deprecated, and it installs a copy that you must reinstall after each change.

### Test it without touching your setup

A separate `COPILOT_HOME` keeps test sessions, settings, and installed plugins away from your normal Copilot:

```bash
export COPILOT_HOME=$(mktemp -d)
cp ~/.copilot/config.json "$COPILOT_HOME/"   # sign-in only
mkdir -p /tmp/omc-play && cd /tmp/omc-play && git init -q
copilot --experimental --plugin-dir /path/to/oh-my-copilot/plugin
```

Then try it:

1. Run `/omc status`.
2. Ask: "Create `notes.txt` with three lines, then change the second line." Copilot should edit it with `read_anchored` and `edit_anchored`.
3. Optional: copy [examples/rules.json](examples/rules.json) to `.github/omc/rules.json`, and ask Copilot to run `git push --force`. The `confirm-force-push` rule stops and asks you first.
4. Run `/omc off rules`, and repeat step 3. Copilot no longer asks because of the rule.

> **Use oh-my-copilot in interactive sessions, not `copilot -p`.** Prompt mode is not supported. Nobody can answer `ask` rules or permission prompts, and if stream rules are on, a fire cancels the run with exit code 1 and the work is lost. A snapshot-before-exit safeguard is on the roadmap.

See [How Copilot picks the anchored tools](#how-copilot-picks-the-anchored-tools).

## How Copilot picks the anchored tools

The plugin adds two tools: **`read_anchored`** and **`edit_anchored`**. On their own, the models ignore them: in the [benchmark](docs/benchmark.md), neither model used them without being told. When told, edits were about 20–25% faster and used 37–46% fewer output tokens.

So the plugin tells them. On the first prompt of each session, it adds this note as hidden context (the `nudge` feature):

```text
Use `read_anchored` and `edit_anchored` to read and edit existing text files, instead of `view` and `edit`. Read the file with `read_anchored` first, then edit it with `edit_anchored` using the `LINE:HASH` anchors it returns. If an anchor is rejected, retry with a current anchor from the error only if you recognize the target; otherwise use `read_anchored` again. If these tools are not available or report that they are turned off, use `view` and `edit` as usual. Use `create` only for new files.
```

- **It costs about 100 tokens once per session.** The note stays in the conversation, so later prompts add nothing.
- **It follows the kill switches.** No note is sent while `hashline` or `nudge` is off, from any source: `OMC_DISABLE`, `OMC_DISABLE_FEATURES`, a config file, `/omc off`, or the circuit breaker. If you turn it off after the note was sent, the next prompt tells the model to go back to the built-in tools. Turning it back on sends the note again. Use the same form you turned it off with: `/omc on` after `/omc off`, or `/omc on nudge` after `/omc off nudge`. A bare `/omc on` does not clear per-feature overrides.
- **It is checked.** In a [small live check](docs/benchmark.md#spot-check-the-plugins-own-nudge), 3 of 3 runs used the anchored tools with no hint in the prompt, and a run with `OMC_DISABLE=1` used the built-in tools.

To keep the anchored tools but stop the note, use `/omc off nudge`, `OMC_DISABLE_FEATURES=nudge`, or `{"features": {"nudge": false}}`. Then you can still ask for the tools in a prompt (for example, "Use the read_anchored and edit_anchored tools to read and edit files."), or put the text above in `~/.copilot/copilot-instructions.md` or `.github/copilot-instructions.md`. The sentence "If these tools are not available…" keeps that fallback working when the plugin is off.

### Retry a rejected anchored edit

If an anchor is stale or out of range, `edit_anchored` rejects the whole batch. The error shows the current line and up to two lines on either side. For a request past the end, the preview ends at the last line; for line `0`, it starts at the first. Long lines are shortened for display, but their anchors still hash the full line as usual.

If you recognize the target, use its displayed `LINE:HASH` and resubmit the batch. If the preview is ambiguous or the target is missing, use `read_anchored` to inspect the intended range first. Nearby lines with the same short hash are hints, not proof that the text moved. The tool never relocates an edit. An empty file has no numbered anchors; to add its first line, use `insert_after` with `BOF`.

## Resolve merge conflicts

The `conflicts` feature adds two tools, modeled on oh-my-pi's `conflict://` handles:

- **`list_conflicts`** lists the conflicts in every unmerged file (from `git ls-files -u`), or in the files or folders you pass. Each conflict gets an id such as `src/app.js#2@k3vq7m`, plus its line range, the ours, base and theirs lines with their labels, and two lines of context. The base appears only with `merge.conflictStyle=diff3` or `zdiff3`.
- **`resolve_conflicts`** takes a list of `{id, resolution, content?}`. `resolution` is `ours`, `theirs`, `base`, `both-ours-first`, `both-theirs-first`, or `custom` with `content`.

What it guarantees:

- **Each file is all-or-nothing.** One bad id or resolution means that file is not written.
- **Stale ids are rejected.** The id ends with a hash of the conflict, so if the conflict changed since it was listed, the call fails and asks for a fresh list. The hash also covers the line before and after the conflict, so resolving one conflict does not invalidate the ids of the others. If two conflicts in a file have identical content, their ids go stale on any change to the file instead of risking the wrong one.
- **The file format is kept.** Line endings (LF or CRLF), a byte-order mark, and a missing final newline stay as they were.
- **Nothing is staged unless you ask.** The result names the files with no conflicts left and suggests `git add`. Pass `stage: true` to run `git add` on them.
- **It stays inside the project.** Paths are relative to the session's working directory, and paths outside the repository root are refused.

While a merge, cherry-pick, revert or rebase is in progress, the first prompt also gets a short hidden note that lists the conflicted files and points the model at these tools. It is sent again only when that list changes, and only while `conflicts` and `nudge` are on. Outside those operations no git command runs; during them the check uses read-only git commands and gives up after 2 seconds. In a live check with Claude Haiku 4.5, the model resolved a two-conflict merge in two calls (`list_conflicts`, then `resolve_conflicts` with `theirs` and `ours`).

To turn the tools off, use `/omc off conflicts`, `OMC_DISABLE_FEATURES=conflicts`, or `{"features": {"conflicts": false}}`. Like the anchored tools, they stay listed after `/omc off` and refuse calls.

## Commit splitting and code review

The plugin also ships a skill and a custom agent. Both are plain Copilot features: they need no extension and no `--experimental`, so they keep working even with `OMC_DISABLE=1`.

### `commit` skill: atomic commits

Ask Copilot to "split my changes into atomic commits". It loads the `commit` skill, which works like `omp commit`:

1. It reads `git status` and the staged and unstaged diffs, and learns the message style from `git log` (Conventional Commits if the repository uses them).
2. It groups hunks by intent (fix, refactor, feature, docs), orders the commits so each one stands on its own, and shows you the plan. It waits for your approval unless you said to go ahead.
3. It stages each group with a helper, commits, and then checks that nothing was lost.

It never pushes, never rewrites existing commits, never touches the working tree, and leaves anything that looks like a secret unstaged.

The helper, [`scripts/hunks.mjs`](plugin/skills/commit/scripts/hunks.mjs), stages single hunks without `git add -p`. It lists hunks with stable ids, stages the ones you pick with `git apply --cached`, and records a snapshot of the working tree to verify against at the end. You can also run it yourself:

```bash
node plugin/skills/commit/scripts/hunks.mjs list            # ids for hunks, whole-file changes, untracked files
node plugin/skills/commit/scripts/hunks.mjs stage h1a2b3c4d
node plugin/skills/commit/scripts/hunks.mjs snapshot        # before; prints a tree id
node plugin/skills/commit/scripts/hunks.mjs verify <tree-id>
```

> [!NOTE]
> The helper lives in the plugin folder, outside your repository, so Copilot asks for permission to run it. In `-p` mode, where nobody can answer, add `--add-dir <plugin folder>` (or approve the folder once interactively). If the helper is denied, the skill falls back to file-level staging and hand-written patches.

### `reviewer` agent: P0 to P3 findings and a ship verdict

Ask Copilot to "use the reviewer agent to review my changes", or select it with `/agent`. It shows up as `oh-my-copilot:reviewer`. Like OMP's `/review`, it reviews uncommitted changes by default, or a commit, branch or files you name, and grades each finding:

| Level | Meaning |
|---|---|
| P0 | Must fix: security hole, data loss, crash, broken build |
| P1 | Bug: wrong result, unhandled error, regression |
| P2 | Risk or maintainability concern |
| P3 | Nit, only when you ask for nits |

Each finding gives a `file:line` location, evidence, impact, and a fix. The answer ends with `VERDICT: SHIP`, `VERDICT: SHIP WITH FIXES`, or `VERDICT: DO NOT SHIP`. The agent only has read, search and shell tools, and its instructions limit the shell to read-only commands such as `git diff` and running existing tests.

To turn them off, disable the plugin, or turn off the skill with `/skills` or `"disabledSkills": ["commit"]` in `settings.json`. The `/omc` switches do not cover them, because they are not part of the extension.

## Turn it off

You can return to plain Copilot without uninstalling anything:

| When | Do this |
|---|---|
| Right now, this session only | `/omc off`, or `/omc off <feature>` for one feature (`hashline`, `nudge`, `rules`, `imports`, `streamRules`, `conflicts`) |
| Next launch only | Start Copilot with `OMC_DISABLE=1`, or `OMC_DISABLE_FEATURES=rules` |
| Every session | `copilot plugin disable oh-my-copilot` |
| Every session, keeping the plugin enabled | Add `"extensions": {"disabledExtensions": ["plugin:oh-my-copilot:omc"]}` to `~/.copilot/settings.json` |
| One project | Put `{"enabled": false}` in `.github/omc/config.json` |
| All extensions | Set `"extensions": {"mode": "disabled"}` in `~/.copilot/settings.json` |

**After `/omc off`, the plugin's tools are still listed.** Copilot does not let an extension remove its tools mid-session. They refuse calls, so the model falls back to the built-in tools.

oh-my-copilot also protects itself:

- errors never block a tool call;
- a feature that fails three times in a row turns itself off until you run `/omc reset`.

## Configure

oh-my-copilot reads two optional files from each of two places. Project files take precedence over user files.

| File | User location | Project location |
|---|---|---|
| Settings | `~/.copilot/omc/config.json` | `.github/omc/config.json` |
| Rules | `~/.copilot/omc/rules.json` | `.github/omc/rules.json` |

It looks for the project folder from the session's working directory upward, and stops at the repository root. Edits to these files take effect on the next tool call. `/omc reload` re-reads them and clears any `/omc` overrides.

`config.json` accepts `enabled`, `features.hashline`, `features.nudge`, `features.rules`, `features.imports`, `features.streamRules`, `features.conflicts`, `importPaths`, and `circuitBreakerThreshold`. Every feature is on by default except `imports` and `streamRules`. `nudge` controls the hidden notes: the anchored-tools note (only while `hashline` is on) and the merge-conflict note (only while `conflicts` is on). See [examples/config.json](examples/config.json).

### Rules

A rules file holds `{"rules": [...]}`. See [examples/rules.json](examples/rules.json).

| Field | Required | Meaning |
|---|---|---|
| `pattern` | Yes, unless `paths` or `pathPattern` is set | JavaScript regular expression to match. Without it, every call that passes the other filters matches. |
| `id` | No | Name shown in messages, as `[omc rule <id>]` |
| `when` | No | `pre` (default) checks the call before it runs. `post` checks it after it ran; see [Post rules](#post-rules). |
| `action` | No | `deny` (default), `ask`, `context`, or `interrupt`. Post rules only allow `context`, which is also their default. For `interrupt`, see [Stream rules](#stream-rules). |
| `scope` | No | Only for `interrupt` rules: what the rule watches. See [Stream rules](#stream-rules). |
| `message` | No | Reason shown to the user and the model |
| `tools` | No | Tool names to check, for example `["bash"]`. By default every tool is checked. |
| `paths` | No | Glob, or list of globs, that a target file must match. See [Path globs](#path-globs). |
| `pathPattern` | No | Regular expression that the target file path, as the tool received it, must match |
| `field` | No | Which text `pattern` is matched against. Pre rules: `auto` (default), `all`, or a dotted argument path such as `command`. Post rules: see below. |
| `flags` | No | Regex flags: any of `i`, `m`, `s`, `u` |
| `enabled` | No | `false` skips the rule |

With `field: "auto"`, a rule matches what the tool would run or write:

- the command for `bash`;
- `new_str` for `edit`;
- `file_text` for `create`;
- the new lines for `edit_anchored` and `apply_patch`;
- every string argument, for any other tool.

When several rules match, `deny` wins over `ask`, and `ask` wins over `context`. A rule that is invalid is skipped, and Copilot shows a warning.

#### Path globs

`paths` limits a rule to tool calls whose target file matches. Paths are matched relative to the project root (the nearest folder with `.git`, or the working directory).

```json
{ "id": "no-generated-edits", "tools": ["edit", "create", "edit_anchored", "apply_patch"],
  "paths": ["src/generated/**", "!**/README.md"], "message": "Change the generator instead." }
```

- `*` matches within one folder, `**` matches any number of folders, `?` matches one character.
- `{ts,tsx}` matches either word, and `[0-9]` matches a character range.
- A pattern without `/`, such as `*.ts`, matches the file name in any folder.
- A pattern that starts with `!` excludes files. A file matches when it matches any normal pattern and no `!` pattern. A list with only `!` patterns matches every other file.
- Files outside the project are matched by their absolute path.
- Matching does not backtrack, and its cost is capped, so a hostile pattern cannot stall Copilot. A glob is rejected if it is longer than 1,024 characters, or if its `{a,b}` alternatives add up to more than 2,048 path segments. A path longer than 4,096 characters, or with more than 256 segments, never matches.

The target file comes from the tool's `path` argument, or from the file headers of `apply_patch`. Shell commands have no target file, so a `paths` rule never matches `bash`. Add `tools` when a rule should only cover edits: without it, reading a matching file with `view` also matches.

#### Stream rules

An `interrupt` rule can stop the model while it is still writing. This is off by default. The rest of this section explains when to turn it on.

```json
{ "id": "no-console-log", "action": "interrupt", "pattern": "console\\.log\\(",
  "message": "Never use console.log in this project. Write output with process.stdout.write instead." }
```

**With `streamRules` off (the default),** an `interrupt` rule works like a `deny` rule for tool calls: a matching call is refused, and the model sees the message. Text that only appears in the model's reply is ignored. This costs nothing and has no side effects.

**With `streamRules` on,** oh-my-copilot also reads the response as it streams. When the rule matches:

1. it stops the response, before a matching tool call runs;
2. it removes that unfinished response from the conversation;
3. it sends the model a reminder, `[omc rule <id>] <message>`, and asks it to redo the work. The chat shows `[omc rule <id>] interrupted; retrying with the rule`.

The `deny` behavior stays as a backstop, in case the call finishes before the stop lands. If the response does not stop cleanly, or removing it from the conversation times out, oh-my-copilot sends no retry. It tells you the rule fired and asks you to send your prompt again.

To turn it on, put `{"features": {"streamRules": true}}` in `~/.copilot/omc/config.json` or `.github/omc/config.json`, then start Copilot. The setting is read when Copilot starts, because that is when the plugin asks Copilot for the streamed response. `/omc on streamRules` in a running session only turns on the `deny` behavior until you restart. `/omc off streamRules`, and every other kill switch, stops it at once.

`scope` picks what the rule watches. It can be a word or a list:

| Scope | Watches |
|---|---|
| `text` (or `message`) | The model's reply text |
| `tools` (or `tool_args`, `tool`) | The arguments of tool calls, using the same `field`, `tools`, `paths` and `pathPattern` as a `deny` rule |
| `reasoning` | The model's hidden reasoning. Not watched unless you ask, because models often think about what not to do. |

By default a rule watches `text` and `tools`, or only `tools` when it has `tools`, `paths` or `pathPattern`. `text` and `reasoning` need a `pattern`. A `paths` rule waits until the file path has fully streamed in.

Limits:

- each rule fires at most once per prompt you send;
- at most 3 interruptions per prompt, and 20 per session;
- a rule does not fire during a prompt that itself matches the rule, so you can still ask about the thing it forbids;
- responses from sub-agents are not watched;
- `/omc status` shows whether the stream is watched and how often each rule fired.

> **Warning: do not use stream rules with `copilot -p`.** In prompt mode, Copilot treats the stop as a cancel and exits with code 1 before the retry is sent. The work is not done. Use it in interactive sessions only.
>
> **Each interruption costs at least one more model request,** because the model starts its answer again. In a test, one interruption about doubled the AI credits used by a short task.

#### Post rules

A rule with `"when": "post"` runs after a tool call finished, and adds its `message` as a note for the model. It cannot block anything, because the tool already ran. Use it to point out problems in a result:

```json
{ "id": "tests-failed", "when": "post", "tools": ["bash"],
  "pattern": "^(FAIL|not ok)\\b|\\b[1-9]\\d* (failed|failing)\\b", "flags": "m",
  "message": "The test run reported failures. Fix them before moving on." }
```

For post rules, `field` can be:

- `auto` or `result` (default): the tool's output, or its error message if it failed;
- `file`: the target files as they are after the tool ran (up to 1 MB each), for example to check a whole file after an edit;
- `all`: the arguments and the output;
- a dotted argument path, such as `command`.

### Native Copilot instructions versus OMC imports

Copilot CLI already reads these instruction files without this plugin, according to [GitHub's instruction-file documentation](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions):

| Native location | Scope |
|---|---|
| `~/.copilot/copilot-instructions.md` | User instructions across repositories |
| `~/.copilot/instructions/**/*.instructions.md` | Modular user instructions |
| `.github/copilot-instructions.md` | Repository instructions; not an entire `.github/copilot/` directory |
| `.github/instructions/**/*.instructions.md` | Path-specific instructions using `applyTo` |
| `AGENTS.md` | Agent instructions |
| `CLAUDE.md` and `.claude/CLAUDE.md` | Agent instructions, not limited to choosing a Claude model |
| `GEMINI.md` | Agent instructions, not limited to choosing a Gemini model |
| Directories in `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` | Additional `AGENTS.md` and `*.instructions.md` files |

`COPILOT_HOME` replaces `~/.copilot` for user-level files. Repository and agent files are discovered at the repository root, working directory, intermediate directories and directories along files being worked on; modular repository instruction discovery excludes intermediate directories. Use Copilot's `/instructions` to inspect and toggle native files. Applicable instructions are combined; GitHub does not define a general precedence order. OMC does not re-import these files or control them with `/omc`.

The current official CLI file list does not list `.claude/rules`; OMC does not import that directory either.

### Imported project rules (opt-in)

Importing other agents' rule formats is inspired by [OMP's discovery providers](https://github.com/can1357/oh-my-pi/tree/main/packages/coding-agent/src/discovery), not built into Copilot CLI. OMC supports these extra files under the project root:

| File | How it is used |
|---|---|
| `.cursor/rules/**/*.mdc` with `alwaysApply: true` | Added to the first prompt of the session |
| `.cursor/rules/**/*.mdc` with `globs` | Added once per session, the first time Copilot reads or edits a matching file |
| `.cursor/rules/**/*.mdc` with only a `description` | Listed by path and description in the first prompt, so the model can read the file when it is relevant |
| `.cursor/rules/**/*.mdc` with none of these | Not imported. In Cursor these rules apply only when you mention them. |
| `.cursorrules` | Added to the first prompt |
| `.clinerules` file, or `*.md` and `*.txt` files in a `.clinerules/` folder | Added to the first prompt. A `paths:` list in the file's frontmatter makes it glob-scoped instead. |
| `.windsurf/rules/**/*.md` with `trigger: always_on` | Added to the next prompt |
| `.windsurf/rules/**/*.md` with `trigger: glob` and `globs` | Added when a file tool targets a matching file |
| `.windsurf/rules/**/*.md` with `trigger: model_decision` (or `agent`) and `description` | Listed by path and description; the model decides whether to read it |
| `.windsurf/rules/**/*.md` with `trigger: manual`, or no trigger | Not automatically imported |
| `.windsurfrules` and `.windsurf/global_rules.md` | Always-on project instructions; `paths:` or `globs:` frontmatter scopes them |

These are natural-language instructions, not enforced `rules.json` deny/ask rules. They reach the model as hidden context and stay in the conversation. Windsurf activation modes follow its documented [rule format](https://docs.devin.ai/cli/extensibility/rules.md); missing triggers are conservatively treated as manual. OMC does not import user-global Windsurf memories, nested workspace roots, `.devin` rules, or arbitrary other formats. Those need separate compatibility work rather than treating every Markdown file as always-on.

Select imports for this session:

```text
/omc on imports .clinerules
/omc on imports .cursorrules
/omc on imports .windsurf/rules
/omc off imports .windsurf/rules/legacy.md
/omc on imports ".cursor/rules/Style Guide.mdc"
/omc status
```

Starting from the default, the first command enables **only Cline**. Paths are literal, case-sensitive, project-relative files or directories, not globs; the most specific selection wins. A bare `/omc on imports` enables all supported sources except explicit path exclusions. `/omc off imports` pauses every import, including selected paths. Enabling a path after that pause starts a fresh, selective session selection. `/omc reload` clears session switches and restores config-file choices. Environment kill switches and the circuit breaker still apply.

To persist a Cline-only selection, put this in `.github/omc/config.json` or your Copilot home's `omc/config.json`:

```json
{
  "importPaths": {
    ".clinerules": true
  }
}
```

`features.imports` sets the default for unselected sources (false by default); `importPaths` overrides individual files or directories. Thus `{"features":{"imports":true},"importPaths":{".cursorrules":false}}` enables everything except legacy Cursor rules. User configuration, project configuration and session path choices layer in that order. `OMC_DISABLE_FEATURES=imports` disables all of them.

- **Size limits.** Always-on rules and on-request indexes together carry at most 12,000 characters per session; a glob-scoped rule carries at most 6,000, and all glob-scoped rules together at most 24,000. Switching paths off and on does not reset those budgets. Longer rules are cut, with a note telling the model which file to read for the rest. Rules that do not fit are listed or skipped. `/omc status` lists files cut or left out.
- **When rules change.** Files are cached per session and selection. Changing the selection reloads selected files; otherwise edits apply to the next session. Newly enabled always-on rules arrive on the next prompt; glob rules arrive on the next matching file-tool call.
- **Only regular files inside the project.** Symlinks are skipped with a warning, as are files that resolve outside the project root, so a cloned repository cannot pull in files such as `~/.aws/credentials`.
- **Glob-scoped rules need a file tool.** They are triggered by `view`, `create`, `edit`, `read_anchored`, `edit_anchored` and `apply_patch`, not by shell commands.
- **Opt-in, with a soft retraction.** Disabled rule contents are not read, even by `/omc status`. Turning a source off after it was sent adds a request on the next prompt to stop following those files, without retracting unaffected imports. This cannot erase earlier context or guarantee that the model forgets it; start a new session for a clean boundary. Avoid enabling imports already copied into native Copilot instruction files.

## Develop

```bash
npm test
```

The tests use Node's built-in test runner and need Node 20 or later. They do not need Copilot CLI.

To check that Copilot CLI really discovers the plugin, run the offline discovery probe:

```bash
npm run test:discovery
```

It starts Copilot headless in a throwaway `COPILOT_HOME`, loads `./plugin`, and checks for the `reviewer` agent, the `commit` skill, the `omc` extension and its four tools. It needs no sign-in and makes no model calls: the model provider is a local server that rejects every request, and the probe fails if that server is called at all. If Copilot CLI is not installed, the probe skips; pass `-- --require` to make that a failure. Set `COPILOT_BIN` to test a specific Copilot binary.

CI runs `npm test` on Node 20, 22 and 24, and the discovery probe against Copilot CLI 1.0.114 with the locked SDK version. The probe requires compatible CLI and SDK protocol versions; if yours differ, set `COPILOT_BIN` to a compatible CLI or update and test the pair together. See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

| Path | Contents |
|---|---|
| `plugin/plugin.json` | Plugin manifest (Agent Plugins 1.0) |
| `.github/plugin/marketplace.json` | Marketplace catalog; its version and description must match `plugin.json` |
| `scripts/discovery-probe.mjs` | Offline check that Copilot CLI discovers the plugin's agent, skill, extension and tools |
| `plugin/com.github.copilot/extensions/omc/extension.mjs` | Entry point. It checks `OMC_DISABLE`, then loads the features. |
| `plugin/com.github.copilot/extensions/omc/lib/` | Feature code: `main.mjs` wires everything into the session; the other modules are pure logic |
| `plugin/skills/commit/` | The `commit` skill and its staging helper, `scripts/hunks.mjs` |
| `plugin/com.github.copilot/agents/` | Custom agents: `reviewer.agent.md` |
| `test/` | Unit tests, and integration tests that use a fake session |
| `examples/` | Sample `config.json`, `rules.json`, and Cursor rules (`cursor-rules/`) |
| `docs/investigation.md` | Research notes, feature map, and roadmap |
| `docs/benchmark.md` | Stock Copilot vs oh-my-copilot edit benchmark |
| `bench/` | Benchmark tasks, runner (`run.mjs`), report (`report.mjs`) and raw results. Running it uses AI credits. |

## License

[MIT](LICENSE).
