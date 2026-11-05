<img src="assets/icon.svg" width="64" height="64" alt="">

# oh-my-copilot

oh-my-copilot is a GitHub Copilot CLI plugin that brings ideas from [oh-my-pi](https://github.com/can1357/oh-my-pi) to Copilot. It is a proof of concept, tested on Copilot CLI 1.0.105.

It adds three things to Copilot:

- **Hash-anchored editing.** `read_anchored` shows each line as `LINE:HASH|content`. `edit_anchored` then edits by anchor, for example `12:ab`, instead of retyping the old text. If the file changed since it was read, the edit is rejected and nothing is written. The plugin tells the model to prefer these tools, so you do not have to.
- **Tool-call rules.** Regex rules in `rules.json` run before every tool call. A rule can deny the call, ask the user, or add a note for the model.
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
- **It follows the kill switches.** No note is sent while `hashline` or `nudge` is off, from any source: `OMC_DISABLE`, `OMC_DISABLE_FEATURES`, a config file, `/omc off`, or the circuit breaker. If you turn it off after the note was sent, the next prompt tells the model to go back to the built-in tools. `/omc on` sends the note again.
- **It is checked.** In a [small live check](docs/benchmark.md#spot-check-the-plugins-own-nudge), 3 of 3 runs used the anchored tools with no hint in the prompt, and a run with `OMC_DISABLE=1` used the built-in tools.

To keep the anchored tools but stop the note, use `/omc off nudge`, `OMC_DISABLE_FEATURES=nudge`, or `{"features": {"nudge": false}}`. Then you can still ask for the tools in a prompt (for example, "Use the read_anchored and edit_anchored tools to read and edit files."), or put the text above in `~/.copilot/copilot-instructions.md` or `.github/copilot-instructions.md`. The sentence "If these tools are not available…" keeps that fallback working when the plugin is off.

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
| Right now, this session only | `/omc off`, or `/omc off <feature>` for one feature (`hashline`, `nudge`, `rules`) |
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

`config.json` accepts `enabled`, `features.hashline`, `features.nudge`, `features.rules`, and `circuitBreakerThreshold`. `nudge` only has an effect while `hashline` is on. See [examples/config.json](examples/config.json).

### Rules

A rules file holds `{"rules": [...]}`. See [examples/rules.json](examples/rules.json).

| Field | Required | Meaning |
|---|---|---|
| `pattern` | Yes | JavaScript regular expression to match |
| `id` | No | Name shown in messages, as `[omc rule <id>]` |
| `action` | No | `deny` (default), `ask`, or `context` |
| `message` | No | Reason shown to the user and the model |
| `tools` | No | Tool names to check, for example `["bash"]`. By default every tool is checked. |
| `pathPattern` | No | Regular expression that the target file path must match |
| `field` | No | `auto` (default), `all`, or a dotted argument path such as `command` |
| `flags` | No | Regex flags: any of `i`, `m`, `s`, `u` |
| `enabled` | No | `false` skips the rule |

With `field: "auto"`, a rule matches what the tool would run or write:

- the command for `bash`;
- `new_str` for `edit`;
- `file_text` for `create`;
- the new lines for `edit_anchored` and `apply_patch`;
- every string argument, for any other tool.

When several rules match, `deny` wins over `ask`, and `ask` wins over `context`. A rule that is invalid is skipped, and Copilot shows a warning.

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
| `plugin/skills/commit/` | The `commit` skill and its staging helper, `scripts/hunks.mjs` |
| `plugin/com.github.copilot/agents/` | Custom agents: `reviewer.agent.md` |
| `test/` | Unit tests, and integration tests that use a fake session |
| `examples/` | Sample `config.json` and `rules.json` |
| `docs/investigation.md` | Research notes, feature map, and roadmap |
| `docs/benchmark.md` | Stock Copilot vs oh-my-copilot edit benchmark |
| `bench/` | Benchmark tasks, runner (`run.mjs`), report (`report.mjs`) and raw results. Running it uses AI credits. |
