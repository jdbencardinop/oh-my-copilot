# Native Harness Capabilities — Comparative Research Report
**Thread 2 of 4 — "oh-my-copilot" (OMC) research project**
**Date of research: November 2026.** All claims reflect documentation/source snapshots fetched in Nov 2026; several harnesses have undergone major renames/rebuilds since common mid-2025 training-data baselines (noted inline). Unverifiable or weakly-sourced claims are explicitly flagged **[unverified]**.

---

## 0. Methodology & scope note

This report synthesizes four parallel deep research passes, each fetching official docs/source directly:
1. GitHub Copilot CLI, Copilot coding/cloud agent, VS Code Copilot agent mode (and VS Code's "agent harnesses" concept covering Claude/Codex-in-VS-Code too).
2. Claude Code.
3. OpenAI Codex CLI and Cursor (IDE agent + `cursor-agent` CLI + Cloud/Background Agents).
4. OpenCode, "pi" (`earendil-works/pi`), Gemini CLI, Aider, Cline, Roo Code (shut down May 2026 — final-state snapshot), Amp, Factory Droid.

**Important corrections to common assumptions surfaced during research (read first):**
- **Cursor no longer uses an embeddings-based semantic codebase index.** It ships "Instant Grep," a proprietary local lexical/regex engine, explicitly marketed as *not* uploading code or storing embeddings. The old "codebase indexing" docs page now redirects there. — [cursor.com/docs/agent/tools/search](https://cursor.com/docs/agent/tools/search)
- **Aider has no native MCP support** (open feature request Aider-AI/aider#3314) and does **not** auto-detect `AGENTS.md` (only via generic `--read`).
- **Amp does not natively support ACP** — only a third-party bridge (`acp-amp`) exists. Amp also no longer gates tool calls behind approval by default (as of Nov 2026); this is a major behavior change from its 2025 `amp.permissions` model.
- **Roo Code was archived/shut down on 2026-05-15.** Findings describe its final shipped state (through v3.53.0); the team's active successor is a separate product, "Roomote."
- **"ast-grep" has zero evidence of native integration in ANY harness researched** (Copilot family, Claude Code, Codex, Cursor, OpenCode, pi, Gemini CLI, Aider, Cline, Roo, Amp, Factory Droid). Every harness that does structural/non-text code search either uses tree-sitter for a repo-map/symbol-index (Aider, Cline) or relies on LSP/grep instead.
- **MCP "server mode"** (the harness itself exposed as an MCP server for other tools to call) is rare: only the GitHub Copilot ecosystem, OpenCode **[unverified]**, and Amp (narrowly, for its "Puck" meta-agent) show any evidence of it. Most harnesses are MCP **clients only**.
- GitHub Copilot's three surfaces (CLI / cloud coding agent / VS Code agent mode) are materially different products with different capability sets — conflating them is a common error this report avoids by treating them as separate columns where it matters.

---

## 1. Capability matrix

Legend: ✅ = native, full; 🟡 = native but partial/limited/varies; ❌ = not natively supported (third-party/add-on only); ❓ = unverified/not found in docs reviewed.

| Capability | Copilot CLI | Copilot Cloud Agent | VS Code Copilot (agent mode) | Claude Code | Codex CLI | Cursor (IDE/CLI/Cloud) | OpenCode | pi | Gemini CLI | Aider | Cline | Roo Code (final) | Amp | Factory Droid |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Edit format: anchored/context diff (apply_patch-like)** | ❓ undocumented | 🟡 example-only `str_replace` | ❓ undocumented | ✅ Edit tool (str_replace, exact match, read-before-edit gate) | ✅ `apply_patch`/V4A context-anchored diff | ❓ undocumented wire format | ✅ `edit`(str_replace)+`patch`(multi-file, GPT-only) | ✅ `edit`/`write` | ✅ `replace` (str-replace+multi-stage fuzzy/Levenshtein/LLM recovery) | ✅ `diff`/`diff-fenced`/`udiff`/`whole` (model-selectable) | ✅ `replace_in_file` SEARCH/REPLACE + `write_to_file` | ✅ `apply_diff`/`apply_patch`/`edit`/`write_to_file` | ❓ closed-source, undocumented | 🟡 diff-based, undocumented internals |
| **Whole-file write tool** | ✅ | ✅ | ✅ | ✅ Write tool | ✅ (`Add File` in patch) | ✅ | ✅ `write` | ✅ | ✅ `write_file` | ✅ `whole` format | ✅ `write_to_file` | ✅ `write_to_file` | ❓ | ✅ `Create` |
| **Multi-file edit in one call** | 🟡 implied | ✅ iterative PR commits | ✅ working-set tracked | 🟡 parallel Edit calls, no single multi-file primitive | ✅ one patch, multiple `Update File` sections | ✅ unlimited tool calls/session | ✅ `patch` tool (GPT models only) | 🟡 via loop | 🟡 via loop | ✅ multiple tagged blocks per reply | 🟡 via loop | 🟡 via loop | ❓ | ❓ |
| **Edit error recovery/retry** | 🟡 interrupt-safe write only | 🟡 none documented | 🟡 Autopilot auto-retry | ✅ typed errors (ambiguous/stale/non-UTF8) feed back for re-attempt | ✅ typed `InvalidPatchError`/`InvalidHunkError` w/ line numbers | 🟡 undocumented (checkpoints are the rollback, not patch retry) | ✅ v2.2.5 shows nearest-match suggestions | 🟡 context-overflow retry only | ✅ 4-stage fallback incl. Levenshtein+LLM repair | ✅ dedicated troubleshooting doc, format-switch guidance | ✅ reverts on mismatch, falls back to whole-file after 3 fails | 🟡 consecutive-mistake limit (10) | ❓ | ❓ |
| **Grep tool** | ✅ | ✅ (`search`) | ✅ `#search/textSearch` | ✅ ripgrep-based (Win only by default; else via Bash) | 🟡 via shell tool only, no dedicated tool | ✅ "Instant Grep" (proprietary, local) | ✅ | ✅ | ✅ `grep_search` (git grep) | ❌ no dedicated tool | ✅ `search_files` (ripgrep) | ✅ `search_files` | ❓ | ✅ |
| **Glob tool** | ✅ | ✅ | ✅ `#search/fileSearch` | ✅ (Win default; else Bash) | 🟡 via shell | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❓ | ✅ |
| **LSP integration (native, automatic)** | ✅ automatic, prefers LSP over text search | ❓ not confirmed | ✅ `#search/usages`, Problems panel | ✅ LSP tool, auto diagnostics post-edit (needs per-language plugin) | ❌ not found | ❓ not confirmed as named tool | ✅ broad (gopls/rust-analyzer/pyright/etc.) | ❌ | ❌ (delegated to `codebase_investigator` subagent) | ❌ | 🟡 optional plugin, SDK/CLI only | ❌ | ❓ | 🟡 via ACP IDE context only |
| **Semantic/vector codebase index** | ❌ (LSP instead) | ✅ RAG-based semantic search | ✅ `#search/codebase` (workspace index) | ❌ (Grep/Glob/LSP/subagents instead) | ❌ | ❌ (replaced by Instant Grep, explicitly no embeddings) | ❌ | ❌ | ❌ (subagent-based instead) | ❌ (tree-sitter repo-map instead) | ❌ | ✅ tree-sitter→embeddings→Qdrant | 🟡 Task subagent skill | ❌ (AGENTS.md/AutoWiki instead) |
| **tree-sitter repo-map / symbol index** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ signature feature, PageRank-ranked | ✅ `list_code_definition_names` | ✅ (feeds codebase index) | ❌ | ❌ |
| **ast-grep** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Web fetch tool** | ✅ `web_fetch` | ❌ "not applicable in cloud" | ✅ `#web/fetch` | ✅ WebFetch (HTML→MD, 2nd-model extraction, caching) | 🟡 via shell/API only | ✅ "Fetch" tool (distinct from Browser) | ✅ `webfetch` | ❌ none | ✅ `web_fetch` (20 URLs, SSRF-protected) | 🟡 `/web` scrape-only | ✅ `web_fetch` | ❓ | ✅ (Parallel-powered) | ✅ `FetchUrl` |
| **Web search tool** | ✅ `web_search` | ❌ | ❌ (requires MS extension) | ✅ WebSearch (server-side, title/URL only) | ✅ `web_search` (live/cached/indexed modes) | ✅ "Web" tool | ✅ `websearch` | ❌ none | ✅ `google_web_search` (grounded, cited) | ❌ | ✅ `web_search` | ❓ | ✅ (Parallel-powered) | ✅ `WebSearch` |
| **Hooks (lifecycle events)** | ✅ incl. blocking `preToolUse` | ❓ not found | ✅ (Preview, shared w/ CLI format) | ✅ ~30 events incl. block/modify | ✅ 13 events, trust-gated | ✅ very granular (agent/tab/app-lifecycle) | ❓ not confirmed | ❓ not core (extension-based) | ✅ JSON stdout, exit-code-2 block | ❌ none | ❓ | ❓ | ✅ plugin `tool.call` handlers | ✅ incl. `PreToolUse` |
| **Plugin system** | ✅ "Agent Plugins 1.0" + marketplace | ❌ | ✅ Customization Marketplace | ✅ bundles skills/agents/hooks/MCP/mods | ✅ shared w/ ChatGPT, one universal dir | ❓ (skills double as modes) | ✅ npm/git/local | ❌ (extensions are the mechanism) | ✅ Extensions (bundle everything) | ❌ | ✅ (SDK/CLI/Desktop) | ✅ | ✅ TS/JS plugin system | ✅ incl. Claude-Code-plugin compat |
| **MCP client** | ✅ | ✅ (default-on GitHub+Playwright) | ✅ + "Copilot connectors" | ✅ full (resources, tool search) | ✅ | ✅ incl. MCP Apps (UI ext.), OAuth | ✅ stdio+HTTP/OAuth | ✅ stdio+HTTP | ✅ stdio/SSE/HTTP | ❌ **not supported** | ✅ | ✅ (project config wins) | ✅ | ✅ incl. built-in registry |
| **MCP server mode (self as server)** | ❓ | ❓ | ❌ | ❌ | ❓ | ❌ | ❓ [unverified] | ❌ | ❌ | ❌ | ❓ | ❌ | 🟡 ("Puck" only) | ❓ |
| **Skills (SKILL.md / Agent Skills std)** | ✅ | ✅ | ✅ | ✅ (+ merged w/ slash commands) | ✅ `$skill` mentions | ✅ (promotable to Custom Modes) | ✅ | ✅ | ✅ | ❌ | ✅ | ❓ | ✅ (MCP-bundled) | ✅ |
| **Subagents** | ✅ `--fleet`, built-ins | ✅ `agent` tool-kind | ✅ `#agent/runSubagent`, nesting | ✅ `.claude/agents/`, Explore/Plan/General built-ins | ✅ default-on | ✅ `.cursor/agents/`, Explore+Browser built-in | ✅ `mode: subagent` | 🟡 example ext. only, not core | ✅ codebase_investigator, cli_help, browser_agent + A2A remote | ❌ | ✅ `spawn_agent` (CLI/Desktop) | 🟡 Boomerang=sequential only | ✅ Task + Read Thread | ✅ `.factory/droids/` |
| **Parallel subagents (concurrent)** | ✅ fleet | ✅ multi independent sessions | ✅ "independent tasks in parallel" | 🟡 no documented hard cap | ✅ (reduces context rot) | ✅ unlimited (Cloud Agents) | ❓ | ❌ | ❓ | ❌ | ❓ | ❌ (Boomerang is sequential) | ✅ | ✅ Workstreams (beta) |
| **Background/cloud agent execution** | ✅ `--cloud`, `/delegate` | ✅ inherent design | ✅ Cloud sessions, GitHub Environments | 🟡 background Bash only (Ctrl-B), no full cloud agent | ✅ Codex Cloud (2-phase sandboxed container) | ✅ Cloud Agents, unlimited parallel | ❓ | ❌ | ❓ | ❌ | ✅ Cline Cloud Agents | ❌ (shut down) | ✅ "Orbs" | ✅ Droid Computers |
| **Plan mode** | ✅ `/plan` | 🟡 workflow convention | ✅ `/plan` agent | ✅ native permission mode + Plan subagent | 🟡 `/plan`+PLANS.md convention **[moderate confidence]** | ✅ Shift+Tab, saved plan file | ✅ Tab toggle Plan/Build | ❌ (by design) | ✅ default-on, read-only | 🟡 `architect` mode (2-model split) | ✅ Plan/Act (signature feature) | ✅ Architect mode | 🟡 folded into Task's planning skill | ✅ Spec Mode |
| **Todo list tool** | 🟡 plan.md checklist only | ❌ "not applicable" | ✅ `#todos` | ✅ TaskCreate/Get/List/Update (model-gated) + legacy TodoWrite | 🟡 `update_plan`, became opt-in **[moderate confidence]** | ✅ via ACP `cursor/update_todos` | ❓ removed in V2 | ❌ | ✅ `write_todos` | ❌ | 🟡 "Focus Chain" deprecated, no replacement | ✅ `update_todo_list` | ❌ removed Jan 2026 | ❓ |
| **Checkpoints/rewind/undo** | ✅ auto at compaction, `/undo`/`/rewind` | 🟡 steering msgs only | ✅ restore checkpoint | ✅ auto per-turn, 100 retained, `/rewind` | ❓ `codex resume` only, no file-snapshot checkpoint found | ✅ auto before changes, local store | ✅ git-object "Snapshots", `/undo`/`/redo` | ❌ | ✅ shadow-git + broader `/rewind` (survives compaction) | ✅ git-based `/undo` | ✅ shadow-git, 3 restore modes | ✅ shadow-git, pre-edit snapshots | ❌ ("Handoff" replaces compaction instead) | 🟡 worktree isolation + `--fork` only |
| **Session resume** | ✅ `/resume`, cross-surface | ✅ cross-client continuity | ✅ session list, "Chronicle" search | ✅ `--continue`/`--resume`/`--from-pr` | ✅ `codex resume` | ✅ `agent ls/resume/--continue` | ✅ `fork`/`resume`/`load` | ✅ `/resume`,`/fork`,`/clone`,`/tree` | ✅ named checkpoints, 30-day retention | ✅ `--restore-chat-history` | ✅ resumable task history | ✅ | ✅ Thread (portable/shareable) | ✅ `--resume`,`/tree`,`/sessions` |
| **Review mode (dedicated)** | ✅ `/review`,`/security-review` | ✅ Agent Merge (auto-fix PR) | ✅ per-harness diff UIs | ❓ not found as distinct mode | ✅ dedicated review w/o touching tree | ✅ Agent Review (local) + Bugbot (PR/cloud) | ❓ | ❌ | ❓ | ❌ | ❓ | ❓ | ❓ | ✅ (+ Droid Action for PR review) |
| **BYOK (bring your own API key)** | ✅ env vars | ❓ likely unsupported | ✅ Language Models editor | 🟡 via Bedrock/Vertex/Foundry only, not raw 3rd-party key | ✅ custom `model_provider` | ✅ at list price from credit | ✅ `/connect` | ✅ 30+ providers | ❌ Gemini-only | ✅ via litellm, broadest | ✅ | ✅ | ✅ | ✅ custom OpenAI/Anthropic-compat endpoints |
| **Per-agent/session model selection** | ✅ | 🟡 trigger-time only | ✅ per-harness picker | ✅ `/model` + aliases | ✅ `[agents]` config | ✅ picker + per-subagent | ✅ | ✅ + llama.cpp local router | ✅ `/model` + fallback chain | ✅ main/weak/editor split | ✅ | ✅ Sticky Models (per-mode) | ✅ "The Dial" (4 fixed bundles) | ✅ per-worker/validator/spec |
| **Reasoning-effort control** | ✅ `--effort` | ✅ dropdown | ✅ "thinking effort" setting | ✅ (effort levels, cache-aware) | 🟡 config key confirmed, flag unconfirmed | ❓ not a distinct named dial | ✅ named "Variants" (#high/#low/#max) | ✅ `--thinking` | ❓ not confirmed | ✅ `--reasoning-effort`/`--thinking-tokens` | ✅ Extended Thinking toggle + CLI levels | ✅ `-r/--reasoning-effort` | ✅ per-Dial-mode | ✅ granular levels |
| **Model routing/auto-advisor** | ✅ "Copilot Fusion" | 🟡 "Auto" default (GPT-5.3-Codex fallback) | ✅ Copilot Fusion (Single/Cascade/Critique) | ❌ | 🟡 "Ultra" preset, not general auto-route | ✅ "Cursor Router" (Teams/Ent) | ❓ | ❓ | ✅ Auto/Pro routing (3.1) | ❌ | ❓ | ❓ | ❓ | ✅ "Factory Router"/Auto Model |
| **Context compaction (auto)** | ✅ 80/90/95% thresholds | ❌ none | ✅ auto-summarize | ✅ auto-compact, documented survivors list | 🟡 `/compact` **[moderate confidence, secondary sources]** | ✅ automatic | ✅ default-on, v2.2.5 improved | ✅ threshold-based + branch summary | ✅ `/compress` manual + hook | 🟡 soft-limit summarization only | ✅ Auto-Compact, cache-aware | ✅ Context Condensation v2 | ✅ automatic | ✅ 250k-token default |
| **Context window indicator/UI** | ✅ `/context` breakdown | ❓ no ceiling documented | 🟡 7-layer model, no numeric indicator confirmed | ✅ context-window doc/visualization | ❓ not found | ✅ "context ring" + category tray | ❓ not confirmed | ✅ footer usage display | ✅ `/stats` | ✅ `/tokens` | ✅ live token/cost header | ❓ | ✅ `amp usage` | ✅ Analytics dashboard |
| **Prompt caching (documented)** | 🟡 inferable from `/usage` cache counts | ❓ | ❓ not confirmed | ✅ explicit, effort-aware | ✅ `cached_input_tokens` field | ✅ explicit cache write/read pricing | ✅ reuse + "warming" | ✅ `cacheWarming` setting | ✅ token-caching doc | ✅ very detailed (`--cache-prompts`) | ✅ cache-aware Auto-Compact | ❓ | ❓ | ❓ not found |
| **Cost/token reporting** | ✅ `/usage` | 🟡 AI-credits billing, no in-session breakdown | ✅ Status Bar dashboard | ✅ `/usage` | ✅ JSON `usage` object | ✅ settings + shared dashboard | ❓ not confirmed | ✅ | ✅ `/stats` | 🟡 startup line, no `/cost` confirmed | ✅ live cost in header | ❓ | ✅ `amp usage`/"Explain Usage" | ✅ Analytics API |
| **Approval/permission modes** | ✅ Manual/Assisted/Allow-all | ✅ gov. by design (no self-approve) | ✅ 3-tier + per-harness schemes | ✅ default/acceptEdits/plan/auto/dontAsk/bypass | ✅ on-request/never (OS sandbox-tied) | ✅ Auto-review/Allowlist/Run-Everything | ✅ rule engine w/ wildcards + Policies layer | ❌ no default gating | ✅ default/auto_edit/plan/yolo | 🟡 `--yes`/`--yes-always` only | ✅ granular per-capability toggles | ❓ | ❌ no gating by default (Nov 2026) | ✅ Autonomy Levels + rules engine |
| **OS-level sandbox** | ✅ "MXC" container (local) + cloud sandbox | ✅ cloud-only sandbox | ✅ Seatbelt/bubblewrap/BaseContainer | ✅ `@anthropic-ai/sandbox-runtime`, mac/Linux/WSL2 only | ✅ Seatbelt/bubblewrap/Windows sandbox | 🟡 "not a security boundary" (classifier-based) + CLI `--sandbox` flag | 🟡 explicitly NOT sandboxed by default (permission rules only) | 🟡 opt-in via Docker/Gondolin ext. | ✅ Seatbelt + Docker/Podman | ❌ none (git undo is the safety net) | ❓ | ❓ | ❌ (Orbs=isolation, not sandbox) | ✅ Seatbelt/bubblewrap+seccomp |
| **Network firewall/allowlist** | ❓ | ✅ configurable allowlist | ✅ network restriction option | 🟡 via sandbox-runtime proxy allowlist | ✅ off-by-default, workspace-scoped | ✅ MCP allow/deny controls (enterprise) | ❓ | ❓ | ✅ policy engine | ❌ | ❓ | ❓ | ❓ | ✅ allowlisted network proxy |
| **Headless/non-interactive mode** | ✅ `-p`, `--output-format=json` | ✅ inherent (async trigger) | 🟡 no confirmed headless for in-editor agent | ✅ `-p`/`--print`, `--bare` | ✅ `codex exec` w/ JSON schema output | ✅ `cursor-agent -p`, text/json/stream-json | ✅ `opencode run` | ✅ Print/JSON/RPC modes | ✅ `-p` w/ NDJSON, exit codes | ✅ `--message`/`-m` | ✅ standalone CLI/TUI | ✅ `@roo-code/cli` | ✅ `amp -x`/`-ox` | ✅ `droid exec` (5 output formats) |
| **SDK (programmatic embedding)** | ✅ "GitHub Copilot SDK" (named, undetailed) | 🟡 named, undetailed | ❓ | ✅ TS + Python Agent SDK | ✅ `@openai/codex-sdk` (TS) | ✅ `@cursor/agent-sdk` (broadest: channels/deploy) | ✅ `@opencode-ai/sdk` (TS) | ✅ TS SDK (`createAgentSession`) | ❓ | 🟡 unofficial `Coder.create()` | ✅ (SDK/CLI/Desktop) | ❓ | ✅ TS + Python SDKs | ✅ TS + Python SDKs |
| **ACP (Agent Client Protocol)** | ✅ `copilot --acp` | ❌ | ❌ (own "AHP" instead) | ❓ not official (3rd-party `claude-code-acp` only) | ❌ not found | ✅ `agent acp`, rich extensions | ✅ `opencode acp` (Zed/JetBrains) | ❌ (bespoke RPC instead) | ✅ `gemini --acp` | ❌ | ✅ (CLI) | ❓ | ❌ (3rd-party bridge only) | ✅ (JetBrains/Zed) |
| **GitHub Actions/native GitHub integration** | ✅ documented Actions pattern | ✅ inherent (issues/PRs/API) | 🟡 migrating cloud-session mechanism | ✅ `claude-code-action`, `@claude` mentions | ✅ `openai/codex-action` | ✅ `@cursor`, Bugbot CI check | ✅ `opencode github install` | ❌ none found | ✅ in-repo workflows + official Action | ❌ none found | 🟡 documented recipe, not Marketplace App | ❓ | ✅ App-based, webhook orbs | ✅ Droid Action (multi-VCS) |
| **LSP-based diagnostics surfaced to agent** | ✅ automatic | ❓ | ✅ Problems panel integration | ✅ post-edit auto-report | ❌ | ❓ | ✅ | ❌ | ❌ | ❌ | 🟡 optional plugin | ❓ | ❓ | 🟡 via ACP IDE context |
| **Debugger integration** | ❌ | ❌ | ❓ (3rd-party MCP only lead) | ❌ | ❌ | ❓ | ❓ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Notebook/Jupyter support** | ❌ | ❌ | ✅ rich native tool set | ✅ NotebookEdit tool | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Browser automation (native, no MCP)** | 🟡 "Computer use" (desktop GUI, not browser-specific) | 🟡 default-on Playwright MCP (bundled ≠ native tool) | ✅ full native tool set | ❌ (WebFetch only) | ❌ | ✅ Navigate/Click/Type/Screenshot/Console/Network | ❓ (Code Mode in desktop beta) | ❌ | ✅ `browser_agent` subagent | 🟡 `/web` scrape (Playwright for JS) | ✅ Puppeteer `browser_action` | ❌ (removed) | ❓ | ❌ |
| **Persistent memory (cross-session facts)** | ✅ "Copilot Memory" | ❌ | ❓ | 🟡 auto-memory (2nd system beyond CLAUDE.md) | ❌ | 🟡 "Memories" page gone/merged, uncertain | ❌ | ❌ | ✅ experimental "Auto Memory" | ❌ | 🟡 "Memory Bank" = community pattern, not native | ❌ | ❌ | ❌ |

---

## 2. Per-harness distinctive notes

### GitHub Copilot CLI (`@github/copilot`)
Standalone terminal agent. Distinctive natively-shipped features: automatic LSP-over-grep preference ([docs.github.com/en/copilot/concepts/customizations/lsp-servers](https://docs.github.com/en/copilot/concepts/customizations/lsp-servers)); a native ACP server mode (`copilot --acp`) — notably the **only** Copilot surface with ACP; a dedicated cross-session "Copilot Memory" feature (`copilot memories import`) unmatched elsewhere in the Copilot family ([docs.github.com/en/copilot/concepts/prompting-and-context/copilot-memory](https://docs.github.com/en/copilot/concepts/prompting-and-context/copilot-memory)); `--fleet`/`/fleet` for parallel subagents; "Agent Plugins 1.0" with its own marketplace (`github/awesome-copilot` default); "Copilot Fusion" model router shared conceptually with VS Code. Its slash-command surface (`/plan`,`/fleet`,`/delegate`,`/review`,`/security-review`,`/yolo`,`/sandbox`,`/undo`,`/resume`,`/compact`,`/context`,`/usage`) is the richest documented among the three Copilot surfaces.

### GitHub Copilot Cloud/coding agent
Fundamentally async/headless by design — triggered via issue assignment, `@copilot` PR mention, a public-preview REST "agent tasks" API, or GraphQL. Distinctive: a formally documented, configurable **network firewall/allowlist** unique among all harnesses researched; strict self-approval governance (cannot approve its own PR; can only push to branches it created); default-enabled Playwright MCP server for browser automation; "Agent Merge" that watches a PR and auto-fixes failing CI/merge conflicts. Lacks: web tools (explicitly "not applicable in cloud"), todo-list tool (explicitly "not applicable"), documented context-window ceiling, confirmed BYOK.

### VS Code Copilot agent mode
VS Code's docs (reorganized ~Nov 2026) introduce the concept of **"agent harnesses"** — Copilot, Local (native extension-host), Claude, and Codex — all shipped as first-class, built into VS Code itself, not third-party extensions. Distinctive natively-shipped tools unmatched by the CLI or cloud agent: `#search/codebase` (semantic workspace index), full native **Notebook tooling** (`#edit/editNotebook`, `#execute/runNotebookCell`, kernel-variable refs), and fully native **browser automation** (`openBrowserPage`,`navigatePage`,`screenshotPage`,`clickElement`,`runPlaywrightCode` — no MCP required). Explicitly does **not** support ACP (uses its own "Agent Host Protocol," open issue microsoft/vscode#265496). Web search is notably NOT native (requires a separate Microsoft extension).

### Claude Code
Strict `str_replace`-only edit model with mandatory read-before-edit gating and typed failure feedback (no diff/whole-file ambiguity). One of the richest **hooks** systems found (~30 named events: PreToolUse/PostToolUse/PreCompact/PostCompact/SubagentStart/Stop/etc.), all capable of blocking/modifying via `permissionDecision`. Skills and slash commands have been **unified** — both now produce `/name` invocations from `.claude/skills/<name>/SKILL.md`. A documented plugin manifest schema (`.claude-plugin/plugin.json`) with marketplaces. Native OS-level sandboxed Bash execution (open-sourced as `@anthropic-ai/sandbox-runtime`). Checkpointing is the most explicit of any harness (100 retained snapshots, granular restore options). Caveat: Grep/Glob tools are oddly **absent by default on macOS/Linux/WSL** (Bash-embedded find/grep used instead) — only on by default on Windows.

### OpenAI Codex CLI
Rust-based, open-source. Centers on the `apply_patch`/V4A context-anchored diff format (chosen specifically because models hallucinate line numbers — uses `@@` context markers instead), verified directly against source (`codex-rs/apply-patch/src/parser.rs`, `lib.rs`). Genuine OS-level sandbox (Seatbelt/bubblewrap/Windows sandbox) with `approval_policy` now reduced to `on-request`/`never` (the older `untrusted` policy was explicitly retired in Nov 2026 docs). `codex exec` headless mode is unusually rich: JSONL event stream, `--output-schema` for JSON-Schema-constrained structured output. "Codex Cloud" runs a two-phase sandboxed container (network-enabled setup phase, then offline agent phase by default). Subagents are enabled by default in current releases, explicitly framed around reducing "context rot."

### Cursor (IDE / `cursor-agent` CLI / Cloud Agents)
Replaced its embeddings-based semantic index with a proprietary local lexical engine ("Instant Grep") — an important correction to common assumptions. Extremely granular, three-tier hooks taxonomy (Agent/Tab/App-lifecycle). Native MCP support includes the MCP Apps extension (interactive UI returned by tools) — notable breadth. Distinctive "Run Modes" permission model (Auto-review/Allowlist/Run-Everything) with an explicit documented admission that "Auto-review is not a security boundary" (LLM classifier, not sandbox). Native, no-MCP-required Browser tool with persistent per-workspace session state. Full ACP support with Cursor-specific protocol extensions (`cursor/update_todos`, `cursor/create_plan`, etc.). Ownership/bundling context: as of Nov 2026 docs, Cursor is marketed as part of "The X Subscription" bundling Grok+Cursor+X, reflecting a deep xAI tie-in.

### OpenCode (sst/opencode → anomalyco/opencode, "V2")
Client-server architecture (shared background daemon, multiple TUI/desktop/web clients attach to it). `AGENTS.md`-only by design in V2 (explicitly dropped CLAUDE.md fallback). Full ACP agent mode (`opencode acp`) for Zed/JetBrains. Named reasoning "Variants" (`#high`/`#low`/`#max`). Native git-object-based Snapshots for undo/redo. Permission model is an explicit rule engine (`{action, resource, effect}`) layered under org-level "Policies" — and docs explicitly **recommend permission rules over OS sandboxing**, i.e., no sandbox by default.

### pi (`earendil-works/pi`, formerly `badlogic/pi-mono`)
Deliberately minimal ("clay, not product") — explicitly omits subagents, plan mode, and todo lists as *core* features by design, exposing a TypeScript extension API (`pi.registerTool/registerCommand/on(event)`) instead. No native web-fetch/web-search tool at all (by design — use Bash/MCP/extension). Distinctive "codemode" (QuickJS-sandboxed scripting layered over tools). Broadest native model-provider list (30+) including a local llama.cpp auto-discovery router for GGUF files. No default approval gating at all — relies entirely on opt-in sandbox extensions (Docker/Gondolin micro-VM). No ACP; uses a bespoke RPC protocol instead.

### Gemini CLI (Google)
Multi-stage edit-recovery pipeline confirmed directly in source (`edit.ts`): exact → whitespace-flexible → regex-flexible → Levenshtein fuzzy → LLM-assisted repair — the most elaborate documented edit-recovery chain of any harness. `GEMINI.md` hierarchical memory with JIT ancestor-directory scanning, configurable to also read `AGENTS.md`/`CONTEXT.md`. Native A2A (Agent2Agent) protocol support for **remote** subagents, distinct from local subagents. Native ACP mode (`gemini --acp`). Notably **Gemini-only** for models — no BYOK/third-party-LLM support, a sharp contrast with every other non-Copilot harness researched.

### Aider
The outlier in architecture: no plugin system, no native MCP, no AGENTS.md auto-detection — but the most mature **repo-map** feature (tree-sitter-parsed, PageRank-ranked symbol graph fit to a token budget) and the deepest native **git integration** (auto-commit on every AI edit with generated Conventional-Commits messages, `/undo` as git-revert). Supports the broadest edit-format selection (`whole`/`diff`/`diff-fenced`/`udiff`/architect-split), chosen per-model. Very detailed prompt-caching controls (`--cache-prompts`, structured cache-boundary ordering, keepalive pings).

### Cline
Full standalone evolution beyond its VS-Code-extension origins — now CLI/SDK/Desktop/JetBrains/Cloud. "Plan/Act" mode (distinct models per mode) is its signature feature. Granular per-capability permission toggles (Read/Edit/Execute/Browser/MCP) rather than Cursor/Claude-style unified permission-mode presets. Broadest documented provider catalog (200+ providers, 6,400+ models, auto-refreshed). "Memory Bank" is explicitly a **community prompting convention**, not a native feature — a useful distinction from similarly-named native features elsewhere.

### Roo Code (shut down 2026-05-15 — historical snapshot)
Its "Boomerang Mode" (Orchestrator) delegates subtasks via `new_task` but is **sequential parent-pause/child-resume**, not concurrent fan-out — an important nuance vs. true parallel subagents elsewhere. Had real semantic codebase search via tree-sitter→embeddings→Qdrant (more "real" vector search than most competitors claimed). Removed its browser tool entirely (PR #11392) before shutdown. Successor project "Roomote" is a separate self-hosted cloud-agent product, out of scope here.

### Amp (Sourcegraph → "Amp Frontier Corporation")
Underwent a near-total rebuild in 2025–2026: VS Code/Cursor extensions killed, slash commands removed (replaced by skills), TODOs removed ("no longer needed with Opus 4.5"), and — critically — **no default tool-approval gating as of Nov 2026** (a reversal from its earlier granular `amp.permissions` system). "The Dial" (low/medium/high/ultra) bundles model+effort+prompt+toolset as fixed presets rather than exposing independent knobs. Background/cloud execution is branded "Orbs" (e2b-based, self-hostable). Closed-source — edit-tool internals are not publicly documented.

### Factory Droid
Strong enterprise/governance posture: genuine OS-level sandbox (Seatbelt/bubblewrap+seccomp) with fail-closed semantics, a rule-based permission engine, and a built-in secret scanner ("Droid Shield"). "Missions" orchestrate plan-then-execute workflows at scale (worker/validator roles, up to ~500 features claimed). "Workstreams" (beta) do parallel multi-machine agent fan-out with a shared artifact folder. Explicit Claude-Code-plugin compatibility layer (auto-converts `.claude-plugin/`→`.factory-plugin/`). The commonly-referenced "Reality Check" branded term was **not found** in public docs — closest match is the `/verify` slash command (investigator framing with CONFIRMED/REFUTED/INCONCLUSIVE verdicts) in the "Droid Control" plugin.

---

## 3. What base GitHub Copilot CLI lacks (ranked by likely OMC value)

Ranked roughly by (a) how commonly other top harnesses have it, (b) how much it would improve a Copilot CLI user's workflow, and (c) feasibility to port as an OMC plugin feature.

1. **Dedicated todo-list tool** — Copilot CLI only has an implicit `plan.md` checklist; Claude Code (TaskCreate/TodoWrite), VS Code (`#todos`), Gemini CLI (`write_todos`), Cline, Roo, and most others have an explicit structured tool the model is pushed to use for multi-step tracking. High value, low complexity to port as an OMC tool/skill.
2. **Persistent, hook-based tool-call blocking beyond `preToolUse`** — Copilot CLI has hooks but the fuller event taxonomies in Claude Code (~30 events) and Cursor (agent/tab/app-lifecycle) allow much richer interception (e.g., `afterFileEdit`, `beforeSubmitPrompt`, `PreCompact`/`PostCompact`). Worth evaluating which additional hook points OMC could simulate via its own plugin layer.
3. **Dedicated review-mode parity with Cursor's Agent Review/Bugbot or Codex's "review uncommitted changes without touching the tree"** — Copilot CLI has `/review`/`/security-review` but no confirmed "review without side effects" guarantee documented; worth hardening/porting OMP's review workflow explicitly.
4. **Multi-stage edit-error recovery** (Gemini CLI's exact→whitespace→regex→Levenshtein→LLM-repair chain; Claude Code/Codex's typed-error feedback) — Copilot CLI's edit-recovery story is undocumented/unclear; a more robust recovery layer could reduce failed-edit loops.
5. **Repo-map/tree-sitter symbol index (Aider-style)** — none of the Copilot surfaces have this; it's a cheap, non-LLM-call way to improve context quality for large repos, complementary to Copilot's existing LSP-first approach.
6. **Context-window visualization matching Cursor's "context ring" / Claude Code's context-window doc** — Copilot CLI has `/context` but the category-by-category breakdown (System/Tools/Rules/Skills/MCP/Subagents/Conversation) seen in Cursor is more granular.
7. **A more explicit, OS-level sandbox analogous to Codex's Seatbelt/bubblewrap or Factory's fail-closed sandbox** — Copilot CLI's "MXC" local sandbox is mentioned but less transparently documented than Codex's/Factory's; worth comparing hardening posture.
8. **Reasoning-effort/model-routing transparency to match Cursor's "Auto"/Factory's "Auto Model" cost-savings framing** — Copilot has Copilot Fusion, broadly comparable, but less user-facing cost-savings messaging; lower priority since functionally similar.
9. **Native debugger integration** — absent in literally every harness researched (not a differentiator; low priority).
10. **ast-grep** — absent everywhere; not a meaningful gap versus competitors (skip).

---

## 4. What Copilot (across its three surfaces) has that others lack

1. **Automatic LSP preference over text search** (CLI) — most competitors either have no LSP (Codex, Cursor unconfirmed, pi, Amp) or gate it behind manual plugin installs (Claude Code, Cline SDK-only).
2. **Native ACP server mode** (CLI only: `copilot --acp`) is relatively rare — shared only with Cursor, OpenCode, Gemini CLI, Factory Droid; notably Claude Code and Amp do **not** have first-party ACP.
3. **Persistent cross-session "Copilot Memory"** (CLI) with explicit import tooling — most competitors either have no native memory system (Codex, Cursor, OpenCode, pi, Aider, Roo, Amp, Factory) or only experimental/ambiguous versions (Gemini CLI's "Auto Memory", Claude Code's second auto-memory system, Cursor's apparently-deprecated "Memories").
4. **Formally documented, configurable network firewall/allowlist** (Cloud/coding agent) — the most explicit of any harness researched; Codex's sandbox is off-by-default network access but not a configurable allowlist in the same governance sense; Factory Droid is the closest comparator.
5. **Fully native, no-MCP-required Notebook tooling and Browser automation** (VS Code surface) — Claude Code has notebook support (NotebookEdit) but no native browser tool; Cursor has native browser but Claude Code/Codex/OpenCode/Aider/Amp/Factory do not have native notebook tools.
6. **Cross-surface session continuity** (CLI/cloud/VS Code/mobile/app all sharing session state) — a breadth of surface integration (desktop, mobile app, Slack/Teams trigger, GitHub.com) that most single-product competitors don't match end-to-end, though Amp and Cline both have multi-surface ambitions (native apps, Slack).
7. **Strict governance model for cloud-agent PR self-approval** (cannot approve own PR; can only push to branches it created) — a deliberate security design not emphasized the same way in other cloud-agent products (Codex Cloud, Cursor Cloud Agents, Amp Orbs, Factory Droid Computers) based on docs reviewed.
8. **Shared "Agent Skills" cross-surface implementation** spanning CLI/cloud/VS Code using the *same* open standard — gives Copilot users a consistent skills mechanism across all three products, whereas many competitors (e.g., Amp, pi) only partially or inconsistently adopt the same spec.

---

## 5. Sources

### GitHub Copilot (CLI / Cloud / VS Code)
- https://docs.github.com/en/copilot/reference/custom-agents-configuration
- https://docs.github.com/en/copilot/concepts/customizations/lsp-servers
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/overview
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/watch-and-fix-pull-requests
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-the-agent-environment
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-the-firewall
- https://docs.github.com/en/copilot/reference/copilot-allowlist-reference
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/configure-secrets-and-variables
- https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/allowing-tools
- https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/overview
- https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli-in-actions
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server
- https://docs.github.com/en/copilot/reference/github-copilot-app-reference/slash-commands
- https://docs.github.com/en/copilot/concepts/prompting-and-context/copilot-memory
- https://docs.github.com/en/copilot/concepts/models/bring-your-own-key
- https://docs.github.com/en/copilot/concepts/models/copilot-fusion
- https://docs.github.com/en/copilot/reference/custom-instructions-support
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions
- https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/computer-use
- https://docs.github.com/en/copilot/concepts/copilot-surfaces/copilot-cli
- https://code.visualstudio.com/docs/agents/reference/tools-reference
- https://code.visualstudio.com/docs/agents/reference/workspace-context
- https://code.visualstudio.com/docs/agents/reference/custom-instructions-reference
- https://code.visualstudio.com/docs/agents/run/review-code-edits
- https://code.visualstudio.com/docs/agents/run/approvals
- https://code.visualstudio.com/docs/agents/run/agents-window
- https://code.visualstudio.com/docs/agents/run/browser-tools
- https://code.visualstudio.com/docs/agents/guides/notebooks-with-ai
- https://code.visualstudio.com/docs/agents/concepts/language-models
- https://code.visualstudio.com/docs/agent-customization/hooks
- https://code.visualstudio.com/docs/agent-customization/agent-skills
- https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/
- https://github.blog/changelog/2026-10-28-route-and-orchestrate-models-with-github-copilot-fusion/
- https://github.com/microsoft/vscode/issues/265496 (ACP feature request, unresolved)

### Claude Code
- https://code.claude.com/docs/en/tools-reference
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/plugins/manifest-reference
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/slash-commands
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/output-styles
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/permission-modes
- https://code.claude.com/docs/en/sandboxing
- https://code.claude.com/docs/en/permissions
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/devcontainer
- https://code.claude.com/docs/en/checkpointing
- https://code.claude.com/docs/en/sessions
- https://code.claude.com/docs/en/interactive-mode
- https://code.claude.com/docs/en/model-config
- https://code.claude.com/docs/en/prompt-caching
- https://code.claude.com/docs/en/costs
- https://code.claude.com/docs/en/context-window
- https://code.claude.com/docs/en/headless
- https://code.claude.com/docs/en/agent-sdk/overview
- https://code.claude.com/docs/en/github-actions

### OpenAI Codex CLI
- https://developers.openai.com/codex/cli
- https://developers.openai.com/codex/local-config
- https://developers.openai.com/codex/web-search
- https://developers.openai.com/codex/hooks
- https://developers.openai.com/codex/skills-and-plugins
- https://developers.openai.com/codex/extend/mcp
- https://developers.openai.com/codex/noninteractive
- https://developers.openai.com/codex/agent-configuration/subagents
- https://developers.openai.com/codex/code-review
- https://developers.openai.com/codex/cloud
- https://developers.openai.com/codex/agent-approvals-security
- https://developers.openai.com/codex/sandboxing
- https://developers.openai.com/codex/models
- https://developers.openai.com/codex/github-action (also mirrored at learn.chatgpt.com/docs/github-action)
- https://github.com/openai/codex/blob/main/docs/agents_md.md
- https://github.com/openai/codex/blob/main/codex-rs/apply-patch/src/parser.rs
- https://github.com/openai/codex/blob/main/codex-rs/apply-patch/src/lib.rs
- https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/apply_patch.rs
- https://github.com/openai/codex/blob/main/codex-rs/core/tests/suite/apply_patch_cli.rs
- https://github.com/openai/codex/blob/main/sdk/typescript/README.md [moderate confidence, not independently re-fetched]
- Secondary (moderate confidence only): codex.danielvaughan.com, hammerautomation.ai — `/compact` and `update_plan` opt-in claims

### Cursor
- https://cursor.com/docs/agent/overview
- https://cursor.com/docs/agent/tools/search
- https://cursor.com/docs/agent/tools/browser
- https://cursor.com/docs/agent/security/run-modes
- https://cursor.com/docs/agent/plan-mode
- https://cursor.com/docs/agent/agent-review
- https://cursor.com/docs/agent/prompting
- https://cursor.com/docs/rules
- https://cursor.com/docs/hooks
- https://cursor.com/docs/skills
- https://cursor.com/docs/subagents
- https://cursor.com/docs/mcp
- https://cursor.com/docs/bugbot
- https://cursor.com/docs/cloud-agent
- https://cursor.com/docs/cli/overview
- https://cursor.com/docs/cli/headless
- https://cursor.com/docs/cli/acp
- https://cursor.com/docs/models-and-pricing
- https://cursor.com/docs/enterprise/privacy-and-data-governance
- https://cursor.com/changelog
- https://cursor.com/llms.txt
- https://cursor.com/docs/reference/third-party-hooks

### OpenCode
- https://opencode.ai/v2/docs/tools
- https://opencode.ai/v2/docs/plugins
- https://opencode.ai/v2/docs/mcp-servers
- https://opencode.ai/v2/docs/skills
- https://opencode.ai/v2/docs/agents
- https://opencode.ai/v2/docs/commands
- https://opencode.ai/v2/docs/instructions
- https://opencode.ai/v2/docs/snapshots
- https://opencode.ai/v2/docs/models
- https://opencode.ai/v2/docs/providers
- https://opencode.ai/v2/docs/permissions
- https://opencode.ai/v2/docs/cli
- https://opencode.ai/v2/docs/sdk/
- https://opencode.ai/v2/docs/github/
- https://opencode.ai/docs/lsp/ (V1 path; V2 continuity unverified)
- https://github.com/anomalyco/opencode/releases (v2.2.5 notes)
- https://github.com/anomalyco/opencode PR #60689/#60688

### pi (earendil-works/pi)
- https://github.com/earendil-works/pi — docs/settings.md, docs/compaction.md, docs/extensions.md, docs/mcp.md, docs/skills.md, docs/codemode.md, docs/configuration.md, docs/sessions.md, docs/providers.md, docs/models.md, docs/security.md, docs/cli-integration.md, docs/sdk.md
- pi.dev

### Gemini CLI
- https://github.com/google-gemini/gemini-cli — docs/tools/file-system.md, docs/reference/tools.md, docs/core/subagents.md, docs/tools/web-fetch.md, docs/tools/web-search.md, docs/extensions/index.md, docs/hooks/index.md, docs/tools/mcp-server.md, docs/cli/skills.md, docs/core/remote-agents.md, docs/cli/gemini-md.md, docs/cli/plan-mode.md, docs/cli/checkpointing.md, docs/cli/rewind.md, docs/get-started/authentication.mdx, docs/cli/model-routing.md, docs/reference/commands.md, docs/cli/token-caching.md, docs/cli/auto-memory.md, docs/cli/sandbox.md, docs/reference/policy-engine.md, docs/cli/headless.md, docs/cli/acp-mode.md, docs/issue-and-pr-automation.md
- geminicli.com/extensions/browse
- github.com/google-github-actions/run-gemini-cli

### Aider
- https://aider.chat/docs/more/edit-formats.html
- https://aider.chat/docs/troubleshooting/edit-errors.html
- https://aider.chat/docs/repomap.html
- https://aider.chat/docs/languages.html
- https://aider.chat/docs/usage/images-urls.html
- https://aider.chat/docs/install/optional.html
- https://aider.chat/docs/usage/modes.html
- https://aider.chat/docs/usage/conventions.html
- https://aider.chat/docs/config/aider_conf.html
- https://aider.chat/docs/git.html
- https://aider.chat/docs/llms.html
- https://aider.chat/docs/usage/caching.html
- https://aider.chat/docs/scripting.html
- https://github.com/Aider-AI/aider/issues/3314 (no native MCP, open FR)

### Cline / Roo Code
- https://github.com/cline/cline — apps/vscode/src/core/prompts/responses.ts
- cline.bot docs (CLI/SDK/Desktop/Teams references)
- https://github.com/RooCodeInc/Roo-Code — PR #11392 (browser tool removal); archived 2026-05-15

### Amp
- https://ampcode.com/docs/the-dial
- https://ampcode.com/docs/security
- (plugin/toolbox/skills/orbs documentation referenced per ampcode.com/docs)
- Third-party ACP bridge: `acp-amp` by Superagentic AI (not first-party)

### Factory Droid
- docs.factory.com (droid exec, Missions, Workstreams, Spec Mode, Droid Shield, Agent Readiness Model, Droid Action)
- github.com/Factory-AI/factory-plugins
- github.com/Factory-AI/droid-action

---

## 6. Open items for follow-up (flagged uncertain across this report)
- Exact wire-level edit/diff format for base Copilot CLI/VS Code/Cloud agent is undocumented publicly (only the cloud agent's docs give an example-only `str_replace` mention).
- Codex CLI's `/compact` and `update_plan`-opt-in status rely on secondary sources, not a first-party changelog — recommend direct verification against `developers.openai.com/changelog` if this becomes load-bearing for OMC design decisions.
- OpenCode's MCP server-mode and context-window/cost UI in the TUI were not confirmed either way.
- Cursor's "Memories" feature status (deprecated vs. merged into Rules) is ambiguous — the docs page redirects without a clear deprecation notice.
- Whether VS Code's model page omission of xAI/Grok (vs. CLI/Cloud agent explicitly listing it) reflects a real capability gap or just an incomplete page wasn't resolved.
- "GitHub Copilot SDK" is named in both CLI and Cloud agent docs but its API surface was not deep-dived in this pass.
