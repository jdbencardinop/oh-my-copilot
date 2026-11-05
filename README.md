<img src="assets/icon.svg" width="64" height="64" alt="">

# oh-my-copilot

oh-my-copilot is a GitHub Copilot CLI plugin that brings ideas from [oh-my-pi](https://github.com/can1357/oh-my-pi) to Copilot. It is a proof of concept, tested on Copilot CLI 1.0.105.

It adds four things to Copilot:

- **Hash-anchored editing.** `read_anchored` shows each line as `LINE:HASH|content`. `edit_anchored` then edits by anchor, for example `12:ab`, instead of retyping the old text. If the file changed since it was read, the edit is rejected and nothing is written. The plugin tells the model to prefer these tools, so you do not have to.
- **Tool-call rules.** Rules in `rules.json` run before every tool call, and optionally after it. A rule can deny the call, ask the user, or add a note for the model. Rules can be scoped to files with globs such as `src/**/*.ts`.
- **Cursor and Cline rules.** Copilot does not read `.cursor/rules/*.mdc`, `.cursorrules` or `.clinerules`. oh-my-copilot passes them to the model, so a project's existing rules work without copying them.
- **A `/omc` command.** It shows status and turns features on or off for the current session.

If anything goes wrong, Copilot keeps working as normal. See [Turn it off](#turn-it-off).

For the background, comparisons, and roadmap, read [docs/investigation.md](docs/investigation.md). For measured speed and token savings, read [docs/benchmark.md](docs/benchmark.md).

## Try it

Copilot only loads extensions when experimental features are on.

Run it from this checkout:

```bash
copilot --experimental --plugin-dir ./plugin
```

Or install it, then start Copilot with `--experimental`. You can also set `"experimental": true` in `~/.copilot/settings.json` instead of passing the flag.

> [!WARNING]
> `--experimental` is not limited to one session. Copilot saves it as `"experimental": true` in the profile's `settings.json`, so every later session that uses the same profile also runs with experimental features on. That includes apps that embed Copilot, such as T3 Code, which can then fail with `extensionSdkPath is required` or fail to resume sessions. To keep it contained, run with a separate profile (see [Test it without touching your setup](#test-it-without-touching-your-setup)), for example `COPILOT_HOME=~/.copilot-omc copilot --experimental …`. To undo it, set `"experimental": false` in `~/.copilot/settings.json`.

```bash
copilot plugin install ./plugin
```

Copilot warns that installing from a local path is deprecated. It still works in 1.0.105.

Type `/omc status` inside Copilot to confirm that the plugin is active.

With `--plugin-dir`, code changes take effect the next time you start Copilot. An installed plugin is a copy, so run `copilot plugin install ./plugin` again after changing the code.

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

For a one-shot run, use `copilot --experimental --plugin-dir … -p "…" --allow-all-tools`.

See [How Copilot picks the anchored tools](#how-copilot-picks-the-anchored-tools).

## How Copilot picks the anchored tools

The plugin adds two tools: **`read_anchored`** and **`edit_anchored`**. On their own, the models ignore them: in the [benchmark](docs/benchmark.md), neither model used them without being told. When told, edits were about 20–25% faster and used 37–46% fewer output tokens.

So the plugin tells them. On the first prompt of each session, it adds this note as hidden context (the `nudge` feature):

```text
Use `read_anchored` and `edit_anchored` to read and edit existing text files, instead of `view` and `edit`. Read the file with `read_anchored` first, then edit it with `edit_anchored` using the `LINE:HASH` anchors it returns. If an anchored edit is rejected as stale, read the file again. If these tools are not available or report that they are turned off, use `view` and `edit` as usual. Use `create` only for new files.
```

- **It costs about 100 tokens once per session.** The note stays in the conversation, so later prompts add nothing.
- **It follows the kill switches.** No note is sent while `hashline` or `nudge` is off, from any source: `OMC_DISABLE`, `OMC_DISABLE_FEATURES`, a config file, `/omc off`, or the circuit breaker. If you turn it off after the note was sent, the next prompt tells the model to go back to the built-in tools. Turning it back on sends the note again. Use the same form you turned it off with: `/omc on` after `/omc off`, or `/omc on nudge` after `/omc off nudge`. A bare `/omc on` does not clear per-feature overrides.
- **It is checked.** In a [small live check](docs/benchmark.md#spot-check-the-plugins-own-nudge), 3 of 3 runs used the anchored tools with no hint in the prompt, and a run with `OMC_DISABLE=1` used the built-in tools.

To keep the anchored tools but stop the note, use `/omc off nudge`, `OMC_DISABLE_FEATURES=nudge`, or `{"features": {"nudge": false}}`. Then you can still ask for the tools in a prompt (for example, "Use the read_anchored and edit_anchored tools to read and edit files."), or put the text above in `~/.copilot/copilot-instructions.md` or `.github/copilot-instructions.md`. The sentence "If these tools are not available…" keeps that fallback working when the plugin is off.

## Turn it off

You can return to plain Copilot without uninstalling anything:

| When | Do this |
|---|---|
| Right now, this session only | `/omc off`, or `/omc off <feature>` for one feature (`hashline`, `nudge`, `rules`, `imports`, `streamRules`) |
| Next launch only | Start Copilot with `OMC_DISABLE=1`, or `OMC_DISABLE_FEATURES=rules` |
| Every session | `copilot plugin disable oh-my-copilot` |
| Every session, keeping the plugin enabled | Add `"extensions": {"disabledExtensions": ["plugin:oh-my-copilot:omc"]}` to `~/.copilot/settings.json` |
| One project | Put `{"enabled": false}` in `.github/omc/config.json` |
| All extensions | Set `"extensions": {"mode": "disabled"}` in `~/.copilot/settings.json` |

**After `/omc off`, the anchored tools are still listed.** Copilot does not let an extension remove its tools mid-session. They refuse calls, so the model falls back to the built-in tools.

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

`config.json` accepts `enabled`, `features.hashline`, `features.nudge`, `features.rules`, `features.imports`, `features.streamRules`, and `circuitBreakerThreshold`. Every feature is on by default except `streamRules`; see [Stream rules](#stream-rules). `nudge` only has an effect while `hashline` is on. See [examples/config.json](examples/config.json).

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

### Cursor and Cline rules

The `imports` feature reads rule files that other coding agents use, from the project root:

| File | How it is used |
|---|---|
| `.cursor/rules/**/*.mdc` with `alwaysApply: true` | Added to the first prompt of the session |
| `.cursor/rules/**/*.mdc` with `globs` | Added once per session, the first time Copilot reads or edits a matching file |
| `.cursor/rules/**/*.mdc` with only a `description` | Listed by path and description in the first prompt, so the model can read the file when it is relevant |
| `.cursor/rules/**/*.mdc` with none of these | Not imported. In Cursor these rules apply only when you mention them. |
| `.cursorrules` | Added to the first prompt |
| `.clinerules` file, or `*.md` and `*.txt` files in a `.clinerules/` folder | Added to the first prompt. A `paths:` list in the file's frontmatter makes it glob-scoped instead. |

The rules reach the model as hidden context, like the nudge, and stay in the conversation. Copilot CLI does not read these files itself. It reads `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/rules`, `.github/copilot-instructions.md` and `.github/instructions`, which oh-my-copilot leaves alone. See [examples/cursor-rules](examples/cursor-rules).

- **Size limits.** The first prompt carries at most 12,000 characters of imported rules, one glob-scoped rule at most 6,000, and all glob-scoped rules together at most 24,000 per session. These are hard caps. Longer rules are cut, with a note telling the model which file to read for the rest. Rules that do not fit at all are listed by file name, ending with "and N more" when the list itself would not fit. Glob-scoped rules past the session budget are skipped. `/omc status` lists the files that were cut or left out.
- **When rules change.** A session reads the rules once. Changes apply to the next session.
- **Only regular files inside the project.** Symlinks are skipped with a warning, as are files that resolve outside the project root, so a cloned repository cannot pull in files such as `~/.aws/credentials`.
- **Glob-scoped rules need a file tool.** They are triggered by `view`, `create`, `edit`, `read_anchored`, `edit_anchored` and `apply_patch`, not by shell commands.
- **On by default.** The feature does nothing in projects without these files. If you already copied the rules into Copilot's own instruction files, turn it off to avoid sending them twice: `{"features": {"imports": false}}` or `/omc off imports`. Turning it off mid-session tells the model to stop following the imported rules.

## Develop

```bash
npm test
```

The tests use only Node's built-in test runner. They need Node 20 or later and no dependencies.

| Path | Contents |
|---|---|
| `plugin/plugin.json` | Plugin manifest (Agent Plugins 1.0) |
| `plugin/com.github.copilot/extensions/omc/extension.mjs` | Entry point. It checks `OMC_DISABLE`, then loads the features. |
| `plugin/com.github.copilot/extensions/omc/lib/` | Feature code: `main.mjs` wires everything into the session; the other modules are pure logic |
| `test/` | Unit tests, and integration tests that use a fake session |
| `examples/` | Sample `config.json`, `rules.json`, and Cursor rules (`cursor-rules/`) |
| `docs/investigation.md` | Research notes, feature map, and roadmap |
| `docs/benchmark.md` | Stock Copilot vs oh-my-copilot edit benchmark |
| `bench/` | Benchmark tasks, runner (`run.mjs`), report (`report.mjs`) and raw results. Running it uses AI credits. |
