# Harness Managers & Orchestrators (Thread 4 of 4)

Research scope: apps/tools that **run, manage, and coordinate multiple coding-agent harnesses**
(Claude Code, Codex CLI, GitHub Copilot CLI, OpenCode, Cursor Agent, Pi, Gemini CLI, etc.) —
as opposed to being a harness themselves. Compiled November 2026. All facts below were verified
against primary sources (official GitHub repos, docs sites, vendor blogs) where possible; claims
resting only on secondary/blog sources are explicitly flagged **[unverified]**.

> Note on method: GitHub star/fork/license/activity numbers in the comparison table were pulled
> live from the GitHub REST API (`api.github.com/repos/...`) on 2026-11-06 and may drift quickly —
> treat as a snapshot, not a permanent ranking.

> **Scope correction:** this session runs in the user's
> [`tesseracode/t3code` fork](https://github.com/tesseracode/t3code), which adds Copilot support.
> That observation does not establish Copilot support in upstream `pingdotgg/t3code`.
> Local tool schemas are evidence about the fork, not necessarily upstream features.
> The large star counts prompted a verification check, not an allegation of artificial growth;
> six repository counts were independently confirmed in the [synthesis](../landscape.md#what-the-star-count-warning-meant).

---

## 1. Summary

The "harness manager / orchestrator" category has exploded in 2025–2026 into roughly four
architectural families:

1. **Desktop/terminal apps that spawn harness CLIs as subprocesses in isolated git worktrees**
   (Orca, T3 Code, Conductor, Claude Squad, CCManager, uzi, vibe-kanban, Nimbalyst/Crystal,
   opcode). This is the dominant pattern: the orchestrator does not reimplement agent reasoning,
   it just runs `claude`, `codex`, `copilot`, `opencode`, etc. as child processes, usually one per
   `git worktree` so several agents can touch the same repo without colliding.
2. **Terminal multiplexer/runtime layers** that make agent *processes* (not just git state) safe
   to run in parallel, detach, and resume — tmux itself, Claude Squad (tmux-based), uzi
   (tmux-based), and the newer agent-native multiplexers **herdr** (Rust, tmux-like but
   agent-status-aware) and **Rex** (Mitchell Hashimoto's new terminal, with a first-class
   "Activity Mode" built on an open escalation protocol, OSC 7501 "Program Status Protocol").
3. **Cloud/VM orchestration platforms** that run agents in ephemeral sandboxes you don't own
   locally — Cursor Cloud Agents, OpenAI Codex Cloud, GitHub Copilot coding agent + Agent HQ,
   Google Jules, Devin (Cognition), OpenHands, Terragon (now shut down), Sculptor (containers).
   These emphasize async/remote/mobile workflows over local worktree juggling.
4. **Protocol-level standardization**: the **Agent Client Protocol (ACP)**, originally built by
   Zed and Google, is emerging as the "LSP for coding agents" — a JSON-RPC-over-stdio protocol
   that lets *any* ACP client (editor, IDE, orchestrator) drive *any* ACP agent uniformly. GitHub
   Copilot CLI itself now implements ACP (public preview, Jan 2026), which is the single most
   important integration point for `oh-my-copilot`: Copilot CLI can be driven headlessly by any
   ACP-aware orchestrator, independent of its own plugin/hook system.

For disambiguation: **"Orca"** most likely refers to **Orca by StablyAI** (`stablyai/orca`,
onorca.dev) — a cross-platform (macOS/Windows/Linux + mobile) "AI orchestrator" app explicitly
designed to run Claude Code, Codex, and other coding agents in parallel worktrees, with chat/CLI
views, mobile companion, review/annotate-diff tools, and a CLI/plugin system. A second,
much smaller, unrelated project called **orca-harness / Orcacode** (`okikorg/orca-harness`) is a
Rust-based *standalone terminal coding agent* (a harness, not an orchestrator) and is likely a
false-positive match on the name; it is noted below for completeness but is out of the "manages
multiple harnesses" scope. **"T3 Code"** is confirmed as the open-source "agent harness control
surface" (`pingdotgg/t3code`, t3.codes) from Theo Browne / Ping Labs (makers of t3.gg /
create-t3-app) — not to be confused with "T3 Chat." **"herdr"** is `herdrdev/herdr`
(herdr.dev), a Rust, Apache-2.0, agent-aware terminal workspace/multiplexer. **"rex (beta)"** is
**Rex**, a new terminal in public beta from Mitchell Hashimoto (creator of Ghostty, HashiCorp
co-founder, via his company "Superlogical"), at `superlogical.com/rex`, with an "Activity Mode"
sidebar for tracking coding-agent status across panes/hosts; a community plugin,
`irfn/rex-agents`, adds a herdr-style dedicated agent list panel on top of Rex.

**This research session runs inside the user's `tesseracode/t3code` fork.** Its local
`t3-code-*` tool schemas show the fork's orchestration surface, including Copilot integration.
Those observations must not be attributed to upstream without separate upstream evidence.

---

## 2. Orca (StablyAI)

- **Identity:** `stablyai/orca` on GitHub; product site **onorca.dev**; "The AI Orchestrator for
  100x builders." MIT license. (https://github.com/stablyai/orca, https://www.onorca.dev/)
- **What it does:** Desktop app (macOS/Windows/Linux) + mobile companion (iOS App Store, Android
  APK) that runs Claude Code, Codex, and "any other coding agent" in parallel, each in its own git
  worktree. Supports both a Chat UI and raw terminal CLI view for the same agent conversation,
  interchangeably, without losing context.
  (https://github.com/stablyai/orca#chat-or-terminal)
- **Orchestration model:** A "coordinator" agent can split one big task, spin up worker agents
  each in their own workspace/worktree, and merge their reported results back —
  i.e., built-in **multi-agent task decomposition**, not just parallel independent sessions.
  (https://www.onorca.dev/docs/cli/orchestration)
- **Worktrees:** First-class "Parallel Worktrees" feature — quickly split tasks into isolated
  environments so agents don't interfere with each other.
  (https://www.onorca.dev/docs/model/worktrees)
- **Run anywhere / remote:** Pair a "Remote Orca Server," work on any SSH host, or give a single
  worktree its own cloud VM; agents keep running when the laptop sleeps.
  (https://www.onorca.dev/docs/ways-to-run)
- **Mobile/remote access:** Native iOS/Android companion app — get pinged when an agent needs
  input, reply in chat, keep work moving away from the desk.
  (https://apps.apple.com/us/app/orca-ide/id6766130217, https://www.onorca.dev/docs/mobile)
- **Review/diff flow:** Review diffs, leave inline notes on exact changed lines, send focused
  feedback back to the agent ("Review AI Output" / annotate-diff feature).
  (https://www.onorca.dev/docs/review/annotate-ai-diff)
- **PR integration:** Draft commit messages and PRs directly from the diff; send failing CI
  checks or PR review comments back to an agent to fix.
  (https://www.onorca.dev/docs/review/commit-push)
- **Issue tracker integration:** Native GitHub & Linear integration — see issues in one place,
  start a workspace directly from a Linear issue. (https://www.onorca.dev/docs/review/linear)
- **Scheduling/automation:** "Automations" feature schedules prompts on a repo (nightly dependency
  bumps, weekly triage, flaky-test sweeps), run via the **Orca CLI**, which exposes everything the
  app does (worktree create, start workers, drive browser/desktop apps, schedule automations) to
  scripts or to agents themselves. (https://www.onorca.dev/docs/cli/overview,
  https://www.onorca.dev/docs/cli/automations)
- **Browser/computer-use tooling:** Built-in browser with a "Design Mode" (click an element, copy
  its HTML/CSS/selector into the agent's chat) and generic **Computer Use** support for driving
  desktop apps/external browsers when there's no CLI or API.
  (https://www.onorca.dev/docs/browser/design-mode, https://www.onorca.dev/docs/cli/computer-use)
- **Plugins:** A plugin catalog for themes, editors, languages, and panels, installed in one
  click. (https://www.onorca.dev/plugins)
- **Open-source status / stack:** MIT-licensed; TypeScript (per GitHub API). Live GitHub stats at
  time of writing: **~117k stars, ~7.4k forks**, pushed same-day — i.e., among the most popular
  projects in this entire category (note: this scale of star count for a sub-year-old desktop app
  is unusually high and should be sanity-checked against GitHub's own star history/README badges
  before being treated as fully organic). Supported platforms badge confirms macOS, Windows,
  Linux. (https://github.com/stablyai/orca)
- **Copilot CLI / ACP relevance:** Orca's README does not explicitly mention GitHub Copilot CLI or
  ACP support as of this research pass; its "run any other coding agent" framing plus a generic
  plugin system suggests Copilot CLI could likely be wired in similarly to Claude Code/Codex, but
  this is **inferred, not confirmed**.

### Disambiguation note: orca-harness / Orcacode (`okikorg/orca-harness`)
A separate, much smaller project shares the "Orca" name: Orcacode is a *standalone terminal coding
agent* ("Orca Harness," a Rust kernel), shipped as a ~6.5 MB static binary, with parallel subagent
delegation and a Rust SDK/plugin system. It is a **harness**, not a manager-of-harnesses, so it is
out of this thread's primary scope, but is worth flagging since the name collision is easy to
make. (https://github.com/okikorg/orca-harness, https://orcapods.ai/blog/introducing-orcacode)

---

## 3. T3 Code (pingdotgg/t3code, by Theo Browne / Ping Labs)

- **Identity:** `pingdotgg/t3code` on GitHub; site **t3.codes**; self-described as "an *agent
  harness control surface*." MIT-licensed, open source, explicitly forkable.
  (https://github.com/pingdotgg/t3code, https://t3.codes)
- **What it does:** Orchestrates (does not replace) installed coding-agent CLIs from one surface:
  an Electron desktop app, a web app (app.t3.codes), and native mobile apps (iOS/Android). It is
  explicitly a control plane, not a model reseller: "We built T3 Code because we wanted the best
  possible development experience with agents... inspired by existing solutions like the Codex
  desktop app, Conductor, Claude Desktop and Cursor Glass, but none met our bar."
  (https://github.com/pingdotgg/t3code)
- **Harnesses supported & how driven:** Claude Code, Codex CLI, Cursor CLI, Grok Build CLI,
  OpenCode, Google Antigravity, and "fx" — each via **bring-your-own-subscription**: the user
  installs and authenticates the underlying CLI (`claude auth login`, `codex login`,
  `agent login` for Cursor, `grok login`, `opencode auth login`, Google sign-in for Antigravity,
  `fx login`) on the machine running the T3 Code **server**, and T3 Code drives that already-
  authenticated CLI as a subprocess/session. No API keys are resold and there are no quota caps
  beyond the underlying provider's own limits. (https://github.com/pingdotgg/t3code,
  https://t3.codes) Marketing copy also references "ACP registry agents" as a supported class,
  implying ACP is one of the drive mechanisms alongside direct CLI spawning **[secondary/marketing
  source — not independently confirmed against T3 Code's own technical docs in this pass]**.
- **Architecture:** A local Node.js-style **server** process runs on the user's machine (installed
  via `curl -fsSL https://t3.codes/install.sh | sh`, or `npx t3@latest` to try without installing);
  desktop/web/mobile **clients** connect to that server. `t3 service install` keeps the server
  running in the background; `t3 update` upgrades it. (https://github.com/pingdotgg/t3code)
- **Worktrees & parallel agents:** T3 Code runs agent tasks in **separate git worktrees**, so each
  task/agent gets an isolated checkout with no file collisions; this environment's own T3 Code
  MCP tool surface (`t3-code-t3_worktree_handoff`, `t3-code-t3_worktree_status`,
  `t3-code-t3_worktree_list`) confirms per-thread worktree creation, listing, and handoff as
  first-class primitives, each thread optionally bound to its own branch/worktree. Threads can
  also be delegated to background/child agents (`t3-code-delegate_task`,
  `t3-code-t3_thread_launch`) with configurable isolation (`shared` vs. `worktree`), consistent
  with the "every task writes to its own branch" model described publicly.
- **Snapshots/undo:** Every agent step is snapshotted for comparison and rollback — described in
  third-party write-ups as an "undo any step" safety net for agent output **[secondary source:
  https://luminalog.com/blog/t3code-explained — plausible given the worktree model but not
  independently confirmed against primary T3 Code docs]**.
- **Review/diff/PR flow:** Every agent thread writes to its own branch. "One button to commit,
  push, and make a PR" opens a GitHub PR with an auto-generated title/body/changelog, after an
  inline diff review; supports draft PRs, stacked PRs, and amending PRs, using the user's existing
  GitHub auth. (https://t3.codes) This matches first-hand observation in this environment via
  `t3-code-link_pull_request`, `t3-code-list_thread_pull_requests`,
  `t3-code-read_pull_request_guide`, and `t3-code-watch_pull_request` tools, which watch PR CI
  status/comments/conflicts and wake the orchestrating thread on events.
- **Orchestrator V2 (Claude plans, Codex builds):** A documented workflow where Claude Code drafts
  a plan, hands execution off to Codex running in a separate worktree/thread, and Claude then
  verifies Codex's work against the plan; several Codex threads can run in parallel, each in its
  own worktree, to avoid merge conflicts. As of the research date this was shipping in **nightly**
  builds. (YouTube walkthrough: https://www.youtube.com/watch?v=epSi9U87wz4 — **secondary source,
  video not independently re-verified via a T3 Code changelog entry, but consistent with the
  underlying worktree/branch architecture confirmed from primary docs**)
- **Remote/mobile access:** Native iOS (`T3 Code: Remote Claude & More`,
  https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824) and Android
  (Google Play `com.t3tools.t3code`) apps, plus a web app, all connecting to the same local/remote
  server — i.e., full remote control of agents running on a home/work machine from a phone.
- **Fork-friendliness:** Explicitly designed to be forked wholesale ("If you don't like something,
  fork it" — `gh repo fork pingdotgg/t3code --clone`); UI, agents/tools/flows, and distribution are
  all meant to be user-customizable; monorepo structure visible in the marketing site's own commit
  diff example (`apps/marketing/...`). (https://t3.codes)
- **Open-source status / stack:** MIT license; TypeScript (per GitHub API); packaged for
  Homebrew (`brew install --cask t3-code`), Winget, Scoop, `.deb`, AUR (stable + nightly), and
  Nix (nixpkgs `t3code`). "We are very very early in this project... We are (mostly) not accepting
  contributions yet." (https://github.com/pingdotgg/t3code)
- **Popularity/activity:** Live GitHub stats: **~48.6k stars, ~9.6k forks**, pushed same-day as
  this research — extremely fast growth for a project started ~Feb 2026, reflecting Theo
  Browne/t3.gg's large existing developer audience; marketing copy claims "Tolerated by over
  500,000 devs." (https://t3.codes)
- **Pricing:** Free; BYOS (bring your own subscription) model — no token reselling.
- **Copilot CLI / ACP relevance:** GitHub Copilot CLI was **not** in T3 Code's explicitly listed
  harness set at research time (Claude Code, Codex, Cursor, Grok Build, OpenCode, Antigravity,
  fx). The user's `tesseracode/t3code` fork does add Copilot support; this session uses it.
  Upstream support was not confirmed. The project's stated
  "Add an agent" extensibility model (plus possible ACP-registry support referenced in marketing
  copy) suggests it would be straightforward to add. This is a concrete gap/opportunity worth
  flagging for `oh-my-copilot`: if T3 Code or a similar control-surface project adds Copilot CLI as
  a harness, a Copilot CLI plugin's hooks/skills would very likely continue to work unmodified,
  since T3 Code's model is "drive the CLI you already have installed and authenticated" rather than
  reimplementing agent behavior.

  ---

  ## 4. herdr

  - **Identity:** `herdrdev/herdr` on GitHub; site **herdr.dev**. Apache-2.0 license. Tagline:
    "the runtime your coding agents live on." (https://github.com/herdrdev/herdr, https://herdr.dev)
  - **What it does:** A **tmux-like terminal workspace manager purpose-built for coding agents**,
    not a GUI wrapper around them — herdr shows each agent's *actual* terminal UI inside a pane,
    tracks real session state, and layers workspace/tab/pane organization, persistence, and remote
    access on top. (https://github.com/herdrdev/herdr)
  - **Core mechanics:**
    - **Detach without stopping work** — closing the client or losing the SSH connection does not
      kill agent processes; herdr keeps terminals running in a background server. After a server/
      machine restart it restores the saved pane/tab layout and can *resume* supported agent
      sessions (the original OS processes do not survive a full restart, but herdr can relaunch the
      agent's own resume/continue command). (https://herdr.dev/docs/session-state/)
    - **Several machines, one window** — local work and saved SSH machines are combined into one
      agent list with independent reconnects per host. (https://herdr.dev/docs/connecting-machines/)
    - **State detection** — every pane is automatically marked `idle`, `working`, or `blocked` by
      reading the live bottom of the pane's screen against a per-agent "detection manifest" (no
      custom scripting needed), or by reading an agent's own self-reported state when the agent
      supports herdr natively.
    - **Agent-native automation** — agents can drive herdr themselves through a CLI + **socket API**:
      spawning panes, prompting other agents, and waiting until another agent is *genuinely* blocked
      (not just idle) before proceeding — enabling agent-to-agent coordination scripts.
      (https://herdr.dev/docs/agent-skill/)
    - **Keyboard + mouse both first-class** — tmux-style prefix-key bindings and click/drag/split
      mouse interaction, switchable per moment.
    - **Plugins** — a marketplace extending panes/workflows. (https://herdr.dev/plugins/)
    - **Single static binary, no Electron** — "one rust binary, no electron... runs in whatever
      terminal you already use."
  - **Harnesses supported & how driven:** herdr is explicitly agent-agnostic — "runs what you
    already run: claude code, codex, cursor, opencode, grok and the rest" — and does **not** wrap or
    replace the agent process; it *owns their terminals* (i.e., spawns/attaches the literal CLI
    process inside a managed pane, the same subprocess/tmux-style model as Claude Squad/uzi, but
    with first-party state detection). A detailed support matrix
    (https://herdr.dev/docs/agents/, verified directly) lists two tiers:
    - **"Supported by herdr"** (herdr reads state from on-screen output, with an optional
      `herdr integration install <name>` for session-resume support): **Claude Code, Codex,
      GitHub Copilot CLI, Cursor Agent CLI, OpenCode, Pi, OMP, Droid, Devin CLI, Kimi Code CLI,
      Kilo Code CLI, Hermes Agent, Qoder CLI, Qwen Code, Letta Code, MastraCode, Grok CLI,
      Antigravity CLI**, plus lighter "state only" support for Amp, Kiro CLI, Maki, Gemini CLI, and
      Cline.
    - **"Supported by the agent"** (the agent itself reports state to herdr, nothing to install):
      Command Code, Crush (charmbracelet/crush), Kiro CLI, Muse Code, and Prime Agent.
    - **GitHub Copilot CLI is explicitly and directly supported** (`copilot` integration, installed
      via `herdr integration install copilot`) — this is one of the clearest and most directly
      confirmed Copilot CLI integrations found across this entire research thread.
      (https://herdr.dev/docs/agents/)
    - **VM/sandbox wrapper support:** on Linux/macOS, if a sandbox wrapper hides the real agent
      process from herdr, setting `HERDR_AGENT=<agent>` on the wrapper command (e.g.
      `HERDR_AGENT=claude fence -- claude`) tells herdr which detection manifest to use for that
      foreground process — useful for agents run inside containers/sandboxes.
  - **Remote/mobile access:** Remote machines via SSH are first-class (see "several machines, one
    window" above); no dedicated mobile app was found — herdr is terminal-native, used via its own
    CLI/TUI client rather than a phone app.
  - **Open-source status / stack:** Apache-2.0 license; **Rust**, single static binary; install via
    `curl -fsSL https://herdr.dev/install.sh | sh`, `brew install herdr`, `mise use -g herdr`, or a
    Windows PowerShell installer (plus an "endpoint-protected Windows" beta mode).
    (https://github.com/herdrdev/herdr)
  - **Popularity/activity:** Live GitHub stats: **~48.3k stars, ~3.9k forks**, pushed within the
    last few days of this research — created ~March 2026, implying very rapid adoption; listed on
    Homebrew core (`formulae.brew.sh/formula/herdr`).
  - **Pricing:** Free and open source; no paid tier found in docs.
  - **Copilot CLI / ACP relevance:** Direct, first-class, explicitly documented GitHub Copilot CLI
    support (state detection + optional session-resume integration) makes herdr one of the two or
    three clearest "already works with oh-my-copilot's host CLI" tools in this whole landscape.
    Since herdr attaches to Copilot CLI's *real* terminal process rather than reimplementing it, any
    `oh-my-copilot` plugin behavior (slash commands, hooks, skills) should be fully preserved when
    Copilot CLI is run inside a herdr pane — herdr only reads the pane's screen output for state and
    does not intercept or rewrite Copilot CLI's stdin/stdout stream content. No explicit ACP support
    was found in herdr's docs; its integration model is screen-scraping + optional self-reporting,
    not JSON-RPC/ACP.

  ---

  ## 5. Rex (beta) — Mitchell Hashimoto's new terminal

  - **Identity:** **Rex**, a terminal application in public beta, built by **Mitchell Hashimoto**
    (co-founder of HashiCorp, creator of Ghostty), under a company/site branded **Superlogical**, at
    **superlogical.com/rex**. Tagline: "the multiplexer for all work."
    (https://www.superlogical.com/rex/docs/, https://en.theblockbeats.news/flash/371371)
  - **Platform/status:** macOS application and a Linux/FreeBSD server component, available to beta
    testers as of this research. Configuration is written in **Lua** (`init.lua`), with custom
    actions (`rex.action`), key bindings (`rex.bind`/`rex.unbind`), key sequences/modes, and Lua
    event hooks (`rex.on`) for reacting to terminal events (directory changes, program exit, window
    close, session creation). (https://www.superlogical.com/rex/docs/)
  - **Activity Mode — the key orchestrator feature:** Rex's standout feature for this report is
    **Activity Mode**, a centralized sidebar listing every running or recently-idle program/coding
    agent across panes, with task status, letting a user jump directly to whichever terminal needs
    attention. (https://en.theblockbeats.news/flash/371371) This is powered by an open protocol:
  - **Program Status Protocol (OSC 7501):** A terminal escape sequence that lets *any* program
    proactively tell the terminal whether it is idle, working, waiting on the user, finished, or
    failed, and why — documented at
    https://www.superlogical.com/rex/docs/build/program-status. Claude Code and Codex emit this
    status natively ("out of the box"); other agents without native emission (OpenCode, Pi, etc.)
    still show up in the panel via weaker signals (e.g., terminal title parsing for Claude Code's
    `✳`/spinner glyphs). Mitchell Hashimoto has stated the team historically disliked typical task-
    notification panels for being noisy, and spent "several weeks" tuning Rex's status-aggregation
    rules to avoid alert fatigue; beta feedback has reportedly been positive.
    (https://en.theblockbeats.news/flash/371371)
  - **Agent automation primitives:** Rex ships a **built-in agent skill** letting agents like Claude
    Code or Codex directly open tabs, split panes, read a terminal's screen content, and control
    connected Rex apps/hosts — i.e., agents can drive Rex itself, similar to herdr's socket API
    concept. (https://www.superlogical.com/rex/docs/automate/agent-skill.md) A full CLI (`rex`) and
    a documented, self-describing **Server API** (list methods, inspect args/results, call them) are
    also available for scripting. (https://www.superlogical.com/rex/docs/automate/cli.md,
    https://www.superlogical.com/rex/docs/automate/server-api.md)
  - **Remote hosts:** Rex supports connecting to other Rex servers (`rex hosts`) for cross-machine
    session management, surfaced in the community `rex-agents` plugin's "Remote hosts" section
    (see below) with per-host agent/session lists and unreachable-host detection.
  - **Community plugin — `irfn/rex-agents`:** A third-party plugin (MIT license, tiny — 1 GitHub
    star at time of writing, created Oct 2026) that adds a dedicated, herdr-style agent-list panel
    to Rex: one row per coding agent (not per tab), sorted by urgency (🔴 waiting > ❌ failed >
    ✅ done > ⏳ working > 💤 idle), showing git branch/dirty state per agent, Claude Code's own
    `/rename` session name, usage/plan-limit bars (5-hour and weekly, read from local files such as
    `ai-usage`, no API keys needed), and keybindings to jump straight to whichever agent is waiting.
    Agents must emit OSC 7501 to appear; Claude Code and Codex do this "out of the box"; OpenCode and
    Pi panes are listed but only as idle (no waiting-state support) unless they also emit the
    protocol. (https://github.com/irfn/rex-agents) Installable via the `Amber` Lua plugin manager or
    by hand-cloning into `~/.local/share/rex/plugins/`.
  - **Harnesses supported & how driven:** Rex and its plugins are agent-agnostic at the protocol
    level — any program that emits OSC 7501 (or is detected via title-parsing heuristics) shows up
    in Activity Mode / the agents panel, which is architecturally identical to herdr's own "state
    only" vs. "integration installed" tiers. Confirmed compatible agents (from the `rex-agents` repo
    README): Claude Code, Codex, OpenCode, Pi.
  - **Open-source status:** Rex itself (the terminal application and server) appears to be
    **closed-source/proprietary** (no GitHub org/repo found for "Rex" or "Superlogical" containing
    the terminal's source, only documentation served from superlogical.com); the OSC 7501 *protocol*
    itself is openly documented and implementable by any program, and third-party plugins like
    `rex-agents` are open source (MIT) and hosted on GitHub.
  - **Popularity/activity:** Public beta stage; community engagement centers on a "Rex Beta Discord"
    (the docs site even exposes an MCP server, OAuth-gated to Discord members, for querying docs +
    community feedback — https://www.superlogical.com/rex/community-mcp). Given Mitchell
    Hashimoto's profile (Ghostty, HashiCorp/Terraform/Vagrant) and the recency of the beta, exact
    install-base/popularity numbers were not found and should be treated as **early-stage/unverified
    at scale**.
  - **Pricing:** Not disclosed in docs found during this research pass — likely still pre-pricing
    given beta status. **[unverified]**
  - **Copilot CLI / ACP relevance:** No explicit mention of GitHub Copilot CLI support was found in
    Rex's docs or the `rex-agents` plugin (Copilot CLI is not in the plugin's confirmed-agent list).
    Because Copilot CLI does not natively emit OSC 7501 (as of this research), it would currently
    only appear as a generic "idle" terminal in Rex's Activity Mode rather than with rich
    waiting/working/failed status, *unless* Copilot CLI adds native Program Status Protocol support
    or a herdr-style external detection manifest is built for it. This is a concrete, low-effort
    integration opportunity for `oh-my-copilot`: emitting OSC 7501 escape sequences (or documenting
    how to configure one) would make Copilot CLI sessions "just work" with both Rex's Activity Mode
    and any OSC-7501-aware tool, without needing Rex-specific plugin code.

---

## 6. Notable others — local/desktop orchestrators

### 6.1 Conductor (conductor.build)

- Native **macOS app**. Each task gets an isolated workspace (branch, files, terminal, diff,
  review path); supports parallel agents in separate tabs/workspaces; built-in diff viewer, PR
  creation, merge/archive flow; "Plan Mode"/"Fast Mode" and reasoning-effort controls.
  (https://www.conductor.build/, https://www.conductor.build/docs)
- **Harnesses & how driven:** Claude Code, Codex, and OpenCode are **bundled** (no separate
  install needed); Cursor is driven via the **Cursor API** rather than a spawned CLI. No GitHub
  Copilot CLI support found. (https://www.conductor.build/docs/reference/harnesses)
- **Closed-source**, proprietary; free to use, "we do not bill or resell model usage" — harness
  usage is billed through the user's own provider account/API key.
- **Notable idea:** "Codex goals" — a standing objective Codex keeps pursuing across turns without
  a fresh prompt each time (local workspaces only, not yet in cloud workspaces).
- T3 Code's own README explicitly cites Conductor as one of its direct inspirations
  (https://github.com/pingdotgg/t3code).

### 6.2 Claude Squad (`smtg-ai/claude-squad`)

- Terminal (TUI) app, **Go**, **AGPL-3.0**. Each task/instance gets an isolated **git worktree**
  plus its own **tmux session**; review diffs before applying, checkout changes before pushing, a
  background/"yolo" auto-accept mode (`--autoyes`). (https://github.com/smtg-ai/claude-squad)
- **Harnesses & how driven:** Claude Code (default), Codex, Gemini CLI, Aider, and other local
  agents, via a configurable `program` field per profile — plain subprocess spawning inside a tmux
  pane, no SDK/ACP layer. Requires `tmux` and `gh` as prerequisites.
- **Popularity:** live GitHub stats **~8.7k stars, 623 forks**; created Mar 2025, still actively
  maintained (pushed Aug 2026).
- **Copilot CLI/ACP:** not in the documented supported-program list; no ACP mention.
- Its `--autoyes` auto-accept design is explicitly criticized by **CCManager** (below) as
  "bypass[ing] Claude Code's built-in security confirmations" — a useful cautionary design note.

### 6.3 vibe-kanban (`BloopAI/vibe-kanban`)

- A **Kanban board** for planning + orchestrating coding agents: each workspace gives an agent a
  branch, terminal, dev server; diff review with inline comments sent directly back to the agent;
  built-in browser preview with devtools/inspect/device emulation; opens PRs with AI-generated
  descriptions. (https://github.com/BloopAI/vibe-kanban)
- **Harnesses & how driven:** 10+ agents — Claude Code, Codex, Gemini CLI, **GitHub Copilot CLI**,
  Amp, Cursor, OpenCode, Droid, Claude Code Router, Qwen Code
  (https://www.vibekanban.com/docs/supported-coding-agents) — each driven via a Rust
  `StandardCodingAgentExecutor` trait, spawned as an isolated subprocess inside its own git
  worktree by a `ContainerService`, with logs normalized back to the UI.
- **Apache 2.0**, Rust + TypeScript/pnpm monorepo; install via `npx vibe-kanban`.
- **Popularity:** live GitHub stats **~28.6k stars, ~3.1k forks** — one of the most-starred tools
  in this entire category.
- **Status:** the company behind it (bloop) **shut down** the business (announced it couldn't find
  a sustainable model since most users were free); code continues as community-maintained open
  source, while the hosted cloud/kanban services wind down.
  (https://vibekanban.com/blog/shutdown)
- **Copilot CLI/ACP:** explicit first-party **GitHub Copilot CLI** executor support is documented
  — vibe-kanban drives `copilot` as a direct CLI subprocess (not via ACP). This is one of the
  clearest confirmed Copilot CLI integrations in this report.

### 6.4 Crystal → Nimbalyst (`stravu/crystal` → `Nimbalyst/nimbalyst`)

- **Crystal is deprecated** (as of Feb 2026) and fully replaced by **Nimbalyst**, an "AI-native
  workspace": Electron desktop app (macOS/Windows/Linux) + iOS companion. WYSIWYG editors
  (markdown, mockups, Mermaid, Excalidraw, CSV, data models, Monaco code editor) where human and
  agent edit the same files; red/green diff review stepped through in the rendered document;
  **parallel agent sessions each isolated in its own git worktree**; session kanban board; MCP
  client/servers with visual widget rendering; iOS companion for replying to agents, swiping
  diffs, push notifications. (https://github.com/Nimbalyst/nimbalyst)
- **Harnesses:** Codex, Claude Code, OpenCode "side by side," plus **GitHub Copilot CLI listed as
  "alpha"** support and a Gemini provider. Exact drive mechanism (subprocess vs. ACP) not
  explicitly documented.
- **Free and MIT-licensed**; live GitHub stats **~2.0k stars, ~333 forks** (new repo, created Oct
  2025; the legacy Crystal repo had ~3.1k stars/196 forks before deprecation).
- **Notable idea:** "Extension SDK" — every built-in editor, including the code editor, goes
  through the same `EditorHost` contract, so a community-built editor for a new file type is
  first-class rather than a plugin bolt-on.

### 6.5 Sculptor (Imbue) — `imbue-ai/sculptor`

- Desktop app (Mac Apple Silicon, Linux) for running coding agents in **isolated containers**
  (explicitly *not* git worktrees) in parallel — positioned against worktrees because "containers
  keep your machine safe" vs. worktrees sharing the local environment/dependencies. "Pairing
  Mode" syncs an agent's container work bidirectionally into the local repo/IDE for instant
  testing; merge-with-conflict-flagging; resumable session history (plans/chats/tool
  calls/code). (https://imbue.com/blog/sculptor-announce, https://github.com/imbue-ai/sculptor)
- **Harnesses:** ships with integrated support for **Claude Code** and Imbue's own **"Pi" agentic
  harness** (pi.dev); can also run/manage any generic terminal-based agent; Codex support added
  via pasting an OpenAI API key.
- **Not truly open source yet** — the repo is public, but Imbue states they "don't have the
  bandwidth to take on a large volume of external contributions... it's not truly open source
  until the community is involved." Live GitHub stats **~245 stars, 20 forks**; MIT license,
  Python.
- **Notable idea:** explicit anti-worktree design philosophy — full container isolation avoids
  dependency reinstallation and shared-local-env corruption, at the cost of being heavier-weight
  than a worktree.
- **Copilot CLI/ACP:** no mention found.

### 6.6 Terragon (terragonlabs) — SHUT DOWN

- Cloud-based coding agent orchestration (ran agents in cloud sandboxes). **Officially shut down
  February 9, 2026** — its website now serves only a "Terragon Shutdown" notice. No live product
  remains to evaluate; secondary sources claim a final code snapshot was released "as-is" with
  migration recommendations toward Claude Code Web / Codex Web, but this was **not independently
  verified** beyond the shutdown page itself. A cautionary data point on category volatility.

### 6.7 Omnara (`omnara-ai/omnara`)

- Originally launched (YC S25, Aug 2025) as a mobile "mission control"/remote-control tool
  specifically for Claude Code (`pip install omnara && omnara` syncs a local Claude Code session
  to Omnara's web/iOS apps for remote review, voice input, cloud-sandbox failover). Current docs
  reposition it as a broader **"open-source managed agent platform"** — agents defined via YAML
  (instruction, model, tools, machine sources), launched via dashboard/CLI/REST+TypeScript SDK,
  streaming events for mobile/web monitoring with human-in-the-loop "ask_question" interactions.
  (https://github.com/omnara-ai/omnara, https://docs.omnara.com/introduction)
- **Apache 2.0**; self-hostable (Docker Compose) or "Omnara Cloud" (app.omnara.com); Go backend +
  TypeScript SDK. Live GitHub stats **~3.4k stars, 261 forks**.
- **Copilot CLI/ACP:** current official docs don't mention Copilot CLI; older secondary sources
  claimed broader tool support (Cursor, Codex, Copilot) but this is **unverified** against the
  current primary docs — treat the original "mobile remote for Claude Code" framing as historically
  accurate but possibly superseded by the pivot.

### 6.8 Happy (`slopus/happy`, "Happy Coder")

- Open-source, multi-surface (iOS/Android native apps, desktop, web, CLI) orchestrator across a
  multi-repo project (`happy`, `happy-desktop`, `happy-agent`): subagents on different models can
  message each other; scheduled messages; persistent bots; durable sessions surviving restarts;
  **Git worktrees on their own branch** for parallel work; end-to-end encrypted mobile sync;
  natively multiplayer (invite a colleague to watch/steer the same session).
  (https://github.com/slopus/happy, https://happy.engineering/welcome/)
- **Harnesses & how driven:** Claude (native Claude Code), Codex (native), Grok (Grok Build),
  Gemini (via Google's Antigravity), and explicitly: **"any Agent Client Protocol (ACP) agent can
  run too (beta)"** — reuses existing CLI subscriptions already on the machine rather than
  requiring a Happy account for model access.
- **MIT-licensed**; native Swift/UIKit iOS app, native Kotlin/Jetpack Compose Android app, a
  relay server that only ever sees encrypted ciphertext, Cloudflare Worker for push.
- **Popularity:** live GitHub stats **~24.5k stars, ~2.1k forks** — very high activity, pushed the
  same day as this research; App Store rating 4.9★ (1,000+ ratings), Google Play 5.0★ (3.1k+
  reviews).
- **Pricing:** free/MIT; only voice-in-the-phone-app feature is paid (20 free min/30 days, then
  subscription, or bring your own ElevenLabs agent for unlimited use).
- **Copilot CLI/ACP:** this is the **clearest explicit ACP confirmation** found among all the
  local-orchestrator tools in this report ("any ACP agent can run too (beta)") — since GitHub
  Copilot CLI implements ACP (see §9), Happy should in principle already be able to drive Copilot
  CLI as a generic ACP agent, even without Happy-specific Copilot code, though this exact
  combination was not independently tested in this research pass.
- **Notable idea:** "Auto mode" — reads and workspace edits run freely while everything else is
  OS-sandboxed, with only boundary-crossing actions auto-reviewed, rather than prompting the user
  for every action.

### 6.9 opcode (formerly Claudia, `winfunc/opcode`)

- Desktop GUI (**Tauri 2**: Rust backend + TypeScript/React frontend) — a "command center" for
  **Claude Code only**: visual project/session browser (reads `~/.claude/projects/`), session
  history/resume, custom "CC Agents" (system prompts run as background processes), usage/cost
  analytics dashboard, MCP server management UI, timeline/checkpoints for branching/reverting
  conversation history, CLAUDE.md management. (https://github.com/winfunc/opcode)
- **AGPL-3.0**; explicitly "not affiliated with Anthropic." Live GitHub stats **~22.4k stars,
  ~1.7k forks**.
- Single-harness tool (Claude Code only) — no Copilot CLI/ACP relevance.

### 6.10 CCManager (`kbwo/ccmanager`)

- Self-contained terminal UI (**no tmux dependency**, unlike Claude Squad) managing multiple
  coding sessions across git worktrees and **multiple projects/repos simultaneously**, with
  real-time per-session Busy/Waiting/Idle state in the menu; create/merge/delete worktrees
  in-app; restore sessions after crash/restart; copy Claude Code session data between worktrees
  to preserve context; `.worktreeinclude` to carry gitignored files (`.env`, certs) into new
  worktrees; devcontainer integration; status-change hooks and post-creation worktree hooks for
  automation/notifications. (https://github.com/kbwo/ccmanager)
- **Harnesses & how driven:** Claude Code, Gemini CLI, Codex CLI, Cursor Agent, **Copilot CLI**
  (explicitly mapped `copilot` → `github.com/github/copilot-cli` in its program table), Cline CLI,
  OpenCode, Kimi CLI — all launched as configurable shell `program` commands per preset, i.e.,
  direct subprocess spawning.
- **MIT**; TypeScript, built with Bun; `npm install -g ccmanager`. Live GitHub stats **~1.3k
  stars, 94 forks** — smaller but actively maintained.
- Explicitly contrasts itself against Claude Squad (no tmux dependency, real-time state
  visibility, and criticizes `--autoyes` as unsafe).
- **Copilot CLI/ACP:** direct, first-class **Copilot CLI** support as a spawnable subprocess
  binary — one of the clearest confirmed Copilot CLI integrations in this report; no ACP support
  mentioned.

### 6.11 uzi (`devflowinc/uzi`)

- Go CLI for running many coding agents in parallel git worktrees + **tmux sessions**, with
  automatic per-agent dev-server port management (`uzi.yaml` with `devCommand`/`portRange`),
  real-time monitoring (`uzi ls -w`), broadcast messaging to all agents (`uzi broadcast`),
  auto-confirming trust/continuation prompts (`uzi auto`), checkpoint/rebase-merge workflow (`uzi
  checkpoint`). (https://github.com/devflowinc/uzi)
- **Harnesses:** any CLI tool, via `--agents claude:3,codex:2` syntax — spawns each as its own
  tmux window/pane in its own git worktree; purely subprocess/tmux-based and agent-agnostic by
  design.
- **MIT**; Go; requires Git + Tmux + Go. Live GitHub stats: **582 stars, 29 forks, last pushed
  June 2025** — stale relative to the Nov 2026 research date, suggesting the project is dormant.
- **Notable idea:** agent instances get randomly generated human names (e.g., "brian," "gregory")
  for easy reference in `uzi ls`/`uzi checkpoint <name>`.
- **Copilot CLI/ACP:** no explicit mention; generic enough to run `copilot` as an arbitrary agent
  binary but untested/undocumented for it.

### 6.12 Amp (Sourcegraph) — "parallel threads" / Orbs / Runners / Puck

- Amp is primarily **a coding agent**, not an external-harness orchestrator (it uses its own
  model/agent stack, not spawned third-party CLIs) — included here because its parallelism
  features are directly comparable:
  - **Orbs** — ephemeral cloud machines Amp creates per thread with code/tools/plugins
    pre-configured; closing the laptop does not stop the agent.
  - **Runners** (Sept 2026) — a local/self-hosted machine that can create **git worktrees
    directly from the thread composer** (pick a repo, hit Tab, name a branch, start in a fresh
    checkout like `~/code/amp-fix-flaky-login-test`), with one-click "Archive and Remove
    Worktree" cleanup (`git worktree remove` + branch delete).
  - **Shared Runners** (Sept 2026) — a runner started with `--share` lets anyone in a workspace
    start threads on that machine from ampcode.com.
  - **Puck** — an orchestrator persona/bot that launches and coordinates agents, and can itself
    pass a worktree name through to sub-threads; "Many, Many Pucks" supports multiple independent
    concurrent Puck conversations.
  - "Steer, Don't Queue" — mid-run messages steer the running agent immediately instead of
    queuing.
- Amp itself is closed-source/commercial; some example/automation repos are open. "Free Agent"
  (Sept 2026): free to use bringing your own compute/model subscription/keys; a separate option
  lets users spend an existing Claude subscription inside Amp for free.
- **Copilot CLI/ACP:** no evidence of Copilot CLI or ACP integration found in Amp itself — it is
  structurally different from the other local tools in this report (an agent with its own
  parallelism features, not a wrapper around external CLIs).

---

## 7. Cloud / IDE-vendor agent management platforms

### 7.1 Cursor — Background Agents / Cloud Agents

- Cursor's remote agents (originally "Background Agents," renamed **Cloud Agents**) run coding
  tasks in isolated cloud VMs rather than locally, so work continues with the laptop closed/
  offline. "You can run as many agents as you want in parallel"; supports multi-repo environments
  (one agent touching separate frontend/backend/infra repos, opening PRs across each).
  (https://cursor.com/docs/cloud-agent)
- **Environments:** agent-led setup, saved snapshots, or a Dockerfile via
  `.cursor/environment.json`; can use browser/desktop "computer use," connect MCP servers, use
  Tailscale for private networks, or run on **Self-Hosted Machines** for on-prem execution.
- **Entry points:** iOS app, `cursor.com/agents` web (installable as a PWA on Android), desktop,
  **Slack** (`@cursor`), commenting `@cursor` on a GitHub/GitLab/Bitbucket PR or issue, Linear
  `@cursor`, and a public API.
- **Automations:** scheduled or event-triggered agent runs (e.g., on new PRs, Slack messages)
  **[named feature per secondary source, not independently re-verified against an official
  cursor.com page in this pass]**.
- Requires a paid Cursor plan; billed through Cursor, not BYOS like T3 Code/Orca.
- **Copilot CLI/ACP:** no evidence Cursor's Cloud Agents drive Copilot CLI or implement ACP as a
  client; separately, **Cursor CLI itself is listed as an ACP agent** in Zed's and the ACP
  registry's "Common Agents" (see §9) — i.e., Cursor is more often the *driven* agent than the
  driver, in the ACP ecosystem.

### 7.2 OpenAI Codex — Codex Cloud

- "Give Codex coding tasks to work through in the cloud... Each task has its own workspace and
  can keep working while your computer is asleep." Flow: choose repos → Codex inspects the
  project and prepares setup/dependencies → tasks run from a **published, versioned environment**
  with configured network egress limited to allowed HTTPS destinations/secrets → review changed
  files, request follow-ups, commit, or open a PR. (https://learn.chatgpt.com/docs/cloud)
- Multiple tasks can run concurrently against the same published environment with separate
  working state per task.
- Accessible from ChatGPT web, desktop, and mobile apps; the **Codex CLI can also start a cloud
  task or list/check recent cloud chats** directly ("Start cloud work from the CLI").
- GitHub integration (`@codex` mentions on issues/PRs, a `codex-action` GitHub Action for CI
  automation) is referenced by secondary sources but was **not independently re-verified** against
  an OpenAI primary doc in this pass.
- As part of GitHub's Agent HQ (see §7.3), Codex is also reachable directly inside VS Code
  Insiders for Copilot Pro+ users.
- **Copilot CLI/ACP:** Codex CLI is listed as an ACP agent (via a community `codex-acp` adapter)
  in the ACP registry — again, Codex is typically the *driven* agent in ACP contexts, not an
  orchestrator of other harnesses.

### 7.3 GitHub Copilot coding agent + Agent HQ / Mission Control

- **Copilot coding agent:** assigning a GitHub Issue to "Copilot" (via assignee, mobile, CLI, or
  the `assign-to-agent`/`create-agent-session` Actions) spins up an isolated cloud dev environment
  (via GitHub Actions), which reads the issue + repo context +
  `.github/copilot-setup-steps.yml`, writes code, runs tests, and pushes to a **draft PR** for
  human review — Copilot cannot merge or deploy itself.
  (https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/)
- **Agent HQ / Mission Control** (announced GitHub Universe, Oct 2025; verified directly from
  https://github.blog/news-insights/company-news/welcome-home-agents/): "Agent HQ transforms
  GitHub into an open ecosystem that unites every agent on a single platform." Coding agents from
  **Anthropic, OpenAI, Google, Cognition, and xAI** become directly available in GitHub as part of
  a paid Copilot subscription. Day one: Copilot Pro+ users could use **OpenAI Codex inside VS Code
  Insiders** immediately — "the first of our partner agents to extend beyond its native surfaces
  and directly into the editor." Quotes: OpenAI's Alexander Embiricos; Anthropic's Mike Krieger
  ("Claude can pick up issues, create branches, commit code, and respond to pull requests");
  Google Labs' Kathy Korevec (Jules becoming "a native assignee").
- **Mission control:** "a single command center to assign, steer, and track the work of multiple
  agents from anywhere" — a consistent interface (not one destination) across **GitHub web, VS
  Code, mobile, and CLI**, letting users "choose from a fleet of agents, assign them work in
  parallel, and track their progress from any device."
  (https://github.blog/changelog/2025-10-28-a-mission-control-to-assign-steer-and-track-copilot-coding-agent-tasks/)
- **Enterprise additions:** branch controls (granular CI/check gating for agent-authored code),
  identity/access-policy management for agents like any team member, one-click merge-conflict
  resolution, Slack/Linear integrations (alongside existing Jira, MS Teams, Azure Boards,
  Raycast), an org-wide control plane governing agent behavior, and a metrics dashboard.
- **VS Code additions:** Plan Mode (Copilot asks clarifying questions, builds a step-by-step plan
  before writing code); custom agents via source-controlled `AGENTS.md`; a GitHub MCP Registry in
  VS Code for one-click MCP server installs; agentic code review; GitHub Code Quality (org-wide
  maintainability/reliability reporting).
- As of a Jan 2026 changelog, **Copilot itself is now also usable as an ACP agent** — extending
  "any agent, any surface" beyond GitHub's own UI into any ACP-aware client.

### 7.3b Copilot CLI plugins & ACP — the key integration surface for `oh-my-copilot`

- **Plugin system** (directory with `plugin.json` manifest, optional custom agents
  `*.agent.md`, skills `SKILL.md` bound to slash commands, hooks `hooks.json`, MCP configs
  `mcp-config.json`; installed via `copilot plugin install <source>`, managed via `copilot plugin
  enable/disable/list`, state tracked in persisted configuration rather than session memory).
- **Hooks** (verified directly,
  https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks):
  repo-level hooks in `.github/hooks/*.json`; user-level hooks in `~/.copilot/hooks/` (or
  `$COPILOT_HOME/hooks/`). Lifecycle events: `sessionStart`, `sessionEnd`, `userPromptSubmitted`,
  `preToolUse`, `postToolUse`, `errorOccurred`, `agentStop`. Each hook runs bash/PowerShell with
  optional `cwd`/`timeoutSec`/`env`, receives JSON event payloads on stdin, and can block actions
  via exit code. Docs state explicitly: "Changes to hook configurations are loaded when the CLI
  starts."
- **ACP support** (verified directly, https://github.blog/changelog/2026-01-28-acp-support-in-copilot-cli-is-now-in-public-preview/,
  Jan 28 2026): "GitHub Copilot CLI now implements the Agent Client Protocol (ACP)... This enables
  third-party tools, IDEs, and automation systems to integrate directly with Copilot's agentic
  capabilities." Launch via `copilot --acp` (stdio) or `copilot --acp --port 8080` (TCP). ACP
  clients can initialize connections, discover capabilities, create isolated sessions with custom
  working directories, send prompts (text/images/context resources), get streaming updates,
  respond to permission requests, and cancel/manage session lifecycle. Explicit use cases:
  IDE integrations, CI/CD orchestration, custom frontends, and **multi-agent systems**
  ("Coordinate Copilot with other AI agents using a standard protocol"). Official ACP server docs:
  https://docs.github.com/copilot/reference/acp-server. Corroborated by the ACP agents registry
  (https://agentclientprotocol.com/get-started/agents.md — "GitHub Copilot (in public preview)")
  and by Zed's docs (https://zed.dev/docs/ai/external-agents), which list Copilot as a "Common
  Agent" installable as an ACP External Agent in Zed's Agent Panel.
- **Conclusion — the two extension surfaces are independent:** the **hooks/plugins system**
  extends/customizes Copilot's own local behavior; **ACP mode** exposes Copilot itself as a
  drivable agent backend to any ACP-aware client/editor (Zed, JetBrains, VS Code extensions, Devin
  Desktop, etc.). Since both read config from the filesystem at CLI **startup** rather than being
  injected by the parent process, **a `oh-my-copilot` plugin's hooks/skills should keep working
  whether Copilot CLI is run interactively by a human, spawned as a subprocess by an orchestrator
  (CCManager, vibe-kanban, herdr, Claude Squad), or driven headlessly over ACP** — *provided* the
  working directory/repo context passed to the subprocess still contains the relevant
  `.github/hooks/`/`.github/plugin/` files, and the user's `~/.copilot/` home directory is
  reachable from that subprocess's environment. Container-isolated tools (e.g., Sculptor's Docker
  sandboxes) could break user-level hooks/plugins unless those paths are explicitly mounted — this
  is an inference from the documented file-based config mechanism, not independently
  tested/confirmed in any specific orchestrator's own docs.
- Of the local tools surveyed in §6, only **CCManager**, **vibe-kanban**, and **herdr** explicitly
  document first-class Copilot CLI support as a spawnable agent; Nimbalyst lists it as "alpha."

### 7.4 Google Jules

- "An experimental coding agent that helps you fix bugs, add documentation, and build new
  features. It integrates with GitHub, understands your codebase, and works autonomously."
  (https://jules.google/docs) Sign in at jules.google.com, connect GitHub, select repos.
- **VM sandbox / workflow:** Jules runs in a VM where it clones code, installs dependencies, and
  modifies files; user picks repo + branch, writes a prompt, optionally adds environment setup
  scripts, clicks "Give me a plan" — Jules generates a plan the user must **review and approve
  before any code changes are made**.
- Automatically looks for an `AGENTS.md` at the repo root for codebase conventions. Async —
  users can leave while Jules works; browser notifications alert on completion or when input is
  needed.
- Concurrent task limits scale with Google AI Pro/Ultra subscription tier; a **Jules Tools** CLI
  and a REST API allow scripted/automated task management; a GitHub Action
  (`google-labs-code/jules-action`) supports CI/CD; MCP support for tools like Linear, Stitch,
  Neon **[secondary sources for this paragraph, consistent with Google's positioning but not
  independently refetched this pass]**.
- Per GitHub's Agent HQ announcement, Jules becomes "a native assignee" within GitHub's mission
  control.

### 7.5 Devin (Cognition Labs)

- **Devin can manage Devins:** a parent Devin session can break a large task into scoped pieces
  and delegate each to a **"managed Devin"** — a full Devin instance in its own isolated VM with
  its own terminal/browser/dev environment, able to run shell commands/tests and verify its own
  changes. The parent session acts as **coordinator**: scopes work, assigns pieces, monitors
  progress, resolves conflicts, compiles results, and can read full trajectories of child sessions
  to improve future task breakdowns. (https://cognition.com/blog/devin-can-now-manage-devins)
  Coordinator capabilities: spin up managed Devins; message child sessions mid-task; monitor ACU
  (compute) consumption per child; put child sessions to sleep or terminate them; schedule
  follow-up self-messages. Example uses: parallel QA across app pages, large codebase migrations,
  security/dependency audits (one session per package), bulk refactors.
- **Devin Desktop 2.0's Agent Command Center**
  (https://docs.devin.ai/desktop/agent-command-center) manages every agent running — both
  **local agents** (in-editor sessions) and **cloud agents** (Devin VM sessions) — from a single
  view: duplicate/branch a session from a response footer, editable queued messages, a sidebar
  listing/filtering/grouping sessions per workspace, "start child session," and unified native OS
  notifications across **Devin Local and ACP agents alike** ("one notification per session rather
  than one per surface") — notably, Devin Desktop can itself **host/drive ACP agents**, confirming
  a second major vendor (besides Zed) building ACP support into its own management UI.
- Enterprise features (SSO/SCIM, RBAC, Slack/PagerDuty/Sentry triggers) are documented by Cognition
  but weren't independently re-fetched in this pass **[secondary source for this bullet]**.

### 7.6 OpenHands (formerly OpenDevin)

- `OpenHands/OpenHands` on GitHub — MIT-licensed, open-source autonomous SWE agent platform,
  originally a community response to closed-source Devin, with academic (CMU, UIUC) and industry
  contributors. Live GitHub stats confirmed via API: **~92.8k stars, ~12.4k forks** — one of the
  largest projects in this entire report by star count. (https://github.com/OpenHands/OpenHands)
- **Sandbox model:** executes agent actions inside an isolated **Docker container** (official
  agent-server image `ghcr.io/openhands/agent-server:latest-python`), with the local project
  optionally bind-mounted (`SANDBOX_VOLUMES=$PWD:/workspace:rw`).
  (https://docs.openhands.dev/openhands/usage/sandboxes/docker)
- **Multi-agent/multi-harness orchestration:** supports delegating to different underlying coding
  harnesses/models via the **Agent Client Protocol** — confirmed in the official ACP agents
  registry, with its own doc page: https://docs.openhands.dev/openhands/usage/run-openhands/acp.
  This makes OpenHands dual-purpose: both an ACP-capable **agent** (drivable by ACP clients like
  Zed) and historically an orchestration platform in its own right.
- Browser-based chat UI, event-based architecture logging every action/decision for full
  replay/audit, extensible Python/TypeScript SDK, self-hostable for on-prem/enterprise use.

### 7.7 Warp terminal — Agent Mode / "Warp Code"

- Warp's **Agent Mode** turns the terminal into an agentic environment: natural-language tasks
  decompose into shell command sequences, executed with per-command (and extra-strict
  per-destructive-action) approval, with shell/git/error-log context attached automatically.
- Secondary sources describe a **"Oz" orchestration platform** enabling parallel multi-agent runs
  (Claude Code, Codex, Gemini CLI) and cloud-agent delegation across desktop/web/remote — **this
  was not independently verified against an official Warp blog/docs page in this research pass**
  (a direct fetch of a candidate Warp blog URL 404'd); treat as **unverified** pending direct
  confirmation.
- Shared/reusable "workflows" can be saved/versioned as team primitives; MCP support lets Agent
  Mode reach external tools/ticketing/DBs.

### 7.8 Zed editor — Agent Panel & Agent Client Protocol (ACP)

- **ACP spec** (verified directly, https://agentclientprotocol.com): ACP "standardizes
  communication between code editors/IDEs and coding agents," analogous to how LSP standardized
  language servers — solving per-editor custom integration overhead, limited compatibility, and
  agent/editor lock-in. **Local agents** run as editor subprocesses over **JSON-RPC over stdio**;
  **remote agents** can be cloud-hosted over HTTP/WebSocket ("full support for remote agents is a
  work in progress"). ACP reuses MCP's JSON representations where possible but adds
  agentic-UX-specific types (e.g., diff display); default text format is Markdown.
- **Zed's Agent Panel / External Agents** (verified, https://zed.dev/docs/ai/external-agents):
  Zed hosts the conversation thread in its Agent Panel while an "External Agent" owns its own
  runtime, auth, model selection, tools, and native config — Zed does not charge for or mediate
  billing of External Agents. Agents install from an **ACP Registry** (`zed: acp registry`
  command). Zed lists **Claude, Codex, OpenCode, Copilot, Cursor, and Pi Coding Agent** as "Common
  Agents," each with its own documented auth/billing flow (e.g., Claude's `/login`, Gemini CLI's
  `GEMINI_API_KEY`/Vertex, Codex's ChatGPT-login-or-API-key).
- **Full ACP agent registry** (verified, https://agentclientprotocol.com/get-started/agents.md):
  a large, fast-growing list including Claude Agent (via Zed's own `claude-agent-acp` adapter),
  **Codex CLI** (via a community `codex-acp` adapter), Gemini CLI (native), **GitHub Copilot**
  (native, public preview), Cursor (via `cursor.com/docs/cli/acp`), OpenHands, OpenCode, Cline,
  Factory Droid, Goose, Junie (JetBrains), Kiro CLI, Qwen Code, and dozens of smaller/community
  implementations.
- **Full ACP client/editor list** (verified, https://agentclientprotocol.com/get-started/clients.md):
  beyond Zed, ACP clients include JetBrains IDEs (native), multiple VS Code extensions (ACP
  Client, ACP Patchbay, ACP Pro Extension — also usable in Cursor/Windsurf/Trae), Neovim plugins
  (CodeCompanion, avante.nvim, agentic.nvim), Emacs (`agent-shell.el`), Obsidian plugins, Sublime
  Text, Qt Creator, Visual Studio (via Poolside Assistant), and various standalone/experimental
  editors (Athas, necoder, Volt). CLIs/TUIs wrapping ACP include `acpx` and others.
- **Bottom line for oh-my-copilot:** yes — GitHub Copilot CLI's own ACP implementation (§7.3b)
  plus its listing in the official ACP agents registry means it can already, in principle, be
  driven by Zed's Agent Panel, Devin Desktop, Happy (beta ACP support), and any other ACP client
  — independent of whether that client knows anything about Copilot specifically. This is the
  single most future-proof integration surface identified in this entire research thread.

### 7.9 tmux-based manual/DIY multi-agent managers (beyond Claude Squad/herdr)

- **Claude Squad** (see §6.2) is the best-documented, most widely-used example (requires `tmux` +
  `gh`, isolated git worktree per session).
- Several smaller community tmux dashboards were identified via secondary sources but **not
  independently fetched/verified in this pass** — flagged for follow-up before citing specific
  feature claims:
  - **Agent of Empires (aoe)** — Go TUI atop tmux; project grouping, live output previews,
    optional Docker sandboxing + git worktree isolation.
  - **Agent-Manager** — Go TUI wrapping tmux; tree view of sessions by project, status indicators
    (working/waiting/finished/errored/idle/dead), diff/review mode.
  - **tmuxcc** (`nyanko3141592/tmuxcc`) — Rust TUI dashboard managing Claude Code/Codex
    CLI/Gemini CLI/OpenCode sessions across tmux panes; tree grouping, approval/rejection, batch
    ops, live pane previews.
  - **Named Tmux Manager (NTM)** — turns tmux into a multi-agent control center: spawn/tile
    agents, broadcast prompts across panes, conflict detection, persistent named-pane sessions,
    TUI command palette.
  - These represent a broader DIY/open-source ecosystem of "Claude Squad–style" tmux
    orchestrators, generally free/MIT-licensed, wrapping **CLI subprocess invocation** rather than
    the ACP JSON-RPC protocol — complementary to, and sometimes overlapping with, ACP-based editor
    integrations.

---

## 8. Comparison table

| Project | Supported harnesses (confirmed) | Drive mechanism | Worktrees | Remote/mobile | OSS / License | Stack | Activity (stars/forks, live) |
|---|---|---|---|---|---|---|---|
| **Orca (StablyAI)** | Claude Code, Codex, "any other agent" | CLI subprocess spawn, own CLI exposes same ops | Yes, first-class | Yes — iOS/Android app, SSH, cloud VM per-worktree | MIT | TypeScript (Electron-style desktop) | ~117k★ / 7.4k🍴 |
| **T3 Code** | Claude Code, Codex, Cursor, Grok Build, OpenCode, Antigravity, fx | BYOS: drives already-authenticated local CLIs; ACP registry referenced in marketing | Yes, per-thread | Yes — iOS/Android/web, local server + remote clients | MIT | TypeScript (Electron + Node server) | ~48.6k★ / 9.6k🍴 |
| **herdr** | Claude Code, Codex, **Copilot CLI**, Cursor, OpenCode, Grok, Pi, Droid, Devin CLI, Kimi, Kilo, Qwen, Antigravity, +more | Owns/attaches real terminal process; screen-scrape or self-reported state | N/A (process/pane mgmt, agent-agnostic re: git) | SSH to saved machines; no phone app | Apache-2.0 | Rust, single binary | ~48.3k★ / 3.9k🍴 |
| **Rex (beta)** | Claude Code, Codex, OpenCode, Pi (via OSC 7501); agnostic otherwise | OSC 7501 escape-sequence status protocol + title heuristics | N/A (terminal/pane mgmt) | Multi-host (`rex hosts`); no phone app found | Terminal closed-source; protocol + plugins (e.g. `rex-agents`) open (MIT) | Native app; Lua config/plugins | Beta — no public stars for core app; plugin ~1★ |
| **Conductor** | Claude Code, Codex, OpenCode (bundled), Cursor (API) | Bundled runtime / Cursor API | Yes | No (macOS-only) | Closed source | macOS native | No public repo |
| **Claude Squad** | Claude Code, Codex, Gemini CLI, Aider | tmux pane + subprocess | Yes | No | AGPL-3.0 | Go + tmux | ~8.7k★ / 623🍴 |
| **vibe-kanban** | Claude Code, Codex, Gemini CLI, **Copilot CLI**, Amp, Cursor, OpenCode, Droid, Qwen | Rust executor trait, subprocess in worktree | Yes | Hosted cloud service shutting down; local continues | Apache-2.0 | Rust + TS | ~28.6k★ / 3.1k🍴 |
| **Nimbalyst (ex-Crystal)** | Codex, Claude Code, OpenCode, **Copilot CLI (alpha)**, Gemini | Not fully documented | Yes | iOS companion app | MIT | Electron/TS | ~2.0k★ / 333🍴 |
| **Sculptor** | Claude Code, Pi, Codex (via API key), generic terminal agents | Container runtime (not worktree) | No (containers) | No | Public repo, not accepting contributions ("not truly OSS yet") | Python, Docker | ~245★ / 20🍴 |
| **Terragon** | (historical) cloud agents | Cloud sandbox | — | Was cloud-based | — | — | Shut down Feb 2026 |
| **Omnara** | Claude Code (origin); generic "managed agents" now | YAML-defined agents, dashboard/CLI/SDK | N/A | iOS app (historical), web dashboard | Apache-2.0 | Go + TS SDK | ~3.4k★ / 261🍴 |
| **Happy** | Claude, Codex, Grok, Gemini (Antigravity), **any ACP agent (beta)** | Native CLI integration + ACP (beta) | Yes, per-branch | iOS/Android native, E2E-encrypted, multiplayer | MIT | Swift, Kotlin, relay server | ~24.5k★ / 2.1k🍴 |
| **opcode (ex-Claudia)** | Claude Code only | Reads/writes Claude's own session files, spawns background processes | No (session mgmt, not worktree-centric) | No | AGPL-3.0 | Tauri 2 (Rust+TS/React) | ~22.4k★ / 1.7k🍴 |
| **CCManager** | Claude Code, Gemini CLI, Codex CLI, Cursor Agent, **Copilot CLI**, Cline, OpenCode, Kimi | Configurable shell `program` subprocess | Yes, multi-repo | No | MIT | TypeScript (Bun) | ~1.3k★ / 94🍴 |
| **uzi** | Any CLI agent (`--agents claude:3,codex:2`) | tmux window/pane + subprocess | Yes | No | MIT | Go | 582★ / 29🍴 (stale, last push Jun 2025) |
| **Amp (Orbs/Runners/Puck)** | Its own agent stack (not external CLIs) | N/A (not a CLI wrapper) | Yes (Runners feature) | Cloud "Orbs", shared Runners | Closed source | — | Commercial, active |
| **Cursor Cloud Agents** | Cursor's own agent | Cloud VM | N/A | iOS, web, Slack, PWA | Closed source | — | Commercial, active |
| **Codex Cloud** | Codex | Cloud VM, published environments | N/A | ChatGPT web/desktop/mobile, Codex CLI | Closed source | — | Commercial, active |
| **GitHub Copilot coding agent + Agent HQ** | Copilot, Codex, Claude, Jules, Grok (via Agent HQ) | GitHub Actions cloud environment; mission control UI | N/A (PR/branch-based) | GitHub web, VS Code, mobile, CLI | Closed source (GitHub product) | — | Active, major 2025 GitHub Universe launch |
| **Google Jules** | Jules (Google's own agent) | VM sandbox | N/A | Web, Jules Tools CLI, REST API, GitHub Action | Closed source | — | Active |
| **Devin (Cognition)** | Devin, "managed Devins," + ACP agents (Desktop 2.0) | VM per managed Devin; Desktop hosts ACP agents | N/A | Desktop app, cloud dashboard | Closed source | — | Active |
| **OpenHands** | Any ACP-compliant harness + its own agent | Docker sandbox; ACP client/agent both ways | N/A (container-based) | Self-hosted web UI | MIT | Python/TS | ~92.8k★ / 12.4k🍴 |
| **Warp (Agent Mode / "Oz")** | Claude Code, Codex, Gemini CLI (unverified specifics) | Terminal-native agent execution | Unclear | Desktop app, unverified cloud claims | Closed source | — | **[unverified]** |
| **Zed Agent Panel** | Claude, Codex, OpenCode, **Copilot**, Cursor, Pi, + full ACP registry | ACP (JSON-RPC over stdio/HTTP) | N/A (editor, not worktree mgr) | Editor-based, remote agents "work in progress" | Zed itself OSS (GPL/AGPL mix, not re-verified here); ACP spec open | Rust (Zed), protocol-agnostic | Fast-growing ACP ecosystem |

---

## 9. Observed design patterns

1. **Git worktrees are the default isolation primitive** for local orchestrators (Orca, T3 Code,
   Conductor, Claude Squad, vibe-kanban, Nimbalyst, CCManager, uzi, Happy, Amp Runners) — cheap,
   native to git, avoids full container overhead, and plays well with GitHub PR flows (branch per
   task/agent → PR). Containers (Sculptor) are the explicit minority position, trading worktree
   convenience for stronger isolation/dependency safety.
2. **Subprocess spawning of the user's own authenticated CLI ("BYOS") is the dominant drive
   mechanism**, not SDKs or reimplementation — T3 Code, Orca, Claude Squad, CCManager, uzi,
   vibe-kanban, herdr, Rex-plugins all explicitly describe driving `claude`, `codex`, `copilot`,
   etc. as already-installed, already-authenticated CLI binaries. This has a direct, favorable
   implication for `oh-my-copilot`: a Copilot CLI plugin installed on the user's machine should
   "just work" unmodified under nearly all of these tools, since none of them replace or
   re-author Copilot CLI's own startup/config-loading behavior.
3. **ACP is emerging as the second, protocol-level drive mechanism**, layered on top of (not
   replacing) subprocess spawning — Zed pioneered it, GitHub Copilot CLI, Codex CLI (via adapter),
   Gemini CLI, Cursor CLI, OpenHands, and dozens of smaller agents now implement it; Happy and
   Devin Desktop are driving ACP support into general-purpose orchestrator UIs, not just editors.
   This is architecturally similar to LSP: one protocol, many clients, many agents, decoupling
   "which editor/orchestrator you use" from "which agent you use."
4. **Terminal-native state-detection is a competing, lighter-weight pattern to ACP** — herdr's
   screen-scraping + optional self-reported-state model, and Rex's OSC 7501 escape-sequence
   protocol, both let *any* program (not just purpose-built ACP agents) surface
   idle/working/waiting/blocked/failed status without requiring a structured RPC integration.
   These two approaches (herdr's manifest-based detection vs. Rex's open escape-sequence
   broadcast) are solving the same "which of my N agents needs me right now" problem with
   different trade-offs: herdr needs no cooperation from the agent but is more brittle to UI
   changes; OSC 7501 needs the agent to cooperate but is more robust and semantically rich.
5. **Mobile/remote-first design is now table stakes for new entrants** — Orca, T3 Code, Happy, and
   (historically) Omnara all ship native iOS/Android apps as core, not bolted-on, features; Cursor
   and Codex Cloud similarly treat mobile/web parity as core. This reflects a broader shift toward
   "fire off a task, walk away, get pinged when it needs you" as the expected UX for long-running
   agent work.
6. **The "coordinator delegates to worker agents" pattern recurs at every layer** — Orca's
   coordinator/worker worktrees, T3 Code's "Claude plans, Codex builds" Orchestrator V2, Amp's
   Puck persona, and Devin's "managed Devins" are all variations on the same idea: one agent (or
   the orchestrator itself) plans/coordinates, while one or more separate agent processes execute
   in isolated environments and report back.
7. **The category is financially volatile** — Terragon and vibe-kanban's parent company both shut
   down within the research window, while Crystal was deprecated in favor of a rebrand
   (Nimbalyst). Free/BYOS-only orchestrators with no separate revenue model (Conductor, T3 Code,
   Orca, Happy) may be more durable than venture-funded cloud-hosting plays, but this is
   speculative based on only a few observed data points.
8. **Copilot CLI's position in this ecosystem is currently "supported but not central"** — it
   appears as a confirmed, first-class spawnable agent in herdr, vibe-kanban, CCManager, and
   (alpha) Nimbalyst, and as a confirmed ACP agent in the Zed/ACP registry and GitHub's own Agent
   HQ — but it is conspicuously absent from T3 Code's and Conductor's harness lists, and has no
   native OSC 7501 (Rex) status-reporting yet. This is both a gap and an opportunity.

---

## 10. Implications for `oh-my-copilot`

- **Plugins/hooks should survive subprocess spawning largely unmodified.** Because Copilot CLI's
  plugin and hooks system both load from the filesystem at CLI startup (`.github/hooks/`,
  `.github/plugin/`, `~/.copilot/hooks/`) rather than depending on how the parent process invokes
  it, running Copilot CLI under any of the subprocess-spawning orchestrators above (CCManager,
  vibe-kanban, herdr, Claude Squad-style tools, T3 Code if/when it adds Copilot support) should
  preserve `oh-my-copilot`'s behavior as long as (a) the working directory still contains the
  relevant repo-level hook/plugin files, and (b) `$HOME`/`$COPILOT_HOME` is reachable from that
  subprocess. **Container-isolated tools (Sculptor) are the one category where this could silently
  break** unless config paths are explicitly mounted — worth testing directly and worth
  documenting in `oh-my-copilot`'s own README as a known caveat.
- **ACP support in Copilot CLI (`copilot --acp`) is the most future-proof integration surface.**
  Any ACP client (Zed's Agent Panel, Devin Desktop, Happy's beta ACP support, future orchestrators)
  can already drive Copilot CLI headlessly. It's worth verifying empirically whether
  `oh-my-copilot`'s slash-commands/hooks still fire when Copilot CLI is launched in `--acp` mode
  rather than its normal interactive mode — ACP sessions may bypass some interactive-only UX
  paths (e.g., certain prompt/confirmation flows), so this should not be assumed without testing.
- **Terminal status-reporting is a cheap, high-leverage addition.** Neither Copilot CLI nor
  (as far as this research found) `oh-my-copilot` currently emits Rex's OSC 7501 "Program Status
  Protocol," even though herdr already has first-class Copilot CLI detection via screen-scraping.
  Adding native OSC 7501 emission (idle/working/waiting/finished/failed + reason) to Copilot
  CLI/`oh-my-copilot` would make Copilot CLI sessions show up with full-fidelity status in Rex's
  Activity Mode (and any other tool that adopts the open protocol) without needing per-tool
  plugin code — a good target for a future `oh-my-copilot` feature or upstream Copilot CLI
  request.
  (protocol doc: https://www.superlogical.com/rex/docs/build/program-status)
  Similarly, `oh-my-copilot` could document a herdr "integration" manifest/skill
  (https://herdr.dev/docs/add-herdr-support/) to make Copilot CLI sessions resumable across herdr
  server restarts, matching what Claude Code/Codex/OpenCode/Pi already get.
  (https://herdr.dev/docs/agent-skill/)
- **Worktree-centric orchestrators are the primary audience to design for.** Since the large
  majority of local tools in this space (Orca, T3 Code, Claude Squad, vibe-kanban, CCManager, uzi,
  Nimbalyst, Happy, Amp Runners) use `git worktree`-per-task as their isolation unit,
  `oh-my-copilot` features that assume a single canonical working directory (e.g., caching paths,
  state files keyed only by repo URL rather than worktree path) could misbehave when multiple
  Copilot CLI instances run concurrently across sibling worktrees of the same repo. Session/cache
  state should be keyed by worktree path, not just repo identity.
- **Explicit first-class Copilot CLI support currently exists in:** herdr (state detection +
  resumable integration), vibe-kanban (spawnable executor), CCManager (spawnable preset), Zed /
  ACP registry (native ACP agent), and GitHub's own Agent HQ/mission control (first-party). It is
  **missing** from T3 Code, Conductor, Claude Squad, uzi, and Rex's native status protocol as of
  this research — these are concrete targets if `oh-my-copilot` or the broader Copilot CLI team
  wants to pursue first-party adoption/visibility in those ecosystems.

---

## 11. Gaps and uncertainties (consolidated)

- **Terragon:** site is shutdown-only; historical product details (pricing, exact harness-driving
  mechanism) rely on secondary sites (devboxer.com, codeherder.com) not independently
  cross-verified.
- **Omnara:** current docs/README's generic "managed agent platform" framing is hard to fully
  reconcile with its well-documented 2025 Claude-Code-specific mobile launch; mobile-app and
  Cursor/Codex/Copilot integration claims rest on secondary sources (YC launch page, and others)
  not re-confirmed on the current official repo/docs.
- **Sculptor pricing tiers** (reported free ≤3 agents, paid "Professional" tier) came from
  secondary review sites, not an official Imbue pricing page (`imbue.com/pricing` returned 404
  during this research).
- **Conductor:** no public GitHub repo, so no stars/activity/license transparency; exact
  process-spawning mechanism for bundled harnesses not documented publicly.
- **Amp's exact technical mechanism** for parallel agent processes within one Orb/Runner (separate
  OS processes vs. logical threads in one process) was not found in public docs.
- **Cursor Cloud Agents' exact current pricing/plan gating** and the precise name/feature-set of
  "Automations" rest on secondary/blog sources, not independently re-verified against an official
  `cursor.com` page in this pass.
- **Codex Cloud's GitHub PR mechanics** (`@codex` mentions, `codex-action`) were not independently
  refetched from an OpenAI primary source (`help.openai.com` returned HTTP 403 during this
  research); the core Codex Cloud workflow itself was verified directly.
- **Warp's "Oz"/multi-agent orchestration claims** are unverified against an official Warp page (a
  direct fetch attempt 404'd) — treat as uncertain pending a successful fetch of a Warp
  blog/changelog page.
- **Devin's enterprise dashboard details** (SSO/SCIM/RBAC, Slack/Sentry/PagerDuty triggers) rely
  on secondary/Cognition-adjacent sources not independently refetched this pass; the Agent Command
  Center and "Managed Devins" core claims are, however, fully verified against primary Cognition
  sources.
- **OpenHands' exact star/fork counts** were confirmed directly via the GitHub API in this pass
  (~92.8k★/12.4k🍴) superseding an earlier, lower secondary-source estimate used mid-research.
- **The broader tmux-manager ecosystem** (NTM, Agent-Manager, Agent of Empires, tmuxcc) descriptions
  come from a single aggregated secondary-source search response; only Claude Squad was
  independently fetched and confirmed from its own GitHub README — recommend direct repo fetches
  for the other four before citing specific feature claims elsewhere.
- **Orca's and T3 Code's GitHub star counts** (~117k and ~48.6k respectively, pulled live via the
  GitHub API on 2026-11-06) are unusually high for projects created within the past ~8-9 months;
  this is reported as observed, but readers should sanity-check against each repo's own star
  history before treating these as a stable measure of "true" organic popularity.
- **Rex** itself (the terminal application/server) could not be found on GitHub under an obvious
  org name, and no independent popularity/installed-base figures were found beyond its public-beta
  status and Discord community — treat its overall adoption level as **unverified/early-stage**.

---

## 12. Sources

### Orca
- https://github.com/stablyai/orca
- https://www.onorca.dev/ (and docs subpages: `/docs/cli/orchestration`, `/docs/agents/native-chat`,
  `/docs/ways-to-run`, `/docs/mobile`, `/docs/review/annotate-ai-diff`, `/docs/review/commit-push`,
  `/docs/model/worktrees`, `/docs/browser/design-mode`, `/docs/review/linear`, `/docs/cli/overview`,
  `/docs/cli/automations`, `/docs/cli/computer-use`, `/plugins`)
- https://apps.apple.com/us/app/orca-ide/id6766130217
- https://github.com/okikorg/orca-harness (disambiguation)
- https://orcapods.ai/blog/introducing-orcacode (disambiguation)

### T3 Code
- https://github.com/pingdotgg/t3code
- https://t3.codes
- https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824
- https://www.youtube.com/watch?v=epSi9U87wz4 (Orchestrator V2 walkthrough — secondary/video)
- https://luminalog.com/blog/t3code-explained (secondary)

### herdr
- https://github.com/herdrdev/herdr
- https://herdr.dev/docs/session-state/, /docs/connecting-machines/, /docs/agent-skill/,
  /docs/agents/, /plugins/, /docs/add-herdr-support/

### Rex
- https://www.superlogical.com/rex/docs/
- https://www.superlogical.com/rex/docs/build/program-status.md (OSC 7501)
- https://www.superlogical.com/rex/docs/automate/agent-skill.md
- https://github.com/irfn/rex-agents
- https://en.theblockbeats.news/flash/371371 (Rex Activity Mode announcement)

### Local/desktop orchestrators
- https://www.conductor.build/ , https://www.conductor.build/docs,
  https://www.conductor.build/docs/reference/harnesses
- https://github.com/smtg-ai/claude-squad
- https://github.com/BloopAI/vibe-kanban , https://www.vibekanban.com/docs/supported-coding-agents ,
  https://vibekanban.com/blog/shutdown
- https://github.com/stravu/crystal , https://github.com/Nimbalyst/nimbalyst
- https://github.com/imbue-ai/sculptor , https://imbue.com/blog/sculptor-announce
- https://www.terragonlabs.com (shutdown page)
- https://github.com/omnara-ai/omnara , https://docs.omnara.com/introduction
- https://github.com/slopus/happy , https://happy.engineering/welcome/
- https://github.com/winfunc/opcode
- https://github.com/kbwo/ccmanager
- https://github.com/devflowinc/uzi
- https://ampcode.com/docs , https://ampcode.com/news/one-runner-many-worktrees ,
  https://ampcode.com/chronicle

### Cloud / IDE-vendor platforms & ACP
- https://cursor.com/docs/cloud-agent
- https://learn.chatgpt.com/docs/cloud
- https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/
- https://github.blog/news-insights/company-news/welcome-home-agents/
- https://github.blog/changelog/2025-10-28-a-mission-control-to-assign-steer-and-track-copilot-coding-agent-tasks/
- https://github.blog/changelog/2026-01-28-acp-support-in-copilot-cli-is-now-in-public-preview/
- https://docs.github.com/copilot/reference/acp-server
- https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
- https://jules.google/docs
- https://cognition.com/blog/devin-can-now-manage-devins
- https://docs.devin.ai/desktop/agent-command-center
- https://github.com/OpenHands/OpenHands , https://docs.openhands.dev/openhands/usage/sandboxes/docker ,
  https://docs.openhands.dev/openhands/usage/run-openhands/acp
- https://agentclientprotocol.com , https://agentclientprotocol.com/get-started/agents.md ,
  https://agentclientprotocol.com/get-started/clients.md
- https://zed.dev/docs/ai/external-agents

### GitHub repo stats
All star/fork/license/language/push-date figures were pulled live via
`https://api.github.com/repos/<owner>/<repo>` on 2026-11-06.
