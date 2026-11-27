# Versus for Claude

**IACDM (Interactive Adversarial Convergence Development Methodology) orchestrator for Claude Code.**

An original methodology created by [Jasmine Moreira](https://github.com/jasminemoreira) that transforms LLMs from reactive code generators into disciplined agents following a structured 8-phase process — from problem discovery to delivery with tests and post-review.

## Why?

AI coding tools share one limitation: **zero internal verification capability**. They generate statistically plausible output without distinguishing correct code from incorrect code. The METR study (2025) showed experienced developers using AI tools were actually **19% slower** — despite believing they were 20% faster.

**The real distinction isn't between tools — it's between process and no process.**

Versus implements the GA/VA (Generative Agent / Verification Agent) model: the AI generates, external agents (automated tests + human operator) verify at discrete **gates**. The gates are enforced by a state machine outside the model — the agent may request advancement, not grant it. Errors are caught at the earliest possible phase, not in production.

## Features

- **8 sequential phases** with verifiable exit criteria — no skipping steps
- **8 safeguards (S0–S7)** against common agent errors (premature convergence, scope creep, blind debugging, reimplementation)
- **Convergence score** (0–100) that gates advancement until the problem is truly understood
- **17 MCP tools** — state, decisions, exit criteria, transitions, phase guidance, lens activation, cycles and their export
- **Code blocked in Phases 0–4** — Edit/Write and shell writes (`cat > src/…`, `tee`, `sed -i`, `cp`/`mv`); documentation, `specs/` and files outside the project stay writable
- **Witnessed tests** — a test run counts only when the hook sees it, with the exit status read from `VERSUS_TEST_EXIT=$?` in any language; npm, pytest, cargo, go, xcodebuild, swift, gradle, mvn, dotnet, flutter and more are recognized, others can be added in `.versus/test-commands`; a run from outside the project does not count
- **Blind-debugging stop (S6)** — three failed runs of the same suite without a named diagnosis block the next run; a passing run never counts
- **Human approvals on the record** — 3→4 (convergence), 4→5 (convergence confirmed after the Phase 4 report), 6→7 (test sign-off) and the cycle close need a decision naming who approved
- **Artifacts checked for form** — architecture module table, coverage matrix (ids, canonical lens, severity), critical and premise coverage, promised tests (`T-xx`) present in test files, a `## Desvios` section, the Scope Inventory, a `guard:` line per lesson
- **Declared checks are executed, not attested** — a criterion can declare a command (`grep … | wc -l` → `0`); the transition waits until the hook has seen it give the expected result
- **Stop verification** — in Phases 5+, type-check, lint and tests run before the turn ends; a timeout is reported as *unverified*, not as a failure
- **State on every prompt**, sized for Claude Code's hook limit; the methodology itself comes from `get_phase_guidance`
- **Session start and compaction recovery** — the state and the instruction to load the guidance arrive when a chat opens and after every compaction; a `📍 Versus <version> ativo` banner shows you it is running
- **Cycles archived, never wiped** — each closed cycle keeps its exit criteria, approvals and test provenance, with a readable export in `.versus/cycles/cycle-N.md`
- **Adversarial critique** with 7 universal + 12 conditional specialized lenses, recorded per iteration
- **Brownfield bootstrap** — take over an existing codebase, Phase 0 runs in delta mode
- **Sidebar** with the methodology state and the live safeguard status

## How It Works

```
Phase 0: Problem Discovery    → HSA 5-level exploration (score >= 90 to advance)
Phase 1: Architecture         → Define modules, interfaces, patterns
Phase 2: Adversarial Critique → Attack the architecture with up to 19 specialized lenses
Phase 3: Simplification       → Address criticals, simplify (loops with Phase 2)
Phase 4: Convergence Gate     → Validate all exit criteria + safeguards
Phase 5: Implementation       → Code the final architecture
Phase 6: Tests                → 100% passing + exploratory testing
Phase 7: Post-Review          → Double-loop learning: evaluate product AND process
```

### Phase 0: Hierarchical Semantic Analysis (HSA)

The most distinctive contribution. Structures problem exploration in 5 levels, each building on the previous:

| Level | Focus | What is sought |
|---|---|---|
| 1. Domain | Universe where the problem exists | Vocabulary, theoretical/technical field, tools, state of the art |
| 2. Problem | What needs to be solved | 5W1H: who, what, when, where, why, how solved today |
| 3. Elements | Parts composing the problem | Components, entities, actors, constraints |
| 4. Processes | How parts relate | Flows, transformations, dependencies, feedback cycles |
| 5. Product | Expected outcome | Deliverables, acceptance criteria, success metrics |

### Context Efficiency

The methodology maximizes `E = I₀/C` (relevant information / total context consumed) through granularization: each session focuses on one module with just its interface signatures, so `C` stays bounded and `I₀` remains a large fraction of it — while in a monolithic session `E` tends to zero as the system grows. (`E` is a conceptual definition, not a measured metric.)

## Quick Start

1. Open your project in VS Code with the Claude Code extension installed.
2. Command Palette (`Ctrl+Shift+P`) → **Versus Claude: Initialize Project**, then enter a name and description.
3. Open a **new Claude Code conversation** — you should see the `📍 Versus … ativo` banner.
4. Describe what you want to build — the agent loads the state and the Phase 0 guidance and starts.
5. Lost context? Type **`retomar Versus`**.

> **After updating the extension, reload the window** (Developer: Reload Window). An open window keeps running the version it started with, and so does its project's `.versus/` — Versus warns you when it detects this.

## Claude Code Hooks

Written to `.claude/settings.json`; the bundles are deployed to `.versus/` on activation.

| Hook | Event | Function |
|---|---|---|
| **session-start** | `SessionStart` | State + instructions when a chat opens or after compaction; session banner for you |
| **inject-context** | `UserPromptSubmit` | Current state on every prompt (warnings first, under the 10,000-character hook limit) |
| **phase-gate** | `PreToolUse` (Edit/Write/MultiEdit/NotebookEdit/Bash) | Blocks code changes in Phases 0–4, including shell writes |
| **block-destructive** | `PreToolUse` (Bash) | Blocks destructive commands and `.env` reads |
| **loop-detector** | `PreToolUse` (Bash) | Blocks a test run after 3 consecutive failures with no diagnosis (S6) |
| **test-outcome** | `PostToolUse` (Bash) | Records witnessed test runs and declared checks |
| **truncation-check** | `PostToolUse` (Grep/Bash) | Warns when tool output was truncated |
| **stop-verify** | `Stop` | Type-check, lint and tests before the turn ends (Phases 5+) |
| **pre-compact** | `PreCompact` | Tells the compaction summary which Versus state to preserve |

**Loop detection counts failures, not executions.** Re-running after a named fix is normal debugging, so only a *failed* run accumulates; a passing run or `record_decision(category='diagnosis')` clears the counter. Verification is never blockable: the green run always goes through.

## The 8 Safeguards

| ID | Name | Protects Against |
|---|---|---|
| S0 | Problem Convergence | Advancing without understanding the problem |
| S1 | Anti-Bug | Simplification that introduces bugs |
| S2 | Stopping Criterion | AI deciding when to stop (user's decision) |
| S3 | Premature Convergence | Stopping iteration too early |
| S4 | Explicit Verification | Skipping human validation at gates |
| S5 | Scope Preservation | Scope creep during critique-simplification |
| S6 | Do Not Reimplement | Recreating what already exists; blind debugging |
| S7 | Sequence Discipline | Starting tangential discussions during implementation |

## The GA/VA Model

```
P₀ → G₀ → P₁ → G₁ → ... → Pₙ → Gₙ → delivery
      ↑              ↑                    ↑
  VA evaluates   VA evaluates        VA evaluates
```

- **GA (Generative Agent):** The LLM. Produces artifacts without verification capability.
- **VA-automatic:** Tests, linters, compilers — binary verdict on formalizable properties.
- **VA-human:** The operator — evaluates semantic adequacy, usability, domain correctness.
- **Gate (Gₖ):** Discrete point where progression requires VA approval. Rejection feeds concrete error information back to the GA.

## LLM Compatibility

The methodology needs strict instruction following, reliable MCP tool calling and long-context reasoning. Use your most capable Claude model (Opus) for Phases 0–4 (design); the **LLM Switch Point at Phase 4** lets you move to a cheaper one (Sonnet) for Phases 5–7 without losing context — everything is persisted in `.versus/state.json` and `specs/`. Switch by opening a new conversation, not mid-conversation.

## Requirements

| Requirement | Minimum | Why |
|---|---|---|
| **VS Code** | >= 1.85 | Extension API |
| **Claude Code** | current | VS Code extension or CLI; hooks and MCP |
| **Node.js** | >= 18 | Runs the hooks and the MCP server |

> **Node.js is mandatory.** Without it the hooks and the MCP server cannot start, and Claude ignores the methodology. Install from [nodejs.org](https://nodejs.org).

## Known Limitations

- **Gates check form and existence, not truth.** An approval's `approvedBy` and a lesson's `guard:` line are written by the agent; Versus makes a missing approval or a missing record visible, it cannot make a false one impossible.
- **The methodology text is fetched, not injected.** Claude Code turns hook output over 10,000 characters into a 2,000-character preview, so the per-prompt injection carries only the state; the guidance arrives through `get_phase_guidance`, which the session-start and compaction hooks tell the model to call.
- **The Claude Code VS Code extension does not pass a test's exit code to hooks.** Append `; echo "VERSUS_TEST_EXIT=$?"` to the test command (the guidance and the refusals say so) — then any runner, in any language, is read correctly.

## Companion Extensions

Same methodology for other agents — [Versus for Cursor](https://open-vsx.org/extension/jmoreira/versus-cursor), [Versus for Kimi](https://github.com/jasminemoreira/Versus-Kimi), [Versus for Qwen](https://github.com/jasminemoreira/Versus-Qwen) and [Versus for Local Qwen](https://github.com/jasminemoreira/Versus-LocalQwen).

## References

- Source methodology: **[Versus](https://github.com/jasminemoreira/Versus)** — canonical repository with the methodology's theory, history, and evolution.
- Academic paper: **[arxiv:2604.16399](https://arxiv.org/abs/2604.16399)** — formal description of IACDM.
- What changed in each version: [CHANGELOG](CHANGELOG.md).

## License

[MIT](LICENSE) — Created by [Jasmine Moreira](https://github.com/jasminemoreira).
