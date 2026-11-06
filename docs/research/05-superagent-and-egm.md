# 05 — DeepSeek superagent, Google's Elephant-Goldfish Model, and Microsoft's TokenEconomizer

This report covers two projects the user asked to add: DeepSeek's
[dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype) and Google's
[elephant-goldfish-model](https://github.com/google/elephant-goldfish-model) (EGM), and Microsoft's
[TokenEconomizer](https://github.com/microsoft/TokenEconomizer). For each one,
it answers three questions:

1. What does OMC already have?
2. What belongs in another layer, such as an orchestrator, a service, or the harness itself?
3. What can OMC bring in?

## Summary

- **EGM is the stronger candidate for OMC.** It is a set of skills and agent files and works as
  a plugin. It already ships an experimental Copilot CLI adapter and an OMP plugin install. Its
  core idea also fits our layer: one agent keeps the full context and drafts the design (the
  "elephant"), and fresh subagents with no context review it (the "goldfish"). OMC should
  **use EGM directly** and reuse its patterns, not copy its skills.
- **dsh-superagent is mostly a different layer.** It is a long-running service. It listens to
  GitHub and Feishu, decides which requests to take, opens tickets, and runs one worker session per
  ticket. That is orchestrator or service work, close to T3 Code or Copilot's cloud agent. Its
  prompt rules, however, carry over well: ask for attention only when needed, stop at defined
  scope limits, report delivery honestly, and keep a person's pause in force.
- **TokenEconomizer is in our layer and overlaps the most.** It is a Copilot CLI plugin built on
  hooks that cuts cost by learning across a repository's sessions. Its loop guard, learned repo
  facts, and tool pruning sit next to OMC's stream rules, rules, and deferred per-model tool
  profiles. OMC should **coexist with it and borrow its methods**, not rebuild it.
- **OMC already covers part of all three.** The `reviewer` agent is a fresh-context reviewer, rules
  give the model written policy, and the commit skill and anchored edits support delivery. What OMC lacks:
  design-stage review, a drift check from docs to code, and a "low-attention" working style.

## Evidence and limits

- Both repositories were read at their default branch on 2026-11-06. dsh-superagent:
  MIT, about 20.2k stars, created 2026-10-31, last pushed 2026-11-03. EGM: Apache-2.0,
  about 13k stars, created 2026-09-13, pushed 2026-11-06.
- **The video transcripts could not be read.** YouTube asked this machine to sign in
  ("confirm you're not a bot"), and the transcript service blocked its IP. Only the titles were
  confirmed, through YouTube's oEmbed endpoint. Both videos are by AI LABS:
  - [3DklR44DHnM](https://www.youtube.com/watch?v=3DklR44DHnM) — "Deepseek Just Released The
    Greatest Claude Code Workflow Ever".
  - [xxf6D9jynFw](https://www.youtube.com/watch?v=xxf6D9jynFw) — "EGM: Google's New Way To Use
    Claude Code Is Insane".
- **Secondary write-ups of the EGM video** ([daily.dev](https://daily.dev/posts/egm-google-s-new-way-to-plan-with-claude-code-is-insane-wnpdgfh5l),
  [ai.joaoqueiros.com](https://www.ai.joaoqueiros.com/blog/elephant-goldfish-model-claude-code-spec-review-ai-labs))
  match the repository. The video's stages are bootstrap, brainstorm, draft, a review of up to
  five rounds, and a drift check. In the video's demo, the drift check found a real bug: the
  code allowed deleting a sold product that the spec said should only be hidden. The video calls
  EGM overkill for small fixes.
- **No reliable summary of the DeepSeek video was found.** Search results described DeepSeek's
  model API in general. Per the user, the video recreates the superagent workflow by hand inside
  Claude Code. The analysis here therefore relies on the repository.

- **TokenEconomizer** was read at its default branch on 2026-11-06: Apache-2.0, Python,
  about 4.9k stars, created 2026-10-13, pushed 2026-11-06. It is a UC Berkeley and Microsoft
  Research project. Its cost results come from its own paper and were not reproduced here.

## dsh-superagent in brief

dsh-superagent is a research prototype that runs as a plugin inside **DeepSeek Harness (DSH)**.
It is not an official DeepSeek product. It acts as an automated team member for one GitHub
repository.

- **Flow.** A *Source* (GitHub or Feishu) emits *Triggers*. An *Eval* step decides whether a
  batch of triggers asks for new work. On accept, it creates a *Ticket* with a *Mandate*: what the
  agent may do and why. An *Executor* runs one DSH session and one directory per ticket, and
  replies on the original thread.
  ([001 Domain](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/main/docs/001-domain.md))
- **Two roles.** The main session (the orchestrator) only routes, with routing notes of 30 words
  or fewer. The workers read sources, implement, and verify. The orchestrator has 14 tools; each
  worker has 6, such as `orchestrator_report` and `orchestrator_trigger_handback`.
- **No waiting.** A guard refuses `sleep`, shell timeouts over 30 seconds, and job waits over
  5 seconds in the main session. Reports arrive as messages instead.
- **Philosophy: minimize human attention.** The agent acts only when asked or when a written
  rule allows it. Proactive rules start in a record-only mode. It speaks only when a person must
  act, and asks one structured question at a time.
  ([000 Philosophy](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/main/docs/000-philosophy.md))
- **Scope rules.** A worker finishes focused changes through review and CI. It stops when a
  change would break caller expectations, change module responsibilities, or redesign several
  modules. It then leaves an explicitly incomplete draft PR and names the blocker.
- **Honest delivery.** Opening a PR does not mean it is ready. A UI change needs real before and
  after screenshots. The agent never merges its own work, and enables auto-merge only under
  configured limits.
- **Per-role models** (`src/app/role-models.ts`), a web panel that shows only items that need a
  person, and an agent-guided `SETUP.md`.

## EGM in brief

EGM's motto is "design with an elephant, review with a goldfish". A context-rich agent and the
user write a spec. Then zero-context subagents stress-test it before any code is written.

- **Skills:** `egm-bootstrap` (folder READMEs), `egm-brainstorm` (`concepts_brief.md`),
  `egm-draft` (`design_draft.md`, section by section), `egm-review` (staged subflows),
  `egm-review-loop` (review, resolve, repeat), `egm-resolve`, and `egm-drift-report`.
- **Reviewer personas:** design critic, zoom out, comprehension, implementation readiness,
  structural, style, codebase details, inventive catalyst, plus a synthesizer.
- **A strict review contract.** Each reviewer runs in a new child that receives only the target,
  the line ranges, its persona, the standards, and a reading list. It never gets the
  conversation. If the harness cannot start a fresh subagent, the review stops: "a review in
  the same context is not a Goldfish review".
- **Anti-sycophancy rules.** Critique comes first. The rules ban flattery and apologies. Each gate
  asks exactly one question. Large outputs go to files, not the chat.
- **Drift report.** For each design doc or README, the skill finds the related code and reports
  only differences: missing features, incomplete models, hard-coded shortcuts, and
  architectural divergence.
- **Many harnesses, one skill text.** Claude Code, Codex, Antigravity, OMP and others install the
  same plugin.
  ([harnesses.md](https://github.com/google/elephant-goldfish-model/blob/main/docs/harnesses.md))

### EGM on Copilot CLI today

EGM's [Copilot guide](https://github.com/google/elephant-goldfish-model/blob/main/docs/copilot.md)
labels the adapter **experimental** and says workflow execution and reviewer isolation are **unverified**.

- It loads through `copilot --plugin-dir "$EGM_ROOT" --agent egm:egm`. The entry agent maps
  each persona to a native profile, such as `egm:egm-design`. Reviewers get only `read` and
  `search` and use `include-custom-instructions: false`.
- An offline test with CLI 1.0.82 confirmed that eight profiles and seven skills are discovered,
  using a disposable `COPILOT_HOME`, without calling a model.
- Its guide notes that `copilot plugin install` from a local path is unverified, and that a
  separate context window does not prove instructions or memory are isolated.

## TokenEconomizer in brief

TokenEconomizer ("experience-driven black-box cost control for coding agents") makes an agent
cheaper in repositories you use often. It does not change the agent. It learns from earlier
sessions in the same repository and uses that to cut waste in later ones.
([README](https://github.com/microsoft/TokenEconomizer/blob/main/README.md),
[plugin guide](https://github.com/microsoft/TokenEconomizer/blob/main/docs/PLUGIN.md))

- **Micro-skills (off by default).** It learns repository facts, such as "use `python -m pytest`
  here" or "run this build step first". Facts come from failures that repeat across sessions and
  from a model that reviews recent sessions every 3 sessions. A fact is injected at session start
  once three sessions confirm it, and dropped when later sessions contradict it.
- **Tool pruning (on).** Tools unused over 10 prompts across 2 sessions, or over 5 sessions, are
  left out of later sessions through the agent's own settings. One command restores them.
- **Loop guard (on).** When a turn keeps hitting the same failures, a judge model checks whether
  it is stuck. At 0.7 confidence or more, it adds one redirect note per turn. If the turn is still
  stuck, it tells the person how to stop it; it never stops a turn itself.
- **Cost as billed.** It counts cached tokens at cache prices and includes its own model calls
  in a per-session ledger, shown by `status`.
- **Reported results.** On 277 SWE-Bench tasks across six repositories, mean cost fell 18.4–30.9%
  for five agent and model combinations, and Pass@1 rose in four of five. These are the authors'
  numbers.
- **Hosts.** Claude Code, Codex, Copilot CLI and Pi are supported; opencode, Cursor Agent and
  Hermes Agent are experimental. One Python core sits behind a thin adapter per host.

### TokenEconomizer on Copilot CLI today

- **Install:** `copilot plugin marketplace add <absolute clone path>`, then
  `copilot plugin install tokeneconomizer@tokeneconomizer`. Tested on Copilot CLI 1.0.83 to
  1.0.102; OMC runs 1.0.105, which is untested.
- **Hooks:** `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, `Stop` and
  `SessionEnd`, all calling one Python script. Facts enter as `additionalContext`.
- **Tool pruning is coarse on Copilot.** Copilot has no persistent per-tool filter:
  `--excluded-tools` is a launch flag, and `permissions.deny` refuses a call but still sends the
  tool's schema. The only working lever was `disabledMcpServers` in the repository's
  `.github/copilot/settings.local.json`, which removes a whole MCP server, such as the built-in
  GitHub server. It applies only in a trusted folder.
- **Its own model calls** run through `copilot -p`, with the cheapest capable model.
- **It cannot stop a Copilot turn:** Copilot ignores `continue: false` from hooks.
- **State** lives in `~/.tokeneconomizer`, outside `COPILOT_HOME`. A disposable test must also set
  `TOKENECONOMIZER_HOME`.
- **Evidence is thin for Copilot:** the real-model checks used one model, Claude Haiku 4.5, over
  BYOK.

## Mapping to OMC

The table lists each idea and its fit. "Our layer" means an in-session Copilot CLI plugin:
skills, agent files, extension tools, and hooks.

| Idea | Source | OMC today | Layer | Recommendation |
| --- | --- | --- | --- | --- |
| Fresh-context (goldfish) reviewers | EGM | Partial: the `reviewer` agent reviews diffs, not designs | Ours | **Bring in.** Document EGM install next to OMC; add a design-review mode or persona |
| Design workflow: brainstorm, draft, review, resolve | EGM | None | Ours (skills) | **Use EGM directly**; do not fork its skills |
| Drift report from docs to code | EGM | None | Ours (skill) | **Bring in.** Small and useful in any repo; can reuse the reviewer's read-only setup |
| Refuse to run without a fresh subagent | EGM | None | Ours | **Bring in** to the reviewer: say so when it is not truly isolated |
| Anti-sycophancy and one-question gates | EGM, dsh | Partial: reviewer asks for verdicts | Ours (prompts) | **Bring in** as a style rule or nudge option |
| Per-skill test scenarios (`TEST.md`, `test_scenarios.yaml`) | EGM | Benchmark suites and 163 unit tests | Ours (test) | **Bring in** for the commit skill and reviewer |
| Offline plugin discovery test via SDK RPC | EGM | Manual checks in `COPILOT_HOME` | Ours (CI) | **Bring in** to the packaging item: zero model calls |
| Low-attention working style: ask only when needed, honest delivery, scope stop rules | dsh | Partial: rules can carry it | Ours (rule or output style) | **Bring in** as an optional rule pack |
| A person's pause holds across turns and restarts | dsh | None | Ours (hook + state) | Consider; needs session state |
| Record-only (dry-run) mode for new rules | dsh | None | Ours | **Bring in** for stream rules: log fires before enforcing |
| Per-role models | dsh | Deferred roadmap item 10 | Ours | Fold into item 10 (per-model profiles) |
| Main session must not wait or sleep | dsh | None | Ours (`preToolUse` rule) | Possible as a rule example, low priority |
| Agent-guided setup (`SETUP.md`) | dsh | README only | Ours (docs) | **Bring in** to packaging item 2 |
| Learned repository facts (micro-skills) | TE | Partial: static rules; Copilot has native memory | Ours | **Coexist.** Do not rebuild; check it does not clash with OMC rules |
| Loop guard: judge, one redirect, then notify | TE | Partial: stream rules match patterns and retry | Ours (hooks) | **Borrow** its failure-repeat signal and "redirect once, then tell the person" policy for stream rules |
| Tool pruning from usage evidence | TE | None; per-model profiles deferred (item 10) | Ours | **Borrow** its evidence thresholds and restore command for item 10; note Copilot only allows whole MCP servers off |
| Billed-cost ledger with cache pricing | TE | Benchmark measures credits | Ours (bench) | **Borrow** cache-aware cost accounting in reports |
| Benchmark arms with baselines (Serena, repomap, RTK) | TE | Stock vs. plugin arms | Ours (bench) | Consider; its SWE-Bench and Web-Bench runner is a reference design |
| One core with thin per-host adapters | TE, EGM | Copilot only | Ours | Note for packaging; not needed now |
| Listening to GitHub and chat, admission, tickets | dsh | None | Orchestrator or service | Out of scope; Copilot cloud agent, T3 Code |
| Panel, outbox, worker slots, retries | dsh | None | Orchestrator | Out of scope |
| Reviewer credit and auto-merge rules | dsh | None | Service or repo policy | Out of scope; possibly a commit-skill note |

## Recommended additions

These are proposals, not decisions, and are listed in suggested order.

1. **Recommend EGM alongside OMC.** Add a short install note and test it in the disposable
   `COPILOT_HOME`. Check for agent name conflicts with `oh-my-copilot:reviewer`. EGM already
   asks whether reviewer isolation holds on Copilot, so test that before relying on it.
2. **Drift-report skill.** A read-only skill that compares design docs or READMEs with the code
   and reports only the differences. It complements EGM rather than duplicating its design flow.
3. **Honest isolation in the reviewer.** Add `include-custom-instructions: false` if Copilot
   honors it for plugin agents, and state the limits in the reviewer's output.
4. **Low-attention rule pack.** An opt-in rule set based on dsh's prompts: confirm once, ask one
   question, stop at named scope limits, do not call a draft ready, and keep a person's pause.
5. **Dry-run mode for stream rules.** Log matches without aborting so users can tune patterns
   safely.
6. **Offline discovery test in CI**, following EGM's SDK RPC probe. Use it for packaging.
7. **Test TokenEconomizer next to OMC** in a disposable `COPILOT_HOME` with its own
   `TOKENECONOMIZER_HOME`. Check that both plugins' prompt and session-start context coexist, and
   that its MCP pruning does not touch OMC. If it works, recommend it rather than build cost control.
8. **Loop-guard ideas for stream rules.** Add a "same failure repeated" trigger and a
   "redirect once, then tell the person" limit.
9. **Evidence-based defaults for per-model tool profiles** (item 10), using TokenEconomizer's
   unused-tool thresholds and restore command.

## Not recommended

- **Rebuilding dsh-superagent inside OMC.** Admission, tickets, and multi-session routing need a
  long-running process and Source connectors. That belongs in an orchestrator. OMC can make
  sessions behave better when an orchestrator runs them.
- **Rebuilding TokenEconomizer's cost control.** It already supports Copilot and is backed by a
  paper. OMC should not ship a second session-learning system that injects competing context.
- **Forking EGM's skills.** EGM keeps one skill text for every harness and is still evolving.
  Copying it would create drift. OMC should integrate with it and fill gaps.
