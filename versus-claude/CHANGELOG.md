# Changelog

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
