<img src="assets/icon.svg" width="64" height="64" alt="">

# oh-my-copilot

oh-my-copilot is a GitHub Copilot CLI plugin that brings ideas from [oh-my-pi](https://github.com/can1357/oh-my-pi) to Copilot. It is a proof of concept, tested on Copilot CLI 1.0.105.

It adds three things to Copilot:

- **Hash-anchored editing.** `read_anchored` shows each line as `LINE:HASH|content`. `edit_anchored` then edits by anchor, for example `12:ab`, instead of retyping the old text. If the file changed since it was read, the edit is rejected and nothing is written.
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
2. Ask: "Create `notes.txt` with three lines, then use `read_anchored` and `edit_anchored` to change the second line."
3. Optional: copy [examples/rules.json](examples/rules.json) to `.github/omc/rules.json`, and ask Copilot to run `git push --force`. The `confirm-force-push` rule stops and asks you first.
4. Run `/omc off rules`, and repeat step 3. Copilot no longer asks because of the rule.

For a one-shot run, use `copilot --experimental --plugin-dir … -p "…" --allow-all-tools`.

Copilot keeps using its built-in tools unless you ask for the anchored ones. See [Make Copilot use the anchored tools](#make-copilot-use-the-anchored-tools).

## Make Copilot use the anchored tools

The plugin adds two tools: **`read_anchored`** and **`edit_anchored`**. The models do not choose them on their own. In the [benchmark](docs/benchmark.md), neither model used them without being told. When told, edits were about 20–25% faster and used 37–46% fewer output tokens.

For one request, add a sentence to your prompt:

```text
Use the read_anchored and edit_anchored tools to read and edit files.
```

For every session, put this in `~/.copilot/copilot-instructions.md` (all repositories) or `.github/copilot-instructions.md` (one repository):

```text
Use `read_anchored` and `edit_anchored` to read and edit existing text files, instead of `view` and `edit`. Read the file with `read_anchored` first, then edit it with `edit_anchored` using the `LINE:HASH` anchors it returns. If an anchored edit is rejected as stale, read the file again. If these tools are not available, use `view` and `edit` as usual. Use `create` only for new files.
```

The sentence "If these tools are not available…" keeps the fallback working. With the plugin switched off (`OMC_DISABLE=1`) and these instructions still in place, the models used the built-in tools as normal.

The instructions file was tested in 8 runs, only in the personal location (`~/.copilot`). The repository file is listed as an instruction source by `copilot instruction list`, but it has not been run end to end. See [the spot check](docs/benchmark.md#spot-check-nudging-with-an-instructions-file).

## Turn it off

You can return to plain Copilot without uninstalling anything:

| When | Do this |
|---|---|
| Right now, this session only | `/omc off`, or `/omc off rules` / `/omc off hashline` for one feature |
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

`config.json` accepts `enabled`, `features.hashline`, `features.rules`, and `circuitBreakerThreshold`. See [examples/config.json](examples/config.json).

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
| `test/` | Unit tests, and integration tests that use a fake session |
| `examples/` | Sample `config.json` and `rules.json` |
| `docs/investigation.md` | Research notes, feature map, and roadmap |
| `docs/benchmark.md` | Stock Copilot vs oh-my-copilot edit benchmark |
| `bench/` | Benchmark tasks, runner (`run.mjs`), report (`report.mjs`) and raw results. Running it uses AI credits. |
