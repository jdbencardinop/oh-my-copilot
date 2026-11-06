# Benchmark: stock Copilot vs oh-my-copilot editing

## Result

When the model is told to use them, the anchored tools make edits faster and use fewer tokens. They did not change success: every run in every arm passed, so these tasks were too easy to show any accuracy difference.

| Model | Median wall time | Output tokens | Cached input tokens | Fresh input tokens | AI credits | Model calls |
|---|---|---|---|---|---|---|
| claude-haiku-4.5 | 13.7 → 10.8 s (**−21%**) | 1,196 → 643 (**−46%**) | 104k → 55k (**−48%**) | 9.2k → 12.3k (+34%) | 2.78 → 2.40 (**−14%**) | 6.1 → 3.4 |
| gpt-6.1-sol | 13.8 → 10.3 s (**−25%**) | 286 → 180 (**−37%**) | 59k → 44k (**−25%**) | 7.3k → 7.3k (0%) | 2.70 → 2.45 (**−9%**) | 4.5 → 3.3 |

Each cell is stock → oh-my-copilot, averaged over 18 runs per arm (6 tasks × 3 repetitions). Wall time is the median; everything else is the mean.

Three caveats:

1. **Models need guidance to pick the tools.** With the nudge disabled and no hint in the prompt, neither model used the anchored tools in any of 12 runs. The plugin now sends guidance itself: all 36 runs in the [full nudge benchmark](#full-benchmark-the-plugins-own-nudge) used the anchored tools without a prompt hint. The timings above were measured before that, with the guidance in the prompt.
2. **Most of the saving comes from batching.** Copilot's `edit` changes one unique match per call, so Haiku spent 6–9 calls on the rename and call-site tasks. `edit_anchored` did each of those in one call. On single-line fixes, the two arms were about even.
3. **Fresh input goes up.** Anchored output adds a `LINE:HASH|` prefix to every line, and the plugin adds two tool schemas. Cached input falls by more than fresh input rises, so the credit cost still went down.

## Why OMP changed the edit tool

OMP's author found that the harness, not the model, causes many failed edits ([The harness problem](https://blog.can.ac/2026/02/12/the-harness-problem)):

- **`str_replace` needs a perfect copy of the old text,** including whitespace, and fails when that text appears more than once. Models often get it slightly wrong and loop on "string not found" errors.
- **`apply_patch` suits OpenAI models only.** Other models fail patches often; Grok 4 failed 50.7% and GLM-4.7 failed 46.2%.
- **Hashline gives every line a short, checkable ID.** The model names lines instead of retyping them. If the file changed since it was read, the ID no longer matches and the edit is rejected before anything is written.

The author's benchmark covered 16 models on 180 React bug-fix tasks, 3 runs each. Changing only the edit tool:

- beat patch for 14 of the 16 models, by 15 points on average;
- helped weak models most: Grok Code Fast 1 rose from 6.7% to 68.3%;
- cut output tokens because retry loops stopped: −22% for Claude Haiku 4.5, −24% for Claude Sonnet 4.5, and −61% for Grok 4 Fast;
- did little for some strong models: GPT-5.2 Codex gained 4.6 points but used 26% more tokens.

Our results agree on tokens and speed. We could not test accuracy, because both arms solved every task. Testing accuracy needs harder tasks or weaker models; `grok-code-fast-1` and `gpt-5-mini` were not available on this account.

## Method

### Tasks

Six single-file edits, chosen to stress text-matching tools. Each task has a `before` file, an `after` file, and a prompt in [`bench/tasks/`](../bench/tasks).

| Task | File | Change | Stress |
|---|---|---|---|
| `restore-guard` | `hashline.mjs`, 184 lines | Re-add a removed `throw` line | Insert at the right spot |
| `restore-negation` | `rules.mjs`, 138 lines | Restore a dropped `!` | One-character fix |
| `rename-function` | `main.mjs`, 401 lines | Rename a function at 6 sites | Many edits |
| `duplicate-blocks` | `services.yaml`, 130 lines | Change one of 8 near-identical blocks | Ambiguous matches |
| `makefile-tabs` | `Makefile`, 26 lines | Add and change tab-indented lines; checked byte for byte | Whitespace |
| `many-callsites` | `account.js`, 123 lines | Change 9 of 10 identical calls | Many identical matches |

A run passes when the edited file equals `after`. Trailing whitespace is ignored, except for `makefile-tabs`, which must match exactly.

### Arms

| Arm | Plugin loaded | Prompt hint |
|---|---|---|
| `stock` | No | "Use the view and edit tools" |
| `stock-default` | No | None |
| `omc` | Yes | "Use the read_anchored and edit_anchored tools" |
| `omc-nohint` | Yes | None |
| `omc-nudge` | Yes | None, but the plugin's own nudge is on |
| `omc-instructions` | Yes | None, but a personal `copilot-instructions.md` tells the model to use the anchored tools |
| `omc-off-instructions` | Yes, switched off with `OMC_DISABLE=1` | None, with the same instructions file |

The original results below were recorded before the plugin had its own nudge. The runner now switches the nudge off (`OMC_DISABLE_FEATURES=nudge`) in `omc`, `omc-nohint` and `omc-instructions`, so those arms still measure the same thing. The `omc-nudge` results are in the [full nudge benchmark](#full-benchmark-the-plugins-own-nudge). The two instruction arms appear only in the [spot check](#spot-check-nudging-with-an-instructions-file).

Each run starts a fresh, non-interactive Copilot session with `--output-format json`. It uses its own `COPILOT_HOME` and a fresh git repository containing only the fixture. Built-in MCP servers and user hooks are off. Runs are shuffled and execute up to 4 at a time. The runner now removes inherited OMC kill switches and `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` before applying each arm's settings.

The separate Copilot profile is **not a security sandbox**. The CLI runs with `--allow-all-tools` and the invoking user's filesystem and network permissions. Inspect tasks and their tests before running them, and use an appropriately isolated environment for untrusted repositories.

### Scale

- 72 runs: 6 tasks × 2 models × `stock` and `omc` × 3 repetitions.
- 12 runs: 6 tasks × 2 models × `omc-nohint` × 1 repetition.
- About 221 AI credits for these 84 runs. Copilot CLI 1.0.105, run on November 4, 2026.

### Limits

- **Pass rate was 100% everywhere,** so this measures cost and speed, not accuracy.
- **The hint wording differs between arms.** The `omc-nohint` arm shows what happens without it.
- **The sample is small.** Three runs per task and arm; per-task numbers are noisy.
- **Wall time includes API latency** and the effect of running 4 sessions at once.
- **Only single-file tasks were tested,** with the file named in the prompt.

## Detailed results

### By model and arm

| Model / arm | Runs | Pass | Median wall (s) | Output tokens | Fresh input | Cached input | Credits | Model calls | Tool calls | Edit calls | Failed tool calls | Runs using anchored tools |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| haiku / stock | 18 | 100% | 13.7 | 1,196 | 9,163 | 104,099 | 2.78 | 6.1 | 5.8 | 3.7 | 0.1 | 0% |
| haiku / omc | 18 | 100% | 10.8 | 643 | 12,305 | 54,549 | 2.40 | 3.4 | 2.4 | 1.2 | 0.2 | 100% |
| haiku / omc-nohint | 6 | 100% | 16.1 | 1,241 | 10,340 | 127,127 | 3.18 | 7.0 | 6.0 | 3.8 | 0.3 | 0% |
| sol / stock | 18 | 100% | 13.8 | 286 | 7,333 | 58,579 | 2.70 | 4.5 | 3.5 | 1.0 | 0.0 | 0% |
| sol / omc | 18 | 100% | 10.3 | 180 | 7,334 | 43,745 | 2.45 | 3.3 | 2.3 | 1.0 | 0.0 | 100% |
| sol / omc-nohint | 6 | 100% | 12.1 | 267 | 7,523 | 53,665 | 2.68 | 4.2 | 3.2 | 1.0 | 0.0 | 0% |

"haiku" is `claude-haiku-4.5`; "sol" is `gpt-6.1-sol`. gpt-6.1-sol edits with `apply_patch`, which can change many places in one call, so its edit-call count is 1 in every arm.

### Credits by task

| Task | haiku stock | haiku omc | sol stock | sol omc |
|---|---|---|---|---|
| `restore-guard` | 2.23 | 3.18 | 2.53 | 2.48 |
| `restore-negation` | 1.99 | 2.11 | 2.25 | 2.40 |
| `rename-function` | 4.26 | 3.31 | 4.00 | 3.30 |
| `duplicate-blocks` | 2.03 | 2.00 | 2.50 | 2.13 |
| `makefile-tabs` | 1.94 | 1.59 | 1.98 | 1.81 |
| `many-callsites` | 4.25 | 2.23 | 2.96 | 2.57 |

oh-my-copilot cost more on two tasks. On `restore-negation`, the anchored listing made the input slightly larger. On `restore-guard`, Haiku made anchor mistakes on all three runs (see the next section) and needed extra calls to recover.

### Failed tool calls

All 84 runs passed, but 6 runs had at least one failed tool call:

- **Stock `edit`, 3 runs:** "Multiple matches found" on `rename-function` and `duplicate-blocks`.
- **`edit_anchored`, 3 runs, all Haiku on `restore-guard`:**
  - twice it used an anchor one line off; the error named the correct line, and the model retried successfully;
  - once it passed a hash and the line's text, `28|…`, with no line number. It made the same mistake twice, then got it right on the third call.

Each failed call was rejected before it wrote anything, so no file was damaged.

### Spot check: nudging with an instructions file

This check asks two questions:

1. Can an instructions file make the models use the anchored tools without a prompt hint?
2. Does Copilot still work normally when the plugin is off but the instructions still mention its tools?

The instructions are the text in [`bench/run.mjs`](../bench/run.mjs) (`INSTRUCTIONS`), placed in the run's personal Copilot home. Each model ran 2 tasks (`restore-negation` and `many-callsites`) once per arm: 8 runs, about 21 AI credits. This is a check, not a measurement. The sample is too small to compare speed or cost.

| Arm | Model | Pass | Runs using the anchored tools | Edit tools used |
|---|---|---|---|---|
| `omc-instructions` | claude-haiku-4.5 | 2/2 | 2/2 | `read_anchored` and `edit_anchored` (one run also called `view` once) |
| `omc-instructions` | gpt-6.1-sol | 2/2 | 2/2 | `read_anchored` and `edit_anchored` |
| `omc-off-instructions` | claude-haiku-4.5 | 2/2 | 0/2 | `edit` (1 call, then 9 calls) |
| `omc-off-instructions` | gpt-6.1-sol | 2/2 | 0/2 | `apply_patch` |

- **The instructions worked.** All 4 runs with the plugin on used the anchored tools and passed, with no hint in the prompt.
- **The fallback held.** With the plugin switched off and the same instructions in place, all 4 runs used the built-in tools and passed. None recorded a failed tool call.

Not tested: the repository-level `.github/copilot-instructions.md`, other tasks, and longer sessions.

### Spot check: the plugin's own nudge

The plugin now adds the same guidance as hidden context on the first prompt of each session, so no instructions file is needed (see the [README](../README.md#how-copilot-picks-the-anchored-tools)). The wording adds one phrase to the fallback sentence: "or report that they are turned off".

This was a quick live check outside the runner: one small edit (two one-line changes in a 12-line `cart.js`), with no hint in the prompt and no instructions file. Each run used a fresh Copilot home and repository. 4 runs, about 2 AI credits.

| Setup | Model | Correct edit | Nudge in the prompt | Tool calls |
|---|---|---|---|---|
| Plugin on | claude-haiku-4.5 | 2/2 | 2/2 | each run: `bash` (find the file), `read_anchored`, `edit_anchored` |
| Plugin on | gpt-6.1-sol | 1/1 | 1/1 | `glob`, 2 × `bash`, `read_anchored`, `edit_anchored` |
| `OMC_DISABLE=1` | claude-haiku-4.5 | 1/1 | 0/1 | `glob`, 2 × `view`, 2 × `edit` |

- **The nudge worked.** All 3 runs with the plugin on edited with `edit_anchored` in one call, after one `read_anchored`. None used `view` or `edit`.
- **Off means stock.** With `OMC_DISABLE=1`, no guidance was sent, the anchored tools were not listed, and the model used the built-in tools.
- **Where it shows up.** In `--output-format json`, the note appears in the `user.message` event's `transformedContent`, inside a `<system_reminder>` block.

The six benchmark tasks were subsequently tested below. Interactive sessions and long sessions where the note may be compacted away remain outside this benchmark.

### Full benchmark: the plugin's own nudge

On November 5, 2026, the current plugin at `79a9a22` ran all six tasks with no prompt hint or personal instructions file: two models, three repetitions, 36 runs. Copilot CLI was 1.0.106-9, with concurrency 4. Each run used a disposable Copilot home and repository; the main profile's settings checksum was unchanged. Stream rules and rule imports stayed off by default.

**All 36 runs passed and used both anchored tools.** Haiku had one rejected anchor edit, then recovered successfully. Total reported usage was **93.59 AI credits**.

Compared with the November 4 stock baseline:

| Model | Median wall time | Mean output tokens | Mean AI credits |
|---|---|---|---|
| claude-haiku-4.5 | 13.68 → 10.57 s (−23%) | 1,196 → 608 (−49%) | 2.78 → 2.55 (−8%) |
| gpt-6.1-sol | 13.77 → 10.30 s (−25%) | 286 → 181 (−37%) | 2.70 → 2.65 (−2%) |

This confirms tool adoption on these tasks without manual prompt guidance. Speed and output-token results remain favorable, but credit savings are smaller than in the original hinted run. Compared with that hinted arm, mean credits rose about 6% for Haiku and 8% for GPT. Fresh input increased, and some first runs had more uncached input; this experiment does not isolate cache effects from plugin overhead.

**This is a historical comparison, not a contemporaneous controlled rerun.** The stock baseline used CLI 1.0.105 on November 4; only `omc-nudge` was run on November 5. CLI changes, cache conditions and API latency can affect the comparison. Both arms still passed every task, so there is no evidence here of an accuracy gain. Stream-rule effectiveness was not measured.

Raw results: [`nudge.jsonl`](../bench/results/nudge.jsonl). To reproduce the comparison:

```bash
node bench/report.mjs bench/results/main.jsonl bench/results/nudge.jsonl
```

### More GPT models: stock and nudge side by side

On November 5, 2026, `gpt-6.1-terra`, `gpt-6-astra` and `gpt-6-luna` ran all six tasks in both `stock` and `omc-nudge`, interleaved in one run: 3 models × 6 tasks × 2 arms × 3 repetitions, 108 runs. Copilot CLI was 1.0.106-9, with each model's default reasoning effort. `gpt-6.1-astra` and `gpt-6.1-luna` are not available on this account. The run used **684 AI credits**, mostly Astra (593).

**All 108 runs passed, and every nudge run used the anchored tools.**

| Model | Median wall time | Mean output tokens | Mean AI credits | Model calls |
|---|---|---|---|---|
| gpt-6.1-terra | 11.9 → 10.1 s (−15%) | 291 → 183 (−37%) | 2.30 → 2.46 (+7%) | 4.4 → 3.6 |
| gpt-6-astra | 13.3 → 13.3 s (0%) | 273 → 226 (−17%) | 16.60 → 16.33 (−2%) | 4.3 → 3.6 |
| gpt-6-luna | 11.8 → 10.5 s (−11%) | 303 → 264 (−13%) | 0.15 → 0.17 (+13%) | 3.4 → 3.4 |

Each cell is stock → nudge, 18 runs per arm. Wall time is the median; everything else is the mean.

- **Speed and output tokens improved; credits did not.** These GPT models already edit with `apply_patch` in one call, so batching saves little. The anchored listing raises fresh input, which offsets the saving.
- **Luna made the most anchor mistakes.** On `rename-function`, 3 of 3 nudge runs sent a stale anchor about five lines off; the error named the correct line and the retry succeeded. One `makefile-tabs` run omitted a required `anchor`. No file was damaged.
- **Accuracy did not differ,** because every run in both arms passed.

Raw results: [`gpt-models.jsonl`](../bench/results/gpt-models.jsonl).

```bash
# About 685 credits; Astra alone is about 590
node bench/run.mjs --models gpt-6.1-terra,gpt-6-astra,gpt-6-luna --arms stock,omc-nudge --reps 3 --concurrency 4 --out bench/results/gpt-models-rerun.jsonl
```

Pass `--effort <level>` to set the reasoning effort (`none` to `max`); the run above used each model's default. The report labels such runs `model@effort`.

## Hard suite

The six original tasks are too easy: every model passes all of them, so they can't show an accuracy difference. The hard suite in [`bench/tasks-hard/`](../bench/tasks-hard) adds 12 tasks built to fail more often. It has been probed once but not yet benchmarked.

### Tasks

| Task | Language | Fixture | What it stresses |
|---|---|---|---|
| `multi-file-rename` | JS | 6 files | Rename `loadConfig` across imports, calls, a re-export and a doc comment; `loadConfigSchema` must stay |
| `add-param-callsites` | JS | 4 files | Add a required parameter; 12 call sites each need a different argument |
| `long-file-fix` | JS | 2,587 lines | Fix one function near line 1,877 and change nothing else |
| `long-file-multi-edit` | Python | 2,153 lines | Three edits near the start, middle and end |
| `vague-bug-js` | JS | 3 files | Only the symptom is given: a negative checkout total |
| `vague-bug-py` | Python | 3 files | Only the symptom is given: a dropped report row |
| `python-indent` | Python | 55 lines | Add a `try`/`except` and an `elif` at the right nesting level |
| `yaml-multidoc` | YAML | 276 lines | Edit 2 of 9 near-identical Kubernetes documents |
| `conflict-single-file` | JS | 1 file | A merge in progress with 3 conflicts: keep both, ours, theirs |
| `conflict-multi-file` | JS | 3 files | 4 conflicts; two identical-looking hunks need opposite resolutions |
| `rename-shadowed` | JS | 1 file | Rename `count` in one function and its closure only; 4 other functions use `count` |
| `extract-helper` | JS | 1 file | Replace 4 near-duplicate blocks with one helper without changing behavior |

### Scoring

Each task has a check script that tests behavior, so different correct fixes can pass. Some checks also verify that unrelated files have not changed. The scripts stay in the task folder, outside the run's repository; this keeps them out of the normal fixture but does not prevent filesystem access. The conflict tasks use a `setup.sh` that leaves a real `git merge` in progress.

`yaml-multidoc` is the exception: with no YAML library available, it compares text, ignoring trailing whitespace and quotes. Harmless reformatting fails it.

Run `node bench/verify-tasks.mjs bench/tasks-hard` to check the suite without calling Copilot. For every task, it confirms that the untouched fixture fails its check and that the reference answer in `solution/` passes.

### Probe

On November 5, 2026, a partial probe used a 40-credit scheduling threshold: 28 runs, **39.34 credits**, Copilot CLI 1.0.106-9.

- `gpt-6-luna`: 10 tasks in `stock` and 8 in `omc-nudge`. `python-indent` was not run; other task/arm combinations were also missing.
- `claude-haiku-4.5`, `gpt-6.1-terra` and `gpt-6.1-sol`: `omc-nudge` on `long-file-multi-edit`, `multi-file-rename`, `conflict-multi-file` and `vague-bug-js`. The cap skipped Haiku on `conflict-multi-file` and Sol on `multi-file-rename`.

**All 28 runs passed.** The hard suite didn't separate the models or the arms in this probe either. One run per task is too few to measure pass rates, but these tasks may still be too easy for these models.

- **The conflict tools were picked without a hint.** All four nudge runs on conflict tasks used `list_conflicts` and `resolve_conflicts`, mostly in one call each.
- **Long files cost more.** Haiku's `long-file-multi-edit` run cost 9.65 credits, made 6 edit calls and had 2 rejected anchors before it passed. Sol's cost 6.00.

Mean credits per run in the probe, from 3–10 runs per model:

| Model | Credits per run |
|---|---|
| `gpt-6-luna` | 0.17 |
| `gpt-6.1-terra` | 2.72 |
| `gpt-6.1-sol` | 3.53 |
| `claude-haiku-4.5` | 4.91 |

Extrapolating these uneven samples gives about **820 credits** for 12 tasks × 4 models × 2 arms × 3 repetitions (288 runs), or about 270 for one repetition. This is highly uncertain: the three higher-cost models have no stock measurements in this probe. `gpt-6-astra` is excluded unless requested; at about 16.5 credits per earlier run it would add about 1,200 credits for three repetitions on similarly sized tasks.

Raw results: [`hard-probe.jsonl`](../bench/results/hard-probe.jsonl).

```bash
# Free: check that every fixture fails and every solution passes
node bench/verify-tasks.mjs bench/tasks-hard

# Plan the full suite without starting Copilot sessions
node bench/run.mjs --tasks-dir bench/tasks-hard --models claude-haiku-4.5,gpt-6.1-terra,gpt-6.1-sol,gpt-6-luna --arms stock,omc-nudge --reps 3 --plan
```

## PR-style synthetic suite

The five tasks in [`bench/tasks-realistic/`](../bench/tasks-realistic) model backend bug reports with interacting requirements rather than isolated text edits. They are original synthetic fixtures, **not replays of actual PRs**. The pilot covered two tasks with Haiku and Luna; the subsequent full run covered all five with four models.

| Task | Language | Problem |
|---|---|---|
| `tenant-profile-cache` | JavaScript | Tenant and locale isolation, shared in-flight lookups, invalidation races and mutation-safe results |
| `webhook-idempotency` | JavaScript | Concurrent credits, duplicate events, rollback and independent tenants |
| `cursor-feed` | Python | Stable pagination across tied timestamps, tenant-scoped cursors and invalid inputs |
| `chunked-json-feed` | JavaScript | Incremental UTF-8/NDJSON decoding across arbitrary byte boundaries |
| `config-precedence` | JavaScript | Nested configuration precedence, false/zero values, validation and independent copies |

These tasks allow the model to run existing repository tests; the visible tests pass both before and after the fix. Separate checks outside the fixture verify the requested behavior. Each task also has three deliberately incorrect reference mutations: the free verifier requires all 15 to be syntactically valid and rejected. This tests the checks, but does not prove they detect every incorrect solution.

```bash
# Free: validate visible tests, reference solutions and mutations
node bench/verify-tasks.mjs bench/tasks-realistic

# Free: plan one repetition of each task, model and arm (40 runs)
node bench/run.mjs --tasks-dir bench/tasks-realistic --models claude-haiku-4.5,gpt-6.1-terra,gpt-6.1-sol,gpt-6-luna --arms stock-default,omc-nudge --reps 1 --plan
```

`stock-default` provides no explicit tool-selection hint, so both arms receive the same task prompt. OMC still supplies its own nudge. Estimate and approve spending separately before another paid run.

### Haiku/Luna pilot: November 6, 2026

The approved pilot selected `tenant-profile-cache` and `cursor-feed`, two models at default effort, two arms and one repetition: eight planned runs. Copilot CLI was 1.0.106-9, with concurrency 1, a 300-second session timeout, a 40-credit scheduling threshold and an initial 10-credit reservation. The plugin was at `79a9a22`; the runner and new fixtures were uncommitted at the time. Each session used a disposable Copilot profile and Git fixture. The main Copilot settings checksum was unchanged.

**Seven runs completed for 25.5099935 reported credits.** The most expensive run raised the next reservation to 14.52962 credits. Starting the last run would have reserved 40.0396135 credits in total, so the runner stopped before Haiku's stock pagination attempt. Exit status 2 reflected this scheduling stop, not an infrastructure failure.

| Model / arm | Completed / planned | Behavioral checks passed | Mean credits per run |
|---|---|---|---|
| Haiku / stock-default | 1/2 | 0/1 | 4.48 |
| Haiku / omc-nudge | 2/2 | 0/2 | 9.75 |
| Luna / stock-default | 2/2 | 2/2 | 0.35 |
| Luna / omc-nudge | 2/2 | 2/2 | 0.42 |

These are `claude-haiku-4.5` and `gpt-6-luna`. All seven CLI sessions exited successfully and reported usage; failures came from the behavioral graders. Haiku failed the cache task in both arms. Its pagination attempt failed the cross-tenant cursor check. Cache failures retained assertion metadata but not the assertion messages, so their exact unmet requirements cannot be identified from these results. The runner did not retain the edited fixtures or complete event logs.

Haiku's cache nudge run cost 14.53 credits and made 24 model calls, versus 4.48 credits and seven calls for its stock attempt. It also tried one nonexistent file path. Both attempts failed, so this is not evidence that the extra work improved correctness. Luna passed both tasks in both arms; its four runs cost 1.53 credits in total.

The new tasks exposed failures that the earlier probes did not, **for Haiku on these attempts**. Luna still solved both. One attempt per task and arm, with one missing cell, cannot establish stable accuracy rates, rank the models generally, or measure an OMC benefit.

Raw results: [`realistic-pilot-2026-11-06.jsonl`](../bench/results/realistic-pilot-2026-11-06.jsonl).

```bash
# Free: reproduce the pilot report
node bench/report.mjs bench/results/realistic-pilot-2026-11-06.jsonl
```

### Cost scenarios projected from the pilot

These scenarios cover both arms at default effort. They are **not spending approvals, confidence intervals, or billing ceilings**. At the time, three tasks were unmeasured, Haiku's stock sample had only one run, and the 14.53-credit attempt strongly affected its average.

| Scope | Runs | Illustrative credits |
|---|---|---|
| Haiku and Luna, one repetition | 20 | About 75-84 |
| Haiku, Luna, Terra and Sol, one repetition | 40 | About 137-209 |
| All four models, three repetitions | 120 | About 412-626 |

For Haiku/Luna, extrapolating each model/arm mean to five tasks gives 74.98 credits. Pooling each model's observed runs instead gives 83.76, because the Haiku sample contains more nudge runs. Neither calculation removes the task-selection bias.

Terra and Sol had no measurements on this suite at that point. Their earlier hard-probe means were 2.716145 and 3.52869 credits per run, from four and three runs respectively, all with OMC. Ten runs each would add 62.45 credits if those means held, or 124.90 if both doubled. Combining these assumptions with the Haiku/Luna projections gives the four-model scenarios above. Doubling is an illustrative sensitivity assumption, not an observed multiplier or an upper bound; actual costs could fall outside these ranges.

### Full run: four models, three repetitions

On November 6, 2026, all five tasks ran on Haiku, Luna, Terra and Sol, in `stock-default` and `omc-nudge`, three repetitions each: 120 runs. Copilot CLI was 1.0.106-9, default reasoning effort, concurrency 2, a 650-credit scheduling threshold and a 15-credit reserve. The plugin was at `79a9a22`; the runner and fixtures were uncommitted at the time. **All 120 runs completed for 470.77 credits**, inside the 412–626 scenario, with no timeouts or infrastructure errors. The main Copilot settings checksum was unchanged.

| Model / arm | Passed | Mean credits | Output tokens | Model calls | Median wall (s) |
|---|---|---|---|---|---|
| Haiku / stock-default | 4/15 | 5.17 | 3,568 | 10.2 | 33.0 |
| Haiku / omc-nudge | 6/15 | 8.49 | 5,579 | 14.6 | 53.5 |
| Luna / stock-default | 15/15 | 0.32 | 2,352 | 6.3 | 31.1 |
| Luna / omc-nudge | 15/15 | 0.37 | 2,625 | 6.9 | 34.7 |
| Terra / stock-default | 15/15 | 3.42 | 2,080 | 5.2 | 33.0 |
| Terra / omc-nudge | 15/15 | 3.93 | 2,187 | 6.5 | 33.8 |
| Sol / stock-default | 15/15 | 4.61 | 1,804 | 5.5 | 28.8 |
| Sol / omc-nudge | 15/15 | 5.07 | 1,847 | 5.7 | 33.3 |

Haiku passes by task, stock → OMC: `chunked-json-feed` 1/3 → 2/3, `cursor-feed` 0/3 → 1/3, `webhook-idempotency` 3/3 → 3/3, `config-precedence` 0/3 → 0/3, `tenant-profile-cache` 0/3 → 0/3.

- **Only Haiku found these tasks hard.** The three GPT models passed all 90 runs, so the suite cannot distinguish their accuracy or show an accuracy benefit from OMC.
- **Haiku with OMC passed 2 more runs but cost 64% more.** The difference is two passes out of 15; three repetitions per task are too few to establish an accuracy improvement. OMC cost more on every task, most on `cursor-feed` (5.00 → 11.15) and `tenant-profile-cache` (3.28 → 8.13). Haiku made more model calls with OMC, and its runs took longer.
- **OMC cost 10–17% more on the GPT models without changing outcomes.** All stock GPT runs used `apply_patch`; nearly all OMC runs used `edit_anchored` instead. The saved results do not isolate the cause of the cost difference.
- **`edit_anchored` was used without a manual prompt hint** in 59 of 60 OMC runs; the plugin supplied its own nudge, and the remaining Sol run used `apply_patch`. Rejected anchored edits: Haiku 6, Terra 6, Luna 2, Sol 0. The full event logs and edited fixtures were not retained, so recovery and file integrity cannot be established for every rejected edit.

**OMC runs were slower.** Median wall time rose 0.8–4.5 seconds per run on the GPT models (2–16%) and 20.5 seconds on Haiku (+62%), where its slowest task doubled (`cursor-feed`, 35.0 → 78.4 s). Median time outside the reported API duration during the Copilot process was 4.0–5.4 seconds in every cell; this includes tool execution and startup, but excludes fixture setup and grading. Haiku's median API time rose from 29.1 to 48.2 seconds, alongside 43% more model calls (10.2 → 14.6). Its average per-run API time divided by call count rose from 3.2 to 3.6 seconds; this is not a measurement of individual call latency. For the GPT models, calls rose by 0.2–1.3 per run and the API-time changes were small, so this data cannot separate extra calls from longer prompts or service variation. Timing comes from one machine at concurrency 2 and includes service latency.

These results motivate testing model-specific defaults, but the arms differed by the whole plugin, not only anchored editing. Isolate that feature before choosing defaults. See the deferred roadmap item for per-model tool profiles in [investigation.md](investigation.md#roadmap).

Raw results: [`realistic-full-2026-11-06.jsonl`](../bench/results/realistic-full-2026-11-06.jsonl).

```bash
node bench/report.mjs bench/results/realistic-full-2026-11-06.jsonl
```

### Public changes to consider later

These public candidates have automated tests and do not primarily require visual assessment. None has been turned into a benchmark task or executed here.

| Candidate | Possible task | Caveat |
|---|---|---|
| [Azure/azure-cli-extensions#9188](https://github.com/Azure/azure-cli-extensions/pull/9188) | Fix LocalDNS profile overrides; the PR changes Python code and adds tests. Its merge parent is `dfd42d429252abd4e17d51ba622b6f512eb340ad`. | Check the extension's test dependencies and isolate the added tests from the model. |
| [tesseraworkspaces completion fix](https://github.com/jdbencardinop/tesseraworkspaces/commit/fb03092b79860db52d7df1200533a22860da53b2) | Fix reparent completion context; the commit includes Go regression tests. Its parent is `54f214f080f82ac66b44e3d16de4cf7f8f285419`. | The project has `.tpatch` records; inspect the base and Git history for answer leakage. |
| [az-oauth-tunnel Windows URL fix](https://github.com/jdbencardinop/az-oauth-tunnel/commit/60ae7da7b1e1602bf87c1755d1053d5feb1bc3ab) | Fix shell metacharacter handling in browser launch URLs; the commit adds Go unit tests. Its parent is `a258d637ae45a19587a75d642a863bfbddfed0f9`. | Actual shell validation requires Windows. The base predates the repository's license file, so confirm reuse rights. |

For any chosen change, pin the pre-change base, review licensing and test dependencies, and keep the solution and added regression tests outside the agent's fixture. Check for answer leakage through repository files and Git history. The runner cannot prevent access to those files or to public solutions on the network; use an appropriately isolated environment with controlled access before a real replay.

## Rerun it

The runner needs a signed-in Copilot CLI. It costs about 2–4 AI credits per run for most models; `gpt-6-astra` costs about 16 and `gpt-6-luna` about 0.2. Probe one run before a large batch on a new model.

```bash
# Smoke test: one task, both arms, about 5 credits
node bench/run.mjs --tasks restore-negation --arms stock,omc

# Reproduce the original runs into new files
node bench/run.mjs --models claude-haiku-4.5,gpt-6.1-sol --arms stock,omc --reps 3 --concurrency 4 --out bench/results/main-rerun.jsonl
node bench/run.mjs --models claude-haiku-4.5,gpt-6.1-sol --arms omc-nohint --out bench/results/nohint-rerun.jsonl

# The instructions spot check (about 21 credits)
node bench/run.mjs --models claude-haiku-4.5,gpt-6.1-sol --arms omc-instructions,omc-off-instructions --tasks restore-negation,many-callsites --out bench/results/instructions-rerun.jsonl

# The plugin's own nudge, all six tasks (36 runs; about 94 credits)
# Use a new output file; appending requires --append.
node bench/run.mjs --models claude-haiku-4.5,gpt-6.1-sol --arms omc-nudge --reps 3 --concurrency 4 --out bench/results/nudge-rerun.jsonl

# Tables
node bench/report.mjs bench/results/main.jsonl bench/results/nohint.jsonl
```

`run.mjs` options:

- `--models`, `--arms` and `--tasks` take comma-separated lists. The arms are `stock`, `stock-default`, `omc`, `omc-nohint`, `omc-nudge`, `omc-instructions` and `omc-off-instructions`;
- `--reps`, `--concurrency` and `--timeout` (seconds) take numbers;
- `--effort <level>` sets the reasoning effort for every run;
- `--tasks-dir <dir>` picks another suite, such as `bench/tasks-hard`;
- `--plan` validates and prints the run matrix without reading the Copilot profile, creating results or starting sessions;
- `--max-credits <n>` is a **per-invocation scheduling threshold, not a hard cap**. The runner stops starting sessions when known spend plus reservations would exceed it. Each reservation is at least `--run-cost` (default 5), or the most expensive finished run if higher. Actual and in-flight costs can exceed the reservation or threshold, and an interrupted session's reported usage may be incomplete. Choose a conservative reserve and low concurrency; do not rely on this option to enforce a strict budget;
- Missing usage, failed CLI sessions, and a grader that cannot launch or times out stop new sessions and exit nonzero. A threshold stop or known overrun exits with status 2; a task that completes but fails its behavioral check is recorded as a benchmark failure;
- `--append` explicitly allows writing to a nonempty output file. The threshold covers only the current invocation, not previous entries in that file;
- `--keep` leaves scratch folders in place for inspection, including copied Copilot authentication data and potentially sensitive event logs. Protect and remove them when finished.

The raw results are in [`bench/results/`](../bench/results), one JSON object per run.

## What to try next

- **Rerun the original six tasks with stock and the nudge together.** The nudge has 36 successful runs on those tasks, but its stock comparison is historical. Interleave both arms on the same CLI version to control latency and cache conditions more closely.
- **Separate the GPT models.** They passed all 90 runs on the PR-style suite; add harder tasks or a real PR replay before measuring their accuracy. For Haiku, more repetitions would show whether OMC's two extra passes hold up.
- **Add a real change.** Choose a public PR or commit, then check its base, hidden tests, dependencies and solution leakage before benchmarking.
- **Test weaker models** when they are available, because OMP saw its largest gains there.
- **Make anchor errors easier to fix.** For example, when the model passes `HASH|content`, find the line by its hash and suggest the full anchor.
