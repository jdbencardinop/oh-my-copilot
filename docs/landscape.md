# Agent harness landscape

This document compares oh-my-copilot (OMC) with OMP, with other coding-agent harnesses, and with
the tools that manage them. It answers three questions:

1. What do other harnesses do natively that base Copilot CLI does not?
2. Who else builds OMP-style layers, and how?
3. Which open-source projects can OMC reuse or learn from?

The research ran in November 2026. Read the [HTML edition](html/index.html) for section
navigation, readable tables, and links between reports.
The HTML files open locally without a server or external assets. Markdown is the source of
truth; regenerate all six HTML pages with `npm ci` followed by `npm run docs:html`.

The reports are a research snapshot, not an installed-version compatibility test. They mix
primary documentation with explicitly flagged secondary evidence. A missing feature means it
was not found in the reviewed sources, not that it cannot exist. Full reports, with sources and
flagged uncertainties, live in [`research/`](research/):

| Report | Scope |
| --- | --- |
| [01 — OMP ecosystem](research/01-omp-ecosystem.md) | OMP, Pi, and "oh-my-*" layers for other harnesses |
| [02 — Native harnesses](research/02-native-harnesses.md) | Built-in capabilities of 14 harnesses versus Copilot |
| [03 — Open-source projects](research/03-oss-projects.md) | Reusable tools: MCP servers, hooks, benchmarks |
| [04 — Orchestrators](research/04-orchestrators.md) | Apps that run and coordinate several harnesses |
| [05 — Superagent and EGM](research/05-superagent-and-egm.md) | DeepSeek's dsh-superagent, Google's Elephant-Goldfish Model, and Microsoft's TokenEconomizer, mapped to OMC's layer |

## How to read these reports

- **Short on time (10 minutes):** read the key findings, the candidate roadmap additions, and the
  mapping table in [report 05](research/05-superagent-and-egm.md#mapping-to-omc).
- **Full pass:** this page from top to bottom, then 05, then 02's capability comparison and 03's
  top reuse picks. Read 01 and 04 when you need depth on OMP-style layers or orchestrators.
- **Treat everything as a snapshot.** Star counts, versions, and "missing" features were true
  in the reviewed sources at research time.

## Key findings

- **Anchored editing deserves an isolated benchmark.** OMP's own benchmark reports hashline edits beating
  patch formats on 14 of 16 models. Two unrelated projects, gptme and PI-Desktop, adopted the
  design and credit OMP by name. This does not establish a win for OMC: our existing benchmark
  compares the whole plugin, not anchored editing alone.
- **Structural editing has a reuse candidate.** The reviewed base harnesses did not document
  built-in ast-grep tools; OMP does ship them. The `ast-grep-mcp` project offers a route to
  structural search without building a new parser.
- **Copilot CLI is competitive on many native features.** It ships LSP-first search, an ACP
  server, cross-session memory, `/fleet` subagents, plugins, and blocking `preToolUse` hooks. Its
  main gaps are a to-do tool, a richer hook taxonomy, staged edit recovery, a repository symbol
  map, and a debugger.
- **OMC's in-session layers are rare.** Most "oh-my-*" projects add agent teams and prompts.
  OMP is the only one found that adds tools such as a stream interrupt, an advisor, a debugger,
  or URL-scheme reads.
- **Review with a fresh context, before code exists.** Google's EGM drafts a spec with a
  context-rich agent and reviews it with zero-context subagents; it already ships an
  experimental Copilot CLI adapter. OMC should integrate with it rather than copy it. DeepSeek's
  dsh-superagent is mostly an orchestrator, but its "minimize human attention" prompts fit OMC
  as an opt-in rule pack. Microsoft's TokenEconomizer is a Copilot plugin in our layer: its loop
  guard and tool pruning overlap OMC's stream rules and per-model profiles, so OMC should coexist
  with it and borrow its methods. See [report 05](research/05-superagent-and-egm.md).
- **Many orchestrators run the user's own CLI in a git worktree.** OMC may work unchanged,
  but plugin loading, permissions, and interactive-only features need compatibility checks.

## What the star-count warning meant

The initial reports flagged large counts for young projects as a reason to double-check the
numbers. That was a verification caveat, not evidence of fake stars or inflated adoption.
Direct GitHub API checks on 2026-11-06 confirmed these counts:

| Repository | Stars |
| --- | ---: |
| [can1357/oh-my-pi](https://api.github.com/repos/can1357/oh-my-pi) | 37,986 |
| [pingdotgg/t3code](https://api.github.com/repos/pingdotgg/t3code) | 48,645 |
| [stablyai/orca](https://api.github.com/repos/stablyai/orca) | 116,976 |
| [herdrdev/herdr](https://api.github.com/repos/herdrdev/herdr) | 48,353 |
| [oraios/serena](https://api.github.com/repos/oraios/serena) | 31,138 |
| [ast-grep/ast-grep-mcp](https://api.github.com/repos/ast-grep/ast-grep-mcp) | 489 |

These are popularity snapshots, not measurements of active users, quality, or OMC compatibility.
Other counts in the detailed reports were not independently rechecked during synthesis.

## ast-grep and Go language support

**ast-grep searches code structure; ripgrep searches text.** It parses code into an abstract
syntax tree (AST), so a pattern such as `console.log($ARG)` can match a call despite formatting
differences. The ast-grep CLI can also rewrite matches. `ast-grep-mcp` is an experimental
Model Context Protocol (MCP) server that exposes only the search side: four tools for syntax
trees, rule testing, and pattern or rule search. For OMC, search can come first. Rewrites
would need a separate OMC tool with a preview and explicit acceptance.

**Go's language server is `gopls`**, maintained by the Go project, rather than `golang-pls`.
Language Server Protocol (LSP) presets would supply Copilot's existing LSP integration with
the server command and language/file mappings. They are configuration, not another agent.
Go with `gopls` is the user's priority; installation checks, configuration compatibility,
and Go workspace behavior still need validation before shipping a preset.
See the [official gopls documentation](https://go.dev/gopls/).

Serena is an optional symbol-editing MCP server, not a prerequisite for `gopls`.
Its [license file](https://github.com/oraios/serena/blob/main/LICENSE) specifies MIT for
SolidLSP and GPL-3.0-or-later for the Serena application. GitHub's `NOASSERTION` metadata
means its license detector did not assign a single SPDX license; it is not itself a license.
The earlier detailed report's licensing uncertainty is superseded by this source check.

## What base Copilot CLI lacks

The native-harness report ranks these by likely value to OMC. "Who has it" lists the best
reference implementation.

| Gap | Who has it | How they do it | OMC fit |
| --- | --- | --- | --- |
| Explicit to-do tool | Claude Code, Gemini CLI, VS Code | Typed task tools (`TaskCreate`, `write_todos`) | Small custom tool |
| Richer hook events | Claude Code (~30 events), Cursor | Pre/post compact, subagent start/stop, session events | Upstream request; OMC can only use the hooks Copilot exposes |
| Staged edit recovery | Gemini CLI (fuzzy, Levenshtein, then LLM repair), Cline | Fallback chain inside the edit tool | Extend `edit_anchored` recovery |
| Repository symbol map | Aider (tree-sitter plus PageRank), Cline | Ranked signatures injected as context | Candidate tool; no vector database needed |
| Side-effect-free review mode | Codex, Cursor Bugbot | Review runs without touching the tree | OMC reviewer agent partly covers this |
| Debugger | OMP only (DAP: lldb-dap, dlv, debugpy) | `debug` tool over DAP | Use `mcp-debugger` or `mcp-dap-server` |
| Notebook editing | Claude Code, VS Code | `NotebookEdit`, notebook tool set | Low priority for a CLI |
| Per-model edit formats or prompts | Aider, OpenCode, Cline | Format or prompt selected by model family | Matches roadmap item 10 |

Copilot leads in some areas: automatic LSP-first search, a native ACP server
(`copilot --acp`), Copilot Memory, `/fleet`, and the cloud agent's configurable network firewall.
VS Code agent mode also ships native notebook and browser tools.

## OMP-style layers for other harnesses

| Project | Harness | What it adds | Mechanism |
| --- | --- | --- | --- |
| [oh-my-pi](https://github.com/can1357/oh-my-pi) | Pi (fork) | Hashline, LSP writes, DAP, stream rules, advisor, ast-grep, URL schemes, eval, commit splitting | Rust core rewrite plus TypeScript shell |
| [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) | Claude Code | Parallel agent teams, multi-model routing, autopilot modes | Plugin marketplace plus npm CLI |
| oh-my-codex | Codex CLI | Hooks, agent teams, HUD | Codex plugins and hooks |
| oh-my-opencode ("Sisyphus") | OpenCode | Orchestrator with specialist subagents, LSP and AST tools | Config and plugins; fragmented forks with mixed licenses |
| [SuperClaude](https://github.com/SuperClaude-Org/SuperClaude_Framework) | Claude Code | Commands, personas, methodologies | Prompts and config only |
| [wshobson/agents](https://github.com/wshobson/agents) | Seven harnesses, including Copilot and Pi | Agents, skills and commands written once | Markdown source plus per-harness generators, checked in CI |

OMP differs from the others because it forks the harness and adds new tools. OMC reaches a similar
tool layer without a fork, through Copilot's extension SDK, hooks, and MCP.

## Reuse candidates for the roadmap

| Roadmap item | Reuse or study | Notes |
| --- | --- | --- |
| Structural editing (item 6) | [`ast-grep-mcp`](https://github.com/ast-grep/ast-grep-mcp) (MIT, experimental) | Search only; it documents no rewrite tool. Rewrites need an OMC tool with preview and acceptance |
| Debugger | [`mcp-debugger`](https://github.com/debugmcp/mcp-debugger) (MIT), `go-delve/mcp-dap-server` | Ship as MCP presets before writing a custom tool |
| LSP presets | [gopls](https://go.dev/gopls/), Copilot's native LSP configuration | Go first. Serena is a separate optional MCP approach, not required for native LSP presets |
| Advisor (item 8) | OMP advisor; [zen-mcp-server](https://github.com/BeehiveInnovations/pal-mcp-server) (now `pal-mcp-server`) | Appears inactive since December 2025; its LICENSE file contains Apache-2.0 text. Treat as a design reference |
| Per-model tool profiles (item 10) | [OpenCode](https://github.com/sst/opencode) per-provider prompts; Aider edit formats | Both select behavior by model family in production |
| More rule imports (item 3) | [ruler](https://github.com/intellectronica/ruler), [rulesync](https://github.com/dyoshikawa/rulesync) | They export one source to many formats; their per-format schemas still help OMC import |
| `read_uri` | OMP URL schemes (`pr://`, `issue://`, `conflict://`, `agent://`) | Existing read tools work on non-file resources |
| Benchmarks | [Harbor](https://github.com/harbor-framework/harbor) plus Terminal-Bench 2.0 | Built to compare agent setups on the same model; public results would be more credible |

## Orchestrators

Orchestrators sit one layer above harnesses. Most spawn the user's authenticated CLI in a git
worktree. Some use the Agent Client Protocol (ACP), a JSON-RPC protocol that lets any client drive
any agent.

| Tool | What it is | Copilot CLI support |
| --- | --- | --- |
| [Orca](https://github.com/stablyai/orca) (StablyAI) | Desktop and mobile orchestrator with coordinator and worker worktrees | "Any agent"; not confirmed by name |
| [T3 Code upstream](https://github.com/pingdotgg/t3code) | Open-source control surface for multiple harnesses | Copilot not confirmed in the upstream sources reviewed |
| [T3 Code fork](https://github.com/tesseracode/t3code) | The user's fork used for this session | Copilot support comes from this fork; it is not evidence of upstream support |
| [herdr](https://github.com/herdrdev/herdr) | Rust, agent-aware terminal multiplexer | Yes, with state detection |
| [Rex](https://www.superlogical.com/rex) (beta) | Mitchell Hashimoto's terminal with an agent "Activity Mode" built on the OSC 7501 status protocol | No native status reporting |
| Others | Conductor, Claude Squad, vibe-kanban, Nimbalyst, CCManager, Happy, Zed's agent panel | Copilot confirmed in vibe-kanban, CCManager, Nimbalyst (alpha), and Zed via ACP |

Implications for OMC:

- **Key state by worktree path.** Several Copilot instances may run in sibling worktrees of the same
  repository.
- **Test OMC under `copilot --acp`.** ACP sessions may skip interactive-only paths.
- **Consider emitting OSC 7501 status.** Rex and similar tools could then show whether a Copilot
  session is working, waiting, or failed. This is cheap but optional.
- **Container-based orchestrators** such as Sculptor may not mount `COPILOT_HOME`. Document this
  as a known caveat.

## Candidate additions to the roadmap

These are proposals, not decisions.

1. **Anchored-edit recovery.** When an anchor is stale, return the current lines in the error.
   Consider tree-sitter block operations, as PI-Desktop's ADR describes. This extends the
   existing "anchor errors" gap.
2. **ast-grep search through `ast-grep-mcp`**, plus a separate OMC rewrite tool with stage-then-accept rewrites.
3. **Isolate the anchored-edit effect** in our benchmark, and consider running Terminal-Bench
   through Harbor.
4. **To-do tool and symbol map.** Both are small native-parity tools that Copilot lacks.
5. **Debugger MCP and native LSP presets.** Prioritize Go with `gopls` for LSP configuration;
   use MCP where the native harness lacks a capability.
6. **Orchestrator readiness:** worktree-keyed state, an ACP-mode test, and optional OSC 7501
   status.
7. **EGM alongside OMC, plus a drift-report skill.** Test EGM's Copilot adapter in a disposable
   `COPILOT_HOME`, document the install, and add a read-only skill that reports drift between
   docs and code. See [report 05](research/05-superagent-and-egm.md#recommended-additions).
8. **Low-attention rule pack and dry-run stream rules.** Opt-in prompts from dsh-superagent
   (ask once, stop at named scope limits, honest delivery) and a log-only mode for stream rules.
9. **Coexist with TokenEconomizer.** Test it beside OMC in a disposable profile, borrow its
   "redirect once, then tell the person" loop policy for stream rules, and its unused-tool
   evidence for per-model tool profiles.
