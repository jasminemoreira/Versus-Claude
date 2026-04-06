# Changelog

## [0.5.0] - 2026-04-06

### Added
- **`stop-verify` hook (Stop event).** Blocks task completion until the project compiles, lints, and passes tests. Auto-detects TypeScript (tsc), ESLint, Python (mypy/ruff), Rust (cargo), and test runners (npm test, pytest, cargo test). Prevents the LLM from declaring "Done!" with broken code. Fail-open if no toolchain is detected (warns instead of blocking). Infinite-loop protection via `stop_hook_active` flag.
- **`truncation-check` hook (PostToolUse: Grep|Bash).** Detects when Claude Code truncates tool output (>50K chars → 2KB preview) and injects a warning so the agent reads the full file or narrows its search scope. Also flags suspiciously low grep result counts.
- **`block-destructive` hook (PreToolUse: Bash).** Blocks destructive commands before execution: `rm -rf /`, `DROP TABLE`, `git push --force`, `.env` file reads. Denied operations can be run manually by the user in a separate terminal.

### Changed
- Hook count increased from 3 to 6 (inject-context, phase-gate, loop-detector + stop-verify, truncation-check, block-destructive).
- Bundle pipeline updated to compile all 7 entry points (6 hooks + MCP server).

## [0.4.3] - 2026-03-12

### Added
- **P5 exit criterion `ui_runnable` (required).** The engine now blocks advancing to Phase 6 unless the UI is explicitly marked as implemented and accessible for manual testing — or documented as N/A for backend-only projects. Fixes the pattern where the LLM implements the backend and skips the UI, leaving Phase 6 manual testing with nothing to test.

### Changed
- **P1 guidance: UI as explicit module.** Full and compact guidance now require that any project with a user interface list the UI as a named module in the decomposition (with its own interface contract), never as an implied extension of a backend module.
- **P5 Scope Inventory: item 3 — UI runnable check.** Added a third item to the mandatory scope inventory: verify the UI is implemented and navigable, with explicit `mark_exit_criteria()` instructions. Backend-only projects document N/A and mark the criterion as met.

## [0.4.2] - 2026-03-04

### Changed
- **AP1 reframed as GENERATION MODE.** Phase 2 antipattern AP1 updated from "ask for refutation, not validation" to explicit generation mode framing: "produce failure scenarios ('how does this fail?'), not quality judgments ('is this good?')". The distinction prevents confirmation bias — generative framing produces new content with no anchor, evaluative framing asks the AI to judge its own output. Applied to `full-guidance.ts`, `compact-guidance.ts`, and `SKILL.md` (v3.11).
- **P0 Step 0.5 — Delivery Target (SKILL.md v3.11).** Added mandatory first question before HSA: establish the delivery target (prototype/MVP/production) before starting the problem analysis. Previously, delivery target appeared only at Level 5, which was too late in the flow.

## [0.4.1] - 2026-03-04

### Fixed
- **Global MCP permissions on activation.** `ensureGlobalPermissions()` now runs on every extension activation and writes all MCP tool permissions to `~/.claude/settings.json` (global). Previously, permissions were only written to the workspace `.claude/settings.json` — on a fresh machine or new workspace before `init_project`, Claude Code would prompt for each MCP tool call. Global write ensures tools are pre-approved across all workspaces on the machine.
- **Log prefix `[Versus Lite]` corrected to `[Versus Claude]`** — leftover from the rename in v0.4.0.

## [0.4.0] - 2026-03-02

### Changed
- **Full codebase refactoring** based on adversarial analysis. All changes below are part of this release.

### Removed
- **`methodology.ts` deleted (zombie facade).** Pure re-export passthrough with one logic function (`validatePhaseTransition`) — moved to `engine.ts` as module-level function. Eliminates indirection layer.
- **`guidance.ts` deleted (773-line monolith).** Split into `full-guidance.ts` (MCP `get_phase_guidance` tool) and `compact-guidance.ts` (hook `inject-context`). Eliminates ~400 lines of mixed concerns in a single file.
- **`inject-context.ts`: removed TRANSITION RULE and "For detailed phase instructions" lines.** ~45 tokens/msg overhead eliminated. Transition rule was duplicating phase gate logic already enforced by `phase-gate.ts` hook.
- **`inject-context.ts`: removed `PHASE_NAMES` constant.** 10-line duplicate of `phases.ts` data — replaced with `getPhaseDefinition()` call.
- **`sidebar.ts`: removed 3s polling (`setInterval`).** Replaced with `FileSystemWatcher`-only approach. Eliminates unnecessary CPU/disk activity between state changes.
- **P2 compact: removed static `VALID LENS NAMES` block (~526 tokens/msg).** Replaced with dynamic injection of the model's own `ACTIVATED LENSES` decision from `state.decisions`. Fallback warning (~25 tokens) when Step 1 not yet executed. Prevents token waste on lenses not activated for the project.

### Fixed
- **`inject-context.ts`: fixed `(d: any)` filter callback.** TypeScript strict mode violation — removed explicit `any` annotation.
- **`server.ts`: corrected version string** from `"0.2.0"` to match package version.
- **`phase-gate.ts` + `loop-detector.ts`: added 5s stdin timeout (fail-open).** Hooks were hanging indefinitely if stdin closed unexpectedly. Timeout prevents blocking the agent.
- **`sidebar.ts`: added 300ms debounce on watcher.** A single `state.json` write could fire `onDidChange` multiple times, causing duplicate refresh calls and duplicate phase-transition notifications.
- **`sidebar.ts`: phase-transition notification text** updated to `"Versus Claude:"` prefix (was generic). Prevents confusion when multiple extensions are installed.
- **`specs/` directories created on `initProject`.** 9 subdirectories (`domain`, `references`, `technical`, `examples`, `design`, `models`, `datasets`, `validation`, `competitors`) were not being created — agent found empty workspace on Phase 0 start.
- **P5 compact: scope inventory auto-advance.** Changed `"YOUR NEXT TOOL CALL is advance_phase()"` to `"call advance_phase() IN THIS SAME TURN"` — model was stopping after displaying the inventory and waiting for user input before advancing.

### Added
- **`engine.ts`: `markExitCriteria()` batch method.** Accepts array of `{phase, criterion, met, details}` — saves once after all updates instead of N individual writes.
- **`inject-context.ts`: P2+P3 ACTIVATED LENSES pinning.** The `ACTIVATED LENSES` decision from Phase 2 is pinned in the sliding decision window for both P2 and P3 — prevents lens drift across P3 iterations when the decision falls out of the last-3 window.

## [0.3.33] - 2026-03-01

### Added
- **P5: Adversarial micro-check per module.** After each module, the agent must ask "Where does this implementation DIVERGE from spec?" — adversarial framing prevents AP1 self-validation bias. Divergences fixed before moving to next module (catches drift early, not at end).
- **P5: Scope inventory at exit gate (MUST DISPLAY).** Before `advance_phase()`, agent displays ✅/❌ for: (1) all P1 modules present in codebase, (2) all specs/validation requirements covered by at least one module. Presence/absence check only — quality is Phase 6's job. Both checks in compact and full `PHASE_5_GUIDANCE`. Regression tests added.

## [0.3.32] - 2026-03-01

### Fixed
- **P5: Inter-module stopping caused by text output ending the turn.** Root cause: S7 said "announce X/N completed" — writing text output ends the agent turn, requiring user input to continue. The instruction "YOUR NEXT TOOL CALL" was contradicted by the preceding text output. Fix: replaced announcement with explicit prohibition — NEVER write text between modules (`'X/N completed'`, `'I will now implement X'`, `'Next:'`). Progress visible from tool calls. Regression test: `assertContains(5, "text between modules")`.

## [0.3.31] - 2026-03-01

### Fixed
- **P2 compact: enumerate all 19 lens names.** Previously compact listed 7 universal lenses but not the 8 conditional lenses or 4 DTLs. The agent could not distinguish legitimate lenses (e.g., UI/UX, Observability/Operability) from invented ones. Added `VALID LENS NAMES` line enumerating all 8 conditionals (Resilience, UI/UX, Migration/Coexistence, Sustainability/Proportionality, Ethical/Human Impact, Process/Workflow, Governance/Accountability, Observability/Operability) and 4 DTLs (Control Engineering, Game Theory, Linguistics/Grammar, Mechanical Engineering). Regression tests updated.

## [0.3.30] - 2026-03-01

### Fixed
- **P2 compact: MODULE BOUNDARY guard.** Agent could apply lenses to modules not in P1 decomposition. Added instruction: apply lenses to ONLY modules defined in P1.
- **P2 compact: P1 negative scope items are OOB in P2.** `BOUNDARY` instruction now explicitly states: "P1 negative scope items CANNOT become implementation proposals."
- **P3 compact: ANTI-SCOPE-CREEP checklist with P1 negative scope guard.** 4-item checklist (MUST DISPLAY ✅/❌) including: P1 negative scope is still negative.
- **P6 compact: P3 scope merge.** `get_decisions(phase=3)` added to Step 1 scope recovery — P3 boundary revisions now included in P6 test scope.
- **P6 compact: BINDING CONSTRAINTS in test code.** P1-approved tech stack enforced in test frameworks and runtimes.
- Regression tests updated for P2, P3, P6. All 24 tests pass.

## [0.3.29] - 2026-03-01

### Fixed
- **P5 compact: BINDING CONSTRAINTS.** Agent was using unapproved frameworks even when P1 specified vanilla JS. Added `BINDING CONSTRAINTS` block in compact and full `PHASE_5_GUIDANCE`. Regression test added.
- **P5 compact: context recovery conditional.** Made `get_decisions()` + `check_specs_status()` conditional on new session — not mandatory overhead in continuous P0→P5 flows.

## [0.3.28] - 2026-03-01

### Fixed
- **P4 compact: LLM Switch duplicate.** Both compact P4 and full P4 guidance displayed LLM Switch notification — shown twice. Fixed: display only from full guidance (called once via `get_phase_guidance()`).
- **P4 compact: intentional pause exception.** P4→P5 pause is explicit — agent must NOT auto-call `get_phase_guidance()` after advancing; resumes only on user "continue".

## [0.3.27] - 2026-03-01

### Fixed
- **P2–P6 compact: FLOW instruction added to all phases.** Phases P1–P6 were stopping mid-phase after recording decisions. Added FLOW to every phase.
- **P1 compact: FLOW after architecture answers.** Prevents "I'll draft the architecture decomposition" + stop pattern.

## [0.3.22] - 2026-03-01

### Fixed
- **P2 compact: `invent` prohibition added.** Explicit constraint after universal lens enumeration preventing invention of lens names not in the methodology.

## [0.3.21] - 2026-03-01

### Fixed
- **AI Confident criterion: added explicit description.** Both `guidance.ts` (full guidance) and `SKILL.md` now show `AI Confident (can answer "why?" for every scope, assumption, and decision)` — previously the criterion was opaque with no explanation of what the AI evaluates. Replicated to Versus-Copilot v0.3.18.

## [0.3.20] - 2026-03-01

### Added
- **Compact guidance sync guard: content regression tests (P0-P7).** 8 new test cases in `engine.test.ts` assert key terms per phase. Replicated from Versus-Copilot v0.3.17.
- **Anchor comments in `getCompactGuidance()`.** Each `lines.push()` references its full guidance section.
- **Maintenance checklist in JSDoc of `getCompactGuidance()`.** 5-item checklist.

### Fixed
- **P0 compact: added get_phase_guidance() chain** after advance_phase() in AFTER SCORE (score ≥90 path).
- **P2 compact: added get_phase_guidance() chain** after advance_phase() in AFTER GATE.
- **P3 compact: added get_phase_guidance() chain** for 'More iterations' path after advance_phase() to P2.
- **P4 compact: normalized "LLM Switch Point"** wording (was "LLM SWITCH POINT" — inconsistent with test assertions).

## [0.3.19] - 2026-03-01

### Fixed
- **P2 compact guidance: enumerate the 7 universal lenses by name.** The AI was inventing lens names instead of applying the 7 mandatory universal lenses. Fixed by listing them explicitly: `(1)Assumptions (2)Architectural (3)Implementability (4)Scientific (5)Security (6)Performance (7)Regulatory`. Added `Do NOT invent lens names.` constraint. (Replicated from Versus-Copilot v0.3.15.)

## [0.3.14] - 2026-03-01

### Fixed
- Systematic inconsistency: `PHASE_4_GUIDANCE`, `PHASE_5_GUIDANCE`, and `PHASE_6_GUIDANCE` full constants had no "Next Step" section — no advance_phase(), no get_phase_guidance(). Only compact guidance had the transition instructions.
- `PHASE_3_GUIDANCE` Step 4: Phase 4 path had advance_phase() but no get_phase_guidance() — compact was ahead of full guidance.
- Same fixes applied to SKILL.md Phase 3, 4, 5, 6 sections.

### Changed
- `guidance.ts` PHASE_3_GUIDANCE: Step 4 "→ Phase 4" now includes get_phase_guidance() after advance_phase()
- `guidance.ts` PHASE_4_GUIDANCE: added "Next Step (MANDATORY when all items are ✅)" section
- `guidance.ts` PHASE_5_GUIDANCE: added "Next Step (MANDATORY when all modules are implemented)" section
- `guidance.ts` PHASE_6_GUIDANCE: added "Next Step (MANDATORY when all testing is complete)" section
- SKILL.md Phase 3, 4, 5, 6: same "Next Step" additions mirroring guidance.ts

## [0.3.13] - 2026-03-01

### Fixed
- P1→P2 inconsistency: `PHASE_1_GUIDANCE` full constant (returned by `get_phase_guidance()`) was missing the transition instruction added to compact guidance in v0.3.12. AI calling `get_phase_guidance()` in Phase 1 now receives the same "Next Step (MANDATORY)" instruction.

### Changed
- `guidance.ts` `PHASE_1_GUIDANCE`: added "Next Step (MANDATORY after user confirms architecture)" section after CAUTION AP3
- `SKILL.md` Phase 1: added "Next Step (MANDATORY after user confirms architecture)" section after Exit Criteria Phase 1

## [0.3.12] - 2026-03-01

### Fixed
- Global transition rule: after `advance_phase()` succeeds, AI now immediately calls `get_phase_guidance()` and begins the new phase's first step. Fixes the AI stopping silently after phase transitions (reported at P3→P4).

### Changed
- `inject-context.ts`: added global `TRANSITION RULE` line injected on every message
- `guidance.ts` P3 compact: `AFTER CONFIRMATION` now includes `get_phase_guidance()` after `advance_phase()`
- `guidance.ts` P1, P4, P5, P6 compact: added `WHEN DONE` / `WHEN ALL ✅` / `WHEN TESTING COMPLETE` transition instructions (phases that had no transition instruction at all)
- `SKILL.md`: added R6 (Phase transition) to Global Rules

## [0.3.11] - 2026-03-01

### Fixed
- **Phase 0**: When score < 90, AI now calls `start_iteration()` and continues HSA targeting lowest-scoring criteria. Previously the AI stopped after displaying the score.
- **Phase 2 → Phase 3**: Removed incorrect "Zero 🔴 to advance" blocker. Phase 3 exists to address criticals — advancement is always valid when findings exist. The 🔴 count informs what Phase 3 must do, not whether Phase 3 happens.
- **Phase 3 post-cycle**: AI now executes the agreed action after confirmation — `advance_phase()` for Phase 4, or `start_iteration()` + return to Phase 2 critique for more iterations. Previously the AI stopped after displaying the recommendation.

### Changed
- Compact guidance updated for P0, P2, P3 with explicit AFTER SCORE / AFTER GATE / AFTER CONFIRMATION instructions
- SKILL.md updated with same three fixes

## [0.3.10] - 2026-03-01

### Fixed
- Phase 2 Exit Gate: AI now proactively offers next step after displaying gate summary (advance to Phase 3 / iterate), instead of stopping silently and waiting for the user to ask what to do next.

### Changed
- `PHASE_2_GUIDANCE`: added "Next Step" section after Exit Gate with mandatory AskUserQuestion transition offer
- Compact guidance P2: added explicit "AFTER GATE" instruction and updated DON'T to include "stop silently after gate summary"
- `SKILL.md`: added "Next Step" section after Phase 2 Exit Gate

## [0.3.9] - 2026-02-28

### Added
- 4 Domain Transfer Lenses integrated into Phase 2 as additional conditional lenses (same activation mechanism, unified coverage matrix):
  - **Control Engineering** — detects systems that react to events but don't regulate state (oscillation, drift, runaway feedback). Signal: state synchronization, runtime configuration, feedback-driven systems.
  - **Game Theory** — detects architectures that assume cooperation but collapse under adversarial/strategic behavior. Signal: multiple independent actors, public API, marketplace or platform design.
  - **Linguistics / Grammar** — detects protocol ambiguity where two correct implementations produce incompatible behaviors. Signal: inter-component communication, protocol definitions, interface contracts between independent teams.
  - **Mechanical Engineering** — detects rigid coupling disguised as tolerance; failure from small deviations in dependencies, environment, or load. Signal: module maintenance, system evolution, long-lived systems with technical debt.
- Phase 2 conditional lens count updated from 8 to 12 in guidance header and SKILL.md
- `activated_lenses_recorded` exit criterion description updated to explicitly name all 4 DTLs

## [0.3.8] - 2026-02-28

### Changed
- Phase 2 exit criteria: added `activated_lenses_recorded` (required) — AI must call `record_decision(category='architecture')` declaring which conditional lenses were activated and why each non-activated lens was skipped, **before** starting the critique
- Strengthened `lenses_applied` description: "no lens skipped — absence of findings is a valid result"
- Strengthened `coverage_matrix` description: "all applied lenses as columns"
- P2 compact guidance now has explicit Step 1 (record activation) before Step 2 (apply lenses)
- SKILL.md Phase Guardrails P2: updated DO to "Record activated/non-activated lenses first"

## [0.3.7] - 2026-02-27

### Removed
- HLI (Human Lead Index) metric — removed entirely. The metric measured AI bookkeeping (decision recording, safeguard checks) rather than actual human engagement. The methodology's structural mechanisms (phase gates, exit criteria, safeguards, DO/DON'T guardrails) already prevent vibe-coding by design, making a numeric overlay redundant and misleading.
  - Removed: `PhaseHLI`, `HLIAlert`, `HLIData` types, `metrics/hli.ts`, HLI calculation in `advancePhase()`, sidebar HLI section, context hook HLI injection, MCP tool HLI responses, SKILL.md HLI documentation

## [0.3.6] - 2026-02-27

### Added
- Exit criteria progress in sidebar — shows "[3/8] Exit Criteria" with per-criterion status (met/required/optional), expanded by default
- Phase DO/DON'T guardrails in compact guidance — each phase has explicit boundaries injected into AI context (e.g., P5: "DON'T: Run the application or tests — that is Phase 6")
- Phase hint in sidebar — userHint child item under phase (e.g., "Implement code. Testing happens in Phase 6.") with tooltip
- VS Code notification on phase transition — `showInformationMessage()` with phase name and hint
- HLI explanation tooltip — hover explains the metric, scoring, and how to improve
- Phase Guardrails section in SKILL.md documenting DO/DON'T per phase

### Changed
- All exit criterion IDs translated from Portuguese to English (e.g., `usuario_confirmou` → `user_confirmed`, `viabilidade_tech` → `tech_feasibility`)
- Auto-migration of old Portuguese IDs on state load — existing projects seamlessly upgraded
- Sidebar now imports phase definitions from `phases.ts` instead of hardcoded `PHASE_NAMES` map

## [0.3.5] - 2026-02-27

### Added
- HLI (Human Lead Index) — anti-vibe-coding metric (0-10) calculated at each phase transition measuring human leadership via criteria ratio (30%), decision density (30%), and phase-specific indicator (40%)
- HLI sidebar display with per-phase breakdown, drop alerts (>2 points), context hook injection, and MCP tool response integration

## [0.3.4] - 2026-02-27

### Changed
- Version bump and rebuild to sync with Copilot extension versioning

## [0.3.3] - 2026-02-27

### Changed
- Stability release — version bump only (no code changes)

## [0.3.2] - 2026-02-27

### Added
- Phase 6: Spec-Driven Test Protocol — tests against specs not implementation, Test Map with mandatory display, negative tests (1:2 ratio), false coverage detection, spec coverage report as traceable decision
- Phase 6: Multi-session testing protocol with structured record_decision(category='testing') for cross-session continuity
- LLM Compatibility section in READMEs (Opus S / Sonnet A / Haiku C tiers)

### Changed
- Phase 3: AI computes structural change % and criticals, presents recommendation, user confirms (instead of asking user to choose percentage range)
- Phase 5: Autonomous sequential implementation (S7 reinforced)
- SKILL.md synced with guidance.ts (R3 removed, Phase 3/5/6 updated)
- Publisher ID to JasmineMoreira, URLs to public Versus repo

## [0.3.1] - 2026-02-26

### Added
- New `start_new_cycle` MCP tool: resets to Phase 0 preserving decisions, projectSpec, history, and specs/
- Phase 7 engine hints (_phase7Action) in get_phase_state and mark_exit_criterion to enforce meta-iteration offer
- Delivery Target question in Phase 0 Level 5 conditioning Phase 1 Progressive Scope
- R5 (Mandatory Display) rule with MUST DISPLAY markers across all phases

### Changed
- R3 removed, S7 reinforced for autonomous Phase 5 implementation
- Auto-approved permissions: MCP tools + Read/Write/Edit/Glob/Grep/Bash/WebFetch/WebSearch/NotebookEdit
- READMEs: corrected Quick Start (palette → new conversation → start), added Node.js requirement
- package.json: node >= 18.0.0 engine requirement

## [0.3.0] - 2026-02-25

### Added
- HSA (Hierarchical Semantic Analysis) 5-level structure to Phase 0
- Multi-session testing and Phase 6 testing recovery in SessionStart hooks

### Changed
- Fix all hook/MCP paths from IACDM_Claude to Versus_Claude
- Strengthen SessionStart and compact hooks with imperative STOP prompts
- Force-replace hook merge strategy in ensureSettings (no stale duplicates)
- guidance R2: Add 'ALWAYS provide suggested options' clause
- guidance R4: Fix 'Popular' typo to 'Populate'

## [0.2.0] - 2026-02-24

### Added
- 8 conditional adversarial lenses for Phase 2 (Resilience, UI/UX, Migration, Sustainability, Ethical, Process, Governance, Observability)
- Disambiguated command titles with "Versus Claude:" prefix
- Comprehensive README with architecture documentation
- 3 Claude Code hooks: inject-context, phase-gate, loop-detector

### Changed
- Renamed from IACDM to Versus across all source files and configs
- Renamed source directory from `iacdm-claude` to `versus-claude`
- Full Portuguese-to-English translation of all source, docs, and config files

## [0.1.0] - 2026-02-18

### Added
- Initial release as IACDM Claude
- MCP server with 15 tools for methodology orchestration
- 8 sequential phases with verifiable exit criteria
- 8 safeguards (S0-S7) preventing common AI agent errors
- Convergence score (0-100) with weighted breakdown
- Persistent decision registry surviving context switches
- Gateway guard for smaller model detection
- VS Code sidebar (TreeView) showing methodology state
- Claude Code hooks: context injection, edit blocking in early phases, loop detection
- Project initialization with `state.json`, `specs/`, and config generation
