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
| Custom agents | Named agent profiles with their own prompt and tools | `agents/*.agent.md` | Usable as subagents |
| MCP servers | External tools over MCP | `mcp.json` | Any language |
| Shell hooks | Commands run on lifecycle events | `hooks.json` | Can deny tool calls |
| LSP config | Language servers | `lsp.json` | |
| BYOK | Other model providers | `COPILOT_PROVIDER_*` environment variables | One provider at a time |

These SDK hooks are available to extensions in 1.0.105:

- `onPreToolUse`, `onPreMcpToolCall`, `onPostToolUse`, `onPostToolUseFailure`;
- `onUserPromptSubmitted`, `onUserPromptTransformed`;
- `onSessionStart`, `onSessionEnd`, `onErrorOccurred`;
- `onAgentStop`, `onSubagentStart`, `onSubagentStop`.

`onPreToolUse` can allow, deny or ask about a tool call, rewrite its arguments, or add context for the model. The rules feature is built on it.

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
| Stream rules (TTSR) | Missing | **Partly done**: rules check tool calls before they run. A true mid-stream abort and retry would need stream events plus `session.abort`; not investigated yet. |
| Subagents | Built in | Use native subagents; add custom agents |
| Plan mode | Built in | Native |
| Review with a verdict | Built in (`/review`) | Optional reviewer agent with a P0 to P3 rubric |
| LSP | Built-in config | Ship `lsp.json` presets |
| Debugger (DAP) | Missing | MCP server |
| `ast_edit`, `ast_grep` | Missing | MCP server or an extension tool wrapping ast-grep |
| `eval` kernels | Missing (shell only) | MCP server |
| Universal `read` and URL schemes | Partial (web fetch, GitHub MCP) | Extension tools, for example `read_uri` |
| Conflict resolution | Missing | Extension tool |
| `omp commit` | Missing | Skill plus extension helpers |
| Memory | Built in (`/memory`) | Native; compare later |
| Advisor model | Missing | Needs design: a hook plus a second model call |
| Web search | Partial (`/research`, web fetch) | MCP server |
| Browser | Built-in `browser-use` plugin, disabled by default | Native |
| Collaboration | Partial (`/remote`, `/share`) | Native |
| ACP | Built in (`--acp`) | Native |
| Config inheritance | Partial (Copilot's own instruction files) | Importer for Cursor and Cline rules, later |
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
| `OMC_DISABLE_FEATURES=rules` | One launch | Comma-separated list of `hashline`, `rules` or `all` | Unit tests |
| `/omc off`, `/omc on` | This session | Rules stop at once; the anchored tools refuse calls (see the note below) | Live |
| `/omc off <feature>`, `/omc on <feature>` | This session | Per feature | Unit tests |
| Config file | User or project | `{"enabled": false}` or `{"features": {"rules": false}}` in `~/.copilot/omc/config.json` or `.github/omc/config.json` | Live (project file) |
| Circuit breaker | Automatic | A feature turns itself off after three consecutive internal errors. The threshold is configurable; `/omc reset` retries. | Unit tests |
| Fail open | Automatic | Internal errors never block a tool call. The entry file loads features lazily, so a broken module cannot stop Copilot. | Unit tests |

Precedence works like this:

- Environment kill switches beat everything.
- `/omc` overrides beat config files.
- Project config beats user config.
- Environment variables can only turn things off.

**`/omc off` cannot remove tools mid-session.** Copilot 1.0.105 does not let an extension remove its own tools ("Extension connections cannot replace SDK external tools"). After `/omc off`:

- `read_anchored` and `edit_anchored` stay listed;
- any call to them returns a message telling the model to use the built-in view and edit tools.

To remove the tools from the list entirely, restart with `OMC_DISABLE=1` or use one of the disable settings above.

## Proof of concept

The plugin lives in [`plugin/`](../plugin). It contains one extension, `omc`, with three features:

- `read_anchored` and `edit_anchored` tools that use the hashline format;
- rules from `rules.json` that are checked before each tool call;
- a `/omc` command for status and toggles.

| Check | Result |
|---|---|
| `npm test` (unit tests, integration tests with a fake session, and example files) | 37 passing |
| The model uses `read_anchored`, then `edit_anchored`, to rename a function and append a line | Pass |
| A `deny` rule blocks a bash command and shows the rule's reason | Pass |
| A `context` rule reaches the model, which then removed the banned `console.log` | Pass |
| `/omc status`, `/omc off` and `/omc on` in interactive mode | Pass |
| `OMC_DISABLE=1`, `disabledExtensions`, project `{"enabled": false}`, and a disabled plugin | Plain Copilot behavior in each case |
| Installed with `copilot plugin install`, without `--plugin-dir` | Loads and enforces rules |
| Benchmark: 84 runs, 6 edit tasks, 2 models ([docs/benchmark.md](benchmark.md)) | All runs passed. When prompted to use the anchored tools: 21–25% faster, 37–46% fewer output tokens, 9–14% fewer credits. Unprompted, the models did not use them. |
| Instructions-file nudge, 8 runs ([spot check](benchmark.md#spot-check-nudging-with-an-instructions-file)) | With the plugin on, both models used the anchored tools in 4 of 4 runs. With the plugin off (`OMC_DISABLE=1`) and the same instructions, 4 of 4 runs used the built-in tools. All 8 passed. |

## Open questions and risks

- **Experimental API.** Hooks and tool registration may change between CLI releases.
- **Distribution.** Direct plugin installs from local paths or repositories are deprecated. Long term, publish through a marketplace (`plugin@marketplace`).
- **Change tracking.** Copilot's "Changes +N -M" counter does not count edits made by extension tools. How `/rewind` treats those edits is untested.
- **Permissions.** In interactive mode, the custom tools ask for permission unless they are allowed. The proof of concept does not set `skipPermission`.
- **True stream rules.** Can an extension watch the streamed answer, then abort and retry? Not investigated.
- **Replacing the built-in edit tool.** `overridesBuiltInTool` exists, but the anchored tools are kept separate to avoid breaking Copilot's own editing.

## Roadmap

1. **Ship the nudge with the plugin.** Without a prompt hint, the models never used the anchored tools. A personal instructions file fixed that in a [spot check](benchmark.md#spot-check-nudging-with-an-instructions-file), but each user must create it. Look into a skill, a prompt hook, or instructions provided by the plugin.
2. **Package for distribution.** A marketplace manifest, install docs, and a CI job that runs `npm test`.
3. **Richer rules.** Import Cursor `.mdc` and Cline rules; scope rules by path glob; add `onPostToolUse` checks.
4. **A stream-rules spike.** Find out whether session events plus `session.abort` can reproduce OMP's mid-stream abort and retry.
5. **A conflict resolution tool.** Resolve with `@ours`, `@theirs` or `@base` per conflict.
6. **Structural editing.** ast-grep through an MCP server.
7. **Git workflow.** A commit-splitting skill with extension helpers.
8. **Specialist agents.** A reviewer with a P0 to P3 rubric, and an advisor.
9. **An optional launcher.** It would add `--experimental` and BYOK profiles.
