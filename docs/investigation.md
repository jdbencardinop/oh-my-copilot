# oh-my-copilot: investigation and feature map

This document covers six things:

- what [oh-my-pi](https://github.com/can1357/oh-my-pi) (OMP) adds to [Pi](https://github.com/earendil-works/pi);
- how Pi compares with GitHub Copilot CLI;
- how Copilot CLI can be extended;
- what an OMP-style layer for Copilot needs;
- how to fall back to plain Copilot;
- what the proof of concept in this repository has proven.

Everything was checked against Copilot CLI 1.0.105 on Linux with Node 24, and against the OMP and Pi READMEs as they were when this was written.

## Summary

- **Build it as a Copilot plugin with an extension at its core.** An extension is a Node process that joins the Copilot session through the Copilot SDK. The same plugin can also ship skills, custom agents, MCP servers and LSP config. A launcher wrapper is optional; you only need one for settings a plugin cannot set.
- **Falling back to plain Copilot is supported natively.** Copilot can turn off all extensions, one extension, or the whole plugin, and it keeps running if an extension crashes. This project adds its own kill switches on top. See [Disabling and fallback](#disabling-and-fallback).
- **The proof of concept works in real sessions.** Hash-anchored editing (OMP's "hashline") and tool-call rules (a lighter form of OMP's stream rules) run in live Copilot sessions. Every fallback path in this document was tested live, except where a table says otherwise.
- **The main risk is that extensions are experimental.** They load only with `--experimental` or `"experimental": true`, and parts of the API may change.

## Sources

| Source | Used for |
|---|---|
| [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi) README | OMP features |
| [The harness problem](https://blog.can.ac/2026/02/12/the-harness-problem/) | Hashline design and benchmark claims |
| [earendil-works/pi](https://github.com/earendil-works/pi) README and docs (CLI, extensions, usage) | Pi baseline |
| [github/copilot-sdk](https://github.com/github/copilot-sdk) and the SDK typings bundled with the CLI (`~/.cache/copilot/pkg/<platform>/<version>/copilot-sdk`) | Extension API |
| [Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/cli-plugin-reference) | Plugin layout |
| `copilot --help`, `copilot help commands`, `copilot help environment` | Copilot baseline |
| Live tests in isolated `COPILOT_HOME` directories | Everything marked "verified" |

## What OMP adds over Pi

Pi is deliberately minimal:

- **Tools:** four by default (`read`, `bash`, `edit` and `write`).
- **Ways to customize it:** extensions, skills, prompt templates, themes, and packages shared through npm or git.
- **Ways to run it:** interactively, in print or JSON mode, over RPC, or through a TypeScript SDK.
- **Sessions and integrations:** session trees, forks, compaction and MCP.
- **Left out on purpose:** subagents and plan mode, which users are expected to add themselves.

OMP is a fork of Pi that ships those additions built in:

| Area | OMP feature | What it does |
|---|---|---|
| Editing | Hashline edits | The model edits by `LINE:HASH` anchors instead of retyping the old text. OMP rejects stale anchors before writing. OMP reports large gains for weaker models, for example Grok Code Fast 1 going from 6.7% to 68.3%. |
| Editing | `ast_edit`, `ast_grep` | Structural search and rewrite over tree-sitter grammars. Changes are previewed, then accepted. |
| Editing | Conflict URLs | Each merge conflict becomes `conflict://N`. Writing `@ours`, `@theirs` or `@base` to it resolves the conflict. |
| Reading | Universal `read` | One tool reads files, directories, archives, SQLite, PDFs, notebooks, URLs, `ssh://` paths, and internal schemes such as `pr://`, `issue://`, `agent://` and `skill://`. |
| Code intelligence | LSP on every write | Diagnostics, navigation and safe renames through `workspace/willRenameFiles`. |
| Code intelligence | Debugger | Drives DAP sessions (lldb, dlv, debugpy): breakpoints, stepping, frames and variables. |
| Execution | `eval` | Persistent Python and JavaScript kernels that can call the agent's own tools. |
| Execution | Native tooling | ripgrep, glob, and a bash 5.3 engine with built-in coreutils, all running in process. This avoids fork-exec and works on Windows. |
| Guardrails | Time-traveling stream rules (TTSR) | Regex rules watch the model's output stream. A match aborts the response mid-token, injects the rule and retries. Rules cost no context until they fire, and they survive compaction. |
| Agents | Subagents | `task` fans work out into isolated worktrees and returns schema-validated results. Agent Hub shows, steers and stops workers. |
| Agents | Advisor model | A second model reads every turn and adds notes, concerns or hard blockers. |
| Agents | Review | `/review` runs parallel reviewer subagents and returns P0 to P3 findings with a ship verdict. |
| Memory | Curated memory | `retain`, `recall`, `reflect` and `learn`. Session summaries load at the start of the next session. The backend is pluggable. |
| Git | `omp commit` | Splits the working tree into ordered, atomic commits with validated messages. |
| Web and desktop | Search, browser, desktop | `web_search` across 23 providers, a Puppeteer browser, and desktop control (windows, screenshots, input, accessibility tree). |
| Collaboration | `/collab` | Shares a live session by link or QR code, read-write or view-only. Frames are sealed on the client. |
| Integration | ACP, RPC, SDK | Can be driven from editors such as Zed, over stdio, or embedded in Node. |
| Integration | Config inheritance | Reads existing rules, skills and MCP config from `.claude`, `.cursor`, `.windsurf`, `.gemini`, `.codex`, `.cline`, `.github/copilot` and `.vscode` with no migration step. |
| Models | 60+ providers | Custom providers, fallback chains, path-scoped models and round-robin credentials. |
| UX | Magic keywords and modes | Keywords `ultrathink`, `chillax`, `orchestrate` and `workflowz`; `/vibe` director mode; `/fresh`. |
| Tool surface | Tool discovery | Rarely used tools stay behind `xd://` so the default tool list stays small. |

## Pi and Copilot CLI: baseline comparison

| Capability | Pi | Copilot CLI 1.0.105 |
|---|---|---|
| Philosophy | Minimal core that you extend | Batteries included, integrated with GitHub |
| Default tools | `read`, `bash`, `edit`, `write` | Shell, view, edit, create, grep, glob, web fetch, ask user, a SQL store, and more |
| Subagents | Not built in | Built in: custom agents, `/fleet`, `/tasks`, and `/delegate` to the cloud agent |
| Plan mode | Not built in | `/plan`, `--plan`, autopilot mode |
| Models | Many providers with your own keys | Copilot-routed models through `/model`. BYOK through `COPILOT_PROVIDER_*` environment variables (OpenAI-compatible, Azure, Anthropic). Offline mode with local models. |
| Extensions | TypeScript modules with a very rich event API (stream, provider request, context, compaction, UI) | Node extensions through the SDK's `joinSession`: tools, slash commands and lifecycle hooks. Experimental. |
| Skills | Yes | Yes (`SKILL.md`) |
| Prompt templates | Yes | Plugin commands |
| MCP | Yes | Yes, plus a built-in GitHub MCP server |
| LSP | Through extensions | Built-in config (`lsp.json`, `/lsp`) |
| Hooks | Extension events | Shell hooks (`hooks.json`) and SDK hooks |
| Sessions | Tree, fork, clone, compact | Resume, `/fork` (including into a worktree), `/rewind`, `/compact`, `/share`, `/remote`, `/memory` |
| Code review | Not built in | `/review`, `/diff` |
| Automation | Print, JSON, RPC, SDK | `-p`, `--output-format json`, SDK, `--acp` |
| Packaging | Pi packages (npm or git) | Plugins and marketplaces |

Copilot already covers much of what OMP adds to Pi: subagents, plan mode, LSP, review, MCP and sessions. The gaps are mostly in the editing and guardrail layer, plus a few specialist tools.

## How to extend Copilot CLI

| Mechanism | What it adds | Where it lives | Notes |
|---|---|---|---|
| Plugin | A bundle of everything below | `copilot plugin install`, a marketplace, or `--plugin-dir` | Agent Plugins 1.0 layout: `plugin.json`, `skills/`, `mcp.json`, and `com.github.copilot/{agents,commands,hooks,lsp.json,extensions}` |
| Extension | Custom tools, slash commands, SDK hooks, session messages | `com.github.copilot/extensions/<name>/extension.mjs` in a plugin. Also `~/.copilot/extensions` and `.github/extensions`. | Runs as a child process over JSON-RPC. Needs `--experimental`. |
| Skills | Instructions and scripts the model loads on demand | `skills/<name>/SKILL.md` | No code needed |
| Custom agents | Named agent profiles with their own prompt and tools | `com.github.copilot/agents/*.agent.md` in a plugin; also `~/.copilot/agents` and `.github/agents` | Usable as subagents. Plugin agents are namespaced, for example `oh-my-copilot:reviewer`. |
| MCP servers | External tools over MCP | `mcp.json` | Any language |
| Shell hooks | Commands run on lifecycle events | `hooks.json` | Can deny tool calls |
| LSP config | Language servers | `lsp.json` | |
| BYOK | Other model providers | `COPILOT_PROVIDER_*` environment variables | One provider at a time |

These SDK hooks are available to extensions in 1.0.105:

- `onPreToolUse`, `onPreMcpToolCall`, `onPostToolUse`, `onPostToolUseFailure`;
- `onUserPromptSubmitted`, `onUserPromptTransformed`;
- `onSessionStart`, `onSessionEnd`, `onErrorOccurred`;
- `onAgentStop`, `onSubagentStart`, `onSubagentStop`.

`onPreToolUse` can allow, deny or ask about a tool call, rewrite its arguments, or add context for the model. The rules feature is built on it, and so are glob-scoped imported rules.

`onPostToolUse` sees the tool's result and can add context for the model or replace the result. It only fires for successful calls; `onPostToolUseFailure` gets the error text of failed calls and can only add context. Post rules use both, and only add context.

`onUserPromptSubmitted` can add hidden context to a prompt. Copilot appends it to the prompt as a `<system_reminder>` block, and it stays in the conversation. The nudge, the merge-conflict note and the always-on imported rules are built on it; when more than one applies, they share one block, in that order (nudge, conflict note, imported rules).

Things to know before writing an extension:

- **Never write to stdout.** It carries JSON-RPC. Use `session.log` for messages.
- **The tool list is fixed when the extension joins.** In 1.0.105, `session.setTools` is rejected for extension connections.
- **Extension IDs follow a fixed format:** `plugin:<plugin>:<extension>`, `project:<extension>` or `user:<extension>`. This project's ID is `plugin:oh-my-copilot:omc`.
- **Project extensions have extra gates.** Extensions in `.github/extensions` need folder trust in interactive mode, and `GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS=true` in `-p` mode. Plugin and user extensions load in `-p` mode without that variable.

## Building an OMP-style layer for Copilot

Use a plugin with an extension at its core. None of the options is enough alone.

| Piece | Role | OMP features it can carry |
|---|---|---|
| Extension | Runtime behavior: tools, hooks, commands | Hashline, rules, conflict tools, commit helpers, URL-scheme reads |
| Skills | Workflows that are mostly instructions | Commit splitting, review rubric, debugging playbooks |
| Custom agents | Specialist subagents | Reviewer, advisor, researcher |
| MCP servers | Heavy or non-Node tools | ast-grep, DAP debugger, browser, web search |
| LSP config | Language servers | Diagnostics after writes |
| Launcher wrapper (optional) | Flags and environment a plugin cannot set | `--experimental`, BYOK provider profiles |

### Coverage map

| OMP feature | In Copilot today | Plan for oh-my-copilot |
|---|---|---|
| Hashline edits | Missing | **Done in the proof of concept** (`read_anchored`, `edit_anchored`) |
| Stream rules (TTSR) | Missing | **Done, opt-in** (`streamRules`, off by default): `"action": "interrupt"` rules watch the streamed reply text, tool-call arguments and, if asked, reasoning. On a match the plugin aborts the response, removes it from history (`history.truncate`), and sends `[omc rule <id>] <message>` as a reminder. Each rule fires once per prompt; at most 3 fires per prompt and 20 per session. With the feature off, the same rules deny matching tool calls. Also: rules check tool calls before they run (`when: "pre"`) and their results after (`when: "post"`), scoped by tool and path glob. Not suited to `-p`: a fire ends the run with exit code 1. |
| Subagents | Built in | Use native subagents; add custom agents |
| Plan mode | Built in | Native |
| Review with a verdict | Built in (`/review`) | **Done**: `reviewer` agent with a P0 to P3 rubric and a `VERDICT:` line |
| LSP | Built-in config | Ship `lsp.json` presets |
| Debugger (DAP) | Missing | MCP server |
| `ast_edit`, `ast_grep` | Missing | MCP server or an extension tool wrapping ast-grep |
| `eval` kernels | Missing (shell only) | MCP server |
| Universal `read` and URL schemes | Partial (web fetch, GitHub MCP) | Extension tools, for example `read_uri` |
| Conflict resolution | Missing | **Done in the proof of concept** (`list_conflicts`, `resolve_conflicts`, behind the `conflicts` feature) |
| `omp commit` | Missing | **Done**: `commit` skill with a hunk-staging helper script; no extension code |
| Memory | Built in (`/memory`) | Native; compare later |
| Advisor model | Missing | Needs design: a hook plus a second model call |
| Web search | Partial (`/research`, web fetch) | MCP server |
| Browser | Built-in `browser-use` plugin, disabled by default | Native |
| Collaboration | Partial (`/remote`, `/share`) | Native |
| ACP | Built in (`--acp`) | Native |
| Config inheritance | Partial: Copilot reads `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/rules`, and its own instruction files | **Done for Cursor and Cline** (`imports`): `.cursor/rules/*.mdc` (always, glob-scoped, on request), `.cursorrules`, `.clinerules`. Windsurf, Codex and others, later. |
| 60+ providers | BYOK, one provider at a time | Launcher profiles |
| In-process native tools | Not needed | Copilot ships its own grep and glob |

## Disabling and fallback

You can always get back to plain Copilot without uninstalling anything.

### Native Copilot controls

| Control | Scope | How | Verified |
|---|---|---|---|
| Disable all extensions | Every session | In `~/.copilot/settings.json`: `"extensions": {"mode": "disabled"}` | Yes |
| Disable only this extension | Every session | `"extensions": {"disabledExtensions": ["plugin:oh-my-copilot:omc"]}` | Yes |
| Disable the plugin | Every session | `copilot plugin disable oh-my-copilot`; undo with `copilot plugin enable oh-my-copilot` | Yes |
| Skip the plugin for one run | One run | When running from source, leave out `--plugin-dir` | Yes |
| Turn off experimental features | Every session | Drop `--experimental`. This also turns off other experimental features. | Yes |
| Crash isolation | Automatic | A crashing extension is skipped, and a throwing hook does not block the tool | Yes |
| `/extensions` dashboard | Interactive | Modes: Disabled, Load Only, Load and Augment | Seen, not driven in a test |

### oh-my-copilot controls

| Control | Scope | How | Verified |
|---|---|---|---|
| `OMC_DISABLE=1` | One launch | The extension joins with nothing registered | Live |
| `OMC_DISABLE_FEATURES=rules` | One launch | Comma-separated list of `hashline`, `nudge`, `rules`, `imports`, `streamRules`, `conflicts` or `all` (case-insensitive) | Unit tests |
| `/omc off`, `/omc on` | This session | Rules stop at once; the anchored and conflict tools refuse calls (see the note below) | Live |
| `/omc off <feature>`, `/omc on <feature>` | This session | Per feature | Unit tests |
| Config file | User or project | `{"enabled": false}` or `{"features": {"rules": false}}` (any feature name) in `~/.copilot/omc/config.json` or `.github/omc/config.json` | Live (project file) |
| Circuit breaker | Automatic | A feature turns itself off after three consecutive internal errors. The threshold is configurable; `/omc reset` retries. | Unit tests |
| Stream rules opt-in | Every session | `streamRules` is the only feature that is off by default. The plugin requests streamed events (`streaming: true` in `joinSession`) only if the feature is on when Copilot starts; otherwise it leaves Copilot's own streaming setting alone. Turning it off mid-session stops interrupts at once; turning it on mid-session only enables the deny fallback until a restart. Abort, truncate and the retry each time out after 5 s. A failed or hung abort counts toward the breaker. If the session does not go idle after the abort, or truncate times out (a late truncate could erase the retry), no retry is sent: the breaker counts a failure and the user is told to send the prompt again. A truncate that fails outright still retries. A failed or hung retry trips the breaker at once. Sub-agent deltas are excluded (`includeSubAgentStreamingEvents: false`, plus an `agentId` check). | Unit tests; live on/off runs |
| Fail open | Automatic | Internal errors never block a tool call. The entry file loads features lazily, so a broken module cannot stop Copilot. | Unit tests |

Precedence works like this:

- Environment kill switches beat everything.
- `/omc` overrides beat config files.
- Project config beats user config.
- Environment variables can only turn things off.

**`/omc off` cannot remove tools mid-session.** Copilot 1.0.105 does not let an extension remove its own tools ("Extension connections cannot replace SDK external tools"). After `/omc off`:

- `read_anchored`, `edit_anchored`, `list_conflicts` and `resolve_conflicts` stay listed;
- any call to them returns a message telling the model to use the built-in view and edit tools;
- if the nudge was already sent, the next prompt tells the model to go back to the built-in tools.

To remove the tools from the list entirely, restart with `OMC_DISABLE=1` or use one of the disable settings above.

## Proof of concept

The plugin lives in [`plugin/`](../plugin). It contains one extension, `omc`, with these features:

- `read_anchored` and `edit_anchored` tools that use the hashline format;
- a nudge: on the first prompt of a session, hidden context tells the model to prefer those tools (only while `hashline` and `nudge` are on);
- `list_conflicts` and `resolve_conflicts` tools that resolve merge conflicts by id (`ours`, `theirs`, `base`, both, or custom), plus a hidden note while a merge has conflicts (only while `conflicts` and `nudge` are on);
- rules from `rules.json` that are checked before each tool call, or after it (`when: "post"`), optionally scoped by path globs;
- Cursor and Cline rule files passed to the model as hidden context (`imports`);
- a `/omc` command for status and toggles.

| Check | Result |
|---|---|
| `npm test` (unit tests, integration tests with a fake session, and example files) | 151 passing |
| The model uses `read_anchored`, then `edit_anchored`, to rename a function and append a line | Pass |
| A `deny` rule blocks a bash command and shows the rule's reason | Pass |
| A `context` rule reaches the model, which then removed the banned `console.log` | Pass |
| `/omc status`, `/omc off` and `/omc on` in interactive mode | Pass |
| Richer rules, 4 live runs with Haiku | A `paths: ["gen/**"]` deny rule blocked `edit_anchored` on `gen/data.txt`. A post rule matched `bash` output and its note reached the model, which followed it. An `alwaysApply` `.mdc` rule changed every reply. A glob-scoped `.mdc` rule reached the model when it used `create` on a matching file; in a run where the model wrote the file with `bash`, it did not fire (expected: shell commands have no target file). |
| Stream rules, 3 live runs with Haiku | Rule `no-console-log` (`interrupt`, pattern `console\.log\(`). Interactive with `streamRules` on: the model began a `create` call with `console.log`; the plugin aborted it before it ran, truncated the turn, and sent the reminder. The model retried and wrote `hello.js` with `process.stdout.write`. `/omc status` showed `fired 1 time(s) (no-console-log x1)`. Interactive with the feature off: the `create` call was denied by the fallback, and the model retried without `console.log`. `-p` with the feature on: the CLI shut down when the abort landed, exited 1, and wrote no file. |
| `OMC_DISABLE=1`, `disabledExtensions`, project `{"enabled": false}`, and a disabled plugin | Plain Copilot behavior in each case |
| Installed with `copilot plugin install`, without `--plugin-dir` | Loads and enforces rules |
| Benchmark: 84 runs, 6 edit tasks, 2 models ([docs/benchmark.md](benchmark.md)) | All runs passed. When prompted to use the anchored tools: 21–25% faster, 37–46% fewer output tokens, 9–14% fewer credits. Unprompted, the models did not use them. |
| Instructions-file nudge, 8 runs ([spot check](benchmark.md#spot-check-nudging-with-an-instructions-file)) | With the plugin on, both models used the anchored tools in 4 of 4 runs. With the plugin off (`OMC_DISABLE=1`) and the same instructions, 4 of 4 runs used the built-in tools. All 8 passed. |
| Conflict tools, 3 runs (Claude Haiku 4.5, diff3 merge with 2 conflicts, "keep their timeout and our port") | All 3 results were correct. Run 1, before the conflict note: the model edited the markers with `edit_anchored`. Run 2, tools deferred behind tool search: it could not find them. Run 3, tools always loaded plus the note: `list_conflicts`, then one `resolve_conflicts` call (`theirs`, `ours`); the file was left unstaged. |
| The plugin's own nudge, 4 runs ([spot check](benchmark.md#spot-check-the-plugins-own-nudge)) | No hint and no instructions file. With the plugin on, 3 of 3 runs (2 Haiku, 1 gpt-6.1-sol) used `read_anchored` and `edit_anchored`. With `OMC_DISABLE=1`, no nudge was sent and the run used `view` and `edit`. All 4 edits were correct. |

## Open questions and risks

- **Experimental API.** Hooks and tool registration may change between CLI releases.
- **Distribution.** Direct plugin installs from local paths or repositories are deprecated. Long term, publish through a marketplace (`plugin@marketplace`).
- **Change tracking.** Copilot's "Changes +N -M" counter does not count edits made by extension tools. How `/rewind` treats those edits is untested.
- **Permissions.** In interactive mode, the custom tools ask for permission unless they are allowed. The proof of concept does not set `skipPermission`.
- **Stream rules rely on experimental runtime behavior.** Stream deltas, `session.abort`, `history.truncate` and resending a prompt from an extension all work in CLI 1.0.105, but none is a documented contract. `-p` mode treats the abort as a cancel and exits 1 before the retry, and there is no way for an extension to detect `-p`, so the feature is off by default. Each fire costs at least one more model request. Sub-agent streams are not watched. Only Claude Haiku deltas were tested live. Matching is limited to a 16 KB tail per argument, message or reasoning block.
- **Replacing the built-in edit tool.** `overridesBuiltInTool` exists, but the anchored tools are kept separate to avoid breaking Copilot's own editing.

## Roadmap

1. **Ship the nudge with the plugin.** Done: the `nudge` feature sends the guidance through `onUserPromptSubmitted`, once per session, and only while the anchored tools are on. A plugin skill was rejected because the model loads it only on demand and the kill switches cannot turn it off. `onSessionStart` was not used because the extension may join after the session starts. A system message from the extension could not be withdrawn mid-session. Next: run the six benchmark tasks on the `omc-nudge` arm.
2. **Package for distribution.** A marketplace manifest, install docs, and a CI job that runs `npm test`.
3. **Richer rules.** Done: `paths` globs (with `!` exclusions) relative to the project root; `when: "post"` rules that add context after a tool ran, from its output or the written file; Cursor `.mdc`, `.cursorrules` and Cline rules imported as hidden context (`imports` feature, on by default because Copilot does not read these files); rule files are read once per session, symlinks and paths outside the project root are skipped, and globs use a non-backtracking matcher because repositories supply them). Next: glob-scoped rules triggered by shell commands that touch files, and more formats (Windsurf, Codex).
4. **Stream rules.** Done, opt-in: `"action": "interrupt"` rules with a `scope` (`text`, `tools`, `reasoning`). With `streamRules` on, the plugin watches deltas, aborts, truncates the aborted turn and retries with the rule as a reminder; with it off, the rules deny matching tool calls. Next: in `-p` mode, save a snapshot of the work before the abort ends the run, so a fire does not lose it (deferred; until then the README advises against using the plugin with `-p`); detect `-p` mode if the SDK exposes it, so the feature could default to on in interactive sessions; test GPT models' delta patterns; watch sub-agents.
5. **A conflict resolution tool.** Done: `list_conflicts` and `resolve_conflicts` (the `conflicts` feature). Ids carry a hash of the hunk and its neighboring lines, so stale ids are rejected; hunks with identical content get ids that go stale on any change, so they are never confused; each file is written all-or-nothing; staging is opt-in. Next: binary, delete/modify and rename conflicts, which still need git.
6. **Structural editing.** ast-grep through an MCP server.
7. **Git workflow.** Done: the `commit` skill splits the working tree into ordered, atomic commits. Its helper, `scripts/hunks.mjs`, lists hunks with stable ids, stages them with `git apply --cached`, and verifies against a working-tree snapshot. A script was enough, so no extension tool was added. Copilot asks before running a script outside the repository; in `-p` mode, pass `--add-dir` with the plugin folder. Live check (claude-haiku-4.5): a five-change tree became five commits, one file split by hunk, nothing lost.
8. **Specialist agents.** Reviewer done: `oh-my-copilot:reviewer` grades findings P0 to P3 and ends with a ship verdict. Tools are limited to `read`, `search` and `execute`; the prompt keeps the shell read-only, which Copilot cannot enforce. Live check: it found a planted off-by-one as P1. Advisor not started: OMP's advisor reads every turn, which needs a hook and a second model call rather than an agent file.
9. **An optional launcher.** It would add `--experimental` and BYOK profiles.
