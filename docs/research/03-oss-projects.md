# 03 — OSS Projects for Agent Tooling Techniques (Thread 3 of 4)

*Research date: 2026-11-06. Star counts/activity pulled live via GitHub API on this date — treat as a snapshot, not stable. Some search-engine summaries could not be independently cross-checked against primary source files; those claims are marked **[unverified]**.*

> **Source-check updates:** the [synthesis](../landscape.md) independently rechecks six star
> counts and clarifies licensing. Serena's [LICENSE](https://github.com/oraios/serena/blob/main/LICENSE)
> specifies MIT for SolidLSP and GPL-3.0-or-later for the application; `NOASSERTION` in the
> original tables is GitHub detector metadata, not a license. The
> [ast-grep MCP README](https://github.com/ast-grep/ast-grep-mcp) calls the server experimental
> and describes structural search and analysis. Rewrite support and integration safety still
> require validation; the original "near-zero integration risk" recommendation is too strong.
> Go's `gopls` is the user's priority for native LSP presets, separate from Serena.

## 1. Edit tools: anchored/hashline edits, apply_patch, fuzzy matchers, fast-apply, edit-format benchmarks

| Project | URL | What it does | Mechanism | Lang | License | Stars/Activity | OMC relevance |
|---|---|---|---|---|---|---|---|
| OpenAI Codex `apply_patch` | https://github.com/openai/codex (apply-patch crate under `codex-rs/apply-patch`) | Canonical structured patch tool: `*** Begin Patch *** / Add File / Update File / Delete File *** End Patch`, context-matched hunks | Custom patch grammar, context-line matching before mutation, sandboxed apply | Rust | Apache-2.0 | 133,391★, pushed today (very active) | Directly comparable to OMC's hashline anchored edits — study context-matching/ambiguity-rejection logic |
| tokenring-ai/apply-patch | https://github.com/tokenring-ai/apply-patch | TypeScript port of OpenAI's apply_patch for JS/Node agent stacks | Same patch grammar ported from Rust | TypeScript | Apache-2.0 | 3★, pushed 2025-10-01 | Easiest-to-read reference impl since OMC/plugin ecosystem is likely Node-based |
| Aider-AI/aider edit formats | https://aider.chat/docs/more/edit-formats.html, source: https://github.com/Aider-AI/aider | Multiple interchangeable edit formats (`whole`, `diff` SEARCH/REPLACE, `diff-fenced`, `udiff`) selected per-model | Format chosen based on which models reliably emit it; applies via search/replace or whole-file write | Python | Apache-2.0 | 49,979★, pushed 2026-05-22 | Directly informs "per-model tool profiles" pending idea — Aider already picks edit format per model family |
| Aider-AI/aider leaderboard | https://aider.chat/docs/leaderboards/edit.html | Tracks both task-pass-rate AND "correct edit format" compliance per model | Automated Exercism-based eval harness scoring format conformance separately from correctness | Python | Apache-2.0 | (same repo) | Template for OMC's benchmark harness — separate "did it edit correctly" from "did it solve the task" |
| Diff-XYZ benchmark (JetBrains Research) | https://arxiv.org/abs/2510.12487, dataset: https://huggingface.co/datasets/JetBrains-Research/diff-xyz | Benchmarks LLMs on Apply / Anti-apply / Diff-generation using real commit triples | Supervised eval over ⟨old_code, new_code, diff⟩ triples from CommitPackFT | Python (eval scripts) | Unclear/research release | Published 2026 (arXiv) | Finding: search-replace format works best for large models, format choice matters less for small models — relevant to OMC hashline-edit vs diff-format decision |
| alexmelges/harnesskit | https://github.com/alexmelges/harnesskit | "Fuzzy edit tool for LLM coding agents — never fail a str_replace again" | Cascading match strategy: exact → whitespace-normalized → difflib similarity → line-fuzzy | Python | MIT | 1★ (very small/new) **[low confidence on maturity]** | Small reference for fuzzy str_replace fallback chains that OMC's hashline tool could adopt as a last-resort fallback |
| Morph Fast Apply | https://docs.morphllm.com, demos: https://github.com/morphllm/morph-demos | Hosted fast-apply model that merges an edit snippet (with `// ... existing code ...` markers) into a full file in one model call, ~10,500 tok/s, ~98% claimed accuracy | Specialized small model trained specifically for "apply this diff-like instruction to this file," not a diff algorithm | Hosted API + OSS SDK/demos | Demos repo license unknown | N/A (commercial API) | Represents an alternative architecture to deterministic hashline matching: offload "fuzzy apply" to a dedicated small model instead of string matching. Relevant to OMC's edit-tool robustness strategy, but introduces an external paid dependency — note as an option, not a drop-in OSS component |

**Gaps:** Could not find a maintained, widely-starred standalone OSS "hashline" (stable per-line anchor ID) implementation distinct from line-number or content-hash diffing — this appears to be a relatively novel/OMP-specific design; no close OSS analog found besides Codex's context-line matching and Aider's SEARCH/REPLACE blocks.

## 2. Structural code tools exposed to agents: ast-grep, Serena/LSP, code indexing MCPs, repo maps

| Project | URL | What it does | Mechanism | Lang | License | Stars/Activity | OMC relevance / Copilot-CLI usable? |
|---|---|---|---|---|---|---|---|
| ast-grep/ast-grep-mcp | https://github.com/ast-grep/ast-grep-mcp | Official MCP server exposing ast-grep's AST pattern search/lint/rewrite across ~20+ languages | Wraps `ast-grep` CLI; exposes `dump_syntax_tree`, rule-based scan/test, structural rewrite with explicit-apply gating | Python | MIT | 489★, pushed 2026-11-05 (very active) | Yes — standard MCP server, directly pluggable into Copilot CLI's `.github/copilot/mcp.json` or equivalent; best starting point for the "ast-grep structural editing" pending idea |
| thrawn01/mcp-ast-grep | https://github.com/thrawn01/mcp-ast-grep | Alternative/earlier MCP wrapper over ast-grep | Similar wrapping approach | Go (per search summary) **[unverified — not directly fetched]** | Unknown | Unknown | Secondary reference implementation; compare tool surface differences vs. the official one |
| GodSpeedAI/ast-grep-mcp-rs | https://github.com/GodSpeedAI/ast-grep-mcp-rs | Rust reimplementation of ast-grep MCP server | Native Rust binding to ast-grep core (no CLI shellout) | Rust | MIT | 1★, pushed 2026-03-13 | Low adoption but relevant if OMC wants a fast, dependency-free native binary rather than Python/Node |
| spiritledsoftware/ast-grep-mcp | https://github.com/spiritledsoftware/ast-grep-mcp | Node.js-based ast-grep MCP server | CLI wrapper | TypeScript | MIT | 1★, pushed 2026-08-17 | TypeScript reference, matches likely OMC plugin stack |
| oraios/serena | https://github.com/oraios/serena | "IDE for your agent": semantic, symbol-level code retrieval/editing via LSP, exposed as MCP server | Spins up language servers per project (30+ languages), exposes `find_symbol`, `find_referencing_symbols`, `replace_symbol_body`, `insert_before/after_symbol` etc. instead of raw line edits | Python | NOASSERTION (check repo LICENSE file; not simple MIT/Apache) | 31,138★, pushed 2026-10-28 (very active, most popular project in this category) | Most relevant OSS project for "LSP presets" and symbol-level structural editing pending ideas. MCP-based, so directly usable from Copilot CLI. License is NOASSERTION — needs legal check before any code reuse (not just usage) |
| zilliztech/claude-context | https://github.com/zilliztech/claude-context | MCP server for whole-codebase semantic code search ("make entire codebase the context") | AST-aware chunking (tree-sitter) + Merkle-tree incremental indexing + hybrid BM25/dense-vector search in Milvus/Zilliz Cloud; multi-provider embeddings (OpenAI/Voyage/Gemini/Ollama) | TypeScript | MIT | 12,673★, pushed 2026-07-14 | Directly matches OMC's "code indexing/semantic search MCP" need; requires external vector DB (Milvus/Zilliz) and embedding API key — adds infra dependency. Usable today as an MCP server for Copilot CLI |
| Aider-AI/aider repo map | https://github.com/Aider-AI/aider/blob/main/aider/repomap.py ; docs: https://aider.chat/docs/repomap.html | Builds a compact, token-budgeted map of the repo (top-level classes/functions/signatures per file) sent to the LLM for context | Tree-sitter symbol extraction → build symbol graph → personalized PageRank to rank importance (weighted toward currently-open/mentioned files) → binary-search to fit a token budget (default 1024 tokens) | Python | Apache-2.0 | 49,979★ (same repo as edit formats) | Best OSS reference for a lightweight, embedding-free "repo map" feature — cheaper and simpler than a vector-DB semantic search MCP; could be ported as a pure prompt-context generator without needing MCP server infra |
| mickeyinfoshan/lsp-mcp | https://github.com/mickeyinfoshan/lsp-mcp | Generic MCP↔LSP bridge; connects any MCP client to any LSP server (Go/TS/JS/Python out of box, extensible) | Translates MCP tool calls into LSP JSON-RPC, manages LSP server subprocesses, YAML config per language/root | Unverified (search summary only) **[unverified]** | Unknown | Unknown | Candidate for OMC's "LSP presets" pending idea — generic bridge rather than full semantic-editing layer like Serena |
| ProfessioneIT/lsp-mcp-server | https://github.com/ProfessioneIT/lsp-mcp-server | Similar LSP↔MCP bridge aimed at Codex/Claude Code clients | JSON config mapping | Unverified | Unknown | Unknown | Alternative to Serena if OMC wants only navigation (go-to-def/find-refs/hover) without Serena's heavier symbol-editing abstraction |
| nzrsky/lsp-bridge | https://github.com/nzrsky/lsp-bridge | High-performance LSP↔MCP bridge in Zig; targets Zig/Rust/Go/TS/Python | Native bridge, performance-focused | Zig | Unverified | Unknown | Niche; only relevant if performance of the bridge itself becomes a bottleneck |

**Note on verification:** I directly fetched GitHub API metadata (stars/license/activity) for `ast-grep/ast-grep-mcp`, `oraios/serena`, `zilliztech/claude-context`, `GodSpeedAI/ast-grep-mcp-rs`, and `spiritledsoftware/ast-grep-mcp`. The lsp-mcp bridge projects (`mickeyinfoshan/lsp-mcp`, `ProfessioneIT/lsp-mcp-server`, `nzrsky/lsp-bridge`) come from a single AI-generated web search summary and were **not independently verified** against the GitHub API or primary source — recommend the main agent re-verify star counts/license/activity before citing these as authoritative.

## 3. Debugger/REPL tools for agents (DAP, Jupyter/eval MCPs)

| Project | URL | What it does | Mechanism | Lang | License | Stars/Activity | OMC relevance |
|---|---|---|---|---|---|---|---|
| debugmcp/mcp-debugger | https://github.com/debugmcp/mcp-debugger | "Headless, agentic debugger over MCP" — agents can set breakpoints, step, inspect variables in live programs across 7 languages | MCP server wraps a DAP proxy layer that spawns/manages debug adapters and translates MCP tool calls to DAP requests | TypeScript | MIT | 186★, pushed 2026-11-06 (very active, most current of the DAP options) | Strongest direct match for the "DAP debugger" pending idea; MCP-native, usable from Copilot CLI immediately |
| go-delve/mcp-dap-server | https://github.com/go-delve/mcp-dap-server | MCP server to communicate with DAP servers, letting AI agents debug live programs | Similar DAP-proxy-over-MCP pattern, from the official Delve (Go debugger) org | Go | MIT | 106★, pushed 2026-11-03 (active) | Backed by the Delve team — credible for Go debugging specifically; good complement if OMC needs strong Go support |
| KashunCheng/dap_mcp | https://github.com/KashunCheng/dap_mcp | Early/independent MCP server wrapping a debugger via DAP | DAP bridge | Python | AGPL-3.0 | 40★, pushed 2025-09-24 (stale relative to the other two) | AGPL-3.0 license is a blocker for direct code reuse in a possibly-permissive-licensed OMC; use only as a design reference, not as a dependency |
| microsoft/debug-adapter-protocol (spec) | https://microsoft.github.io/debug-adapter-protocol/ | The DAP specification itself | JSON-RPC-style protocol spec, not a library | N/A | N/A | N/A | Primary spec any DAP MCP bridge must implement against; useful for evaluating correctness/completeness of the above three servers |
| LLDB + MCP | https://lldb.llvm.org/use/mcp.html | LLVM's own LLDB debugger ships first-party MCP support | Native LLDB MCP integration (not a 3rd-party bridge) | C++ | Apache-2.0 (LLVM) | N/A (part of LLVM) | Worth noting as a precedent that major debugger projects are adding first-class MCP support, validating the DAP-MCP investment |

**Gap:** No widely-used Jupyter/eval-kernel-as-MCP project surfaced distinctly in this pass beyond generic "code execution sandbox" MCP servers (e.g., e2b.dev-style sandboxes), which were out of scope for this specific search round; flagging as a follow-up search for the main agent if "eval kernels" pending idea needs deeper coverage.

## 4. Rules/guardrails engines, hooks, rule-format converters

| Project | URL | What it does | Mechanism | Lang | License | Stars/Activity | OMC relevance |
|---|---|---|---|---|---|---|---|
| GowayLee/cchooks | https://github.com/GowayLee/cchooks | Python SDK for writing Claude Code hooks (PreToolUse, PostToolUse, SessionStart/End, etc.) without manual JSON parsing | `create_context()` returns typed context objects; hooks call `exit_success()`/`exit_deny(reason)` | Python | MIT | 131★, pushed 2026-04-08 | Directly maps to OMC's "pre/post tool rules" feature — a clean reference for ergonomic hook-SDK design (typed context, simple allow/deny API) |
| dyoshikawa/rulesync | https://github.com/dyoshikawa/rulesync | Single canonical rules file → generates AGENTS.md, CLAUDE.md, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md`, GEMINI.md, `.windsurfrules`, etc. | CLI with `init`/`sync`/`status`/`adopt`/`add <tool>` commands; markdown-based canonical source | TypeScript | MIT | 1,585★, pushed 2026-11-06 (very active) | Directly competes with/validates OMC's "rule imports (Cursor/Cline/Windsurf)" feature — but rulesync does bidirectional *sync* (canonical → N targets) rather than one-way import; worth comparing architecture choices |
| intellectronica/ruler | https://github.com/intellectronica/ruler | "Apply the same rules to all coding agents" — similar sync tool to rulesync | Canonical rules dir → generates tool-specific config files for many agents | TypeScript | MIT | 2,961★, pushed 2026-11-04 (very active, more stars than rulesync) | Most-starred option in this space; worth comparing its supported-tool list and config schema against rulesync and OMC's own importer before committing to OMC's design |
| mkreyman/mcp-memory-keeper | https://github.com/mkreyman/mcp-memory-keeper | MCP server for persistent context management in AI coding assistants (adjacent to rules/guardrails via context injection) | Stores/retrieves structured context across sessions via MCP | TypeScript | MIT | 136★, pushed 2026-09-03 | Lower relevance to rules specifically, more relevant to category 6 (memory) — cross-listed here because it's sometimes used to implement guardrail-like "remember this constraint" behavior |

**Gap/uncertainty:** I did not find a clearly-documented OSS project implementing "streaming interrupt" or "time-traveling" rule systems analogous to what OMC/OMP describe (i.e., rules that can retroactively interrupt an in-flight streamed response rather than just gate before/after a tool call). This appears to be a relatively novel architecture in OMP/OMC; closest analogs are Claude Code's own hook system (PreToolUse can block before execution, but nothing found that interrupts mid-stream token generation at the OSS tooling layer). **Recommend the main agent flag this as a potential genuine OMC/OMP differentiator rather than something to "reuse" from elsewhere.**

## 5. Advisor / second-opinion / multi-model patterns

| Project | URL | What it does | Mechanism | Lang | License | Stars/Activity | OMC relevance |
|---|---|---|---|---|---|---|---|
| BeehiveInnovations/zen-mcp-server | https://github.com/BeehiveInnovations/zen-mcp-server | Lets Claude Code / Gemini CLI / Codex CLI orchestrate consults with Gemini, O3, Grok, OpenRouter, Ollama, Azure, custom models — "working as one" | MCP server with specialized workflow tools (code review, debug, planning, pre-commit, security audit) that route sub-tasks to whichever configured model is best suited; maintains cross-model conversation continuity | Python | NOASSERTION (check license before reuse) | 11,824★, pushed 2025-12-15 (star count high but no commits in ~11 months — momentum may have stalled) | **Closest direct OSS match to OMC's "advisor (second model reviewing each turn)" pending idea.** Its "expert mode routing" and multi-model aggregation pattern is exactly the architecture to study; the NOASSERTION license and apparent recent inactivity (last push Dec 2025) are both worth flagging |

**Gap:** Did not find an academic paper or OSS project specifically named "PAL" matching the described consult-another-model pattern in this search pass — the query returned mostly tangential or irrelevant results. **[unverified / gap]** Recommend a targeted follow-up search for "PAL: Program-aided language models" (a different, unrelated concept from NLP literature) to rule out confusion, and a direct GitHub code search for `"second opinion" "another model"` across MCP server repos if the main agent wants more candidates.

## 6. Context and memory tools (compaction, memory banks)

| Project | URL | What it does | Mechanism | Lang | License | Stars/Activity | OMC relevance |
|---|---|---|---|---|---|---|---|
| thedotmack/claude-mem | https://github.com/thedotmack/claude-mem | Persistent memory across Claude Code (and Codex/Gemini/Copilot/OpenCode) sessions; captures session activity, AI-summarizes it, re-injects into future sessions | Hooks into session-end/compaction events, generates structured summaries (goals, decisions+reasoning, file/deployment state, blockers, corrections, preferences), stores and re-surfaces them automatically | TypeScript | Apache-2.0 | **113,661★** (anomalously high — flagged below), pushed 2026-11-06 (very active) | Directly relevant to context/memory needs even though not explicitly in OMC's pending-ideas list; could inform a future "session continuity" feature |
| basicmachines-co/basic-memory | https://github.com/basicmachines-co/basic-memory | "AI conversations that actually remember" — MCP-based persistent memory store using plain Markdown notes with semantic search/relations | MCP server exposing create/search/read note tools; supports local or hosted-cloud mode (`claude mcp add -s user -t http basic-memory-cloud ...`) | Python | AGPL-3.0 | 4,503★, pushed 2026-11-06 (very active) | AGPL-3.0 — same licensing caution as `dap_mcp`; usable as an external MCP tool (not code reuse) without triggering copyleft obligations on OMC itself |
| edo-ceder/session-memory | https://github.com/edo-ceder/session-memory | Claude Code plugin specifically targeting "session drift" — captures decisions/state/corrections around compaction events, refreshable manually | Hooks around the compaction lifecycle | Shell | MIT | 0★ (essentially unadopted) | Low-confidence/unproven, but conceptually matches OMC's interest in compaction-adjacent behavior; worth reading source for the compaction-hook pattern even with near-zero adoption |
| mkreyman/mcp-memory-keeper | https://github.com/mkreyman/mcp-memory-keeper | MCP server for persistent context management in AI coding assistants | Structured context storage/retrieval via MCP | TypeScript | MIT | 136★, pushed 2026-09-03 | Mid-tier adoption alternative to basic-memory without the AGPL license |

**⚠️ Data-quality flag:** `thedotmack/claude-mem` returned **113,661 stars** from the GitHub API — this is implausibly high for a niche plugin (more stars than `sst/opencode` at 224k is at least directionally consistent for a mega-project, but claude-mem having more stars than `cline/cline` at 71k or `Aider-AI/aider` at 49k, projects with vastly larger install bases and multi-year histories, is suspicious). **Treat this star count as unverified/possibly a GitHub API caching anomaly or a mismatched repo identity; recommend the main agent re-check this number directly on github.com/thedotmack/claude-mem before citing it in any external-facing material.**

## 7. Agent benchmarking harnesses (comparing harnesses/plugins on the same model)

| Project | URL | What it does | Mechanism | Lang | License | Stars/Activity | OMC relevance |
|---|---|---|---|---|---|---|---|
| harbor-framework/harbor | https://github.com/harbor-framework/harbor | Official evaluation harness for Terminal-Bench 2.0; framework for evaluating and improving agents | `harbor run --dataset terminal-bench@2.0 --agent <agent> --model <model>` — holds model constant while swapping agent/tool-config to isolate harness effects; supports parallel eval via Modal/Daytona providers | Python | Apache-2.0 | 6,835★, pushed 2026-11-06 (very active) | **Most directly relevant harness-comparison project** — exactly the "stock vs plugin across models" comparison pattern OMC's benchmark harness already does, but at much larger scale/infra. Study its agent-abstraction interface and result/error-taxonomy reporting |
| Terminal-Bench 2.0 | https://www.tbench.ai/news/announcement-2-0 | The benchmark dataset/suite Harbor runs against — realistic CLI tasks in Docker containers | Task suite + reference evaluation protocol | N/A (task definitions) | Unclear | Actively maintained (2.0 announced) | Could be a candidate task-suite for OMC's own benchmark harness rather than building bespoke tasks from scratch |
| princeton-nlp/SWE-bench | https://github.com/princeton-nlp/SWE-bench | "Can Language Models Resolve Real-world GitHub Issues?" — benchmark harness evaluating patch-resolution against real repo issues/PRs | Harness clones target repos at a commit, applies model-generated patch, runs the repo's own test suite to check pass/fail | Python | MIT | 6,150★, pushed 2026-09-18 (active) | The most established, widely-cited harness in this space; many derivative "mini-SWE-bench" / "SWE-bench verified" variants compare harnesses/scaffolds on identical models — good prior art for methodology (holdout test suites, patch application correctness, avoiding leakage) even though it's not plugin-comparison specific |
| Published commentary: "The Harness Effect" | https://codex.danielvaughan.com/2026/04/19/the-harness-effect-same-model-different-tool-different-score/ | Blog analysis showing the same base model scoring up to 13–16 points differently across agent harnesses on Terminal-Bench | Comparative analysis across public leaderboard runs | N/A (article) | N/A | Published 2026-04-19 | Directly validates OMC's benchmarking premise (stock vs. plugin matters) — good citation for OMC's own README/benchmark docs to justify why the comparison harness exists |

## 8. Per-model tool/prompt tuning

| Project | URL | What it does | Mechanism | Lang | License | Stars/Activity | OMC relevance |
|---|---|---|---|---|---|---|---|
| sst/opencode | https://github.com/sst/opencode | The open-source coding agent itself; internally selects different static system-prompt text per provider/model family | Discrete prompt asset files per model family (e.g., anthropic-flavored vs. default vs. "beast"-style prompts for reasoning-heavy models), chosen at runtime based on configured provider/model | TypeScript | MIT | 224,861★, pushed 2026-11-06 (extremely active, among the largest OSS coding agents) | **Primary reference for OMC's "per-model tool profiles" pending idea** — proves the pattern at large scale and is itself a strong adoption signal |
| optix2000/opencode-provider-system-prompts | https://github.com/optix2000/opencode-provider-system-prompts | Third-party OpenCode plugin letting users override/replace system prompts per-provider/per-model via YAML-frontmatter-matched markdown rule files with regex model matching | Plugin hooks into OpenCode's prompt-construction pipeline | TypeScript | None declared (no LICENSE file found) | 0★ (brand new / low adoption) **[low confidence]** | Smaller, more hackable example of exactly the mechanism OMC wants (regex/model-family matched prompt override files) — good as a design reference despite low stars, precisely because it's simpler to read than OpenCode core |
| capyBearista/opencode-plugins (`opencode-agent-prompt-inheritance`) | https://github.com/capyBearista/opencode-plugins | Maintains a library of vendored provider prompt assets (anthropic.txt, codex.txt, gemini.txt, beast.txt, default.txt) with routing logic, auto-synced from upstream OpenCode via GitHub Action | `provider-prompt.ts` module selects asset file based on detected model/provider; CI job re-syncs vendored prompts when OpenCode upstream changes | TypeScript | MPL-2.0 | 8★, pushed 2026-11-02 (active) | Interesting pattern for OMC to copy: automated CI sync of "known good" per-model prompt text from an upstream source-of-truth, rather than manually hand-maintaining it — directly useful operational idea regardless of star count |
| cline/cline + cline/prompts | https://github.com/cline/cline ; https://github.com/cline/prompts | Autonomous coding agent (VS Code/JetBrains/CLI) with a companion community prompts/workflows library (`.clinerules/`, `workflows/`) | XML-tag-based tool invocation format in prompts; Plan/Act mode split; community-contributed `.clinerules` markdown files define domain-specific behavior overrides | TypeScript | Apache-2.0 | 71,380★ (cline/cline), pushed 2026-11-06 (very active) | Less "per-model" specific than OpenCode but a strong reference for (a) XML tool-call prompt conventions and (b) a community rules-library pattern OMC's rule-import feature could emulate for a Copilot-CLI-native rules marketplace |
| x1xhlol/system-prompts-and-models-of-ai-tools | https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools | Leaked/collected full system prompts and internal tool definitions from Cursor, Claude Code, Devin, Replit, Windsurf, v0, Manus, and ~20 other commercial agent products | Raw prompt-text archive, not a library | N/A (text archive) | GPL-3.0 | 144,509★, pushed 2026-10-12 (very active) | Extremely high-value raw material for studying how *commercial* products structure per-model/per-tool system prompts — useful comparative reading for OMC's prompt design even though it's not reusable code. GPL-3.0 license means copying prompt text verbatim into OMC could have licensing implications if OMC ships under a different license — treat as reference-only, not copy-paste source |

---

## Top 10 Projects to Study or Integrate (Ranked)

1. **ast-grep/ast-grep-mcp** (https://github.com/ast-grep/ast-grep-mcp) — MIT, 489★, actively maintained, official MCP server directly satisfying the "ast-grep structural editing" pending idea with near-zero integration risk (standard MCP server, drop into Copilot CLI's MCP config).
2. **harbor-framework/harbor** + **Terminal-Bench 2.0** (https://github.com/harbor-framework/harbor) — Apache-2.0, 6,835★, purpose-built for exactly OMC's "compare stock vs. plugin across models" benchmarking need; adopting its agent/model/task abstraction could save significant harness-engineering effort and buys credibility via a recognized public benchmark.
3. **oraios/serena** (https://github.com/oraios/serena) — 31,138★, the most mature LSP-based semantic editing MCP available; highest-value reference for both "LSP presets" and symbol-level editing beyond line-anchored hashline edits, but check the NOASSERTION license carefully before any code reuse (usage as an external MCP tool is lower-risk than vendoring code).
4. **debugmcp/mcp-debugger** (https://github.com/debugmcp/mcp-debugger) — MIT, pushed same day as this research, 7-language DAP-over-MCP debugger; best-positioned existing OSS project to either adopt directly or use as the architectural template for OMC's own DAP debugger feature.
5. **GowayLee/cchooks** (https://github.com/GowayLee/cchooks) — MIT, small and simple (131★), the cleanest example of a typed hook SDK for pre/post tool rules; directly informs ergonomic API design for OMC's own rules engine even if not reused as a dependency (OMC likely isn't Python).
6. **sst/opencode** (https://github.com/sst/opencode) — MIT, 224,861★, the largest-scale proof that per-model prompt/tool profiles work in production; study its prompt-asset-per-provider architecture as the primary template for OMC's "per-model tool profiles" pending idea.
7. **intellectronica/ruler** (https://github.com/intellectronica/ruler) and **dyoshikawa/rulesync** (https://github.com/dyoshikawa/rulesync) — both MIT, 2,961★ / 1,585★ respectively, both actively maintained; study both before finalizing OMC's Cursor/Cline/Windsurf rule-import design since they've already solved the N-tool rule-format fanout problem (note: these are canonical→N *sync* tools, while OMC's feature is more of an N→1 *import*; the schemas they use for each target format are still directly useful).
8. **BeehiveInnovations/zen-mcp-server** (https://github.com/BeehiveInnovations/zen-mcp-server) — 11,824★, the closest existing OSS match for OMC's "advisor" pending idea (multi-model consult/second-opinion with context continuity); caveat that it appears to have had no commits since Dec 2025 and uses a NOASSERTION license — treat as a design reference more than a dependency.
9. **zilliztech/claude-context** (https://github.com/zilliztech/claude-context) — MIT, 12,673★, production-grade semantic code search MCP; relevant if OMC wants a heavier semantic-search feature beyond Aider-style repo maps, at the cost of requiring a vector DB + embedding API key as external infra.
10. **Aider-AI/aider** repo map + edit-formats (https://github.com/Aider-AI/aider) — Apache-2.0, 49,979★, the single richest reference project in this entire report: its tree-sitter+PageRank repo-map is a low-infra alternative to vector-DB semantic search, its per-model edit-format selection directly parallels OMC's per-model tool-profile idea, and its public leaderboard (https://aider.chat/docs/leaderboards/edit.html) is a ready-made template for reporting OMC's own benchmark results.

---

## Sources

- https://github.com/ast-grep/ast-grep-mcp
- https://github.com/thrawn01/mcp-ast-grep
- https://github.com/GodSpeedAI/ast-grep-mcp-rs
- https://github.com/spiritledsoftware/ast-grep-mcp (via https://lobehub.com/mcp/spiritledsoftware-ast-grep-mcp)
- https://github.com/isco0819/ast-grep-mcp
- https://github.com/oraios/serena
- https://oraios.github.io/serena/
- https://github.com/zilliztech/claude-context
- https://www.npmjs.com/package/@zilliz/claude-context-mcp
- https://github.com/mickeyinfoshan/lsp-mcp
- https://github.com/ProfessioneIT/lsp-mcp-server
- https://github.com/nzrsky/lsp-bridge
- https://github.com/openai/codex (apply-patch system)
- https://deepwiki.com/openai/codex/5.4-apply-patch-system
- https://github.com/tokenring-ai/apply-patch
- https://pypi.org/project/codex-apply-patch/
- https://github.com/Aider-AI/aider
- https://aider.chat/docs/more/edit-formats.html
- https://aider.chat/docs/leaderboards/edit.html
- https://aider.chat/docs/repomap.html
- https://github.com/Aider-AI/aider/blob/main/aider/repomap.py
- https://arxiv.org/abs/2510.12487 (Diff-XYZ)
- https://huggingface.co/datasets/JetBrains-Research/diff-xyz
- https://github.com/alexmelges/harnesskit
- https://docs.morphllm.com/docs/quickstart-fast-apply
- https://github.com/morphllm/morph-demos
- https://github.com/debugmcp/mcp-debugger
- https://github.com/go-delve/mcp-dap-server
- https://github.com/KashunCheng/dap_mcp
- https://microsoft.github.io/debug-adapter-protocol/
- https://lldb.llvm.org/use/mcp.html
- https://github.com/GowayLee/cchooks
- https://pypi.org/project/cchooks/
- https://github.com/dyoshikawa/rulesync
- https://github.com/intellectronica/ruler
- https://github.com/mkreyman/mcp-memory-keeper
- https://github.com/BeehiveInnovations/zen-mcp-server
- https://claudelog.com/claude-code-mcps/zen-mcp-server/
- https://github.com/thedotmack/claude-mem
- https://docs.claude-mem.ai/introduction
- https://github.com/edo-ceder/session-memory
- https://github.com/basicmachines-co/basic-memory
- https://docs.basicmemory.com/integrations/claude-code/
- https://github.com/harbor-framework/harbor
- https://www.tbench.ai/news/announcement-2-0
- https://arxiv.org/html/2601.11868v1 (Terminal-Bench paper)
- https://github.com/princeton-nlp/SWE-bench
- https://codex.danielvaughan.com/2026/04/19/the-harness-effect-same-model-different-tool-different-score/
- https://kimchi.dev/blog/same-model-different-harness-terminal-bench
- https://github.com/sst/opencode
- https://github.com/optix2000/opencode-provider-system-prompts
- https://github.com/capyBearista/opencode-plugins
- https://deepwiki.com/capyBearista/opencode-plugins/6.2-provider-prompt-assets-and-sync-workflow
- https://github.com/cline/cline
- https://github.com/cline/prompts
- https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools
