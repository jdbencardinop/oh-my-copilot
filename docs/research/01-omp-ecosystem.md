# Research Thread 1 of 4: oh-my-pi (OMP) and the "oh-my-*" / Harness-Enhancement Ecosystem

Scope: OMP itself, its parent harness pi/pi-mono, and comparable enhancement layers across other
agent harnesses (Claude Code, OpenCode, Codex, Copilot CLI, Cursor). Research date: 2026-11-06.
All figures (stars, forks, dates) pulled live from the GitHub REST API on that date unless noted;
treat star counts as a snapshot, not a stable ranking.

---

## 1. Summary

**oh-my-pi (OMP)** (`github.com/can1357/oh-my-pi`, site `omp.sh`) is a Rust/TypeScript fork of
Mario Zechner's minimal **Pi** harness, built by **Stencil Labs** (lead: Can Bölük, `can1357`).
It re-adds (and goes well beyond) almost everything OMC has/wants: hash-anchored "Hashline"
editing, LSP-wired writes, a real DAP debugger, persistent Python/JS "eval" kernels, an
advisor/reviewer model watching every turn, "time-traveling stream rules" (TTSR) that abort and
retry a generation mid-token, ast-grep structural edits with preview/accept, URL-scheme reads
(`pr://`, `issue://`, `agent://`, `skill://`, `conflict://`, `xd://`), rule-import from Cursor/
Cline/Windsurf/Copilot/Codex config formats, atomic commit-splitting, and a `/review` reviewer
subagent. It publishes its own edit-format benchmark ("hashline vs. patch vs. str_replace vs.
whole-file") showing double-digit pass-rate gains across 16 models, and that methodology is
already being independently re-implemented in at least two other projects (gptme, PI-Desktop) —
real evidence the hashline idea generalizes beyond OMP's own marketing.

OMP sits inside a much bigger 2025–2026 trend: "oh-my-*" and similar branded layers that bolt
subagent orchestration, curated tool sets, and multi-harness portability onto minimal agent
cores (Pi, OpenCode, Claude Code, Codex CLI). The most structurally relevant sibling project for
OMC is **wshobson/agents**, which explicitly targets GitHub Copilot and Pi as adapter outputs
alongside Claude Code/Codex/Cursor/OpenCode — i.e., someone is already doing "write once, adapt
to many harnesses including Copilot" at scale (202 agents / 185 skills / 105 commands, 42k+
stars). ast-grep itself (16k★, MIT, Rust) is the underlying structural-search/rewrite engine
that OMP's `ast_edit`/`ast_grep` tools and OMC's planned ast-grep feature would both depend on.

**Biggest uncertainty flag:** several of the numbers below (OMP's 37,980★ created in Dec 2025;
pi's rename to `earendil-works/pi` with 120k★; Yeachan-Heo/oh-my-claudecode and oh-my-codex each
created in Jan/Feb 2026 and already at 30–40k★; a16z/Stencil blog post dated 2026-02-12) describe
extremely rapid, very recent growth curves that are unusual relative to typical OSS adoption
rates. These were pulled directly from the live GitHub API and the public web/blog in this
session, but given the compressed timeframe implied, treat absolute star counts and the pace of
adoption as indicative of "hot, actively discussed project" rather than as audited, stable
metrics — re-verify immediately before citing externally or in any report with a longer shelf
life.

---

## 2. oh-my-pi (OMP) — deep dive

- **Repo:** `can1357/oh-my-pi` — https://github.com/can1357/oh-my-pi
- **Site:** https://omp.sh · **npm:** `@oh-my-pi/pi-coding-agent`
- **Org:** Stencil Labs (https://stencil.so)
- **License:** MIT
- **Stats (2026-11-06):** 37,980★ / 4,283 forks / 4,633 open issues / 94 watchers. `created_at`
  2025-12-31, `pushed_at` 2026-11-06 (i.e., committed to same day as this research) — very high
  commit velocity.
- **Stack:** TypeScript shell + ~80,000 lines of Rust core across six native crates
  (`pi-natives`, `pi-shell`, `pi-ast`, `pi-iso`, `pi-voice`, `pi-walker`), compiled to a
  platform-tagged N-API addon for linux-x64/arm64, darwin-x64/arm64, win32-x64/arm64.
- **Discord:** https://discord.gg/4NMW9cdXZa (badge on README, not independently verified for
  member count).
- **Contribution policy:** README notes PRs were "temporarily open to everyone" after previously
  requiring a vouch — evidence of a maturing-but-still-gatekept OSS governance model.

### 2.1 Feature-by-feature (with implementation mechanism, from the README)

| # | Feature | Mechanism as described by OMP |
|---|---|---|
| 1 | Hashline edit | `edit` tool takes content-hash anchors (`[path#TAG]` file-level tag + per-line fingerprints); stale anchors reject the patch before corruption. Same idea OMC already ships as `read_anchored`/`edit_anchored`. |
| 2 | LSP wired into every write | Renames go through `workspace/willRenameFiles` so re-exports/barrel files/aliases update correctly; 14 LSP ops exposed via an `lsp` tool. Docs: `docs/lsp-config.md`. |
| 3 | Real debugger | `debug` tool drives a DAP session (28 DAP ops): lldb-dap for C/C++, dlv for Go, debugpy for Python — breakpoints, stepping, frame/variable inspection. |
| 4 | Time-traveling stream rules (TTSR) | Regex match against the live token stream aborts generation mid-token, injects the matched rule as a system reminder, and retries from the same point; injections survive context compaction. This is the generalization of OMC's existing "streaming TTSR interrupt rules" feature. |
| 5 | First-class subagents | `task` tool fans out isolated-worktree subagents with schema-validated return objects (no prose parsing); "Agent Hub" UI lets you watch/steer/kill individual subagents live. |
| 6 | Advisor (second model watching every turn) | A separate model/role (`advisor`) observes every agent turn on its own context, injecting inline notes (aside / concern / hard blocker) the main agent must react to or justify ignoring. Configurable per role (`modelRoles.advisor`). |
| 7 | Collab / session sharing | `/collab` relays a live session over a link + QR; client-side-sealed frames; `/collab view` for read-only spectators. |
| 8 | web_search → read pipeline | `web_search` chains up to ~23 ranked providers (Perplexity, Exa, Tavily, Brave, Jina, Kagi, SearXNG, DuckDuckGo, etc.) and hands result URLs straight to the same `read` tool used for local files, producing structured markdown with anchors intact (arXiv PDFs, GH pages, SO threads). Specialized per-site handlers for code hosts, package registries, arXiv/Semantic Scholar, forums, docs sites, and security DBs (NVD/OSV/CISA KEV). |
| 9 | Native, no-fork-exec tooling | ripgrep/glob/find linked in-process; a custom embedded bash 5.3 engine with 58 ported coreutils (sed/sort/xargs/jq/etc.) run with zero fork/exec — explicit contrast with harnesses that shell out to `rg`/`grep`/`bash`. |
| 10 | `/review` reviewer subagents | Dedicated reviewer subagents sweep branches/commits/uncommitted diffs in parallel, producing P0–P3-ranked, confidence-scored verdicts. `/annotate code-review` lets a human pre-pin notes to lines before reviewers run. Conceptually matches OMC's existing reviewer agent. |
| 11 | Hashline (restated) | "Model points at anchors instead of retyping lines… reject the patch before it corrupts anything." Headline claim: Grok 4 Fast spends 61% fewer output tokens. |
| 12 | GitHub-as-filesystem | No separate `gh_issue_view`/`gh_pr_view` tools — `read pr://1428` returns the same shape as `read src/foo.ts`. |
| 13 | Curated memory | `retain`/`recall`/`reflect`/`memory_edit`/`learn`/`manage_skill` tools; pluggable backend (`memory.backend`: local, Hindsight, Mnemopi), project-scoped by default. |
| 14 | ACP (editor-drivable agent) | Runs inside Zed via the editor's own save path/terminal/permission-prompt plumbing — no separate plugin/bridge. |
| 15 | Rule-format import | Reads eight external config formats *in their native shape* — Cursor `.mdc`, Cline `.clinerules`, Codex `AGENTS.md`, Copilot `applyTo`, and others — no migration/conversion step. Directly comparable to OMC's "opt-in Cursor/Cline/Windsurf rule imports," but OMP claims broader native-format coverage (8 formats) without any conversion script. |
| 16 | `omp commit` | Reads working tree via `git_overview`/`git_file_diff`/`git_hunk`, splits unrelated changes into atomic, dependency-ordered commits; rejects commit-graph cycles before writing; scores source > tests > docs/config; excludes lockfiles. Directly comparable to OMC's commit-splitting skill. |
| 17 | 16 internal URL schemes | `pr://`, `issue://`, `agent://`, `skill://`, `ssh://`, etc. resolve inside every FS-shaped tool; `grep` can walk a diff like a directory; `agent://<id>/findings.0.path` extracts a field from a subagent's structured output by path. |
| 18 | Conflict resolution via URLs | Each merge conflict becomes `conflict://N`; writing `@theirs`/`@ours`/`@base` resolves it; `conflict://*` does bulk resolution. Directly comparable to OMC's `list_conflicts`/`resolve_conflicts`. |
| 19 | ast_edit preview/accept | `ast_edit` (ast-grep-backed) stages a replacement count as a "(proposed)" card; writing a one-line reason to `xd://resolve` turns it into an atomic, all-or-nothing Accept. |
| 20 | Browser automation | `eval`'s `browser.open(...)` returns a Puppeteer tab handle over headless Chromium or a CDP-attached app; stealth on by default; a relay mode can "adopt" an already-open Chrome tab without stealing focus. |
| 21 | Desktop control | `eval`'s `computer.window(...)`/`win.screenshot()`/`win.ax()`/`el.press()`/`computer.run(...)` enumerate windows/displays, screenshot, send native input, walk the OS accessibility tree, use the clipboard — no browser DOM exposed. |

### 2.2 Tool surface (from README "Whatever the task needs")

Full list of first-class tools: `read`, `write`, `edit` (hashline), `ast_edit`, `ast_grep`, `grep`,
`glob`, `bash` (+46 in-process coreutils, PTY, background jobs), `eval` (persistent Python+JS
cells, shared prelude, tool re-entry), `lsp`, `debug` (DAP), `security_scan` (drives "Codex
Security" cloud scans), `task`, `wait`, `todo`, `ask`, `browser`, `computer`, `web_search`,
`github`, `generate_image`, `tts`, `checkpoint`, `rewind`, `retain`, `recall`, `reflect`,
`memory_edit`, `learn`, `manage_skill`. Several (`github`, `security_scan`, `generate_image`,
`tts`, `checkpoint`, `rewind`, memory tools) are setting-gated / off by default. Rarely-used tools
live behind `xd://` device URIs (`read xd://` lists them).

### 2.3 Prompt/session controls
Magic keywords (`ultrathink`, `chillax`, `orchestrate`, `workflowz`) trigger prose-only behavior
shifts (only outside code spans/fenced blocks/paths). Slash commands `/vibe` (director mode
driving persistent fast/good workers with read-only tools) and `/fresh` (reset provider stream
state without touching transcript).

### 2.4 Provider/model routing
60+ providers across frontier APIs (Anthropic, OpenAI/Codex, Gemini/Vertex/Antigravity, xAI,
DeepSeek, Mistral, Groq, Cerebras, Bedrock, Azure OpenAI, OpenRouter, etc.), "coding plan"
subscription routing (Cursor, GitHub Copilot, GitLab Duo, Devin, Kimi, MiniMax, Z.AI/GLM, Qwen,
etc. via OAuth or plan tokens), and local/self-hosted (Ollama, LM Studio, llama.cpp, vLLM,
LiteLLM). Nine routing roles (`default`, `smol`, `slow`, `plan`, `commit`, `vision`, `task`,
`advisor`, `tiny`); per-role/per-model fallback chains; path-scoped model overrides; round-robin
credential rotation with per-credential backoff.

### 2.5 The Hashline benchmark (primary source)
Blog post: **"The Harness Problem"** — https://stencil.so/blog/the-harness-problem (also
indexed at `blog.can.ac/2026/02/12/the-harness-problem/`).

Key claims (own benchmark, "3 runs × 180 tasks, fresh session each," mutated-bug fixtures drawn
from the React codebase, four tools: read/edit/write):
- Hashline beats `apply_patch`-style patch format in 14/16 models tested; a "v2" revision
  improves further in 12/16.
- Grok Code Fast 1: patch pass rate 6.7% → hashline 68.3% (claimed "tenfold" lift) in the
  headline table; the detailed per-model table in the post shows +4.6 to +64.6 pp swings
  relative to patch baseline depending on model and a separate "V2" revision column.
- Grok 4 Fast: −61% output tokens (best case) attributed purely to eliminating retry loops on
  malformed patches.
- Gemini 3 Flash: "+5pp over str_replace — beats Google's own best attempt at the format,"
  elsewhere stated as 78.3% pass rate.
- Explicitly contrasts: Codex's `apply_patch` (OpenAI-diff blob, "almost certainly" tuned at the
  LLM-gateway level for Codex-family models, with Grok 4's patch failure rate cited at 50.7% and
  GLM-4.7's at 46.2% when forced into that format); Claude Code / most others' `str_replace`
  (exact-match string replace, cites Anthropic's own GitHub issue megathread
  `anthropics/claude-code#3471` on "String to replace not found in file"); Cursor's approach
  (fine-tuned 70B "instant apply" merge model, quoting Cursor's own blog that "fully rewriting
  the full file outperforms aider-like diffs for files under 400 lines" — https://cursor.com/blog/instant-apply).
- Cites external academic benchmarks as corroboration: Aider's own benchmark
  (https://aider.chat/docs/benchmarks.html, format swung GPT-4 Turbo 26%→59% while GPT-3.5 only
  hit 19% because it couldn't reliably produce valid diffs); JetBrains' **Diff-XYZ** benchmark
  (arXiv:2510.12487, "no single edit format dominates across models and use cases"); and
  **EDIT-Bench** (arXiv:2511.04486, "only one model achieves over 60% pass@1 on realistic editing
  tasks").
- Benchmark code/data published at
  https://github.com/can1357/omp/tree/main/packages/react-edit-benchmark (note: different repo
  path, `can1357/omp`, than the main `can1357/oh-my-pi` — likely a historical/internal repo name;
  worth checking at execution time whether this is the same repo under an older slug or a
  genuinely separate internal benchmark mono-repo).
- Also contains a pointed political aside: notes Anthropic blocked OpenCode from Claude Code
  subscriptions (HN thread https://news.ycombinator.com/item?id=46625918) and claims the author's
  own Gemini account was disabled by Google during benchmarking — framed as evidence that
  model vendors resist open, cross-model harness tuning. **Unverified / one-sided claim**, flag
  as opinion/anecdote, not independently confirmed.

### 2.6 Third-party adoption of the Hashline idea (strong evidence of real-world influence)
1. **gptme** (`gptme/gptme`, 4,468★, MIT, Python) ships
   `gptme/tools/hashline_edit.py` (commit `05d863e38b5`), whose docstring states verbatim:
   *"Snapshot-anchored file editing inspired by oh-my-pi's Hashline format."* Implements the same
   two-call read-then-edit cycle with a 4-byte SHA-256 file tag and `PUT`/`CUT` line-range
   operations, including named "registers" for cut/paste across calls — a near-faithful port of
   OMP's syntax into an independent, pre-existing agent project.
   https://github.com/gptme/gptme/blob/05d863e38b57dfd0e433a2a4512e710818dee6d7/gptme/tools/hashline_edit.py
2. **PI-Desktop** (`vastsa/PI-Desktop`) — Architecture Decision Record
   `docs/adr/0087-line-anchored-edit-contract.md` (status "Implemented," dated 2026-08-15)
   explicitly names `oh-my-pi`'s `hashline` package as the design source: *"`oh-my-pi`'s
   `hashline` package solves exactly this by inverting what the model supplies…"* and adopts the
   same `[path#TAG]` header, `PUT N.=M:` / `CUT N.=M` / named-register syntax, adding its own
   tree-sitter-backed syntactic-block resolution for `PUT N*:`/`CUT N*`. This is a second,
   independent production system (a different "PI-Desktop" product, seemingly unrelated to
   Mario Zechner's Pi beyond the name) building hashline into its core edit contract.
   https://github.com/vastsa/PI-Desktop/blob/d4f5c10f371c373485342a59a5b364356189f70f/docs/adr/0087-line-anchored-edit-contract.md

### 2.7 Community/press coverage (secondary sources, lower confidence, not independently fetched in full)
- Hacker News: "Oh-my-pi: A coding agent with the IDE wired in" —
  https://news.ycombinator.com/item?id=48994611 ; a separate comment thread at
  https://news.ycombinator.com/item?id=48848780 ("Currently using Oh My Pi…"). *Not opened
  directly in this session — titles/snippets only, via search summarization; verify directly
  before quoting specific comments.*
- Blog/explainer coverage found by search (not independently fetched): `yuv.ai/blog/oh-my-pi-omp-explained`,
  `betterstack.com/community/guides/ai/oh-my-pi-ai-coding-agent/`,
  `agentpedia.codes/blog/oh-my-pi-terminal-coding-agent-guide`,
  `dev.to/dishant0406/the-oh-my-pi-hype-hashline-reactions-and-what-everyone-missed-2771`,
  `inventivehq.com/blog/oh-my-pi-hash-anchored-editing`,
  `deepwiki.com/can1357/oh-my-pi/7.1-hashline-mode` (auto-generated wiki, treat as derivative not
  primary), `luismori.dev/article/oh-my-pi-omp-hardened-coding-agent-cli-comparison/`.
- A GitHub fork/distribution exists under a different name/owner:
  `CultusSnake/oh-my-pi-IDE-Coding-Agent` and `CyberSecurityChuck/Oh-My-PI` — not inspected for
  divergence from upstream; likely mirrors or forks, could also be unrelated or stale clones.
- Discord badge links to https://discord.gg/4NMW9cdXZa — presence noted, member count/activity
  not independently verified.

**Gap:** No YouTube video was independently verified in this session (search summaries referenced
"capture" `.mp4` clips hosted by OMP itself at `omp.sh/clips/*.mp4` for dap/ttsr/irc/advisor/
collab/web/conflict/codemod demos — these are first-party demo assets embedded in the README, not
third-party video reviews).

---

## 3. The Pi harness (upstream of OMP)

- **Original repo (Mario Zechner / badlogic):** `badlogic/pi-mono`. Direct API lookup in this
  session returned a 301 redirect to `api.github.com/repositories/1035029907`, which resolves to
  **`earendil-works/pi`** — i.e., the project appears to have been renamed/transferred from
  `badlogic/pi-mono` to an `earendil-works` org at some point. Confirm current canonical location
  before citing; OMP's README still describes itself as "Fork of **Pi** by @mariozechner" linking
  to `github.com/badlogic/pi-mono`, so the rename may postdate OMP's fork point, or GitHub's
  redirect may reflect a repo transfer unrelated to a rename of the original.
- **Stats via `earendil-works/pi` (2026-11-06):** 120,363★ / 15,478 forks / 262 open issues, MIT
  license, `created_at` 2025-08-09, `pushed_at` 2026-11-06. Description: "AI agent toolkit:
  unified LLM API, agent loop, TUI, coding agent CLI." These star/fork numbers are an order of
  magnitude larger than OMP's and than nearly every other repo checked in this report — treat as
  a signal that Pi is the most widely adopted minimal-harness base in this space, but the absolute
  number (120k★ accumulated in under 15 months) is unusually high and should be re-verified.
- **npm packages seen in search results:** `@mariozechner/pi-coding-agent` (noted as deprecated)
  and `@earendil-works/pi-coding-agent` (current, per search summaries — not independently
  fetched from npm in this session).
- **Design philosophy (per OMP's README and search summaries):** extremely minimal core — four
  base tools (read/write/edit/bash), terminal-first TUI with print/JSON/RPC/SDK embedding modes,
  tree-structured sessions (fork/resume/compaction), no built-in subagents or plan mode by
  design — everything else is meant to be added via the extension system.
- **Extension model:** TypeScript modules ("Pi Packages") distributed via npm or git, auto-
  discovered from locations like `~/.pi/agent/extensions/*.ts` and `.pi/extensions/*.ts`, with
  hot reload. An `ExtensionAPI` lets an extension subscribe to lifecycle events, intercept
  messages, register new tools/commands/keyboard shortcuts, and even register new model
  providers. Separate concepts: **Extensions** (code), **Skills** (narrower, prompt/tool
  packages — community skills live in a `pi-skills` repo per search summaries), **Prompt
  Templates**, and **Themes** — all distributable as "Pi Packages." *(This architecture
  description is derived from web-search summarization of `pi.dev` docs and a DeepWiki
  auto-generated page, not independently fetched from primary docs in this session — treat the
  specific file-path/hook-name details as indicative, not verified line-by-line.)*
- **Blog (primary, Mario Zechner):** "What I learned building an opinionated and minimal coding
  agent" — https://mariozechner.at/posts/2025-11-30-pi-coding-agent/ (found via search, not
  independently fetched; worth reading directly for the design rationale behind the
  minimal-core / extension-everything-else philosophy that OMP explicitly builds on top of).
- **Site:** https://pi.dev (packages index at `pi.dev/packages/pi-extensions`).

**Implication for OMC:** Pi and OMP demonstrate a two-layer pattern — a tiny, audited core
harness plus an aggressively "batteries-included" fork that re-adds power-user features as
first-class, native (not MCP/shelled-out) functionality. OMC is itself playing the OMP role
relative to GitHub Copilot CLI's minimal core, which is a reasonable analogy for scoping
ambition, but OMP's implementation strategy (~80k lines of Rust, N-API native modules) is far
heavier than what a Copilot CLI plugin can realistically match; the lesson to take is the
*feature list and the rationale* (e.g., "no fork/exec," "URL schemes as a unifying interface,"
"review-before-apply for structural edits"), not the native-binary architecture.

---

## 4. Comparable harness-enhancement layers

### 4.1 wshobson/agents — multi-harness "write once, adapt everywhere" (highest relevance to OMC)
- **Repo:** https://github.com/wshobson/agents
- **Stats:** 42,246★ / 4,463 forks, MIT, Python, created 2025-07-24, pushed 2026-11-05 (daily
  activity).
- **What it does:** A single Markdown-authored catalog of **94 plugins** (92 local + 2 external),
  containing **202 agents, 185 skills, 105 commands**, written once in the Claude Code plugin
  format and mechanically adapted via `tools/adapters/` to run natively on **Claude Code, OpenAI
  Codex CLI, Cursor, OpenCode, Antigravity CLI, GitHub Copilot, and Pi** — i.e., **Copilot is
  already an explicit first-class adapter target** in this project, which is the single most
  directly relevant precedent found for OMC's goal of being "the oh-my-pi of Copilot CLI."
- **Mechanism:** Adapters map model aliases (`opus`/`sonnet`/`haiku`/`fable`/`inherit`) to each
  harness's own model config, translate tool permissions where supported, and regenerate
  artifacts (TOML for Codex, generated GitHub Copilot "agent profiles"/skills, Pi "skills +
  prompt templates" since Pi's lack of native subagents means agents require an additional
  subagent extension on that harness). CI regenerates and validates every harness's output and
  runs OpenCode/Antigravity/Pi artifacts through their installed CLIs as part of validation.
  Quality gating via `make validate STRICT=1`, `make garden`, and a `plugin-eval` static-check +
  LLM-judge + Monte-Carlo scoring tool (explicitly flagged in its own docs as experimental /
  unvalidated against human labels).
- **Capability matrix:** `docs/harnesses.md` documents what each harness actually supports
  (hooks, MCP config, tool-permission translation, installation routes) — this is a ready-made
  reference for how a serious multi-harness project documents per-harness capability gaps, which
  OMC could mirror for its own feature-parity tracking across Copilot CLI versions.
- **License:** MIT — freely inspectable/reusable for adapter-pattern ideas (not for direct code
  copy without attribution/license compliance check).

### 4.2 oh-my-claudecode (Yeachan-Heo)
- **Repo:** https://github.com/Yeachan-Heo/oh-my-claudecode — "Teams-first Multi-agent
  orchestration for Claude Code."
- **Stats:** 40,630★ / 3,636 forks, MIT, TypeScript, created 2026-01-09, pushed 2026-11-05.
- **What it adds (per search summaries, not independently fetched from README in full):** runs up
  to 5 parallel Claude Code instances as a "team" (developer/reviewer/tester-style roles),
  multi-model orchestration across Claude/Gemini/Codex CLIs, smart task routing/cost
  optimization, 19+ specialized agents, 30+ skills (TDD, review, refactor, deploy), "autopilot"/
  "ultrapilot" modes for larger projects. Distributed as npm package `oh-my-claude-sisyphus`
  (`npm i -g oh-my-claude-sisyphus@latest`, then `omc setup`) or via Claude Code's plugin
  marketplace (`/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode`).
- **Mechanism:** Plugin/marketplace-based, i.e. built on Claude Code's native hook/plugin system
  rather than a hard fork of the harness binary (contrast with OMP, which forks/rewrites Pi's
  core).
- **Third-party coverage:** an independent review blog was referenced —
  `andrew.ooo/posts/oh-my-claudecode-multi-agent-review/` (not independently fetched).

### 4.3 oh-my-codex (Yeachan-Heo)
- **Repo:** https://github.com/Yeachan-Heo/oh-my-codex — "OmX - Oh My codeX: Your codex is not
  alone. Add hooks, agent teams, HUDs, and so much more." Site: https://oh-my-codex.dev/.
- **Stats:** 33,727★ / 2,548 forks, MIT, TypeScript, created 2026-02-02, pushed 2026-11-03.
- **What it adds:** Same author/family as oh-my-claudecode, targeting OpenAI's Codex CLI instead:
  multi-agent orchestration, a plugin/hook system (custom HUD overlays, agent teams, workflow
  extensions), VS Code integration, official plugins droppable into a `.agents/plugins`
  directory. Strong focus on automation/scripted workflows and "quality gates."
- **Relevance to OMC:** same author building parallel "oh-my-*" layers for two different harnesses
  (Claude Code, Codex) with an almost identical plugin/hook architecture — a direct existence
  proof that the "one philosophy, many harness-specific re-implementations" strategy (which is
  essentially what OMC is doing for Copilot CLI vs. what OMP does for Pi) is an active, validated
  pattern, not a one-off.

### 4.4 oh-my-opencode / "Sisyphus" agent family (OpenCode ecosystem)
Multiple competing/forked projects surfaced, all centered on an orchestrator persona named
**Sisyphus** (sometimes "Atlas"/"Prometheus" in related variants) that delegates to specialized
background subagents (e.g., "oracle," "librarian," "frontend engineer") with distinct
permissions and model preferences:
- `opensoft/oh-my-opencode` — https://github.com/opensoft/oh-my-opencode. Stats: 1,334★ / 64
  forks, license "Other"/NOASSERTION (**not clearly open-source-licensed — verify before reuse**),
  TypeScript, created 2025-12-28, pushed 2026-01-26 (appears stalled relative to the others).
  Tagline: "#1 OpenCode Plugin- Battery included. ASYNC SUBAGENTS... Curated agents with proper
  models · Crafted tools like LSP/AST included · Curated MCPs · Claude Code Compatible Layer."
- `JYAIXR/oh-my-open-code` — https://github.com/JYAIXR/oh-my-open-code. Stats: 0★ (brand new /
  unadopted at time of check), license "Other"/NOASSERTION, created 2026-01-09. Tagline: "The
  Best Agent Harness. Meet Sisyphus: The Batteries-Included Agent that codes like you."
- `code-yeongyu/oh-my-openagent` (and a `code-yeongyu/oh-my-opencode` variant referenced by
  search) — repo lookup for `code-yeongyu/oh-my-opencode` returned no data via the GitHub API in
  this session (likely renamed/moved/deleted, or search results pointed to a now-stale slug);
  DeepWiki pages (`deepwiki.com/code-yeongyu/oh-my-opencode/...`) and docs
  (`AGENTS.md`, `docs/guide/orchestration.md`) were referenced by search but not independently
  fetched. **Treat this specific sub-branch of findings as unverified** — confirm the live repo
  location before relying on it.
- **Mechanism (per search/DeepWiki summaries):** curated LSP/AST tool bundle, a "Claude Code
  Compatible Layer" (so Claude Code-format agents/skills can run under OpenCode), configurable
  agent categories with per-category model routing, hierarchical orchestrator → specialist
  subagent delegation defined in config files like `AGENTS.md`/`orchestration.md`.
- **Takeaway for OMC:** this sub-ecosystem is fragmented (multiple competing forks, inconsistent
  licensing, wildly different star counts) — useful as evidence that "OpenCode + Sisyphus-style
  orchestrator" is a popular pattern, but not a single canonical project to benchmark against.

### 4.5 SuperClaude (SuperClaude-Org/SuperClaude_Framework)
- **Repo:** https://github.com/SuperClaude-Org/SuperClaude_Framework
- **Stats:** 23,929★ / 1,986 forks, MIT, Python, created 2025-06-22, pushed 2026-09-27 (slower
  recent cadence than the other projects above).
- **What it is:** "A configuration framework that enhances Claude Code with specialized
  commands, cognitive personas, and development methodologies." Pure-configuration approach
  (slash commands + "persona" system prompts + methodology templates) rather than a native-code
  rewrite — closer in spirit to OMC's "rules + nudge + skills" layer than to OMP's Rust rewrite.

### 4.6 claude-flow (ruvnet)
- Referenced heavily in search results as a swarm/multi-agent orchestration layer for Claude
  Code (`ruvnet/claude-flow`), but a direct GitHub API lookup for that slug returned no data in
  this session (search rate-limited before a follow-up query could confirm current location/
  stats). **Unverified in this pass — flag for thread-4 or a follow-up search** before citing
  specific figures; do not assume it is unmaintained, only that it wasn't independently
  re-confirmed here.

### 4.7 GitHub Copilot ecosystem: awesome-copilot
- **Repo:** https://github.com/github/awesome-copilot — "Community-contributed instructions,
  agents, skills, and configurations to help you make the most of GitHub Copilot."
- **Stats:** 40,856★ / 5,301 forks, MIT, JavaScript, created 2025-06-11, pushed 2026-11-06 (same
  day as this research — very active, official GitHub-org-maintained repo).
- **What it is:** Official GitHub-maintained curation of community Copilot customizations
  (custom instructions, chat modes/agents, prompt files, reusable configurations) — the closest
  thing to an "official" plugin marketplace/registry for Copilot today, distinct from a code
  extension framework like OMP. Directly relevant as (a) a distribution channel OMC could publish
  into or cross-link from, and (b) a signal of what kinds of customizations GitHub itself
  encourages for Copilot (instructions/agents/skills — matches OMC's existing rule/skill
  primitives).

### 4.8 ast-grep (structural editing engine — relevant to OMC's pending ast-grep feature)
- **Repo:** https://github.com/ast-grep/ast-grep — "A CLI tool for code structural search, lint
  and rewriting. Written in Rust."
- **Stats:** 16,461★ / 496 forks, MIT, Rust, created 2022-07-01, pushed 2026-11-06 (long-running,
  mature, still very active — oldest and most battle-tested project in this report).
- **Relevance:** This is the actual engine OMP uses under its `ast_edit`/`ast_grep` tools
  (per the README's "`ast_grep` — structural code queries over 50+ tree-sitter grammars"). For
  OMC's pending ast-grep structural editing feature, ast-grep itself (the Rust CLI/library, with
  Python/Node/Rust bindings) is almost certainly the dependency to shell out to or bind against,
  rather than reimplementing tree-sitter query matching — OMP's "preview as (proposed) card, then
  atomic accept via `xd://resolve`" UX pattern (README item 19, §2.1 above) is a directly
  reusable interaction design for a CLI/plugin context: stage the ast-grep rewrite, show a diff/
  count, require an explicit accept before touching disk.

### 4.9 Cursor / Cline / Windsurf rule packs (context for OMC's existing "opt-in rule imports")
Search did not surface a single canonical "awesome Cursor rules" repo with verified stats in this
session (time was prioritized toward the harness-layer projects above, since OMC already has this
feature shipped). **Gap:** a follow-up targeted search for `.cursor/rules` / `.clinerules` /
`.windsurfrules` community pack repos (e.g., `PatrickJS/awesome-cursorrules`) would strengthen
this section if deeper Cursor-ecosystem comparison is wanted later — not done here due to time/
scope tradeoff against the higher-value OMP/Pi/multi-harness findings.

---

## 5. Comparison table

| Project | Harness target | Key features relevant to OMC | Mechanism | License | Stars/forks (snapshot 2026-11-06) | Adoption evidence |
|---|---|---|---|---|---|---|
| **oh-my-pi (OMP)** | Pi (forked) | Hashline edit, LSP writes, DAP debugger, TTSR stream rules, advisor model, subagents, ast_edit preview/accept, URL-scheme reads, rule-format import (8 formats), commit-splitting, `/review` reviewer, eval kernels (Python+JS), browser/desktop control | Rust rewrite of harness core (~80k LoC) + TS shell; native N-API modules, no fork/exec | MIT | 37,980★ / 4,283 | Own benchmark post widely referenced; HN thread; independently re-implemented by gptme and PI-Desktop |
| **Pi / pi-mono** | Self (base harness) | Minimal 4-tool core (read/write/edit/bash), TS extension system (`ExtensionAPI`), skills/templates/themes as "Pi Packages", tree-structured sessions | TypeScript core + npm-distributed extensions | MIT | 120,363★ / 15,478 (as `earendil-works/pi`) | Base for OMP and a target harness for wshobson/agents adapters |
| **wshobson/agents** | Claude Code, Codex CLI, Cursor, OpenCode, Antigravity CLI, **GitHub Copilot**, Pi | Single Markdown source → adapter-generated agents/skills/commands per harness; capability matrix; CI-validated artifacts; experimental plugin-eval scoring | Adapter/codegen pattern (`tools/adapters/`), Make-based install per harness | MIT | 42,246★ / 4,463 | CI regenerates + runs generated artifacts through each harness's CLI; 94 plugins / 202 agents / 185 skills / 105 commands |
| **oh-my-claudecode** | Claude Code | 5-way parallel multi-agent "teams," multi-model (Claude/Gemini/Codex) routing, 19+ agents/30+ skills, autopilot/ultrapilot modes | Claude Code plugin marketplace + npm CLI (`oh-my-claude-sisyphus`) | MIT | 40,630★ / 3,636 | Independent review blog (andrew.ooo); plugin marketplace listing |
| **oh-my-codex** | Codex CLI | Hooks, agent teams, HUD overlays, `.agents/plugins` directory, VS Code integration | Plugin/hook system on Codex CLI | MIT | 33,727★ / 2,548 | Same author/family as oh-my-claudecode; own site (oh-my-codex.dev) |
| **oh-my-opencode / Sisyphus family** | OpenCode | Orchestrator ("Sisyphus") → specialist subagents, curated LSP/AST tools, Claude-Code-compatible layer | Config + plugin files (`AGENTS.md`, `orchestration.md`) | Mixed (MIT and "Other"/NOASSERTION — **verify per-fork**) | Fragmented: opensoft 1,334★; JYAIXR 0★; code-yeongyu variant unconfirmed | DeepWiki pages exist; ecosystem clearly fragmented/competing forks |
| **SuperClaude** | Claude Code | Specialized commands, "cognitive personas," development methodologies | Pure config/prompt framework, no native rewrite | MIT | 23,929★ / 1,986 | Long-running (since mid-2025), slower recent cadence |
| **claude-flow** | Claude Code | Swarm/multi-agent orchestration (per search summaries only) | Unverified in this pass | Unverified | Unverified (API lookup failed/rate-limited) | **Needs re-verification** |
| **github/awesome-copilot** | GitHub Copilot | Curated community instructions/agents/skills/configs | Markdown registry, official GitHub org repo | MIT | 40,856★ / 5,301 | Official github.com org project; daily-active |
| **ast-grep** | Language-agnostic (any harness) | Structural search/lint/rewrite over 50+ tree-sitter grammars | Standalone Rust CLI/library, used as a dependency by OMP's `ast_edit`/`ast_grep` | MIT | 16,461★ / 496 | Oldest project here (2022); clearly the underlying engine for OMC's pending ast-grep feature |
| **gptme** | Self (Python agent) | Independently ported Hashline into `hashline_edit.py`, citing OMP by name | Direct, credited reimplementation | MIT | 4,468★ / 468 | Primary-source code comment: "inspired by oh-my-pi's Hashline format" |
| **PI-Desktop** | Self (separate product, name collision with Pi) | ADR 0087 adopts Hashline as its core `Edit` contract, replacing `old_string`/`new_string` | ADR-documented architectural change, tree-sitter-backed block ops | Unknown (private/enterprise-style ADR docs; not confirmed public OSS) | N/A (ADR doc, not a public star count found) | Primary-source ADR explicitly names and credits `oh-my-pi`'s `hashline` package as the design source |

---

## 6. Ideas OMC could adopt, with priority and rationale

### High priority (directly extends shipped OMC features with evidence of real payoff)

1. **Hashline "block ops" and stale-anchor recovery (extend `edit_anchored`).** OMP/PI-Desktop's
   ADR both go further than a flat line-range anchor: `PUT N*:` / `CUT N*` resolve a
   *syntactic block* (via tree-sitter) starting at an anchored line, and a rejected edit due to a
   stale anchor returns the *current* content at that location inline in the error so the model
   can retry without a fresh read round-trip. OMC's existing hashline-style anchors would get
   meaningfully more useful (and cheaper in turns) by adding: (a) inline "here's what's actually
   there now" on anchor-mismatch rejection, and (b) a named-register cut/paste mechanism for
   cross-call or cross-file moves without re-emitting content. Source:
   `vastsa/PI-Desktop:docs/adr/0087-line-anchored-edit-contract.md` (§3–5); `gptme`'s
   `hashline_edit.py` CUT/PUT @register syntax.

2. **Preview-then-accept UX for structural (ast-grep) edits.** Before OMC's planned ast-grep
   feature lands, adopt OMP's pattern: stage the rewrite as a "(proposed) N replacements" result,
   require an explicit accept action before touching disk, and make the accept atomic/all-or-
   nothing across every matched file. This maps cleanly onto Copilot CLI's existing
   confirmation/approval UX and avoids ast-grep's power (project-wide rewrite) becoming a
   project-wide liability on a bad pattern. Source: OMP README §19 (`ast_edit` → `xd://resolve`).

3. **Benchmark your own hashline implementation the way OMP did, before/after adding ast-grep,
   DAP, etc.** OMP's "harness problem" post makes a credible, reproducible-sounding case
   (mutation-based fixtures on a real codebase, 3 runs × N tasks, fresh session per run, multiple
   models) that *edit-tool format alone* swings pass rates by double digits — independent of any
   model upgrade. Before investing more engineering in OMC's anchored editing, build (or adapt)
   a similar small benchmark harness to quantify OMC's actual hashline win rate vs. a plain
   str_replace baseline on a couple of target models; this is cheap, reusable for marketing
   claims, and matches how at least two other projects (gptme, PI-Desktop) justified adopting the
   same idea. Source: https://stencil.so/blog/the-harness-problem; benchmark code pointer
   `can1357/omp/tree/main/packages/react-edit-benchmark` (verify current location).

### Medium priority (plausible near-term OMC features, lower direct dependency on current OMC code)

4. **URL-scheme reads as the unifying interface for `read_uri` and GitHub integration.** Rather
   than building separate `gh_issue_view`/`gh_pr_view`-style tools, OMP's `pr://`, `issue://`,
   `agent://`, `conflict://` scheme design lets every existing FS-shaped tool (`read`, `grep`,
   `write`) operate on non-file resources with zero new surface area for the model to learn. This
   is directly applicable to OMC's pending `read_uri` work and would let OMC's existing
   merge-conflict tools (`list_conflicts`/`resolve_conflicts`) be reframed as `conflict://N`
   reads/writes for a smaller, more composable API — though note OMC already has dedicated
   conflict tools, so this is a refactor-for-elegance idea, not a capability gap. Source: OMP
   README §12, §17, §18.

5. **Advisor/second-model review role, modeled as a lightweight nudge-adjacent feature rather
   than OMP's full separate-context observer.** OMC's reviewer agent is post-hoc (review a
   diff/PR); OMP's "advisor" is concurrent — it watches every turn the *main* agent takes, on its
   own model/context, and injects notes inline mid-task. A scoped version (e.g., opt-in, runs
   only on destructive/high-risk tool calls, uses a cheap model) could extend OMC's existing
   pre/post tool rules + reviewer agent into something that catches problems during the task,
   not only at the end. Source: OMP README §06.

6. **Rule-format coverage: match or extend OMC's "opt-in Cursor/Cline/Windsurf" import to match
   OMP's claimed 8-format native-shape support** (adds at minimum Codex `AGENTS.md` and Copilot's
   own `applyTo` format as read targets, which is slightly unusual — OMP reads Copilot's *own*
   rule format too, presumably for users migrating between harnesses). Since OMC is itself a
   Copilot CLI plugin, the highest-value gap to close first is probably Codex's `AGENTS.md` (very
   widely adopted convention) if not already covered. Source: OMP README §15.

7. **Adapter/codegen pattern from wshobson/agents for OMC's skills/rules.** If OMC's commit-
   splitting skill, reviewer agent, or rule packs are ever meant to be shared with or ported from
   other harnesses' equivalents (Claude Code skills, Codex AGENTS skills), wshobson/agents'
   "author once in a canonical Markdown format, adapt via generators + CI validation across every
   target harness" pattern is a proven, actively-maintained architecture to borrow — including
   its `docs/harnesses.md` capability matrix as a model for documenting what Copilot CLI
   does/doesn't support relative to competitors. Source: `wshobson/agents` README + `ARCHITECTURE.md`.

### Lower priority / exploratory (interesting but speculative, large scope, or unverified)

8. **In-process coreutils / no-fork-exec tooling.** OMP's pitch that shelling out to `rg`/`grep`/
   `find`/`bash` costs a fork-exec round-trip per call, "especially on Windows (no WSL bridge
   needed)," is compelling for a native binary but likely out of scope for a Copilot CLI plugin
   (which presumably runs inside the existing Copilot CLI process model rather than shipping its
   own ~80k-line Rust core). Worth a short feasibility note only if OMC performance profiling
   ever flags shell-spawn overhead as a bottleneck.

9. **Eval kernels with tool re-entry (Python/JS cells that can call back into agent tools).**
   OMC's pending "eval kernels" item should look at OMP's design where a persistent Python/Bun
   kernel can call `tool.read` from inside a cell and hand data to a JS cell for charting, all
   without leaving the cell — a good target UX for OMC's eval kernel design, though the
   loopback-bridge mechanism (how the kernel calls back into tool execution) wasn't detailed
   enough in the fetched README to reverse-engineer; would need a deeper dive into OMP's source
   (not done in this pass — scope/budget tradeoff) if OMC wants to copy the mechanism, not just
   the feature idea.

10. **DAP debugger and LSP presets.** OMP's "14 LSP ops / 28 DAP ops" figures and its
    `docs/lsp-config.md` are a useful existence proof of scope (how many distinct LSP operations
    a "wired into every write" integration realistically needs) but this thread did not fetch
    OMP's actual LSP/DAP implementation source — recommend a follow-up directly against
    `can1357/oh-my-pi`'s source tree (e.g., `crates/` or wherever the LSP/DAP client code lives)
    before OMC scopes its own DAP/LSP-preset work, since the README alone doesn't show
    implementation detail (how it selects/launches adapters like lldb-dap/dlv/debugpy, how config
    in `docs/lsp-config.md` maps language → server).

11. **claude-flow and Cursor rule-pack ecosystems** — flagged as unverified gaps above; low
    priority to chase further unless a later thread specifically needs swarm-orchestration or
    Cursor-rule-pack comparisons that this thread didn't cover.

---

## 7. Sources

Primary (fetched/verified directly in this session):
- https://github.com/can1357/oh-my-pi (README, fetched in full across 3 paginated fetches)
- https://api.github.com/repos/can1357/oh-my-pi (stats)
- https://api.github.com/repositories/1035029907 → `earendil-works/pi` (stats; redirect target of `badlogic/pi-mono`)
- https://stencil.so/blog/the-harness-problem (a.k.a. `blog.can.ac/2026/02/12/the-harness-problem/`) — hashline benchmark primary source
- https://github.com/gptme/gptme/blob/05d863e38b57dfd0e433a2a4512e710818dee6d7/gptme/tools/hashline_edit.py
- https://api.github.com/repos/gptme/gptme (stats)
- https://github.com/vastsa/PI-Desktop/blob/d4f5c10f371c373485342a59a5b364356189f70f/docs/adr/0087-line-anchored-edit-contract.md
- https://github.com/wshobson/agents (README) + https://api.github.com/repos/wshobson/agents (stats)
- https://api.github.com/repos/Yeachan-Heo/oh-my-claudecode
- https://api.github.com/repos/Yeachan-Heo/oh-my-codex
- https://api.github.com/repos/opensoft/oh-my-opencode
- https://api.github.com/repos/JYAIXR/oh-my-open-code
- https://api.github.com/repos/SuperClaude-Org/SuperClaude_Framework
- https://api.github.com/repos/github/awesome-copilot
- https://api.github.com/repos/ast-grep/ast-grep
- GitHub code search for `oh-my-pi hashline anchored editing` (surfaced the gptme and PI-Desktop hits above)

Secondary (referenced via web-search summarization; titles/URLs captured but content not
independently fetched — verify before quoting directly):
- https://news.ycombinator.com/item?id=48994611 ("Oh-my-pi: A coding agent with the IDE wired in")
- https://news.ycombinator.com/item?id=48848780 (HN comment thread)
- https://news.ycombinator.com/item?id=46625918 (Anthropic/OpenCode access block, cited inside the Stencil blog post)
- https://aider.chat/docs/benchmarks.html and https://aider.chat/docs/more/edit-formats.html (Aider edit-format benchmark)
- arXiv:2510.12487 — "Diff-XYZ" benchmark (JetBrains)
- arXiv:2511.04486 — "EDIT-Bench"
- https://cursor.com/blog/instant-apply
- https://github.com/anthropics/claude-code/issues/3471
- https://mariozechner.at/posts/2025-11-30-pi-coding-agent/ (Pi design rationale, Mario Zechner)
- https://pi.dev and https://pi.dev/packages/pi-extensions
- https://deepwiki.com/badlogic/pi-mono/4.4-extension-system and https://deepwiki.com/can1357/oh-my-pi/7.1-hashline-mode (auto-generated derivative docs)
- https://hochej.github.io/pi-mono/coding-agent/extensions/
- https://andrew.ooo/posts/oh-my-claudecode-multi-agent-review/
- https://oh-my-codex.dev/
- https://deepwiki.com/code-yeongyu/oh-my-opencode/4.1-agent-orchestration-overview
- https://github.com/code-yeongyu/oh-my-openagent (upstream name referenced; not independently confirmed)
- https://yuv.ai/blog/oh-my-pi-omp-explained, https://betterstack.com/community/guides/ai/oh-my-pi-ai-coding-agent/, https://agentpedia.codes/blog/oh-my-pi-terminal-coding-agent-guide, https://dev.to/dishant0406/the-oh-my-pi-hype-hashline-reactions-and-what-everyone-missed-2771, https://inventivehq.com/blog/oh-my-pi-hash-anchored-editing, https://luismori.dev/article/oh-my-pi-omp-hardened-coding-agent-cli-comparison/ (secondary blog coverage of OMP/hashline)
- https://github.com/CultusSnake/oh-my-pi-IDE-Coding-Agent, https://github.com/CyberSecurityChuck/Oh-My-PI (possible forks/mirrors, unverified)

Not found / explicitly flagged as gaps:
- `ruvnet/claude-flow` — GitHub API lookup failed/rate-limited in this session; stats and current repo location unverified.
- A canonical Cursor/Cline/Windsurf community "awesome rules" repo with verified stats — not pursued in depth (lower priority given OMC already ships this feature).
- `code-yeongyu/oh-my-opencode` canonical repo location — API lookup returned nothing; only DeepWiki/search-summary evidence available.
- No direct primary-source fetch of OMP's LSP/DAP implementation code (only README-level feature description) — recommend as a follow-up before OMC scopes its own LSP-preset/DAP work.
