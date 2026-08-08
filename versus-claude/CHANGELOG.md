# Changelog

## [0.13.0] - 2026-08-07

### Added — cross-artifact gate: matrix modules must exist in the architecture (RO3 R2, C2)
Deferred through 0.12.x as "the analysis already validates it". It does not: on re-check, 2 of the 4 valid discarded projects had real module-name drift the analysis passed over (T14 cited `health-prober` and `reinsertion-sweeper`, T02 `repository` and `errors` — 11 findings on modules absent from the architecture). The analysis parser had been loosened to tolerate the *earlier* iterations (a real fix for a false positive on T13's removed `quota-limiter`), and that tolerance hid the true positives too. The gate is a better place than the analysis because it flags with the session open — 11 findings on invented modules cost two minutes to fix in Phase 2 and are irrecoverable after.

`advance_phase` 2→3 now checks that every module a finding cites (the `module` column of a finding row) appears in `architecture.md`'s module table. **Checked against the UNION of every `## V(N)` version**, which is the hard part the pilots proved: a module removed between versions (its earlier-iteration findings are legitimate) is tolerated; a name that appears in no version is drift and blocks, naming the module(s). Case-insensitive; skips when either artifact is absent (other gates cover that). Existence/name-match only — never whether the module is well-designed.

## [0.12.9] - 2026-08-07

### Changed — three conditional-lens triggers that could not be exercised (RO3 R2, block A)
The discarded batch showed three lenses activating far below where they apply, because their trigger text was too narrow or measured a different thing than the lens's own question. A lens that never fires produces silence, later misread as "detects nothing". Guidance only.

- **Sustainability (A1)** activated in 0/7. Its trigger was a list of examples (AI/ML, data processing, cloud-native); a model matched the examples, found none, and refused — even for an autoscaler whose whole job is deciding how much resource to consume. Trigger now names the condition ("the system decides, allocates, or consumes a resource whose cost grows with use — e.g. **but not only** …, apply the central question, do not just match the examples").
- **UI/UX (A2):** "User-facing interface" did not decide whether a CLI counts; three CLI projects diverged (Phase 2 activated, the external estimator did not). Trigger now: "any surface a person operates — including a CLI or operational tooling".
- **Governance (A3):** the question and failure class are about a *system* property (attributability, data ownership) but the trigger was about the *organization* (multiple teams, compliance). GOV activated in 0/7, always "correctly" by the mismatched trigger. Trigger now aligns with the question: the system records/decides something to be audited, attributed, or answered for — a single-operator project activates it when the system has that property.

**A3 changes the taxonomy the paper defends** — the batch now measures the corrected taxonomy, not the published one. That must be stated in the protocol; the original mismatch becomes a pilot finding, it does not disappear.

## [0.12.8] - 2026-08-06

### Changed — the 2↔3 loop-back resets the WHOLE Phase 2 critique, not just the lenses
v0.12.6 reset only `activated_lenses_recorded` when the 2↔3 loop returned to Phase 2. The other four Phase 2 criteria (`lenses_applied`, `coverage_matrix`, `criticals_identified`, `concentration_analyzed`) stayed met from iteration 1, so the sidebar showed a "4/5 done" Phase 2 on re-entry and the gate let the critique of V(1) stand for V(N+1). But re-entering Phase 2 is a FRESH critique of the new architecture version — findings re-produced, criticals and concentration re-analysed against V(N+1). `advancePhase(3→2)` now resets every Phase 2 exit criterion, so the gate re-requires the full round each iteration and the sidebar reflects a clean Phase 2. Surfaced by the sidebar showing criteria as still-met after a loop-back; the fix is in the logic (the sidebar was faithfully reporting an incomplete reset).

## [0.12.7] - 2026-08-06

### Changed — projectSpec entries are timestamped (item 4, isolated)
Shipped on its own, after the 0.12.6 restart block, so a regression here would not be mixed with the corrections that unblock the batch. `ProjectSpec.stack/outOfScope/patterns/constraints` change from `string[]` to `SpecEntry[]`, where `SpecEntry = string | { value, phase?, at }` — new entries carry when and in which phase they were added, so the re-estimation can ask "which entries existed when Phase 2 declared lenses in iteration N?" instead of excluding projectSpec wholesale.

Back-compat by construction: every reader goes through one normalizer, `specEntryValue()`. Only the writer (`updateProjectSpec`, which timestamps new entries and dedups by value) and `getProjectSpec` (normalizes to plain strings for the tool response) really change; `inject-context`, which runs every turn, is immune to the type. Legacy string entries survive untouched. Matches the `SpecEntry`/`specEntryValue` names already in the Qwen build so the two do not diverge.

## [0.12.6] - 2026-08-06

### Changed — lens declaration is per-iteration; two measurement-artifact guards
The T13/T05 pilots were discarded on a defect: Phase 2 declares the conditional lens set once, on the first pass, and the 2↔3 loop never re-examines it — the set stays fixed against V(1) while the architecture changes, so lenses that would activate against V(final) (MEC in both pilots) were never declared. Corrections, from the RO3 analysis contract (`CORRECOES-EXTENSAO.md`), items 1, 2, 3, 5, 7:

- **The lens set is re-declared each round of the 2↔3 loop.** `advancePhase` now resets `activated_lenses_recorded` on the 3→2 loop-back, so the gate demands a fresh declaration before the next 2→3. (item 1, code + guidance)
- **The declaration names its iteration and architecture version** — "ACTIVATED LENSES — iteration 2, against V(2)" — so a later analysis can pair each finding with the lens set that was live when it was produced, instead of inferring from timestamps. (item 2, guidance)
- **A lens may not be dropped for redundancy with another.** The T05 Phase 2 skipped Mechanical Engineering as "already covered by Resilience" — anticipating the very conclusion the batch measures. Activation is by project signal only; "already covered by lens X" is never a valid non-activation reason. (item 3, guidance)
- **The coverage matrix heads each round with `## Iteração N — V(N)`** and appends rather than overwrites, so findings carry their iteration; without it every finding silently collapses into iteration 1. (item 5, guidance)
- **`duplica` applies within the same lens too:** a lens recording one defect twice under two ids inflates its own exclusive contribution, which is the measured quantity. (item 7, guidance)

### Deferred (from the same contract)
- **item 4** (timestamped `projectSpec` entries) — back-compat type change touching several readers; low-risk, done next to match the parallel Qwen build.
- **item 6** (cross-gate `matrix.module ⊆ architecture.modules`) — high-risk new gate whose per-iteration parsing is the exact trap the contract itself warns of (it blocked legitimate projects in the analysis parser), and it is **redundant**: the analysis already validates this. Not before the batch.

## [0.12.5] - 2026-08-05

### Changed — Phase 3 appends the architecture version, never overwrites it (guidance only)
The T01 pilot showed a real information loss: the Phase 2↔3 loop critiques a different architecture each round, but the guidance let Phase 3 overwrite `specs/technical/architecture.md`. A module removed between V(1) and V(2) (`quota-limiter` in the pilot) took its `M-` row with it, so an iteration-1 finding that named it pointed at a module no machine-readable artifact recorded any more — the per-module traceability the coverage matrix exists for broke exactly where the design changed most. Phase 3 now **appends** a `## V(N+1)` section with its own module table; every version is kept, the last is current. Guidance only — no code, no gate, no test change.

Deliberately not included before the batch: the Portuguese-session false warning (`⚠ P2 STEP 1 MISSING` when the lens decision is recorded as "LENTES ATIVADAS") — it is a context warning, not a gate, and touching instrument code on the eve of collection is the regression risk this version series has repeatedly shown to be real. Declared as a known limitation; the real fix (structured lens recording) is deferred to after the batch.

## [0.12.4] - 2026-08-05

### Fixed — the coverage-matrix gate accepted echoed module rows as findings
v0.12.2 made Phase 1 write a module table with `M-\d+` ids, and Phase 2 reads that file for the module names. But the coverage-matrix gate pattern was `[A-Za-z]{1,4}-\d+`, and `M` fits `{1,4}` — so a matrix containing only the Phase-1 module rows (`| M-01 | quota | … |`, zero findings) satisfied the Phase-2 gate. With `count: 1`, one echoed module row passed a matrix with no findings recorded — defeating the gate exactly where the batch (RO3) needs it, since a matrix with no findings is not analysable. Found by the Kimi build.

- **Coverage-matrix pattern now excludes the module prefix:** `\|\s*(?!M-)[A-Za-z]{1,4}-\d+\s*\|`. `M-01` (a module) no longer counts as a finding; `P-01`, `A-03`, `MEC-01` still do.
- **`M-` reserved in the Phase 2 guidance:** the negative lookahead alone would silently drop findings if a model chose `M-` as the prefix for the Mechanical Engineering lens. The guidance now states `M-` identifies a module, never a lens, and Mechanical Engineering uses `MEC-`. Without this the fix would turn a lens finding into a phantom module — the exact error the batch cannot have.

## [0.12.3] - 2026-08-05

### Fixed — the structural-gate error message pointed at the wrong artifact
The `artifactRows` denial message was hardcoded with the coverage-matrix example (`P-01 | auth | Security | 🔴 | …`) and the phrase "findings-table form". But the same message serves every criterion with `artifactRows` — so when `architecture_doc` (a module table) failed, the model was told to write a *findings* row into `architecture.md`. An obedient model would produce the wrong file. Found by the Kimi build during the port.

Fix is per-criterion, not per-message: `artifactRows` gained an optional `example` field, and the message is now generic ("structured form", "table row(s) with an id") plus that example. `coverage_matrix` carries the `P-01 …` example, `architecture_doc` the `M-01 …` example. Tests now assert each artifact's error shows its own example and not the other's.

## [0.12.2] - 2026-08-05

### Changed — the module list is now machine-readable (architecture_doc)
Phase 1 guidance already declared the invariant — "key each module by a stable name; Phase 2's coverage matrix and Phase 5's implementation will reference those same names" — but nothing structured or enforced it: the `architecture_doc` gate was existence + non-triviality, and the doc was prose. So Phase 2 wrote module names from chat memory, Phase 5 did the same, and nothing compared. The coverage matrix's per-module traceability ("keyed by module so a later failure traces to the lens") silently depends on that key being stable.

- **`architecture.md` must now be a module table** — `| M-01 | module | responsibility | interface | depends-on |` — one row per module. The `M-\d+` id makes the row machine-recognizable (module names have no distinguishable token); the **stable key across phases stays the `module` name**. `architecture_doc` reuses the `artifactRows` gate from v0.12.0 (`{ pattern: "\\|\\s*M-\\d+\\s*\\|", count: 1 }`): a prose architecture no longer passes. No new machinery — the same mechanism the coverage matrix uses, one phase earlier.
- The coverage-matrix finding format (frozen in the batch protocol §5) is unchanged: Phase 2's `module` column stays the name; the M-id lives only in the architecture doc, to make the canonical module list extractable.

### Known limit (not yet closed)
The engine checks the FORM (there is a module table), not that Phase 2 and Phase 5 actually **reused** those names. The name drift (Phase 1 `rate-limiter` → Phase 2 `quota`) is now **detectable** — both artifacts are machine-readable and can be diffed — but not **prevented**: no gate cross-checks `matrix.module ∈ architecture.modules`. That cross-artifact check is a further step; this change makes it possible, not automatic.

## [0.12.1] - 2026-08-05

### Fixed — three regressions from the v0.12.0 findings-table change
- **The finding-count floor is gone.** `coverage_matrix.artifactRows.count` was 3, imposing a tool-enforced floor of 3 findings — a measurement artifact in a study whose metric is findings-per-lens. Lowered to 1: the gate still rejects the old severity grid (0 rows with ids) but imposes no count floor. A floor of 1 is not arbitrary — an adversarial pass over 19 lenses that finds literally nothing was not adversarial.
- **The "zero findings" guidance path was unreachable and partly invalid.** Phase 2 guidance still offered "zero findings → advance to Phase 3 OR skip to Phase 4"; the gate blocked <1 finding, and `2→4` was never a valid transition anyway. Rewritten: zero findings is flagged as a red flag (shallow critique), and the only valid transition from Phase 2 is to Phase 3.
- **Internal contradiction in the Phase 2 guidance.** The header line still described "a table of modules × lenses with severities" directly above the paragraph mandating "one row per finding, not a severity grid." The model read both. The stale line is removed.
- **Lens vocabulary pinned for cross-project aggregation.** The guidance said "pick a short prefix per lens family" (per project, model's choice), which would let one project write `Security` and another `Segurança`/`SEG` in the lens column — making a multi-project analysis unaggregatable. The guidance now requires the exact canonical lens name from the Phase 2 lens table in the `lens` column, and a consistent prefix per lens.

## [0.12.0] - 2026-08-05

### Changed — the coverage matrix is a findings table, and the gate checks its form
Preparing a designed batch to test lens orthogonality (RO3) surfaced that the persisted coverage matrix could not answer the question it exists for. v0.11.0 persisted a **severity-per-cell grid** (module × lens), and the gate checked only that the file existed and was non-trivial. But orthogonality vs. overlap — two lenses finding the *same* defect vs. *different* defects in the same module — cannot be read from a grid: it needs **per-finding identity**. There was no finding id anywhere in the methodology.

- **`coverage_matrix` (P2) is now a findings table**: one row per finding, `id | module | lens | severity | description`, each with a unique in-project id (P-01, A-03, …) and `duplica: <id>` when it is the same defect another lens recorded. Guidance rewritten (P2 writes it, P3 addresses findings by id).
- **The artifact gate now validates structure, not just existence.** New `ExitCriterionDef.artifactRows: { pattern, count }`: the file must contain at least `count` lines matching the finding-id pattern. A severity-only grid (no ids) now BLOCKS advance to Phase 3 with a message showing the required form. Existence-only gates (architecture_doc, lessons_documented) are unchanged. As always, the engine checks **form, not content** — whether a finding is real or a `duplica` mark honest stays a human judgment (the oracle).

This makes the matrix the analysable instrument the batch needs, and — beyond the batch — findings with stable ids are referenceable in Phase 3, in rework logs, and in a post-mortem, which the grid never was.

## [0.11.0] - 2026-08-05

### Changed — methodology: gates require evidence, not a self-attested boolean
The audit found the methodology's core inconsistency: almost every exit criterion was a boolean the AI flips via `mark_exit_criterion`, which contradicts its own thesis (S4: gates need verification). A gate could be — and in the corpus routinely was — stamped in seconds with no trace left. Quality cannot be mechanized (the oracle: Tarski/Rice), but **existence and observation can**, and a persisted/witnessed record makes a stamped gate *auditable after a failure* instead of vanishing with the chat. Two mechanisms added to `ExitCriterionDef`:

- **`artifact?: string`** — the criterion is not met until a non-trivial file exists at `specs/<path>`. Marking it met is not enough; `advance_phase` (and `start_new_cycle`) block until the file is on disk. Applied to:
  - `coverage_matrix` (P2) → `specs/design/coverage-matrix.md`, keyed by module; **read by P3** to address criticals.
  - `architecture_doc` (P1) → `specs/technical/architecture.md`, keyed by module; **read by P5** to implement each module.
  - `lessons_documented` (P7) → `specs/references/lessons.md`; feeds the next cycle via `start_new_cycle`.
- **`verify?: "test-pass"`** — the criterion requires the `test-outcome` hook to have *witnessed* a green run in the phase, not merely be told so. Applied to `tests_passing` (P6): `advance_phase` to P7 is blocked unless a passing run was observed in Phase 6. This is S4 (“execute and verify, never assume”) made mechanical. New `PhaseState.lastTestOutcome` records what the hook saw; a witnessed FAIL, or a pass witnessed in an earlier phase, does not satisfy it.

The engine checks **existence/observation, never quality** — whether the matrix is good, the tests meaningful, the lessons real stays a human judgment, and the guidance says so explicitly. The point is a trace to audit, not automated proof.

### Fixed
- **The MCP server now reloads state before every tool call.** It previously loaded `state.json` once at startup and reused the in-memory copy, so out-of-process hook writes (the `test-outcome` hook's `lastTestOutcome`, the loop counter) were invisible to the server — the new `tests_passing` gate would have blocked forever. The engine saves after every mutation, so disk is authoritative; the reload only picks up hook writes. Negligible cost, and it also makes `get_phase_state` reflect live hook state.

### Notes
- Honest limits: the `tests_passing` gate depends on `test-outcome` recognizing the run (same detector S6 already trusts to block) — an unrecognized command/output can false-block; run a standard test command so the hook sees a clear pass. The "non-trivial artifact" bar is 80 non-whitespace chars (a real matrix/doc clears it easily; a stub does not) — tunable.
- The remaining stampable criteria are oracle-limited (semantic quality) and deliberately left as human-judgment gates; the honest move there is the text admitting so, not fake verification.

## [0.10.1] - 2026-08-03

### Fixed
- **`.versus/` bundles crashed in any project whose `package.json` declares `"type":"module"`.** Modern JS projects commonly set this, and it makes Node treat every `.js` under the project tree as an ES module — including the CommonJS bundles Versus deploys (`server.js` + all hooks). The MCP server and every hook then died on load with `ReferenceError: require is not defined in ES module scope`, silently disabling the whole methodology in that project. `deployServer` now writes `.versus/package.json` = `{"type":"commonjs"}` alongside the bundles, pinning CommonJS for the `.versus/` tree (Node resolves module type from the nearest `package.json`). Idempotent, and never overwritten on reactivation, so the immunization persists. Existing broken projects are fixed on the next activation, or by dropping that file in by hand.

## [0.10.0] - 2026-07-14

### Changed — methodology
- **The LLM Switch Point (P4→P5) is now a decision, not a notice.** Phase 4 told the model to "Display the LLM Switch Point notification" and then, in the very next step, to `advance_phase()` and "begin Phase 5 implementation immediately" — so the model correctly announced the option and started coding, leaving the user to interrupt if they wanted a different model. That inverts R2/S2 (the switch is a *user* decision), and it inverts it at the worst possible moment: the choice is only free *before* any code exists, since afterwards switching means abandoning a session mid-implementation. Phase 4 now asks in chat with two options (default "Continue here"), advances the phase in either case (the gate is already satisfied — a new session should resume at Phase 5, not re-run the convergence check), and on "Switch model" records the decision and stops. This mirrors the Session Renewal step Phase 6 already had. The fix includes an explicit prohibition of the observed antipattern ("Do NOT write 'I am advancing to Phase 5; interrupt me if you want to switch'"), since an instruction without the named antipattern tends to be reinvented.
- **The Reverse LLM Switch (Phase 7 → new cycle) got the same treatment.** `start_new_cycle` recommends switching *back* to a capable model for the new cycle's Phase 0 (design), and it had the identical "MUST DISPLAY … recommend" notice shape — announce and proceed to load Phase 0. It is now a decision folded into the new-cycle steps (recommended "Switch model", since design benefits from the most capable model), stopping before Phase 0 guidance loads if the user switches. Same antipattern prohibition. If only the forward switch were fixed, the same inversion would survive at the cycle boundary.
- **`process` is now a documented `record_decision` category.** Both switch decisions record with `category='process'`, which was not in the tool's documented list (it recorded fine — the engine is permissive — but was invisible to any category-filtered `get_decisions`). Added to the description as "methodology/session decisions".
- **These were upstream methodology gaps, not port divergences** — the notice-shaped wording exists in the Kimi, Qwen and LocalQwen builds. The forward-switch fix mirrors the one first applied in the Kimi window; the reverse-switch fix and the `process` category are new here and belong upstream too. Goal: the four builds converge on identical guidance text.

## [0.9.0] - 2026-07-14

### Changed
- **S6 loop detection now counts understanding, not commands.** The detector counted *executions* of a test command: 4 runs in a phase = blocked. But a blind loop runs the tests N times for the same unknown reason, while normal debugging runs them N times for N *named* reasons — and the old rule could not tell them apart, because it counted `Bash` calls rather than diagnoses. Worse, being a `PreToolUse` hook it could not see the result of a run, so it blocked the final **green** run — the one moment where running tests is most legitimate, and the one S4 (`NEVER assume tests passed — execute and verify`) explicitly requires. In practice S6 made S4 impossible to satisfy, and the only way out was to delegate the run to another agent, which is a bypass of zero cost and therefore no protection at all. The new rule:
  - Only a **FAILED** run accumulates. A passing run clears the counter — verification is never blockable.
  - **3 consecutive failures with no diagnosis recorded between them** block the next test run (`LOOP_FAILURE_THRESHOLD` in `rules/safeguards.ts`).
  - `record_decision(category='diagnosis' | 'bugfix' | 'root-cause')` clears the counter immediately. This is the escape hatch the block message always promised and never honored — nothing in the engine cleared the counter on a recorded decision.
  - Counting moved to a new `test-outcome` hook (`PostToolUse`/Bash), the only place a run's result is visible; `loop-detector` (`PreToolUse`) now only blocks. Ambiguous output records nothing: only positive evidence of failure counts, since a false "failed" causes a bogus block while a missed failure merely delays a legitimate one.
- **`normalizeCommandPattern` no longer collapses every JS test into one pattern.** `npm test`, `npx jest`, `npm test -- consent` and `npm test -- link` all normalized to `"test:js"`, so failures in four different suites compounded into a single counter — even though the S6 clause it implements speaks of iterations *on the same module*. The suite/target argument is now part of the pattern.

### Fixed
- **A blocked phase transition no longer reports an empty reason.** `validatePhaseTransition` vetoes a transition when any safeguard for the phase is `violated`, but `TransitionError` had no field for safeguard violations — they were computed and discarded, leaving `Cannot advance from Phase X to Phase Y.` with an empty `missingCriteria`. `TransitionError.safeguardViolations` added and surfaced through `advance_phase`.
- **Three hooks had never been deployed.** `deployServer` copied only 4 of the 7 bundles, while `settings.json` registered hooks pointing at `.versus/stop-verify.js`, `.versus/truncation-check.js` and `.versus/block-destructive.js` — files that were never written to any workspace. Those hooks have been silently dead since v0.5.0 (node could not find the file). The deploy list now covers every bundle referenced by `buildOrchestratorHooks()`.
- `resetLoopCounter()` was dead code (the reset was inlined in `advancePhase` and `startNewCycle`); it is now the single reset path.

### Notes
- Existing `.versus/state.json` files are compatible: `LoopCounter` gained an optional `lastDiagnosis` field and `count` changed meaning (failures, not executions). A stale count from an older version clears on the first passing run, the first recorded diagnosis, or the next phase change.

## [0.8.0] - 2026-05-02

### Added
- **Brownfield bootstrap mode in `init_project`.** Versus now supports projects in progress that need to grow under methodology — the most common real-world scenario. `init_project` accepts an optional `bootstrap_data` parameter with: `stack`, `patterns`, `constraints`, `apparent_use_cases`, `domain_vocabulary`, `module_map`. When present, the handler populates `projectSpec`, records AS-IS decisions in P0/P1 for traceability, and pre-populates `specs/technical/AS-IS-stack.md`, `specs/references/AS-IS-modules.md`, `specs/domain/AS-IS-vocabulary.md`. The init_project tool description carries the full BOOTSTRAP PROTOCOL the AI must follow before calling: (1) detect existing code via surface files, (2) read README + configs + dir structure (NOT implementations), (3) infer stack/modules/use-cases/vocabulary, (4) present Bootstrap Proposal in chat, (5) wait for user confirmation in single turn, (6) call init_project with bootstrap_data populated.
- **DELTA MODE in Phase 0** when bootstrap was applied. The first action of P0 is now MODE DETECTION: if get_decisions(phase=0) returns AS-IS decisions, P0 runs in delta mode — skips HSA Level 1 (Domain, already captured), focuses Levels 2-5 on the new change/feature, Capacity Check asks about modification capacity (not greenfield production), Out of Scope explicitly excludes "everything in the existing system not touched by this delta". Eliminates the failure mode where brownfield projects ran greenfield HSA and produced fictional context.
- **SessionStart hook updated** to point the LLM at the bootstrap protocol when get_phase_state returns "not initialized" and the workspace has existing code.

### Changed
- **`init_project` response includes `mode: "greenfield" | "brownfield"`** and a brownfield-specific instruction block when bootstrap_data was applied.

## [0.7.1] - 2026-05-02

### Added
- **Reverse LLM Switch on `start_new_cycle()`.** Closes the asymmetry: the methodology has a P4→P5 LLM Switch Point (Opus→Sonnet) but had no equivalent for the Pn→P0_v2 transition (when starting a new cycle). Users typically switched to a code-execution model in cycle 1 and never returned to the design-grade model — cycle 2 then started Phase 0 (design) on the wrong model. Now `start_new_cycle()` returns `_modelSwitchAction` with the same close+reopen+retomar Versus mechanic, and P7 Meta-iteration guidance instructs the LLM to display this notification when starting a new cycle.

## [0.7.0] - 2026-05-02

### Changed
- **Complete guidance now injected on every UserPromptSubmit (replaces compact-guidance).** The previous strategy curated a compact summary of full-guidance and injected only that. Audit revealed potential precision loss: the compact omits details from full (score weights table, HSA sub-areas, Tier 1/2/3 criteria, lens central questions, etc.) — the LLM operating only with compact for many turns could drift from the full methodology. The new strategy injects the entire full-guidance content (cross-cutting rules + antipatterns + all 8 phase blocks) on every UserPromptSubmit, guaranteeing the LLM has the complete methodology in context regardless of session length. Token cost is bounded by prompt caching (the content is static and cache-hit after first injection per session). Single source of truth: drift between compact and full is now structurally impossible.

### Removed
- **`compact-guidance.ts` deleted.** No longer used. The 8 compact-sync tests are replaced with 8 presence tests over the complete guidance text (assertPresent for critical terms in full-guidance.ts).

## [0.6.4] - 2026-05-02

### Changed
- **Model switch mechanic added to LLM Switch Point (P4→P5)**: previously the notification told the user "you can switch to a faster/cheaper model" without explaining how. Switching models mid-conversation in the same chat causes the new (smaller-context) model to attempt compaction of the previous session, which destroys the structured context Versus preserves via MCP. The notification now instructs the user to: (1) close the current chat, (2) open a new chat with the target model, (3) type `retomar Versus` so the SessionStart hook recovers state cleanly via MCP. The new model starts with fresh context but full methodology state.
- **P6 Step 0 (Session Renewal) clarified for model switching**: the "New session" option now mentions explicitly that this is also the right moment to switch models if desired (e.g., test execution does not need Opus capabilities), reinforcing the same close+reopen+retomar mechanic.

## [0.6.3] - 2026-05-02

### Added
- **Original Scope Adversarial Review** as a mandatory step at end of Phase 5, before the existing Scope Inventory. Forces the LLM to compare P0 commitments (Delivery Target, Success Criteria, Capacity Check inventory) against actual delivery, build a "Promise vs Delivered" table in adversarial mode (find every gap, no charity), and ask the user via AskUserQuestion how to proceed: (1) Continue Phase 5 to complete missing items, (2) Renegotiate scope via `record_decision(category='scope', content='SCOPE REVISION...')`, or (3) Accept gaps as known debt via `record_decision(category='constraint', content='ACCEPTED GAPS...')`. No default, no silent path. Eliminates silent scope deferral (AP10) by making every deferral explicit, recorded, and consented by the user.
- **3-layer ready-to-advance enforcement** for the failure pattern where the LLM marks all exit criteria met but stops with a phase-end summary instead of calling `advance_phase()`:
  - **Layer 1:** `mark_exit_criterion` returns `_nextAction` field with imperative language when the marked criterion completes the phase
  - **Layer 2:** `get_phase_state` returns `_nextAction` whenever state shows "all met but currentPhase unchanged" — catches the LLM on any context recovery
  - **Layer 3:** `inject-context` hook adds a `⚠️ READY TO ADVANCE` banner at the top of every UserPromptSubmit while in this state — three independent reminders in three different points

## [0.6.2] - 2026-05-02

### Changed
- **`ui_runnable` description shortened to "Smoke test: user runs P0 end-to-end"** for sidebar readability. The full rules (AP10, literal user confirmation in details, primary P0 use case) remain in `full-guidance.ts` and `compact-guidance.ts` where the LLM consumes them — sidebar is for human glance.

## [0.6.1] - 2026-05-01

### Added
- **A — Production Capacity Check in Phase 0** (mandatory when Delivery Target is "Complete product"). After Level 5, the LLM must DISPLAY an asset inventory table (authoring / visual / audio / data / integrations × quantity × production source) and ask the user via AskUserQuestion whether capacity to produce them exists. Capacity gap → reduce scope or record_decision(constraint, CAPACITY GAP). Closes the failure mode where P0 design score reaches 90+ while the actual production of content/assets has no plan ("Lágrima de Paladine" pattern).
- **B — AP10: Silent Scope Deferral** as a new antipattern. The inverse of AP9 (silent scope creep): marking an exit criterion as met=true while textually noting "will be done in next cycle / out of scope / pending content". The criterion is NOT met. Resolution: either reduce Delivery Target via record_decision OR return to the appropriate phase and complete before advancing. Textual prose is NOT acceptable substitute for met=false. Cross-referenced from P0 capacity check and P5 scope inventory.

### Changed
- **C — `ui_runnable` exit criterion now requires empirical user confirmation.** Description changed from "UI implemented and accessible" to "Human user has executed AT LEAST ONE Phase 0 use case end-to-end and confirmed it works". Without explicit user confirmation captured in the `details` field of mark_exit_criterion, the criterion stays pending. P5 Scope Inventory updated accordingly: it now requires the LLM to ask the user via AskUserQuestion to execute one P0 use case and report back, with literal confirmation stored as evidence. Eliminates the failure mode where placeholder UI passed ui_runnable through prose ressalva.

## [0.6.0] - 2026-04-30

### Added
- **P6 Step 0 — Session Renewal (RECOMMENDED).** Before testing, P6 now suggests the user start a fresh chat session via AskUserQuestion (options: "New session" / "Continue here"). Decouples implementer from tester to reduce confirmation bias — the LLM that wrote the code carries an implicit "of course it works" prior. Automated form of S4 (anti-validador). If user picks "New session", a SESSION RENEWAL decision is recorded and the LLM stops; user resumes in a fresh chat with `retomar Versus`.
- **P6 Step 2 — UI Testing Tooling proposal (only if P1 declared a UI module).** When a UI module exists, P6 detects the project stack and proposes 2-3 stack-appropriate browser/automation tools via AskUserQuestion (with a recommended option marked + "Other" for free choice). Stack→tools mapping: Web SPA → Playwright (rec) / Puppeteer / Cypress; React Native → Detox (rec) / Maestro; Electron → Playwright; CLI → bats / expect; Mobile → Maestro / Appium. The chosen tool is installed and a single smoke test of the primary user flow is implemented before regular spec-driven tests. The choice is recorded as a P6 decision and treated as the BINDING-CONSTRAINTS exception (additive, not a P1 violation).

### Changed
- **P6 step numbering.** Existing steps renumbered to fit new structure: Step 0 (renewal) → Step 1 (Spec-Driven Test Protocol) → Step 2 (UI Tooling) → Step 3 (Write and Execute) → Step 4 (Record Spec Coverage) → Step 5 (Manual Exploratory Testing). Compact guidance and tests updated accordingly.

## [0.5.5] - 2026-04-08

### Added
- **specs/README.md generated on init_project.** Contains: (1) a mini operation manual — "retomar Versus" anchor phrase and MCP discovery behavior, (2) description of each of the 9 subdirectories (domain, references, technical, examples, design, models, datasets, validation, competitors), (3) mapping of which subdirectory feeds which phase. Written idempotently (never overwrites user edits). Reduces onboarding friction — users no longer need to guess what goes in each folder.

## [0.5.4] - 2026-04-08

### Fixed
- **Prerequisites dialog button targets the right destination.** Previously, when Node.js was missing, the error dialog offered a single "Open Marketplace" button that searched the VSCode Marketplace — but Node.js is not a VSCode extension. Now the dialog shows context-aware buttons: "Download Node.js" opens https://nodejs.org/en/download in the browser, "Open Marketplace" opens the marketplace only when Claude Code is missing. If both are missing, both buttons appear.

## [0.5.3] - 2026-04-08

### Added
- **Visible methodology banner on session start/resume.** SessionStart hooks (both default and compact matcher) now instruct the LLM to START its first response with a one-line banner (e.g., "📍 Versus ativo — Fase X, iteração Y. Próximo passo: ..."). The user now sees when methodology context was loaded; previously the LLM could load state silently and the user wouldn't know.
- **"Retomar Versus" as user-facing anchor phrase.** The init_project message (both MCP and VSCode notification) now tells the user they can type "retomar Versus" in chat at any time to force the LLM to recover methodology context (get_phase_state + get_phase_guidance + get_decisions). Empirically validated as the phrase that reliably triggers context recovery across sessions.

## [0.5.2] - 2026-04-08

### Changed
- **P7 refocused on project-level review.** Removed "Methodology Self-Improvement" 5-step ceremony and "Double-loop evaluation of the PROCESS" — these only benefit the methodology maintainer (who has access to SKILL.md) and risk methodology degradation when applied by end users. P7 now has 3 steps: (1) update specs/ with actual results, (2) product evaluation via AskUserQuestion (does the software meet P0 requirements?), (3) capture 3-5 project-level lessons (domain insights, stack pitfalls, patterns, wrong P0/P1 assumptions) and deposit in specs/. Meta-iteration v1→v2 via `start_new_cycle()` is unchanged. Applied to full-guidance.ts, compact-guidance.ts, and the MUST DISPLAY artifacts list.

## [0.5.1] - 2026-04-07

### Fixed
- **MCP args type coercion (sanitizer).** All MCP tool arguments are now sanitized before dispatch: `phase`, `target_phase`, and `score` are coerced to number; `met` is coerced to boolean; array params (`stack`, `outOfScope`, `patterns`, `constraints`) accept both single strings and arrays. Prevents silent failures when an LLM sends `"2"` (string) instead of `2` (number) — strict equality comparisons in the engine would fail without coercion. Bug was latent with Claude (which sends correct types) but manifested with other models.

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
