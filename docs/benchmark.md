# Benchmark: stock Copilot vs oh-my-copilot editing

## Result

When the model is told to use them, the anchored tools make edits faster and use fewer tokens. They did not change success: every run in every arm passed, so these tasks were too easy to show any accuracy difference.

| Model | Median wall time | Output tokens | Cached input tokens | Fresh input tokens | AI credits | Model calls |
|---|---|---|---|---|---|---|
| claude-haiku-4.5 | 13.7 → 10.8 s (**−21%**) | 1,196 → 643 (**−46%**) | 104k → 55k (**−48%**) | 9.2k → 12.3k (+34%) | 2.78 → 2.40 (**−14%**) | 6.1 → 3.4 |
| gpt-6.1-sol | 13.8 → 10.3 s (**−25%**) | 286 → 180 (**−37%**) | 59k → 44k (**−25%**) | 7.3k → 7.3k (0%) | 2.70 → 2.45 (**−9%**) | 4.5 → 3.3 |

Each cell is stock → oh-my-copilot, averaged over 18 runs per arm (6 tasks × 3 repetitions). Wall time is the median; everything else is the mean.

Three caveats:

1. **Models do not pick the tools on their own.** Without a hint in the prompt, neither model used the anchored tools in any of 12 runs, and the results matched stock Copilot. Something has to steer the model. A personal instructions file did in a small [spot check](#spot-check-nudging-with-an-instructions-file), and the README shows the text to use.
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
| `omc` | Yes | "Use the read_anchored and edit_anchored tools" |
| `omc-nohint` | Yes | None |
| `omc-instructions` | Yes | None, but a personal `copilot-instructions.md` tells the model to use the anchored tools |
| `omc-off-instructions` | Yes, switched off with `OMC_DISABLE=1` | None, with the same instructions file |

The two instruction arms appear only in the [spot check](#spot-check-nudging-with-an-instructions-file).

Each run starts a fresh, non-interactive Copilot session with `--output-format json`. It uses its own `COPILOT_HOME` and a fresh git repository that holds only the task file. Built-in MCP servers and user hooks are off. Runs are shuffled and execute up to 4 at a time.

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

The instructions are the text in the [README](../README.md#make-copilot-use-the-anchored-tools), placed in the run's personal Copilot home. Each model ran 2 tasks (`restore-negation` and `many-callsites`) once per arm: 8 runs, about 21 AI credits. This is a check, not a measurement. The sample is too small to compare speed or cost.

| Arm | Model | Pass | Runs using the anchored tools | Edit tools used |
|---|---|---|---|---|
| `omc-instructions` | claude-haiku-4.5 | 2/2 | 2/2 | `read_anchored` and `edit_anchored` (one run also called `view` once) |
| `omc-instructions` | gpt-6.1-sol | 2/2 | 2/2 | `read_anchored` and `edit_anchored` |
| `omc-off-instructions` | claude-haiku-4.5 | 2/2 | 0/2 | `edit` (1 call, then 9 calls) |
| `omc-off-instructions` | gpt-6.1-sol | 2/2 | 0/2 | `apply_patch` |

- **The instructions worked.** All 4 runs with the plugin on used the anchored tools and passed, with no hint in the prompt.
- **The fallback held.** With the plugin switched off and the same instructions in place, all 4 runs used the built-in tools and passed. None recorded a failed tool call.

Not tested: the repository-level `.github/copilot-instructions.md`, other tasks, and longer sessions.

## Rerun it

The runner needs a signed-in Copilot CLI. It costs about 2–4 AI credits per run.

```bash
# Smoke test: one task, both arms, about 5 credits
node bench/run.mjs --tasks restore-negation --arms stock,omc

# The run in this document
node bench/run.mjs --models claude-haiku-4.5,gpt-6.1-sol --arms stock,omc --reps 3 --concurrency 4 --out bench/results/main.jsonl
node bench/run.mjs --models claude-haiku-4.5,gpt-6.1-sol --arms omc-nohint --out bench/results/nohint.jsonl

# The instructions spot check (about 21 credits)
node bench/run.mjs --models claude-haiku-4.5,gpt-6.1-sol --arms omc-instructions,omc-off-instructions --tasks restore-negation,many-callsites --out bench/results/instructions.jsonl

# Tables
node bench/report.mjs bench/results/main.jsonl bench/results/nohint.jsonl
```

`run.mjs` options:

- `--models`, `--arms` and `--tasks` take comma-separated lists. The arms are `stock`, `omc`, `omc-nohint`, `omc-instructions` and `omc-off-instructions`;
- `--reps`, `--concurrency` and `--timeout` (seconds) take numbers;
- `--keep` leaves each run's scratch folder in place for inspection.

The raw results are in [`bench/results/`](../bench/results), one JSON object per run.

## What to try next

- **Ship the nudge with the plugin.** The instructions file works, but each user must create it. Look into a skill, a prompt hook, or instructions provided by the plugin itself. Then run all six tasks on `omc-instructions`; the spot check used two.
- **Add harder or larger tasks,** such as several files, long files, or vague bug descriptions, so that accuracy can differ.
- **Test weaker models** when they are available, because OMP saw its largest gains there.
- **Make anchor errors easier to fix.** For example, when the model passes `HASH|content`, find the line by its hash and suggest the full anchor.
