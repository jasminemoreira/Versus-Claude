// State Engine and Methodology Rules tests

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { StateEngine, LOOP_FAILURE_THRESHOLD } from "../state/engine";
import { ScoreBreakdown, SpecEntry } from "../state/types";
import { getCompleteGuidance } from "../rules/full-guidance";
import { validateSafeguard } from "../rules/safeguards";
import { detectOutcome, detectExitCode } from "../hooks/test-outcome";
import { handleGetPhaseState, handleGetDecisions, handleUpdateProjectSpec } from "../mcp/tools/state-tools";
import { handleGetPhaseGuidance } from "../mcp/tools/guidance-tools";
import { handleMarkExitCriterion, handleRecordDecision } from "../mcp/tools/record-tools";
import { handleAdvancePhase } from "../mcp/tools/transition-tools";
import { isTestCommand, writeTargets, loadExtraTestPatterns, stripHeredocs } from "../shell/shell-parse";
import { isAllowedPath, blockedTargets } from "../hooks/phase-gate";
import { buildInjection, INJECT_BUDGET } from "../hooks/inject-context";
import { testRunLocation } from "../shell/shell-parse";
import { VERSUS_VERSION } from "../version";
import { buildOrchestratorHooks } from "../setup";
import { spawnSync } from "child_process";
import { handleExportCycle } from "../mcp/tools/transition-tools";
import { CONDITIONAL_LENSES, UNIVERSAL_LENS_DEFS, CONDITIONAL_LENS_DEFS } from "../rules/lenses";

const MATRIX_REL = path.join("specs", "design", "coverage-matrix.md");

/** Records a valid Phase 2 lens activation for the current critique iteration.
 *  Activates `activated` (default Resilience + Mechanical Engineering, the two
 *  conditional lenses that appear in test fixtures), accounts for the other 10 with
 *  a reason. Phase 2 now requires the structured record before 2→3, so any helper
 *  that models a COMPLETED Phase 2 must call this after stamping the criteria. */
function recordLenses(activated: string[] = ["Resilience", "Mechanical Engineering"]) {
  const notActivated = CONDITIONAL_LENSES
    .filter((l) => !activated.includes(l as string))
    .map((l) => ({ lens: l as string, reason: "not applicable to this test fixture" }));
  const r = engine.recordActivatedLenses(activated, notActivated);
  assert.ok(r.ok, "fixture must record lenses: " + (r.ok ? "" : r.error.message));
}

/** Records the approval decision a gated transition (3→4, 6→7, cycle close) needs (0.18.0). */
function approve(phase: number, approvedBy = "user") {
  engine.recordDecision(phase, "approval", `Phase ${phase} reviewed and accepted (test fixture)`, { proposedBy: "Claude", approvedBy });
}

function createTempWorkspace(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "versus-test-"));
  // Create specs/ for checkSpecsStatus tests
  const specsDirs = ["references", "domain", "technical", "examples", "design", "models", "datasets", "validation", "competitors"];
  for (const dir of specsDirs) {
    fs.mkdirSync(path.join(tmp, "specs", dir), { recursive: true });
    fs.writeFileSync(path.join(tmp, "specs", dir, "README.md"), "# " + dir);
  }
  return tmp;
}

function cleanTempWorkspace(tmp: string): void {
  fs.rmSync(tmp, { recursive: true, force: true });
}

function makeFullBreakdown(total: number): ScoreBreakdown {
  // Distributes the score proportionally to the weights
  const factor = total / 100;
  return {
    clarezaProblema: Math.round(10 * factor),
    casosDeUso: Math.round(15 * factor),
    vocabulario: Math.round(10 * factor),
    ambiguidades: Math.round(15 * factor),
    foraDeEscopo: Math.round(10 * factor),
    criteriosSucesso: Math.round(10 * factor),
    premissas: Math.round(10 * factor),
    documentacao: Math.round(5 * factor),
    usuarioConfirmou: Math.round(10 * factor),
    iaConfiante: Math.round(5 * factor),
  };
}

// ===== Tests =====

let workspace: string;
let engine: StateEngine;

function setup() {
  workspace = createTempWorkspace();
  engine = new StateEngine(workspace);
}

function teardown() {
  cleanTempWorkspace(workspace);
}

function test(name: string, fn: () => void) {
  setup();
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err}`);
    process.exitCode = 1;
  } finally {
    teardown();
  }
}

console.log("\n=== State Engine Tests ===\n");

// --- Project ---

test("initProject creates state.json", () => {
  const state = engine.initProject("Test", "Desc");
  assert.strictEqual(state.projectName, "Test");
  assert.strictEqual(state.currentPhase, 0);
  assert.strictEqual(state.currentIteration, 1);
  assert.strictEqual(state.phase0Score, null);
  assert.strictEqual(state.decisions.length, 0);
  assert.strictEqual(state.safeguards.length, 8);

  // Verify persistence
  const statePath = path.join(workspace, ".versus", "state.json");
  assert.ok(fs.existsSync(statePath));
});

test("initProject rejects if already exists", () => {
  engine.initProject("Test", "Desc");
  const loaded = engine.getPhaseState();
  assert.ok(loaded !== null);
  // Second init should not overwrite (tested via MCP tool)
});

test("getPhaseState returns null without project", () => {
  const state = engine.getPhaseState();
  assert.strictEqual(state, null);
});

test("load recovers state from disk", () => {
  engine.initProject("Persist", "Test");
  const engine2 = new StateEngine(workspace);
  const state = engine2.getPhaseState();
  assert.ok(state !== null);
  assert.strictEqual(state!.projectName, "Persist");
});

// --- Decisions ---

test("recordDecision persists and is queryable", () => {
  engine.initProject("Test", "Desc");
  const d = engine.recordDecision(0, "scope", "Out of scope: i18n");
  assert.ok(d.id);
  assert.strictEqual(d.phase, 0);
  assert.strictEqual(d.category, "scope");

  const decisions = engine.getDecisions(0);
  assert.strictEqual(decisions.length, 1);
  assert.strictEqual(decisions[0].content, "Out of scope: i18n");
});

test("getDecisions filters by phase", () => {
  engine.initProject("Test", "Desc");
  engine.recordDecision(0, "scope", "D1");
  engine.recordDecision(1, "arch", "D2");
  engine.recordDecision(0, "req", "D3");

  assert.strictEqual(engine.getDecisions(0).length, 2);
  assert.strictEqual(engine.getDecisions(1).length, 1);
  assert.strictEqual(engine.getDecisions().length, 3);
});

// --- Score ---

test("updateScore saves and is queryable", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(85, makeFullBreakdown(85));

  const state = engine.getPhaseState()!;
  assert.strictEqual(state.phase0Score, 85);
  assert.ok(state.phase0Breakdown !== null);
});

// --- Exit Criteria ---

test("markExitCriterion creates and updates", () => {
  engine.initProject("Test", "Desc");
  engine.markExitCriterion(0, "score_90", true, "Score 92");

  const criteria = engine.getExitCriteriaState(0);
  assert.strictEqual(criteria.length, 1);
  assert.strictEqual(criteria[0].met, true);

  // Update existing
  engine.markExitCriterion(0, "score_90", false, "Re-evaluated");
  const updated = engine.getExitCriteriaState(0);
  assert.strictEqual(updated[0].met, false);
});

test("getExitCriteriaWithDefs shows defs and state", () => {
  engine.initProject("Test", "Desc");
  engine.markExitCriterion(0, "score_90", true);

  const criteria = engine.getExitCriteriaWithDefs(0);
  assert.ok(criteria.length > 0);
  const score = criteria.find((c) => c.criterion === "score_90");
  assert.ok(score);
  assert.strictEqual(score!.met, true);

  const other = criteria.find((c) => c.criterion === "user_confirmed");
  assert.ok(other);
  assert.strictEqual(other!.met, false);
});

// --- Transitions ---

test("advancePhase blocks without exit criteria", () => {
  engine.initProject("Test", "Desc");
  const result = engine.advancePhase(1);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error.missingCriteria.length > 0);
  }
});

test("advancePhase blocks without score 90", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(75, makeFullBreakdown(75));
  // Mark all exit criteria
  const criteria = engine.getExitCriteriaWithDefs(0);
  for (const c of criteria) {
    engine.markExitCriterion(0, c.criterion, true);
  }
  const result = engine.advancePhase(1);
  assert.strictEqual(result.ok, false);
});

test("advancePhase allows with score >= 90 and criteria", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(92, makeFullBreakdown(92));
  const criteria = engine.getExitCriteriaWithDefs(0);
  for (const c of criteria) {
    engine.markExitCriterion(0, c.criterion, true);
  }
  const result = engine.advancePhase(1);
  assert.strictEqual(result.ok, true);

  const state = engine.getPhaseState()!;
  assert.strictEqual(state.currentPhase, 1);
  assert.strictEqual(state.currentIteration, 1);
  assert.strictEqual(state.history.length, 1);
});

test("advancePhase blocks invalid transition (0→2)", () => {
  engine.initProject("Test", "Desc");
  const result = engine.advancePhase(2);
  assert.strictEqual(result.ok, false);
});

/** Writes a valid coverage findings table (per-finding ids) so Phase 2 can advance. */
function writeCoverageMatrix(ws: string): void {
  const content =
    "# Coverage Matrix\n\n" +
    "| id | module | lens | severity | description |\n" +
    "|------|--------|------|----------|-------------|\n" +
    "| P-01 | auth | Security | 🔴 | login builds SQL by string concat → injection |\n" +
    "| A-03 | auth | Architectural | 🟡 | auth imports ui for its toast → cycle |\n" +
    "| P-02 | ui   | Security | 🔴 | stored XSS via unescaped comment body |\n";
  fs.writeFileSync(path.join(ws, "specs", "design", "coverage-matrix.md"), content);
}

/** A severity-only grid: non-trivial, but no per-finding ids — must NOT satisfy the gate. */
function writeSeverityGrid(ws: string): void {
  const content =
    "# Coverage Matrix\n\n" +
    "| module | correctness | security | performance |\n" +
    "|---|---|---|---|\n" +
    "| auth | 🟢 | 🔴 sql-injection in login | 🟢 |\n" +
    "| ui   | 🟡 missing input validation | 🟢 | 🟢 |\n";
  fs.writeFileSync(path.join(ws, "specs", "design", "coverage-matrix.md"), content);
}

/** Writes a non-trivial architecture doc so Phase 1 can advance. */
function writeArchitectureDoc(ws: string): void {
  const content =
    "# Architecture\n\n" +
    "| id | module | responsibility | interface | depends-on |\n" +
    "|------|--------|----------------|-----------|------------|\n" +
    "| M-01 | auth | authenticate users | login(user, pass) -> Session | db |\n" +
    "| M-02 | ui   | render views | render(state) -> DOM | auth |\n\n" +
    "## Assumptions\n- single-threaded runtime\n\n" +
    "## Desvios\nnenhum\n";   // 6→7 requires the deviations record (0.19.0)
  fs.writeFileSync(path.join(ws, "specs", "technical", "architecture.md"), content);
}

test("loop Phase 2↔3 allowed", () => {
  engine.initProject("Test", "Desc");
  // Fast-forward to Phase 2
  engine.updateScore(95, makeFullBreakdown(95));
  for (const c of engine.getExitCriteriaWithDefs(0)) engine.markExitCriterion(0, c.criterion, true);
  engine.advancePhase(1);
  for (const c of engine.getExitCriteriaWithDefs(1)) engine.markExitCriterion(1, c.criterion, true);
  writeArchitectureDoc(workspace);
  engine.advancePhase(2);

  assert.strictEqual(engine.getPhaseState()!.currentPhase, 2);

  // Phase 2 → 3
  for (const c of engine.getExitCriteriaWithDefs(2)) engine.markExitCriterion(2, c.criterion, true);
  recordLenses();
  writeCoverageMatrix(workspace);
  const to3 = engine.advancePhase(3);
  assert.strictEqual(to3.ok, true);

  // Phase 3 → 2 (loop)
  for (const c of engine.getExitCriteriaWithDefs(3)) engine.markExitCriterion(3, c.criterion, true);
  const to2 = engine.advancePhase(2);
  assert.strictEqual(to2.ok, true);
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 2);
});

test("looping 3→2 resets activated_lenses_recorded (re-declare per iteration)", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  for (const c of engine.getExitCriteriaWithDefs(0)) engine.markExitCriterion(0, c.criterion, true);
  engine.advancePhase(1);
  for (const c of engine.getExitCriteriaWithDefs(1)) engine.markExitCriterion(1, c.criterion, true);
  writeArchitectureDoc(workspace);
  engine.advancePhase(2);
  for (const c of engine.getExitCriteriaWithDefs(2)) engine.markExitCriterion(2, c.criterion, true);
  recordLenses();
  writeCoverageMatrix(workspace);
  assert.strictEqual(engine.advancePhase(3).ok, true);

  const lensMetInP3 = engine.getExitCriteriaWithDefs(2).find((c) => c.criterion === "activated_lenses_recorded")!.met;
  assert.strictEqual(lensMetInP3, true, "still met while in Phase 3");

  for (const c of engine.getExitCriteriaWithDefs(3)) engine.markExitCriterion(3, c.criterion, true);
  engine.advancePhase(2); // loop back

  // Phase 2 AND Phase 3 criteria reset — both rounds will be redone against V(N+1).
  const p2AfterLoop = engine.getExitCriteriaWithDefs(2);
  const p3AfterLoop = engine.getExitCriteriaWithDefs(3);
  assert.ok(p2AfterLoop.every((c) => !c.met), "loop-back must reset EVERY Phase 2 criterion");
  assert.ok(p3AfterLoop.every((c) => !c.met), "loop-back must ALSO reset Phase 3 (criticals_addressed etc.)");
  assert.ok(p2AfterLoop.length >= 5 && p3AfterLoop.length >= 4, "sanity: both criteria sets present");

  // And the next 2→3 is blocked until the round is redone
  writeCoverageMatrix(workspace);
  assert.strictEqual(engine.advancePhase(3).ok, false, "cannot advance again without re-doing the Phase 2 critique");
});

test("after a loop, the 3→4 gate re-requires Phase 3 (no stale iteration-1 stamp)", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  for (const c of engine.getExitCriteriaWithDefs(0)) engine.markExitCriterion(0, c.criterion, true);
  engine.advancePhase(1);
  for (const c of engine.getExitCriteriaWithDefs(1)) engine.markExitCriterion(1, c.criterion, true);
  writeArchitectureDoc(workspace);
  engine.advancePhase(2);
  const doP2 = () => { for (const c of engine.getExitCriteriaWithDefs(2)) engine.markExitCriterion(2, c.criterion, true); recordLenses(); writeCoverageMatrix(workspace); };
  doP2();
  engine.advancePhase(3);                                                        // pass 1 of Phase 3
  for (const c of engine.getExitCriteriaWithDefs(3)) engine.markExitCriterion(3, c.criterion, true);
  engine.advancePhase(2);                                                        // loop back — resets P2 and P3
  doP2();
  engine.advancePhase(3);                                                        // pass 2 of Phase 3

  // Phase 3 criteria were reset by the loop-back; the iteration-1 stamp is gone.
  assert.ok(engine.getExitCriteriaWithDefs(3).every((c) => !c.met), "Phase 3 stamps from iteration 1 must not survive");
  assert.strictEqual(engine.advancePhase(4).ok, false, "3→4 must be blocked until iteration-2 criticals are confirmed addressed");

  for (const c of engine.getExitCriteriaWithDefs(3)) engine.markExitCriterion(3, c.criterion, true);
  approve(3);
  assert.strictEqual(engine.advancePhase(4).ok, true, "…and passes once Phase 3 is redone");
});

// --- Iterations ---

test("startIteration increments counter", () => {
  engine.initProject("Test", "Desc");
  assert.strictEqual(engine.getPhaseState()!.currentIteration, 1);

  const r = engine.startIteration(0);
  assert.strictEqual(r.ok, true);
  if (r.ok) {
    assert.strictEqual(r.value.iterationNumber, 2);
  }
  assert.strictEqual(engine.getPhaseState()!.currentIteration, 2);
});

test("startIteration rejects wrong phase", () => {
  engine.initProject("Test", "Desc");
  const r = engine.startIteration(1); // currently on phase 0
  assert.strictEqual(r.ok, false);
});

// --- Safeguards ---

test("checkSafeguard S0 ok when on Phase 0", () => {
  engine.initProject("Test", "Desc");
  const r = engine.checkSafeguard("S0");
  assert.strictEqual(r.status, "ok");
});

test("checkAllSafeguards returns applicable", () => {
  engine.initProject("Test", "Desc");
  const results = engine.checkAllSafeguards();
  assert.ok(results.length > 0);
});

// --- Specs ---

test("checkSpecsStatus detects empty and populated dirs", () => {
  engine.initProject("Test", "Desc");

  // All empty (only README.md)
  let status = engine.checkSpecsStatus();
  assert.strictEqual(status["domain"].populated, false);

  // Populate domain/
  fs.writeFileSync(path.join(workspace, "specs", "domain", "glossario.md"), "# Glossary");
  status = engine.checkSpecsStatus();
  assert.strictEqual(status["domain"].populated, true);
  assert.strictEqual(status["domain"].fileCount, 1);
});

// --- Complete Guidance Presence Tests ---
// Inject-context now injects the COMPLETE methodology guidance every turn
// (instead of a curated compact summary). These tests guard against accidental
// removal of critical methodology terms from full-guidance.ts.

console.log("\n=== Complete Guidance Presence Tests ===\n");

const completeGuidanceText = getCompleteGuidance();

function assertPresent(term: string, reason: string) {
  assert.ok(
    completeGuidanceText.includes(term),
    `Complete guidance missing "${term}" — ${reason}`
  );
}

test("global rules + antipatterns present", () => {
  assertPresent("R2:",  "R2 (AskUserQuestion) is a core rule");
  assertPresent("R5:",  "R5 (Mandatory Display) is a core rule");
  assertPresent("AP1",  "AP1 (Validation theater) defines generation mode");
  assertPresent("AP10", "AP10 (Silent scope deferral) is the latest antipattern");
});

test("P0 critical terms present", () => {
  assertPresent("HIERARCHICAL SEMANTIC ANALYSIS", "P0 core method");
  assertPresent("Delivery Target", "P0 mandatory first question");
  assertPresent("Production Capacity Check", "P0 capacity check (added v0.6.1)");
  assertPresent("Tier 1", "P0 feasibility tier");
});

test("P1 critical terms present", () => {
  assertPresent("UI module", "UI must be explicit module in P1 decomposition");
  assertPresent("update_project_spec", "P1 must persist structured spec");
});

test("P2 critical terms present", () => {
  for (const lens of ["Assumptions", "Architectural", "Implementability", "Scientific", "Security", "Performance", "Regulatory"]) {
    assertPresent(lens, `universal lens "${lens}" must be named`);
  }
});

test("P2 lens table renders from lenses.ts — names, questions and triggers survive", () => {
  // The Phase 2 lens tables are now rendered from rules/lenses.ts, not hand-written
  // markdown. Guard the rendering: every lens name, plus the v0.12.9 trigger wording
  // that was fixed at real cost, must still appear in the injected guidance.
  for (const l of [...UNIVERSAL_LENS_DEFS, ...CONDITIONAL_LENS_DEFS]) {
    assertPresent(l.name, `lens "${l.name}" must be named in the rendered table`);
    assertPresent(l.failureClass.split(",")[0].trim(), `lens "${l.name}" failure class must render`);
  }
  assertPresent("including a CLI or operational tooling", "UI/UX v0.12.9 trigger must survive rendering");
  assertPresent("resource whose cost grows with use", "Sustainability v0.12.9 trigger must survive rendering");
  assertPresent("single-operator project activates it", "Governance v0.12.9 trigger must survive rendering");
  assertPresent("| Lens | Central Question | Exclusive Failure Class | Activate when... |", "conditional table header renders");
  // Part V (partial): the 6 measured-clear Y triggers. LIN's fix to the documented
  // misread ("internal contracts in the same repo" → wrong refusal) is the load-bearing one.
  assertPresent("it does not require separate teams", "LIN/Y fixes the documented misread");
  assertPresent("not only in long-lived or maintenance-heavy systems", "MEC/Y condition-from-question");
  // Part V complete (all 9): the three re-measured formulations.
  assertPresent("a store only this version ever reads, do not activate", "MIG/Y2 restored selectivity (3/3)");
  assertPresent("A system that decides nothing consequential about anyone stays out", "ETI/Y2 restrictive clause");
  assertPresent("regulates state over time rather than only reacting", "CTR-conservative (enumeration kept as illustration)");
});

test("P5 critical terms present", () => {
  assertPresent("adversarial micro-check", "S7 per-module divergence check");
  assertPresent("Original Scope Adversarial Review", "AP10 prevention via explicit scope review");
  assertPresent("Renegotiate scope", "user option to renegotiate scope");
  assertPresent("ACCEPTED GAPS", "user option to accept gaps as documented debt");
  assertPresent("ui_runnable", "P5 exit criterion");
});

test("P6 critical terms present", () => {
  assertPresent("Session Renewal", "P6 Step 0 session renewal");
  assertPresent("Playwright", "primary UI tool recommendation for web SPA");
  assertPresent("Detox", "primary UI tool recommendation for React Native");
  // Post-batch additions (III.1–III.4, IV)
  assertPresent("critical-coverage.md", "III.1 critical coverage artifact");
  assertPresent("premise-coverage.md", "III.2 premise coverage artifact");
  assertPresent("Detection power", "III.3 detection-power recommendation");
  assertPresent("Measure by stage before optimizing", "IV practice 1");
  assertPresent("name the SCENARIO, not just the assertion", "IV test-fix scenario record");
  assertPresent("VERSUS_TEST_EXIT=$?", "the language-agnostic exit echo is the standard P6 test invocation");
  assertPresent("Do NOT modify the test runner", "P6 tells the agent not to edit the runner to satisfy the hook");
});

test("P1 post-batch terms present (numbered premises + full version table)", () => {
  assertPresent("number each premise", "III.2 Phase-1 premise numbering nudge");
  assertPresent("write each `## V(N)` table COMPLETE", "III.4 full module table per version");
});

test("P7 critical terms present", () => {
  assertPresent("start_new_cycle", "meta-iteration tool");
  assertPresent("init_project", "prohibition against init_project for v2 must be present");
});

test("LLM switch + retomar Versus terms present", () => {
  assertPresent("LLM Switch Point", "P4→P5 model switch notification");
  assertPresent("retomar Versus", "anchor phrase for context recovery");
});

// --- S6 Loop Detection ---

// --- Artifact gate (coverage_matrix persistence) ---

console.log("\n=== Artifact Gate Tests ===\n");

/** Fast-forward a fresh project to Phase 2 with all P2 criteria marked met. */
function toPhase2Stamped(activatedLenses?: string[]) {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  for (const c of engine.getExitCriteriaWithDefs(0)) engine.markExitCriterion(0, c.criterion, true);
  engine.advancePhase(1);
  for (const c of engine.getExitCriteriaWithDefs(1)) engine.markExitCriterion(1, c.criterion, true);
  writeArchitectureDoc(workspace);
  engine.advancePhase(2);
  for (const c of engine.getExitCriteriaWithDefs(2)) engine.markExitCriterion(2, c.criterion, true);
  if (activatedLenses) recordLenses(activatedLenses); else recordLenses();
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 2);
}

test("coverage_matrix stamped but not persisted BLOCKS advance", () => {
  toPhase2Stamped();
  // Every criterion marked met — the stamp — but no artifact on disk.
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  assert.strictEqual(r.error.missingCriteria.length, 1);
  assert.ok(r.error.missingCriteria[0].includes("coverage-matrix.md"));
  assert.ok(r.error.missingCriteria[0].includes("marking the criterion met is not enough"));
});

test("persisted matrix unblocks the advance", () => {
  toPhase2Stamped();
  assert.strictEqual(engine.advancePhase(3).ok, false, "blocked without the file");
  writeCoverageMatrix(workspace);
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 3);
});

test("a trivial artifact does not count as persisted", () => {
  toPhase2Stamped();
  fs.writeFileSync(path.join(workspace, "specs", "design", "coverage-matrix.md"), "| |\n");
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "empty/near-empty file must not satisfy the gate");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("missing or empty")), "the block must say WHY, not just fail");
});

test("a severity grid without per-finding ids BLOCKS (structural gate)", () => {
  toPhase2Stamped();
  writeSeverityGrid(workspace); // non-trivial, but no P-01/A-03 ids
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  assert.ok(r.error.missingCriteria[0].includes("structured form"));
  assert.ok(r.error.missingCriteria[0].includes("P-01"), "matrix error must show the finding example, not another artifact's");

  writeCoverageMatrix(workspace); // proper findings table
  assert.strictEqual(engine.advancePhase(3).ok, true);
});

test("a matrix of only module rows (M- echo, zero findings) BLOCKS", () => {
  toPhase2Stamped();
  // A model echoes Phase 1's module table into the matrix — no actual findings.
  fs.writeFileSync(
    path.join(workspace, "specs", "design", "coverage-matrix.md"),
    "# Modules under critique\n\n| id | module | responsibility |\n|---|---|---|\n" +
    "| M-01 | rate-limiter | enforce quota — echoed from architecture, not a finding |\n" +
    "| M-02 | store | persist counters — echoed, not a finding |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "M- rows are modules, not findings — must not satisfy the coverage gate");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("structured form")), "the block must name the missing form");
});

test("Mechanical Engineering findings (MEC-) still count", () => {
  toPhase2Stamped();
  fs.writeFileSync(
    path.join(workspace, "specs", "design", "coverage-matrix.md"),
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| MEC-01 | auth | Mechanical Engineering | 🔴 | rigid coupling on version bump, real finding |\n"
  );
  assert.strictEqual(engine.advancePhase(3).ok, true, "MEC- is a lens finding, not the reserved M- module prefix");
});

test("a finding citing a module absent from the architecture BLOCKS (module drift)", () => {
  toPhase2Stamped(); // architecture has modules auth, ui
  fs.writeFileSync(
    path.join(workspace, "specs", "design", "coverage-matrix.md"),
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | auth | Security | 🔴 | real finding on a real module |\n" +
    "| R-01 | health-prober | Resilience | 🔴 | invented module, never in the architecture table |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "a finding on a module the architecture never declared must block");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("health-prober") && m.includes("absent from every version")));
});

test("a depends-on cell holding a module id does not hide the next module (tableColumn2 newline walk)", () => {
  toPhase2Stamped();
  // The bug: a whole-file global regex walks across newlines. When a row's last cell is
  // itself an id (`depends-on` = M-01), the match `| M-01 |\n|` swallows the pipe that
  // OPENS the next row, so that row's module drops from the extracted set. Here `game`
  // is the row right after `ui`, whose depends-on is `M-01` — game used to vanish.
  fs.writeFileSync(
    path.join(workspace, "specs", "technical", "architecture.md"),
    "# Architecture\n\n| id | module | responsibility | interface | depends-on |\n|---|---|---|---|---|\n" +
    "| M-01 | board | holds state | get() | — |\n" +
    "| M-02 | ui | render | render() | M-01 |\n" +
    "| M-03 | game | orchestrate | tick() | M-01, M-02 |\n"
  );
  // A finding on `game` — the module the bug dropped from the architecture set.
  fs.writeFileSync(
    path.join(workspace, "specs", "design", "coverage-matrix.md"),
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | game | Security | 🔴 | a real finding on a real module the bug used to hide |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, true, "game IS in the architecture table — a depends-on id must not hide it");
});

test("a module removed in a later version is tolerated (union of versions)", () => {
  // architecture with two versions: quota-limiter existed in V(1), gone in V(2).
  toPhase2Stamped();
  fs.writeFileSync(
    path.join(workspace, "specs", "technical", "architecture.md"),
    "# Architecture\n\n## V(1)\n| id | module | responsibility | interface | depends-on |\n|---|---|---|---|---|\n" +
    "| M-01 | quota-limiter | enforce quota | allow() | store |\n\n" +
    "## V(2)\n| id | module | responsibility | interface | depends-on |\n|---|---|---|---|---|\n" +
    "| M-01 | limiter | enforce quota (simplified) | allow() | store |\n"
  );
  fs.writeFileSync(
    path.join(workspace, "specs", "design", "coverage-matrix.md"),
    "# Findings\n\n## Iteração 1 — V(1)\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | quota-limiter | Security | 🔴 | iteration-1 finding on a module V(2) later removed |\n" +
    "## Iteração 2 — V(2)\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-02 | limiter | Security | 🔴 | iteration-2 finding on the current module |\n"
  );
  assert.strictEqual(engine.advancePhase(3).ok, true, "quota-limiter is in V(1)'s table — a removed module must be tolerated");
});

test("a single finding row satisfies the gate (no ≥3 floor)", () => {
  toPhase2Stamped();
  fs.writeFileSync(
    path.join(workspace, "specs", "design", "coverage-matrix.md"),
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | auth | Security | 🔴 | the one finding this simple design has: token never expires |\n"
  );
  assert.strictEqual(engine.advancePhase(3).ok, true, "one real finding is enough — the gate must not impose a count floor");
});

test("countArtifactRows counts finding rows, not grid rows", () => {
  engine.initProject("Test", "Desc");
  const pat = "\\|\\s*[A-Za-z]{1,4}-\\d+\\s*\\|";
  writeSeverityGrid(workspace);
  assert.strictEqual(engine.countArtifactRows("design/coverage-matrix.md", pat), 0);
  writeCoverageMatrix(workspace);
  assert.strictEqual(engine.countArtifactRows("design/coverage-matrix.md", pat), 3);
});

test("artifactPresent: existence + non-trivial content", () => {
  engine.initProject("Test", "Desc");
  assert.strictEqual(engine.artifactPresent("design/coverage-matrix.md"), false);
  writeCoverageMatrix(workspace);
  assert.strictEqual(engine.artifactPresent("design/coverage-matrix.md"), true);
});

/** Traces every 🔴 finding of writeCoverageMatrix (P-01, P-02) to a test — the III.1
 *  cross-gate now required to leave Phase 6. */
function writeCriticalCoverage(ws: string): void {
  fs.writeFileSync(
    path.join(ws, "specs", "validation", "critical-coverage.md"),
    "# Critical coverage\n\n| finding | test | note |\n|---|---|---|\n" +
    "| P-01 | test/auth.test.ts::rejects sql in login | regression test added |\n" +
    "| P-02 | test/ui.test.ts::escapes comment body | regression test added |\n"
  );
}

/** Fast-forward to Phase 6 with all earlier gates satisfied. */
function toPhase6() {
  toPhase5();
  for (const c of engine.getExitCriteriaWithDefs(5)) engine.markExitCriterion(5, c.criterion, true);
  engine.recordDecision(5, "scope-inventory", "P1 modules ✅ · specs/validation ✅ · UI runnable ✅ (fixture)");
  engine.advancePhase(6);
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 6);
  writeCriticalCoverage(workspace); // III.1: leaving Phase 6 requires every 🔴 finding traced
  approve(6);                       // 6→7 needs a recorded test sign-off (0.18.0)
}

test("tests_passing stamped but no witnessed green run BLOCKS P6→P7", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  // All P6 criteria stamped, but the hook never witnessed a pass.
  const blocked = engine.advancePhase(7);
  assert.strictEqual(blocked.ok, false);
  if (blocked.ok) return;
  const msg = blocked.error.missingCriteria.find((m) => m.includes("no witnessed passing test run"))!;
  assert.ok(msg, "the refusal must name the missing witnessed pass");
  assert.ok(msg.includes("recorded NO test run in this phase"), "with nothing observed, the message says so — not 'failed'");
});

test("the refusal distinguishes observed-fail from nothing-observed (I.3)", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "fail"); // the engine DID observe — a fail
  const r = engine.advancePhase(7);
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  const msg = r.error.missingCriteria.find((m) => m.includes("no witnessed passing test run"))!;
  assert.ok(msg.includes('outcome="fail"'), "the message must say what the engine saw, not just that it did not pass");
  assert.ok(msg.includes("npm test"), "and which command it was");
});

test("a witnessed green run in Phase 6 unblocks P6→P7", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass"); // the hook witnesses a pass in phase 6
  const r = engine.advancePhase(7);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 7);
});

test("a witnessed FAIL does not satisfy tests_passing", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "fail"); // red run
  assert.strictEqual(engine.advancePhase(7).ok, false);
});

test("a pass witnessed in an EARLIER phase does not satisfy Phase 6", () => {
  toPhase5();
  engine.recordTestOutcome("npm test", "pass"); // green run, but in phase 5
  for (const c of engine.getExitCriteriaWithDefs(5)) engine.markExitCriterion(5, c.criterion, true);
  engine.advancePhase(6);
  approve(6);
  writeCriticalCoverage(workspace);
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  assert.strictEqual(engine.advancePhase(7).ok, false, "the pass must be witnessed IN phase 6");
});

test("start_new_cycle BLOCKED until lessons.md is persisted", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass");
  engine.advancePhase(7);
  for (const c of engine.getExitCriteriaWithDefs(7)) engine.markExitCriterion(7, c.criterion, true);
  approve(7);

  const blocked = engine.startNewCycle();
  assert.strictEqual(blocked.ok, false);
  if (blocked.ok) return;
  assert.ok(String(blocked.error).includes("references/lessons.md"));

  fs.writeFileSync(
    path.join(workspace, "specs", "references", "lessons.md"),
    "# Lessons\n\n- The auth module's session TTL assumption from P0 was wrong; refreshed tokens broke it.\n  guard: T-07\n- The chosen ORM lacked batch upsert; had to hand-roll it.\n  guard: none\n"
  );
  const r = engine.startNewCycle();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 0);
});

// --- Part II: engine-authored verification provenance on the gate ---

console.log("\n=== Verification Provenance + Phase-6 Re-verification Tests ===\n");

test("tests_passing is stamped with nominal provenance when the pass came via exit_code=0 (II)", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass", { source: "harness", exitCode: 0, outputSha256: "abc" });
  assert.strictEqual(engine.advancePhase(7).ok, true);
  const ec = engine.getExitCriteriaState(6).find((c) => c.criterion === "tests_passing")!;
  assert.ok(ec.verifiedBy, "the engine stamps HOW the gate was verified, not just that it was");
  assert.strictEqual(ec.verifiedBy!.path, "test-pass");
  assert.strictEqual(ec.verifiedBy!.nominal, true, "harness exit_code=0 is the nominal path");
  assert.strictEqual((ec.verifiedBy!.snapshot as Record<string, unknown>).exitCode, 0);
});

test("a pass classified without exit_code is marked non-nominal (II.2 degradation)", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass"); // markers-only, no exit_code / source
  assert.strictEqual(engine.advancePhase(7).ok, true);
  const ec = engine.getExitCriteriaState(6).find((c) => c.criterion === "tests_passing")!;
  assert.strictEqual(ec.verifiedBy!.nominal, false, "a pass not confirmed by a harness exit_code=0 is a degraded path");
  assert.ok(ec.verifiedBy!.note && ec.verifiedBy!.note.includes("exit_code"), "and the record says why");
});

test("Phase 6 blocks 6→7 until every critical finding is covered (III.1)", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass", { source: "harness", exitCode: 0 });
  fs.rmSync(path.join(workspace, "specs", "validation", "critical-coverage.md")); // undo what toPhase6 wrote
  const r = engine.advancePhase(7);
  assert.strictEqual(r.ok, false, "P-01/P-02 (🔴) must be traced before sign-off");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("critical coverage") && m.includes("critical-coverage.md")));
  writeCriticalCoverage(workspace);
  assert.strictEqual(engine.advancePhase(7).ok, true, "…and passes once every critical is traced");
});

test("a critical finding absent from the coverage file blocks, naming it (III.1)", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass", { source: "harness", exitCode: 0 });
  fs.writeFileSync(
    path.join(workspace, "specs", "validation", "critical-coverage.md"),
    "# Critical coverage\n\n| finding | test | note |\n|---|---|---|\n" +
    "| P-01 | test/auth.test.ts::rejects sql injection in the login path | regression test added |\n" // P-02 omitted, file non-trivial
  );
  const r = engine.advancePhase(7);
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("P-02") && m.includes("critical coverage")));
});

test("Phase 6 requires premise coverage when premises are NUMBERED (III.2)", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass", { source: "harness", exitCode: 0 });
  fs.writeFileSync(
    path.join(workspace, "specs", "technical", "architecture.md"),
    "# Architecture\n\n| id | module | responsibility | interface | depends-on |\n|---|---|---|---|---|\n" +
    "| M-01 | auth | a | l() | db |\n| M-02 | ui | r | r() | auth |\n\n" +
    "## Premissas\n| id | premissa | consequência |\n|---|---|---|\n| A-1 | single-thread | races |\n| A-2 | streaming migration | memory spike |\n\n## Desvios\nnenhum\n"
  );
  const r = engine.advancePhase(7);
  assert.strictEqual(r.ok, false, "numbered premises A-1/A-2 must be traced to tests");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("premise coverage")));
  fs.writeFileSync(
    path.join(workspace, "specs", "validation", "premise-coverage.md"),
    "# Premise coverage\n\n| premise | test |\n|---|---|\n| A-1 | test/threads.test.ts |\n| A-2 | test/memory.test.ts |\n"
  );
  assert.strictEqual(engine.advancePhase(7).ok, true);
});

test("prose premises (no ids) do NOT trigger the premise gate — no over-block (III.2)", () => {
  toPhase6(); // writeArchitectureDoc has a prose "## Assumptions", no A-\d+
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass", { source: "harness", exitCode: 0 });
  assert.strictEqual(engine.advancePhase(7).ok, true, "premise ids are not a stable convention — prose must not be gated");
});

test("architecture_doc stamped but not persisted BLOCKS P1→P2", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  for (const c of engine.getExitCriteriaWithDefs(0)) engine.markExitCriterion(0, c.criterion, true);
  engine.advancePhase(1);
  for (const c of engine.getExitCriteriaWithDefs(1)) engine.markExitCriterion(1, c.criterion, true);
  // All P1 criteria stamped, but no architecture.md on disk.
  const blocked = engine.advancePhase(2);
  assert.strictEqual(blocked.ok, false);
  if (blocked.ok) return;
  assert.ok(blocked.error.missingCriteria.some((m) => m.includes("technical/architecture.md")));

  writeArchitectureDoc(workspace);
  const r = engine.advancePhase(2);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 2);
});

test("a prose architecture (no module table) BLOCKS P1→P2", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  for (const c of engine.getExitCriteriaWithDefs(0)) engine.markExitCriterion(0, c.criterion, true);
  engine.advancePhase(1);
  for (const c of engine.getExitCriteriaWithDefs(1)) engine.markExitCriterion(1, c.criterion, true);
  // Non-trivial prose, but no | M-01 | module rows.
  fs.writeFileSync(
    path.join(workspace, "specs", "technical", "architecture.md"),
    "# Architecture\n\nThe system has an auth module that authenticates users against the db, " +
    "and a ui module that renders views and depends on auth. Assumes a single-threaded runtime.\n"
  );
  const blocked = engine.advancePhase(2);
  assert.strictEqual(blocked.ok, false, "prose must not satisfy the module-table gate");
  if (blocked.ok) return;
  const archMsg = blocked.error.missingCriteria.find((m) => m.includes("architecture.md"))!;
  assert.ok(archMsg.includes("M-01"), "architecture error must show the MODULE example, not the findings example");
  assert.ok(!archMsg.includes("P-01"), "architecture error must NOT leak the coverage-matrix example");

  writeArchitectureDoc(workspace); // proper module table
  assert.strictEqual(engine.advancePhase(2).ok, true);
});

console.log("\n=== S6 Loop Detection Tests ===\n");

/** Fast-forward a fresh project to Phase 5 (where S6 loop detection is active). */
function toPhase5() {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  writeArchitectureDoc(workspace); // Phase 1→2 gate requires the persisted artifact
  writeCoverageMatrix(workspace); // Phase 2→3 gate requires the persisted artifact
  for (let p = 0; p <= 4; p++) {
    for (const c of engine.getExitCriteriaWithDefs(p)) engine.markExitCriterion(p, c.criterion, true);
    if (p === 2) recordLenses(); // Phase 2 exit now needs the structured lens record
    if (p === 3 || p === 4) approve(p);  // 3→4 and 4→5 need a recorded approval (0.18.0 / 0.18.1)
    engine.advancePhase(p + 1);
  }
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 5, "should be in Phase 5");
}

test("passing runs never accumulate — final verification is never blocked", () => {
  toPhase5();
  for (let i = 0; i < 10; i++) {
    engine.recordTestOutcome("npm test", "pass");
  }
  assert.strictEqual(engine.getLoopCounter().count, 0);
  assert.strictEqual(engine.isLoopBlocked(), false);
});

test("a passing run clears failures accumulated before it", () => {
  toPhase5();
  engine.recordTestOutcome("npm test", "fail");
  engine.recordTestOutcome("npm test", "fail");
  assert.strictEqual(engine.getLoopCounter().count, 2);

  engine.recordTestOutcome("npm test", "pass");
  assert.strictEqual(engine.getLoopCounter().count, 0);
  assert.strictEqual(engine.isLoopBlocked(), false);
});

test("blind loop: consecutive failures with no diagnosis block", () => {
  toPhase5();
  for (let i = 0; i < LOOP_FAILURE_THRESHOLD; i++) {
    assert.strictEqual(engine.isLoopBlocked(), false, `should not block before failure ${i + 1}`);
    engine.recordTestOutcome("npm test", "fail");
  }
  assert.strictEqual(engine.getLoopCounter().count, LOOP_FAILURE_THRESHOLD);
  assert.strictEqual(engine.isLoopBlocked(), true, "blocked after threshold undiagnosed failures");
});

test("named diagnosis clears the counter and unblocks", () => {
  toPhase5();
  for (let i = 0; i < LOOP_FAILURE_THRESHOLD; i++) engine.recordTestOutcome("npm test", "fail");
  assert.strictEqual(engine.isLoopBlocked(), true);

  engine.recordDecision(5, "diagnosis", "Duplicate const in card.ts shadowed the export.");
  assert.strictEqual(engine.getLoopCounter().count, 0);
  assert.strictEqual(engine.isLoopBlocked(), false, "diagnosis is the escape hatch the block promises");
  assert.ok(engine.getLoopCounter().lastDiagnosis, "diagnosis timestamp recorded");
});

test("real session: 4 failures, 4 named causes — never blocked", () => {
  toPhase5();
  // The case this rule exists for: each round has its own diagnosis and fix.
  const rounds = [
    { cmd: "npm test -- consent", cause: "consent test asserts old card copy; rewrote the card text" },
    { cmd: "npm test -- link", cause: "link test used a view id that does not exist" },
    { cmd: "npm test", cause: "app crashed on a duplicate const" },
    { cmd: "npm test -- ui_smoke", cause: "dev DB carried leftover rows from an earlier run" },
  ];
  for (const r of rounds) {
    assert.strictEqual(engine.isLoopBlocked(), false, `blocked before running ${r.cmd} — regression`);
    engine.recordTestOutcome(r.cmd, "fail");
    engine.recordDecision(5, "diagnosis", r.cause);
  }
  assert.strictEqual(engine.isLoopBlocked(), false, "four diagnosed failures are the normal cycle, not a loop");

  // And the green verification run goes through.
  engine.recordTestOutcome("npm test", "pass");
  assert.strictEqual(engine.getLoopCounter().count, 0);
});

test("non-diagnosis decisions do NOT clear the counter", () => {
  toPhase5();
  for (let i = 0; i < LOOP_FAILURE_THRESHOLD; i++) engine.recordTestOutcome("npm test", "fail");
  engine.recordDecision(5, "testing", "ran the suite again");
  assert.strictEqual(engine.isLoopBlocked(), true, "only a named diagnosis clears S6");
});

test("different suites are different patterns (S6 speaks of modules)", () => {
  toPhase5();
  engine.recordTestOutcome("npm test -- consent", "fail");
  engine.recordTestOutcome("npm test -- link", "fail");
  // Second suite starts its own count instead of compounding the first.
  assert.strictEqual(engine.getLoopCounter().count, 1);
  assert.ok(engine.getLoopCounter().pattern.includes("link"));
});

test("a blocked S6 vetoes the phase transition, and says why", () => {
  toPhase5();
  for (const c of engine.getExitCriteriaWithDefs(5)) engine.markExitCriterion(5, c.criterion, true);
  engine.recordDecision(5, "scope-inventory", "modules ✅ validation ✅ UI ✅ (fixture)");
  for (let i = 0; i < LOOP_FAILURE_THRESHOLD; i++) engine.recordTestOutcome("npm test", "fail");

  // Advancing must not be an escape from a blind loop — but the refusal must be legible.
  const blocked = engine.advancePhase(6);
  assert.strictEqual(blocked.ok, false);
  if (blocked.ok) return;
  assert.strictEqual(blocked.error.missingCriteria.length, 0, "criteria are all met — S6 is the only blocker");
  assert.ok(blocked.error.safeguardViolations?.length, "the reason must not be an empty error");
  assert.ok(blocked.error.safeguardViolations![0].includes("S6"));
});

test("advancePhase clears the counter (after the loop is diagnosed)", () => {
  toPhase5();
  for (const c of engine.getExitCriteriaWithDefs(5)) engine.markExitCriterion(5, c.criterion, true);
  engine.recordDecision(5, "scope-inventory", "modules ✅ validation ✅ UI ✅ (fixture)");
  for (let i = 0; i < LOOP_FAILURE_THRESHOLD; i++) engine.recordTestOutcome("npm test", "fail");

  engine.recordDecision(5, "diagnosis", "Named the cause.");
  const r = engine.advancePhase(6);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(engine.getLoopCounter().count, 0);
  assert.strictEqual(engine.isLoopBlocked(), false);
});

test("get_phase_state reports safeguards LIVE, not the cached (stale) status", () => {
  toPhase5();
  for (let i = 0; i < LOOP_FAILURE_THRESHOLD; i++) engine.recordTestOutcome("npm test", "fail");
  // Nothing refreshed the cached field — it is still the default "ok".
  const cached = engine.getPhaseState()!.safeguards.find((s) => s.id === "S6")!;
  assert.strictEqual(cached.status, "ok", "the cached status is stale — this is the bug the panel used to show");
  // The handler computes live, so it reflects the active S6 block.
  const out = JSON.parse(handleGetPhaseState(engine)) as { safeguards: Array<{ id: string; status: string }> };
  const s6 = out.safeguards.find((s) => s.id === "S6")!;
  assert.strictEqual(s6.status, "violated", "get_phase_state must reflect the live S6 block, not the cached ok");
});

test("get_phase_state stays inline — spec, decisions, and heredoc command are budgeted", () => {
  toPhase5();
  const many = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}-${i}-${"x".repeat(40)}`);
  engine.updateProjectSpec({ stack: many("s", 30), outOfScope: many("o", 30), patterns: many("p", 30), constraints: many("c", 30) });
  for (let i = 0; i < 20; i++) engine.recordDecision(5, "architecture", `D${i} ${"y".repeat(500)}`);
  engine.recordTestOutcome("python3 - <<'PY'\n" + "z".repeat(2000) + "\nPY", "pass", { source: "harness", exitCode: 0, exitSource: "echo" });

  const out = handleGetPhaseState(engine);
  const o = JSON.parse(out) as any;
  assert.ok(out.length < 6000, `gateway-guard result must stay inline; got ${out.length}`);
  // projectSpec: normalized to plain strings (no {value,phase,at} stamp), capped, noted.
  assert.strictEqual(typeof o.projectSpec.constraints[0], "string", "spec entries are strings, stamps dropped");
  assert.ok(o.projectSpec.stack.length <= 6 && o.projectSpec.constraints.length <= 6, "each list capped independently");
  assert.ok(o._specNote && o._specNote.includes("omitted"));
  // recentDecisions: content trimmed before any dropped, with a count note pointing at get_decisions.
  assert.strictEqual(o.decisionsCount, 22, "20 fixture decisions + the 3→4 and 4→5 approvals toPhase5 records");
  assert.ok(o.recentDecisions.length < 20, "not all 20 decisions carried inline");
  assert.ok(o.recentDecisions.some((d: { content: string }) => d.content.endsWith("…")), "long content trimmed");
  assert.ok(o._decisionsNote && o._decisionsNote.includes("get_decisions"));
  // The heredoc test command is capped, not carried whole.
  assert.ok((o.lastTestOutcome.command || "").length <= 210, "heredoc command capped");
});

test("get_decisions stays inline too (get_phase_state points here for full text)", () => {
  engine.initProject("t", "d");
  for (let i = 0; i < 40; i++) engine.recordDecision(5, "architecture", `D${i} ${"y".repeat(600)}`);
  const out = handleGetDecisions(engine, {});
  const o = JSON.parse(out) as any;
  assert.ok(out.length < 6000, `get_decisions must stay inline; got ${out.length}`);
  assert.strictEqual(o.count, 40);
  assert.ok(o.shown < 40, "budgeted — not all 40 carried inline");
  assert.ok(o._note && o._note.includes("Narrow with get_decisions(phase)"));
});

test("get_decisions truncates a single oversized decision rather than spilling", () => {
  engine.initProject("t", "d");
  engine.recordDecision(5, "architecture", "X".repeat(9000));
  const out = handleGetDecisions(engine, {});
  assert.ok(out.length < 6000, `even one huge decision must stay inline; got ${out.length}`);
  const o = JSON.parse(out) as any;
  assert.ok(o.decisions[0].content.includes("truncated"), "the lone oversized decision is truncated, not spilled");
});

test("get_phase_guidance returns the real phase text, under Claude Code's 50,000-char MCP inline limit", () => {
  toPhase5();
  const out = handleGetPhaseGuidance(engine, {});
  const o = JSON.parse(out) as any;
  // 0.16.8 returned a pointer to guidance assumed to be injected every message; in Claude
  // Code that injection arrives as a 2,000-char preview (10,000-char hook cap), so the
  // pointer led nowhere. The text is delivered here now.
  assert.ok(typeof o.guidance === "string" && o.guidance.includes("## Phase 5"), "carries the Phase 5 section");
  assert.ok(o.guidance.includes("ANTI-PATTERNS"), "and the cross-cutting rules");
  assert.ok(!o.guidance.includes("## Phase 3"), "but not the other phases");
  for (let p = 0; p <= 7; p++) {
    const n = handleGetPhaseGuidance(engine, { phase: p }).length;
    assert.ok(n < 50_000, `Phase ${p} guidance must stay inline (got ${n})`);
  }
});

test("S6 safeguard reports violated when blocked", () => {
  toPhase5();
  for (let i = 0; i < LOOP_FAILURE_THRESHOLD; i++) engine.recordTestOutcome("npm test", "fail");
  const s6 = validateSafeguard("S6", engine.getPhaseState()!);
  assert.strictEqual(s6.status, "violated");
  assert.ok(s6.details.includes("diagnosis"), "must point at the escape hatch");
});

test("unknown outcome is recorded, not dropped — no frozen stale fail (I.1)", () => {
  toPhase5();
  engine.recordTestOutcome("npm test", "fail");
  assert.strictEqual(engine.getPhaseState()!.lastTestOutcome!.outcome, "fail");
  // An unclassifiable run must OVERWRITE the stale fail, not be silently dropped.
  engine.recordTestOutcome("npm test", "unknown");
  const t = engine.getPhaseState()!.lastTestOutcome!;
  assert.strictEqual(t.outcome, "unknown", "unknown must replace the stale fail, not vanish");
  assert.strictEqual(t.command, "npm test", "the command is recorded for the refusal message");
  assert.strictEqual(engine.witnessedTestPass(5), false, "unknown does not satisfy the gate");
});

test("unknown does not count toward S6 (I.1)", () => {
  toPhase5();
  for (let i = 0; i < 5; i++) engine.recordTestOutcome("npm test", "unknown");
  assert.strictEqual(engine.getLoopCounter().count, 0, "an unreadable run is not a failing run");
  assert.strictEqual(engine.isLoopBlocked(), false);
});

test("a recorded pass carries provenance when supplied (I.5)", () => {
  toPhase5();
  engine.recordTestOutcome("npm test", "pass", {
    source: "harness", toolUseId: "tu_1", sessionId: "s_1",
    outputSha256: "abc", outputBytes: 42, exitCode: 0,
  });
  const t = engine.getPhaseState()!.lastTestOutcome!;
  assert.strictEqual(t.source, "harness");
  assert.strictEqual(t.exitCode, 0);
  assert.strictEqual(t.toolUseId, "tu_1");
});

test("detectOutcome: green run is not a failure", () => {
  assert.strictEqual(detectOutcome("Tests: 12 passed, 12 total"), "pass");
  assert.strictEqual(detectOutcome("test result: ok. 8 passed; 0 failed"), "pass");
  assert.strictEqual(detectOutcome("=== 5 passed in 0.42s ==="), "pass");
});

test("detectOutcome: red run is a failure", () => {
  assert.strictEqual(detectOutcome("Tests: 1 failed, 11 passed"), "fail");
  assert.strictEqual(detectOutcome("FAIL src/consent.test.ts"), "fail");
  assert.strictEqual(detectOutcome("SyntaxError: Identifier 'x' has already been declared"), "fail");
  assert.strictEqual(detectOutcome("exit code: 1"), "fail");
});

test("detectOutcome: ambiguous output records nothing", () => {
  assert.strictEqual(detectOutcome("Running tests..."), "unknown");
  assert.strictEqual(detectOutcome(""), "unknown");
});

// --- language-agnostic exit echo (the fix for a harness with no numeric exit_code) ---

test("detectExitCode reads the VERSUS_TEST_EXIT token, last occurrence wins", () => {
  assert.strictEqual(detectExitCode("67/67 testes passaram\nVERSUS_TEST_EXIT=0"), 0);
  assert.strictEqual(detectExitCode("boom\nVERSUS_TEST_EXIT=1"), 1);
  assert.strictEqual(detectExitCode("VERSUS_TEST_EXIT=1\n...retry...\nVERSUS_TEST_EXIT=0"), 0, "the final run's status is the one that counts");
  assert.strictEqual(detectExitCode("no token here"), undefined);
});

test("a non-English runner is unclassifiable by markers but the echo is language-agnostic", () => {
  // The Enduro case: a Portuguese runner prints "67/67 testes passaram" — markers can't read it.
  const ptOutput = "67/67 testes passaram   (37 positivos, 30 negativos)";
  assert.strictEqual(detectOutcome(ptOutput), "unknown", "markers are English-only, by design — not expanded per locale");
  // With the sanctioned echo, the exit status is a number, readable in any language.
  assert.strictEqual(detectExitCode(ptOutput + "\nVERSUS_TEST_EXIT=0"), 0);
  assert.strictEqual(detectExitCode("1 teste falhou\nVERSUS_TEST_EXIT=1"), 1);
});

test("a pass observed via the exit echo is NOMINAL (II) — no harness exit_code needed", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  // Simulate what the hook records when the echo supplied the status on a no-exit_code harness.
  engine.recordTestOutcome("npm test; echo \"VERSUS_TEST_EXIT=$?\"", "pass", { source: "harness", exitCode: 0, exitSource: "echo" });
  assert.strictEqual(engine.advancePhase(7).ok, true);
  const ec = engine.getExitCriteriaState(6).find((c) => c.criterion === "tests_passing")!;
  assert.strictEqual(ec.verifiedBy!.nominal, true, "an observed exit status of 0 is nominal, whether from harness or echo");
  assert.strictEqual((ec.verifiedBy!.snapshot as Record<string, unknown>).exitSource, "echo");
});

test("a pass classified by markers alone (no observed exit) is NON-nominal (II)", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass"); // no exitCode/exitSource — markers only
  assert.strictEqual(engine.advancePhase(7).ok, true);
  const ec = engine.getExitCriteriaState(6).find((c) => c.criterion === "tests_passing")!;
  assert.strictEqual(ec.verifiedBy!.nominal, false);
  assert.ok(ec.verifiedBy!.note && ec.verifiedBy!.note.includes("VERSUS_TEST_EXIT"), "the record names the missing observed-exit path");
});

// --- projectSpec entries: plain strings (0.19.0 dropped the research-only timestamp), legacy forms still read ---

test("updateProjectSpec stores plain strings and dedups by value", () => {
  engine.initProject("Test", "Desc");
  engine.updateProjectSpec({ stack: ["TypeScript"] });
  const e = engine.getPhaseState()!.projectSpec.stack[0];
  assert.strictEqual(e, "TypeScript", "no {value, phase, at} stamp: it was instrumentation no gate read");

  engine.updateProjectSpec({ stack: ["TypeScript", "Node 18"] }); // TS repeated
  assert.strictEqual(engine.getPhaseState()!.projectSpec.stack.length, 2, "dedup by value — no duplicate TypeScript");
});

test("legacy string entries survive and read through the normalizer", () => {
  engine.initProject("Test", "Desc");
  // Simulate a legacy state where entries were plain strings.
  (engine.getPhaseState()!.projectSpec.patterns as SpecEntry[]) = ["Clean Architecture", { value: "Repository", at: "2026-01-01T00:00:00Z" }];
  const spec = engine.getProjectSpec();
  assert.deepStrictEqual(spec.patterns, ["Clean Architecture", "Repository"], "both forms normalize to plain strings");
});

// --- record_activated_lenses: structured lens activation (Block 1) ---

console.log("\n=== Structured Lens Activation Tests ===\n");

test("Phase 2 without lens activation on record BLOCKS advance", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  for (const c of engine.getExitCriteriaWithDefs(0)) engine.markExitCriterion(0, c.criterion, true);
  engine.advancePhase(1);
  for (const c of engine.getExitCriteriaWithDefs(1)) engine.markExitCriterion(1, c.criterion, true);
  writeArchitectureDoc(workspace);
  engine.advancePhase(2);
  for (const c of engine.getExitCriteriaWithDefs(2)) engine.markExitCriterion(2, c.criterion, true);
  writeCoverageMatrix(workspace);
  // Deliberately NOT recording lenses: the stamp alone must not be enough.
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "stamping the criterion is not the same as recording the lenses");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("record_activated_lenses")));
});

test("a translated lens name is rejected at the call", () => {
  engine.initProject("Test", "Desc");
  const r = engine.recordActivatedLenses(["Segurança"], []);
  assert.strictEqual(r.ok, false, "a translation must not enter the record");
  if (r.ok) return;
  assert.ok(r.error.message.includes("not one of the 12 conditional lenses"));
});

test("an unaccounted conditional lens is rejected", () => {
  engine.initProject("Test", "Desc");
  const r = engine.recordActivatedLenses(["Resilience"], []);
  assert.strictEqual(r.ok, false, "silence about a lens must not pass as a decision about it");
  if (r.ok) return;
  assert.ok(r.error.message.includes("unaccounted for"));
});

test("not-activated without a reason is rejected", () => {
  engine.initProject("Test", "Desc");
  const notActivated = CONDITIONAL_LENSES.filter((l) => l !== "Resilience").map((l) => ({ lens: l as string, reason: "" }));
  const r = engine.recordActivatedLenses(["Resilience"], notActivated);
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  assert.ok(r.error.message.includes("without a reason"));
});

test("a universal lens passed as conditional is rejected", () => {
  engine.initProject("Test", "Desc");
  const rest = CONDITIONAL_LENSES.map((l) => ({ lens: l as string, reason: "n/a" }));
  const r = engine.recordActivatedLenses(["Security"], rest);
  assert.strictEqual(r.ok, false, "the conditional count is a measured variable — a universal must not enter it");
  if (r.ok) return;
  assert.ok(r.error.message.includes("UNIVERSAL"));
});

test("the same lens as activated AND not-activated is rejected", () => {
  engine.initProject("Test", "Desc");
  const all = CONDITIONAL_LENSES.map((l) => ({ lens: l as string, reason: "n/a" }));
  const r = engine.recordActivatedLenses(["Resilience"], all);
  assert.strictEqual(r.ok, false, "the record would contradict itself");
  if (r.ok) return;
  assert.ok(r.error.message.includes("BOTH activated and not-activated"));
});

test("a duplicated activated lens is rejected, not absorbed by the completeness check", () => {
  engine.initProject("Test", "Desc");
  const rest = CONDITIONAL_LENSES.filter((l) => l !== "Resilience").map((l) => ({ lens: l as string, reason: "n/a" }));
  const r = engine.recordActivatedLenses(["Resilience", "Resilience"], rest);
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  assert.ok(r.error.message.includes("twice as activated"));
});

test("recorded lenses persist as a per-iteration array, stamped with iteration + version", () => {
  toPhase2Stamped();
  writeCoverageMatrix(workspace);
  assert.strictEqual(engine.advancePhase(3).ok, true);

  const acts = engine.getPhaseState()!.activatedLenses!;
  assert.ok(Array.isArray(acts) && acts.length === 1, "one entry for the first critique iteration");
  assert.strictEqual(acts[0].iteration, 1);
  assert.strictEqual(acts[0].universal.length, 7);
  assert.strictEqual(
    acts[0].conditional.length + acts[0].notActivated.length,
    CONDITIONAL_LENSES.length,
    "all 12 conditional lenses accounted for"
  );
  assert.ok(acts[0].againstVersion >= 1);
});

test("on a NEW project (stateVersion set) legacy prose does NOT satisfy the gate", () => {
  engine.initProject("Test", "Desc"); // createDefaultState stamps stateVersion
  engine.recordDecision(2, "architecture", "ACTIVATED LENSES: Resilience. NOT ACTIVATED: ...");
  assert.strictEqual(engine.lensesRecorded(), false, "the fallback must not be an opt-out on new work");
});

test("on a legacy project (no stateVersion) prose still satisfies the gate — in both languages", () => {
  engine.initProject("Test", "Desc");
  const st = engine.getPhaseState()!;
  delete (st as any).stateVersion; // simulate a project created before v0.14.0
  engine.recordDecision(2, "architecture", "LENTES ATIVADAS na Fase 2: Resilience. NÃO ATIVADAS: ...");
  assert.strictEqual(engine.lensesRecorded(), true, "old free-text record must not be retroactively invalidated");
});

// --- coverage-matrix lens column (Block 2) ---

console.log("\n=== Coverage-Matrix Lens Column Tests ===\n");

function writeMatrix(rows: string): void {
  fs.writeFileSync(path.join(workspace, MATRIX_REL), rows);
}

test("a truncated lens name in the matrix BLOCKS (Sustainability — the T21 case)", () => {
  toPhase2Stamped();
  writeMatrix(
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| SUS-01 | auth | Sustainability | 🔴 | quota check recomputed on every call, unbounded |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "'Sustainability' is not the canonical 'Sustainability / Proportionality'");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("SUS-01") && m.includes("canonical")));
});

test("an abbreviation in the lens column BLOCKS", () => {
  toPhase2Stamped();
  writeMatrix(
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | auth | SEG | 🔴 | sql injection in login |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "'SEG' is not a canonical lens name");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("P-01") && m.includes("canonical")), "the block must name the row and the reason");
});

test("the literal NENHUMA is accepted as a lens value", () => {
  toPhase2Stamped();
  writeMatrix(
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| N-01 | auth | NENHUMA | 🟡 | a real finding that fit no declared lens |\n"
  );
  assert.strictEqual(engine.advancePhase(3).ok, true, "NENHUMA is the declared channel for a no-lens finding");
});

test("spacing/case around the slash is tolerated (UI / UX == UI/UX)", () => {
  toPhase2Stamped(["UI/UX"]);
  writeMatrix(
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| U-01 | ui | ui / ux | 🟡 | no error state on the login form |\n"
  );
  assert.strictEqual(engine.advancePhase(3).ok, true, "canonicalLens tolerates slash spacing and case");
});

/** Reach Phase 2, iteration 2, with iteration-1 and iteration-2 lens sets on record. */
function reachIter2(iter1: string[], iter2: string[]): void {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  for (const c of engine.getExitCriteriaWithDefs(0)) engine.markExitCriterion(0, c.criterion, true);
  engine.advancePhase(1);
  for (const c of engine.getExitCriteriaWithDefs(1)) engine.markExitCriterion(1, c.criterion, true);
  writeArchitectureDoc(workspace);
  engine.advancePhase(2);
  for (const c of engine.getExitCriteriaWithDefs(2)) engine.markExitCriterion(2, c.criterion, true);
  recordLenses(iter1);
  writeCoverageMatrix(workspace); // universal-only findings — passes regardless of the set
  assert.ok(engine.advancePhase(3).ok, "iteration-1 2→3 must pass");
  for (const c of engine.getExitCriteriaWithDefs(3)) engine.markExitCriterion(3, c.criterion, true);
  engine.advancePhase(2); // loop back → iteration 2 (resets P2 + P3 criteria)
  for (const c of engine.getExitCriteriaWithDefs(2)) engine.markExitCriterion(2, c.criterion, true);
  recordLenses(iter2);
}

test("T14: a lens is legit in the iteration that declared it (MEC entered in iteration 2)", () => {
  reachIter2(["Resilience"], ["Resilience", "Mechanical Engineering"]);
  writeMatrix(
    "# Findings\n\n## Iteração 1 — V(1)\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| R-01 | auth | Resilience | 🔴 | iteration-1 resilience finding |\n" +
    "## Iteração 2 — V(2)\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| MEC-01 | auth | Mechanical Engineering | 🔴 | iteration-2 finding, MEC entered this round |\n"
  );
  assert.strictEqual(engine.advancePhase(3).ok, true, "each finding uses a lens declared for ITS iteration");
});

test("T14 trap: an iteration-1 finding may NOT use a lens only a later iteration declared", () => {
  reachIter2(["Resilience"], ["Resilience", "Mechanical Engineering"]);
  writeMatrix(
    "# Findings\n\n## Iteração 1 — V(1)\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| MEC-09 | auth | Mechanical Engineering | 🔴 | anachronistic: MEC was only declared in iteration 2 |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "must validate against iteration 1's set — not the union, not iteration 2");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("MEC-09") && m.includes("iteration 1")));
});

test("a conditional lens never declared in any iteration BLOCKS", () => {
  toPhase2Stamped(); // activates Resilience + Mechanical Engineering only
  writeMatrix(
    "# Findings\n\n## Iteração 1 — V(1)\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| G-01 | auth | Game Theory | 🔴 | a lens the project never activated |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "a finding may not carry an undeclared conditional lens");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("G-01") && m.includes("declared")));
});

// --- coverage-matrix severity column (Block 3 — same form-gate family) ---

console.log("\n=== Coverage-Matrix Severity Column Tests ===\n");

test("a non-canonical severity BLOCKS (word instead of glyph)", () => {
  toPhase2Stamped();
  writeMatrix(
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | auth | Security | high | sql injection in login |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "'high' is not one of 🔴/🟡/🟢 — the analysis counts on this column");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("P-01") && m.includes("severity")));
});

test("an empty severity cell BLOCKS", () => {
  toPhase2Stamped();
  writeMatrix(
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | auth | Security |  | sql injection in login |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "a finding must carry a severity");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("P-01") && m.includes("severity")), "the block must name the row and the column");
});

test("two severity glyphs in one cell BLOCKS (ambiguous)", () => {
  toPhase2Stamped();
  writeMatrix(
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | auth | Security | 🔴🟡 | can't be both critical and important |\n"
  );
  const r = engine.advancePhase(3);
  assert.strictEqual(r.ok, false, "exactly one severity, not two");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("P-01") && m.includes("severity")), "the block must name the row and the column");
});

test("the three canonical severities pass", () => {
  toPhase2Stamped();
  writeMatrix(
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | auth | Security | 🔴 | critical finding |\n" +
    "| A-01 | auth | Architectural | 🟡 | important finding |\n" +
    "| P-02 | ui | Security | 🟢 | suggestion |\n"
  );
  assert.strictEqual(engine.advancePhase(3).ok, true, "🔴/🟡/🟢 are the accepted set");
});

test("severity decoration is tolerated (🔴 Critical)", () => {
  toPhase2Stamped();
  writeMatrix(
    "# Findings\n\n| id | module | lens | severity | description |\n|---|---|---|---|---|\n" +
    "| P-01 | auth | Security | 🔴 Critical | glyph plus its word is fine |\n"
  );
  assert.strictEqual(engine.advancePhase(3).ok, true, "the glyph is the signal; a trailing word is decoration");
});

console.log("\n=== All tests completed ===\n");

// --- 0.17.0: fixes from the first external study (ESJUD, Versus 0.16.4, macOS/Xcode) ---

console.log("\n=== External-study fixes (ESJUD) ===\n");

test("a heredoc that MENTIONS npm test is a write, not a test run", () => {
  const cmd = 'cat >> research/GATES.md <<\'EOF\'\nRodado: npm test; echo "VERSUS_TEST_EXIT=$?" → VERSUS_TEST_EXIT=0\nEOF';
  assert.strictEqual(isTestCommand(cmd), false, "the exact shape that overwrote a green lastTestOutcome in the study");
  assert.ok(!stripHeredocs(cmd).includes("npm test"), "heredoc body is data");
});

test("text that merely mentions a runner is not a run (grep / echo / quoted)", () => {
  assert.strictEqual(isTestCommand('grep -n "npm test" research/LOG.md'), false);
  assert.strictEqual(isTestCommand('grep VERSUS_TEST_EXIT research/LOG.md'), false, "would have forged a pass from logged text");
  assert.strictEqual(isTestCommand('echo "next: npm test; pytest" >> notes.md'), false);
  assert.strictEqual(isTestCommand("git commit -m 'make npm test green'"), false);
});

test("real runs are recognized behind cd/env/time and inside bash -c", () => {
  assert.ok(isTestCommand('npm test; echo "VERSUS_TEST_EXIT=$?"'));
  assert.ok(isTestCommand('cd "aplicativo ios" && xcodebuild test -scheme ESJUD -destination "platform=iOS Simulator,name=iPhone 17"; echo "VERSUS_TEST_EXIT=$?"'));
  assert.ok(isTestCommand("CI=1 time pytest -q"));
  assert.ok(isTestCommand("bash -c 'cargo test --all'"));
  assert.ok(isTestCommand("node ./out/test/engine.test.js"));
});

test("non-npm runners are recognized (the study had to wrap xcodebuild in package.json)", () => {
  for (const c of [
    "xcodebuild -scheme App test", "xcodebuild test-without-building -scheme App", "swift test",
    "./gradlew testDebugUnitTest", "./gradlew connectedAndroidTest", "gradle check", "mvn -q test",
    "./mvnw verify", "dotnet test", "flutter test", "dart test", "make test", "ctest --output-on-failure",
    "bundle exec rspec", "vendor/bin/phpunit", "mix test", "go test ./...", "yarn test", "pnpm run test",
    "bun test", "deno test", "npx vitest run", "python3 -m pytest", "uv run pytest", "tox",
  ]) assert.ok(isTestCommand(c), `should recognize: ${c}`);
  for (const c of ["xcodebuild build -scheme App", "swift build", "./gradlew assembleDebug", "make", "npm install", "go build ./..."]) {
    assert.strictEqual(isTestCommand(c), false, `a build is not a test run: ${c}`);
  }
});

test(".versus/test-commands adds project-specific runners", () => {
  fs.mkdirSync(path.join(workspace, ".versus"), { recursive: true });
  fs.writeFileSync(path.join(workspace, ".versus", "test-commands"), "# custom\n^./run-suite\\b\n(\n");
  const extra = loadExtraTestPatterns(workspace);
  assert.strictEqual(extra.length, 1, "comments and invalid regexes are skipped");
  assert.ok(isTestCommand("./run-suite --all", extra));
  assert.strictEqual(isTestCommand("./run-suite --all"), false);
});

test("phase-gate: paths are anchored at the project root; outside the project is allowed", () => {
  const ws = workspace;
  assert.ok(isAllowedPath(path.join(ws, "specs/technical/architecture.md"), ws));
  assert.ok(isAllowedPath("specs/domain/x.json", ws));
  assert.strictEqual(isAllowedPath(path.join(ws, "src/specs/Impl.swift"), ws), false, "a nested specs/ dir is code — the old substring match let it through");
  assert.ok(isAllowedPath(path.join(os.tmpdir(), "scratch", "notes.ts"), ws), "the study's scratchpad (outside the workspace) was blocked");
  assert.ok(isAllowedPath(path.join(ws, "research/RESEARCH_LOG.md"), ws), "documentation files are not code");
  assert.ok(isAllowedPath(path.join(ws, "research/METRICS/findings.csv"), ws));
  assert.ok(isAllowedPath(path.join(ws, "package.json"), ws));
  assert.strictEqual(isAllowedPath(path.join(ws, "app/package.json"), ws), false, "root config only");
  assert.strictEqual(isAllowedPath(path.join(ws, "src/App.swift"), ws), false);
});

test("phase-gate: Bash writes to code are gated like Edit/Write", () => {
  const ws = workspace;
  const bash = (command: string) => blockedTargets({ tool_name: "Bash", tool_input: { command }, cwd: ws }, ws);
  assert.deepStrictEqual(bash("cat > src/App.swift <<'EOF'\nimport SwiftUI\nEOF"), ["src/App.swift"]);
  assert.deepStrictEqual(bash("echo x | tee -a src/a.ts"), ["src/a.ts"]);
  assert.deepStrictEqual(bash("sed -i 's/a/b/' src/a.py"), ["src/a.py"]);
  assert.deepStrictEqual(bash("cp /tmp/gen.kt app/src/Gen.kt"), ["app/src/Gen.kt"]);
  assert.deepStrictEqual(bash("cat >> research/RESEARCH_LOG.md <<'EOF'\nP0001 > src/x.ts\nEOF"), [], "doc write allowed; heredoc text is not a redirect");
  assert.deepStrictEqual(bash("npm test 2>&1 > /dev/null; ls > /tmp/out.txt"), []);
  assert.deepStrictEqual(bash('echo "a > src/x.ts"'), [], "a quoted > is not a redirection");
  assert.deepStrictEqual(bash("grep -rn foo src/"), [], "reads are never gated");
  assert.deepStrictEqual(writeTargets("cmd > \"$OUT\""), [], "unresolvable targets are skipped, not guessed");
  const edit = blockedTargets({ tool_name: "Write", tool_input: { file_path: path.join(ws, "src/main.ts") } }, ws);
  assert.strictEqual(edit.length, 1);
});

test("mark_exit_criterion refuses a criterion of another phase", () => {
  engine.initProject("Test", "Desc");
  const future = JSON.parse(handleMarkExitCriterion(engine, { phase: 1, criterion: "user_confirmed", met: true }));
  assert.strictEqual(future.success, false, "pre-stamping a future phase is what made G2/G3 land in the same second");
  assert.ok(String(future.error).includes("current phase is 0"));
  const crit = engine.getExitCriteriaWithDefs(0)[0].criterion;
  const now = JSON.parse(handleMarkExitCriterion(engine, { phase: 0, criterion: crit, met: true }));
  assert.strictEqual(now.success, true);
  assert.ok(!engine.getPhaseState()!.exitCriteria.some((c) => c.phase === 1), "the refused mark left nothing behind");
});

test("advance_phase without target_phase says what to pass, never 'Phase undefined'", () => {
  engine.initProject("Test", "Desc");
  const r = JSON.parse(handleAdvancePhase(engine, {} as { target_phase: number }));
  assert.strictEqual(r.success, false);
  assert.ok(String(r.error).includes("requires target_phase") && String(r.error).includes("next sequential phase is 1"));
  assert.ok(!String(r.error).includes("undefined"));
});

test("Phase 4 checks S1-S5, matching its 'Safeguards S1-S5 met' criterion", () => {
  toPhase5();
  // walk back the view: validate as if in Phase 4
  const st = engine.getPhaseState()!;
  const ids = (["S1", "S2", "S3", "S4", "S5"] as const).map((id) => validateSafeguard(id, { ...st, currentPhase: 4 }));
  assert.ok(ids.every((r) => r.details.length > 0));
  assert.strictEqual(ids[0].status, "warning", "S1 in Phase 4 is an active review of Phase 3");
  assert.ok(ids[0].details.includes("Phase 4 review"));
  assert.ok(ids[4].details.includes("Phase 4 review"));
  const { getSafeguardsForPhase } = require("../rules/safeguards");
  assert.deepStrictEqual(getSafeguardsForPhase(4).map((s: { id: string }) => s.id), ["S1", "S2", "S3", "S4", "S5"]);
});

test("S6 is ok (not warning) at 0 undiagnosed failures, warning once they accumulate; S7 is behavioral", () => {
  toPhase5();
  const st = () => engine.getPhaseState()!;
  assert.strictEqual(validateSafeguard("S6", st()).status, "ok", "'warning 0/3' all through Phases 5-6 carried no information");
  engine.recordTestOutcome("npm test", "fail");
  assert.strictEqual(validateSafeguard("S6", st()).status, "warning");
  assert.strictEqual(validateSafeguard("S7", st()).status, "ok");
});

// --- 0.18.0: memory that is lost or lies (RELATORIO-MELHORIAS-VERSUS, 25/11/2026) ---

console.log("\n=== 0.18.0 — cycle archive, approvals, provenance, delivery ===\n");

/** Phase 7 with every gate satisfied, ready for start_new_cycle. */
function toPhase7Closable() {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true, `P6 ${c.criterion} details`);
  engine.recordTestOutcome("npm test; echo VERSUS_TEST_EXIT=$?", "pass", { source: "harness", exitCode: 0, exitSource: "echo", cwd: workspace, runDir: workspace });
  assert.ok(engine.advancePhase(7).ok, "6→7");
  for (const c of engine.getExitCriteriaWithDefs(7)) engine.markExitCriterion(7, c.criterion, true, `P7 ${c.criterion} details`);
  fs.writeFileSync(path.join(workspace, "specs", "references", "lessons.md"),
    "# Lessons\n\n- The session TTL assumption from P0 was wrong; refreshed tokens broke it. guard: T-07\n- ORM lacked batch upsert. guard: none\n");
  approve(7);
}

test("closing a cycle ARCHIVES its exit criteria (with details) instead of wiping them", () => {
  toPhase7Closable();
  const r = engine.startNewCycle();
  assert.ok(r.ok, r.ok ? "" : String(r.error));
  if (!r.ok) return;
  assert.strictEqual(r.value.archived, 1);
  assert.strictEqual(r.value.cycle, 2, "closing cycle 1 opens cycle 2 (was announced as 3 before 0.18.0)");
  const st = engine.getPhaseState()!;
  assert.strictEqual(st.exitCriteria.length, 0, "the live criteria still reset for the new cycle");
  const rec = st.cycles![0];
  assert.strictEqual(rec.cycle, 1);
  assert.ok(rec.exitCriteria.some((c) => c.phase === 6 && c.criterion === "tests_passing" && c.details === "P6 tests_passing details"));
  assert.ok(rec.exitCriteria.find((c) => c.criterion === "tests_passing")!.verifiedBy, "engine provenance survives too");
  assert.ok(rec.transitions.some((t) => t.from === 6 && t.to === 7));
  assert.ok(rec.transitions.some((t) => t.from === 7 && t.to === 0));
  assert.strictEqual(rec.lastTestOutcome?.outcome, "pass");
  assert.ok(rec.decisionCount >= 3, "the cycle's decisions are counted (approvals at 3, 6, 7)");
  assert.strictEqual(engine.currentCycle(), 2);
});

test("the closed cycle is exported to readable Markdown", () => {
  toPhase7Closable();
  const r = engine.startNewCycle();
  assert.ok(r.ok && r.value.exportPath);
  if (!r.ok) return;
  const md = fs.readFileSync(path.join(workspace, r.value.exportPath!), "utf-8");
  assert.ok(md.includes("— Cycle 1"));
  assert.ok(md.includes("**tests_passing** — P6 tests_passing details"), "criteria with details");
  assert.ok(md.includes("approved by user"), "decision provenance");
  assert.ok(md.includes("verified by engine"), "engine provenance");
  assert.ok(md.includes("## Last witnessed test run"));
});

test("export_cycle writes the cycle in progress; refuses an unknown cycle with a reason", () => {
  toPhase5();
  const ok = JSON.parse(handleExportCycle(engine, {}));
  assert.strictEqual(ok.success, true);
  assert.strictEqual(ok.inProgress, true);
  assert.ok(fs.existsSync(path.join(workspace, ok.path)) && ok.path.endsWith("cycle-1-in-progress.md"));
  const bad = JSON.parse(handleExportCycle(engine, { cycle: 4 }));
  assert.strictEqual(bad.success, false);
  assert.ok(String(bad.error).includes("cycle 1"));
});

test("3→4 needs an approval decision naming the approver", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  writeArchitectureDoc(workspace);
  writeCoverageMatrix(workspace);
  for (let p = 0; p <= 2; p++) {
    for (const c of engine.getExitCriteriaWithDefs(p)) engine.markExitCriterion(p, c.criterion, true);
    if (p === 2) recordLenses();
    engine.advancePhase(p + 1);
  }
  for (const c of engine.getExitCriteriaWithDefs(3)) engine.markExitCriterion(3, c.criterion, true);
  const r = engine.advancePhase(4);
  assert.strictEqual(r.ok, false, "stamped criteria alone no longer cross the convergence gate");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("approval") && m.includes("approvedBy")));
  engine.recordDecision(3, "approval", "converged", {});            // no approver → still refused
  assert.strictEqual(engine.advancePhase(4).ok, false, "an approval without approvedBy is not an approval");
  approve(3);
  assert.strictEqual(engine.advancePhase(4).ok, true);
});

test("an approval recorded in an EARLIER pass of Phase 3 does not carry over the 2↔3 loop", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  writeArchitectureDoc(workspace);
  writeCoverageMatrix(workspace);
  for (let p = 0; p <= 2; p++) {
    for (const c of engine.getExitCriteriaWithDefs(p)) engine.markExitCriterion(p, c.criterion, true);
    if (p === 2) recordLenses();
    engine.advancePhase(p + 1);
  }
  approve(3);                                                     // pass 1 of Phase 3 approved…
  assert.ok(engine.advancePhase(2).ok, "…but the user loops back for another critique round");
  for (const c of engine.getExitCriteriaWithDefs(2)) engine.markExitCriterion(2, c.criterion, true);
  recordLenses();
  assert.ok(engine.advancePhase(3).ok);
  for (const c of engine.getExitCriteriaWithDefs(3)) engine.markExitCriterion(3, c.criterion, true);
  assert.strictEqual(engine.advancePhase(4).ok, false, "the pass-1 approval answered the OLD design");
  approve(3);
  assert.strictEqual(engine.advancePhase(4).ok, true);
});

test("the cycle close needs a Phase 7 approval decision", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass");
  engine.advancePhase(7);
  for (const c of engine.getExitCriteriaWithDefs(7)) engine.markExitCriterion(7, c.criterion, true);
  fs.writeFileSync(path.join(workspace, "specs", "references", "lessons.md"), "# Lessons\n\n" + "- a real lesson about the domain that is long enough. ".repeat(3) + "\n  guard: none\n");
  const r = engine.startNewCycle();
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  assert.ok(String(r.error).includes("[Phase 7] approval"));
});

test("a green run OUTSIDE the project does not satisfy tests_passing", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("node test.js", "pass", { source: "harness", cwd: "/tmp/scratch", runDir: "/tmp/scratch", outsideWorkspace: true });
  const r = engine.advancePhase(7);
  assert.strictEqual(r.ok, false, "a '24/24' from the scratchpad is not evidence about this project");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("OUTSIDE the project")));
});

test("testRunLocation follows cd and flags runs/scripts outside the workspace", () => {
  const ws = workspace;
  const at = (cmd: string, cwd = ws) => testRunLocation(cmd, cwd, ws);
  assert.strictEqual(at("npm test")!.outsideWorkspace, false);
  assert.strictEqual(at('cd "aplicativo ios" && xcodebuild test -scheme A')!.runDir, path.join(ws, "aplicativo ios"));
  assert.strictEqual(at('cd "aplicativo ios" && xcodebuild test -scheme A')!.outsideWorkspace, false);
  assert.strictEqual(at("cd /tmp/scratch && node test.js")!.outsideWorkspace, true, "cd out of the project");
  assert.strictEqual(at("npm test", "/tmp/elsewhere")!.outsideWorkspace, true, "session cwd outside");
  assert.strictEqual(at("node /tmp/scratch/check.test.js")!.outsideWorkspace, true, "script invoked by an outside path");
  assert.strictEqual(at("xcodebuild test -derivedDataPath /tmp/dd -scheme A")!.outsideWorkspace, false, "an outside build dir is not a test script");
  assert.strictEqual(at("ls -la"), undefined);
});

test("each transition fingerprints architecture.md (design existed, in that content, before the code)", () => {
  toPhase5();
  const t45 = engine.getPhaseState()!.history.find((h) => h.from === 4 && h.to === 5)!;
  const a = t45.artifacts!.find((x) => x.path === "specs/technical/architecture.md")!;
  const buf = fs.readFileSync(path.join(workspace, "specs", "technical", "architecture.md"));
  assert.strictEqual(a.bytes, buf.length);
  assert.strictEqual(a.sha256, require("crypto").createHash("sha256").update(buf).digest("hex"));
});

test("decisions carry proposedBy/approvedBy and the cycle", () => {
  engine.initProject("Test", "Desc");
  const d = engine.recordDecision(0, "scope", "x", { proposedBy: " Claude ", approvedBy: "" });
  assert.strictEqual(d.proposedBy, "Claude");
  assert.ok(!("approvedBy" in d), "an empty approver is not recorded as one");
  assert.strictEqual(d.cycle, 1);
});

test("version notice: once, for a project last opened by an older Versus, listing what is missing", () => {
  toPhase7Closable();
  fs.rmSync(path.join(workspace, "specs", "references", "lessons.md"));
  const st = engine.getPhaseState()!;
  delete st.versusVersion;                                   // simulate a pre-0.18.0 project
  const n = engine.noteVersion()!;
  assert.strictEqual(n.from, null);
  assert.ok(n.pending.some((p) => p.includes("references/lessons.md")), "the report's case: lessons.md missing at the close");
  assert.ok(n.pending.some((p) => p.includes("approvedBy")));
  assert.strictEqual(engine.getPhaseState()!.versusVersion, VERSUS_VERSION);
  assert.strictEqual(engine.getPhaseState()!.migrations!.length, 1, "the migration is recorded");
  assert.strictEqual(engine.noteVersion(), null, "and announced only once");
});

test("a new project carries the running version (no spurious notice)", () => {
  engine.initProject("Test", "Desc");
  assert.strictEqual(engine.getPhaseState()!.versusVersion, VERSUS_VERSION);
  assert.strictEqual(engine.noteVersion(), null);
});

test("VERSUS_VERSION matches package.json", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8"));
  assert.strictEqual(pkg.version, VERSUS_VERSION);
});

test("the per-message injection fits Claude Code's 10,000-char hook cap even on a huge project", () => {
  toPhase5();
  // 2 earlier cycles worth of decisions + 150 big ones in this one, a big spec, an S6 warning
  const st = engine.getPhaseState()!;
  const old = new Date(Date.parse(st.createdAt) - 86_400_000).toISOString();
  for (let i = 0; i < 60; i++) st.decisions.unshift({ id: `old-${i}`, phase: 2, category: "architecture", content: "OLD CYCLE " + "x".repeat(4000), timestamp: old });
  for (let i = 0; i < 150; i++) engine.recordDecision(5, "implementation", `decision ${i} ` + "y".repeat(5000));
  engine.updateProjectSpec({ stack: Array.from({ length: 80 }, (_, i) => `lib-${i}-with-a-long-name`) });
  engine.recordTestOutcome("npm test", "fail");
  engine.recordTestOutcome("npm test", "fail");
  const text = buildInjection(engine)!;
  assert.ok(text.length <= 10_000 && text.length <= INJECT_BUDGET + 200, `injection must stay under the hook cap; got ${text.length}`);
  assert.ok(text.includes("⚠ S6:"), "the S6 warning is never trimmed away (it used to come after 73K of guidance)");
  assert.ok(text.includes("get_phase_guidance()"), "points at where the methodology text is");
  assert.ok(text.includes("decision 149"), "newest decision of the cycle shown");
  assert.ok(!text.includes("OLD CYCLE"), "earlier cycles are not injected");
  assert.ok(text.includes("export_cycle"), "but the way to reach them is");
});

// --- Delivery channels (0.18.0): what each hook emits must be a shape Claude Code honours ---
// The audit that found these: prompt-type SessionStart/PreCompact hooks never ran, and a
// top-level {additionalContext} reached nobody. Unit tests checked the EMITTER (the text exists),
// never the channel. These run each compiled hook as a process and check its output against
// the documented contract for its event.

console.log("\n=== Delivery channels (hook contracts) ===\n");

const HOOK_CAP = 10_000;
const TOP_LEVEL_KEYS = new Set(["continue", "stopReason", "suppressOutput", "systemMessage", "decision", "reason", "hookSpecificOutput"]);

function runHook(name: string, stdin: unknown): { stdout: string; status: number | null } {
  // The BUNDLE: what deployServer() copies into projects. (out/hooks is tsc output, and
  // tsconfig excludes three hooks, so it held April builds of them; the tests passed on stale code.)
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "bundle", `${name}.js`)], {
    input: JSON.stringify(stdin),
    env: { ...process.env, CLAUDE_PROJECT_DIR: workspace },
    encoding: "utf-8",
    timeout: 20_000,
  });
  return { stdout: r.stdout ?? "", status: r.status };
}

function assertJsonContract(out: string, event: string) {
  const o = JSON.parse(out);
  for (const k of Object.keys(o)) assert.ok(TOP_LEVEL_KEYS.has(k), `${event}: top-level key "${k}" is not part of the hook output contract`);
  if (o.hookSpecificOutput) assert.strictEqual(o.hookSpecificOutput.hookEventName, event, "hookEventName must name the event");
  for (const v of [o.hookSpecificOutput?.additionalContext, o.systemMessage, o.reason, o.hookSpecificOutput?.permissionDecisionReason]) {
    if (typeof v === "string") assert.ok(v.length <= HOOK_CAP, `${event}: a text field over ${HOOK_CAP} chars becomes a 2,000-char preview`);
  }
  return o;
}

test("every registered hook is a command hook, bundled AND deployed", () => {
  const hooks = buildOrchestratorHooks(workspace);
  const bundle = fs.readFileSync(path.join(__dirname, "..", "..", "scripts", "bundle.mjs"), "utf-8");
  const ext = fs.readFileSync(path.join(__dirname, "..", "..", "src", "extension.ts"), "utf-8");
  for (const [event, entries] of Object.entries(hooks)) {
    for (const e of entries as { hooks: { type: string; command?: string }[] }[]) {
      for (const h of e.hooks) {
        assert.strictEqual(h.type, "command", `${event}: only command hooks deliver text (prompt hooks are LLM decisions, unsupported on SessionStart/PreCompact)`);
        const script = /([\w-]+)\.js/.exec(h.command ?? "")![1];
        assert.ok(bundle.includes(`out: "${script}"`), `${script} must be bundled (scripts/bundle.mjs)`);
        assert.ok(ext.includes(`"${script}.js"`), `${script}.js must be in deployServer()'s file list — registered but not copied fails silently`);
      }
    }
  }
  assert.ok(hooks.SessionStart && hooks.PreCompact, "session recovery hooks are registered");
});

test("UserPromptSubmit: plain text under the cap, even on a huge project", () => {
  toPhase5();
  for (let i = 0; i < 120; i++) engine.recordDecision(5, "implementation", `d${i} ` + "z".repeat(6000));
  const r = runHook("inject-context", { prompt: "hi" });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.length > 0 && r.stdout.length <= HOOK_CAP, `got ${r.stdout.length}`);
  assert.ok(r.stdout.startsWith("[Versus] Phase 5"));
});

test("SessionStart (startup and compact): context for the model + the banner for the user, under the cap", () => {
  toPhase5();
  for (let i = 0; i < 80; i++) engine.recordDecision(5, "implementation", `d${i} ` + "z".repeat(6000));
  for (const source of ["startup", "compact"]) {
    const r = runHook("session-start", { source, hook_event_name: "SessionStart" });
    assert.strictEqual(r.status, 0);
    const o = assertJsonContract(r.stdout, "SessionStart");
    const ctx = String(o.hookSpecificOutput.additionalContext);
    assert.ok(ctx.length <= HOOK_CAP, `${source}: got ${ctx.length}`);
    assert.ok(ctx.includes("get_phase_guidance()"), `${source}: must say where the methodology comes from`);
    assert.ok(ctx.includes("[Versus] Phase 5"), `${source}: carries the state itself`);
    assert.ok(/^📍 Versus \d+\.\d+\.\d+ /.test(String(o.systemMessage)), `${source}: the banner goes to the USER mechanically (the model never showed it)`);
    assert.ok(!ctx.includes("VISIBILITY"), "no longer asks the model for the banner");
  }
  const c = JSON.parse(runHook("session-start", { source: "compact" }).stdout);
  assert.ok(String(c.hookSpecificOutput.additionalContext).includes("compacted"));
  assert.ok(String(c.systemMessage).includes("retomado"));
});

test("SessionStart without a project gives the init protocol", () => {
  const r = runHook("session-start", { source: "startup" });
  const o = assertJsonContract(r.stdout, "SessionStart");
  assert.ok(String(o.hookSpecificOutput.additionalContext).includes("init_project"));
  assert.ok(!("systemMessage" in o), "no banner without a project");
});

test("PreCompact: plain text for the compaction summary, under the cap", () => {
  toPhase5();
  const r = runHook("pre-compact", { trigger: "auto" });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.length > 0 && r.stdout.length <= HOOK_CAP);
  assert.ok(r.stdout.includes("Phase 5") && r.stdout.includes("get_phase_guidance()"));
});

test("PostToolUse test-outcome: the S6 escalation uses hookSpecificOutput (the top-level form reached nobody)", () => {
  toPhase5();
  const cmd = 'npm test; echo "VERSUS_TEST_EXIT=$?"';
  engine.recordTestOutcome(cmd, "fail");          // same command: S6 counts failures per suite
  const r = runHook("test-outcome", {
    tool_name: "Bash", tool_input: { command: cmd },
    tool_response: { stdout: "boom\nVERSUS_TEST_EXIT=1", stderr: "" }, cwd: workspace,
  });
  const o = assertJsonContract(r.stdout, "PostToolUse");
  assert.ok(String(o.hookSpecificOutput.additionalContext).includes("S6"));
});

test("PostToolUse truncation-check: hookSpecificOutput too", () => {
  const r = runHook("truncation-check", { tool_name: "Bash", tool_input: {}, tool_response: { stdout: "Output too large (204KB). Full output saved to: /x" } });
  const o = assertJsonContract(r.stdout, "PostToolUse");
  assert.ok(String(o.hookSpecificOutput.additionalContext).includes("truncated"));
});

test("PreToolUse phase-gate and loop-detector: deny via hookSpecificOutput.permissionDecision", () => {
  engine.initProject("Test", "Desc");
  const g = runHook("phase-gate", { tool_name: "Write", tool_input: { file_path: path.join(workspace, "src", "a.ts") } });
  const go = assertJsonContract(g.stdout, "PreToolUse");
  assert.strictEqual(go.hookSpecificOutput.permissionDecision, "deny");
  teardown(); setup();
  toPhase5();
  for (let i = 0; i < LOOP_FAILURE_THRESHOLD; i++) engine.recordTestOutcome("npm test", "fail");
  const l = runHook("loop-detector", { tool_name: "Bash", tool_input: { command: "npm test" } });
  const lo = assertJsonContract(l.stdout, "PreToolUse");
  assert.strictEqual(lo.hookSpecificOutput.permissionDecision, "deny");
});

test("Stop stop-verify: block = decision/reason; a warning goes to the USER as systemMessage", () => {
  toPhase5();
  fs.writeFileSync(path.join(workspace, "package.json"), JSON.stringify({ scripts: { test: "node -e process.exit(1)" } }));
  const b = runHook("stop-verify", { stop_hook_active: false });
  const bo = assertJsonContract(b.stdout, "Stop");
  assert.strictEqual(bo.decision, "block");
  assert.ok(String(bo.reason).includes("TESTS FAILED"));
  fs.rmSync(path.join(workspace, "package.json"));
  const w = runHook("stop-verify", { stop_hook_active: false });
  const wo = assertJsonContract(w.stdout, "Stop");
  assert.ok(typeof wo.systemMessage === "string" && !("additionalContext" in wo));
});

test("update_project_spec returns the delta and counts, not the whole (ever-growing) spec", () => {
  engine.initProject("Test", "Desc");
  engine.updateProjectSpec({ constraints: Array.from({ length: 300 }, (_, i) => `constraint ${i} ` + "c".repeat(120)) });
  const out = handleUpdateProjectSpec(engine, { stack: ["Swift 6"] });
  const o = JSON.parse(out);
  assert.ok(out.length < 1000, `the audit measured 40,764 chars on a real project; got ${out.length}`);
  assert.deepStrictEqual(o.added, { stack: ["Swift 6"] });
  assert.strictEqual(o.counts.constraints, 300);
});

test("4→5 needs the convergence confirmation recorded in Phase 4 (0.18.1)", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(95, makeFullBreakdown(95));
  writeArchitectureDoc(workspace);
  writeCoverageMatrix(workspace);
  for (let p = 0; p <= 3; p++) {
    for (const c of engine.getExitCriteriaWithDefs(p)) engine.markExitCriterion(p, c.criterion, true);
    if (p === 2) recordLenses();
    if (p === 3) approve(3);
    engine.advancePhase(p + 1);
  }
  for (const c of engine.getExitCriteriaWithDefs(4)) engine.markExitCriterion(4, c.criterion, true);
  const r = engine.advancePhase(5);
  assert.strictEqual(r.ok, false, "the 3→4 'shall we verify?' approval does not confirm the verification's result");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("[Phase 4] approval") && m.includes("report")));
  approve(4);
  assert.strictEqual(engine.advancePhase(5).ok, true);
});

// --- 0.18.2: pending items from the first full 0.18 cycle (MoonPatrolClone) ---

console.log("\n=== 0.18.2 — pending items from MoonPatrolClone ===\n");

test("S6 pattern ignores the plumbing: pipes and the exit echo do not restart the count", () => {
  toPhase5();
  engine.recordTestOutcome('npx playwright test; echo "VERSUS_TEST_EXIT=$?"', "fail");
  engine.recordTestOutcome('npx playwright test 2>&1 | grep -E "passed|failed"; echo "VERSUS_TEST_EXIT=${PIPESTATUS[0]}"', "fail");
  assert.strictEqual(engine.getLoopCounter().count, 2, "same suite, different plumbing: one count");
  assert.strictEqual(engine.getLoopCounter().pattern, "npx playwright test");
  engine.recordTestOutcome("cd app && npx playwright test --reporter=line", "fail");
  assert.strictEqual(engine.getLoopCounter().count, 3, "a cd and a flag do not change the suite either");
  assert.ok(engine.isLoopBlocked());
});

test("the state header names the running Versus version", () => {
  toPhase5();
  const t = buildInjection(engine)!;
  assert.ok(t.split("\n")[0].endsWith(`| v${VERSUS_VERSION}`), t.split("\n")[0]);
});

test("the Phase 7 approval writes the cycle record even if no new cycle follows", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true, `P6 ${c.criterion}`);
  engine.recordTestOutcome("npm test", "pass");
  assert.ok(engine.advancePhase(7).ok);
  const r = JSON.parse(handleRecordDecision(engine, { phase: 7, category: "approval", content: "Projeto concluído — atende o MVP", approvedBy: "user ('Projeto concluído')" }));
  assert.ok(String(r._export).includes(".versus/cycles/cycle-1.md"), "a project that ENDS at Phase 7 still leaves its record");
  const md = fs.readFileSync(path.join(workspace, ".versus", "cycles", "cycle-1.md"), "utf-8");
  assert.ok(md.includes("**tests_passing** — P6 tests_passing") && md.includes("Projeto concluído"));
  const plain = JSON.parse(handleRecordDecision(engine, { phase: 7, category: "process", content: "note" }));
  assert.ok(!("_export" in plain), "only an approval closes the cycle");
});

// --- 0.19.0: report items 2, 4, 6, 9, 12 + the Phase 5 Scope Inventory record ---

console.log("\n=== 0.19.0 — declared checks, promised tests, deviations, scope inventory, lesson guards ===\n");

/** Phase 6 with everything but the gate under test satisfied. */
function toPhase6Ready() {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass", { source: "harness", exitCode: 0, exitSource: "echo" });
}

test("a declared check is EXECUTED, not attested: blocked until witnessed with the expected result", () => {
  toPhase6Ready();
  const d = JSON.parse(handleMarkExitCriterion(engine, {
    phase: 6, criterion: "edge_cases", met: true, details: "OAuth removed from all 4 services",
    check_command: "grep -rli oauth services/ | wc -l", check_expect: "output:^\\s*0\\s*$",
  }));
  assert.strictEqual(d.success, true);
  assert.ok(String(d._check).includes("run it through Bash"));
  let r = engine.advancePhase(7);
  assert.strictEqual(r.ok, false, "the audit's case: 'grep = 0' attested, never run");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("has not seen it run")));
  engine.witnessChecks("cd /x && grep -rli oauth services/ | wc -l", "1\n");     // one service still has it
  r = engine.advancePhase(7);
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("did NOT give")));
  engine.witnessChecks("grep -rli oauth services/ | wc -l", "0\n");
  assert.strictEqual(engine.advancePhase(7).ok, true);
});

test("an exit-code check uses the VERSUS_EXIT echo; a bad expectation is refused at declaration", () => {
  toPhase6Ready();
  assert.strictEqual(engine.declareCheck(6, "edge_cases", "make lint", "exit:0").ok, true);
  assert.strictEqual(detectExitCode("ok\nVERSUS_EXIT=0"), 0, "the general token is read like the test one");
  engine.witnessChecks('make lint; echo "VERSUS_EXIT=$?"', "lint ok\nVERSUS_EXIT=0", detectExitCode("lint ok\nVERSUS_EXIT=0"));
  assert.strictEqual(engine.advancePhase(7).ok, true);
  assert.strictEqual(engine.declareCheck(6, "x", "true", "zero please").ok, false);
});

test("the hook witnesses a declared check in ANY phase (not only 5+)", () => {
  engine.initProject("Test", "Desc");
  engine.declareCheck(0, "user_confirmed", "ls specs | wc -l", "output:\\d+");
  const r = runHook("test-outcome", {
    tool_name: "Bash", tool_input: { command: "ls specs | wc -l" },
    tool_response: { stdout: "9\n", stderr: "" }, cwd: workspace,
  });
  const o = assertJsonContract(r.stdout, "PostToolUse");
  assert.ok(String(o.hookSpecificOutput.additionalContext).includes("user_confirmed"));
  const ck = new StateEngine(workspace).getPhaseState()!.exitCriteria.find((c) => c.criterion === "user_confirmed")!.check!;
  assert.strictEqual(ck.witnessed?.ok, true);
});

test("6→7: every T-xx promised by the CURRENT architecture version must appear in a test file", () => {
  toPhase6Ready();
  const arch = path.join(workspace, "specs", "technical", "architecture.md");
  fs.writeFileSync(arch,
    "# Architecture\n\n## V(1)\n| id | module | responsibility | interface | depends-on |\n|---|---|---|---|---|\n| M-01 | auth | a | l() | db |\n| M-02 | ui | r | r() | auth |\n" +
    "Promised: T-09 (dropped later)\n\n## V(2)\n| id | module | responsibility | interface | depends-on |\n|---|---|---|---|---|\n| M-01 | auth | a | l() | db |\n| M-02 | ui | r | r() | auth |\n" +
    "Promised tests: T-01 fast double-tap; T-02 ready flag only with hashed run id\n\n## Desvios\nnenhum\n");
  fs.mkdirSync(path.join(workspace, "tests"), { recursive: true });
  fs.writeFileSync(path.join(workspace, "tests", "input.test.js"), "test('T-01 fast double-tap', () => {})\n");
  const r = engine.advancePhase(7);
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  const m = r.error.missingCriteria.find((x) => x.includes("promised tests"))!;
  assert.ok(m.includes("T-02") && !m.includes("T-01") && !m.includes("T-09"), "only the current version's unimplemented promise");
  fs.writeFileSync(path.join(workspace, "tests", "ready.test.js"), "// T-02\ntest('ready', () => {})\n");
  assert.strictEqual(engine.advancePhase(7).ok, true);
});

test("6→7: the current architecture version records its deviations (or 'nenhum')", () => {
  toPhase6Ready();
  const arch = path.join(workspace, "specs", "technical", "architecture.md");
  const base = "# Architecture\n\n## V(1)\n| id | module | responsibility | interface | depends-on |\n|---|---|---|---|---|\n| M-01 | auth | a | l() | db |\n| M-02 | ui | r | r() | auth |\n";
  fs.writeFileSync(arch, base + "\n## Desvios\nV0 note\n\n## V(2)\n| id | module | responsibility | interface | depends-on |\n|---|---|---|---|---|\n| M-01 | auth | a | l() | db |\n| M-02 | ui | r | r() | auth |\n");
  let r = engine.advancePhase(7);
  assert.strictEqual(r.ok, false, "a Desvios section of an OLD version does not cover the current one");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("Desvios")));
  fs.appendFileSync(arch, "\n## Desvios\n\n## Notes\nx\n");
  assert.strictEqual(engine.advancePhase(7).ok, false, "an empty Desvios section is not a record");
  fs.writeFileSync(arch, fs.readFileSync(arch, "utf-8").replace("## Desvios\n\n## Notes", "## Desvios\n- iframe removed instead of src=about:blank — leak on reopen\n\n## Notes"));
  assert.strictEqual(engine.advancePhase(7).ok, true);
});

test("5→6: the Scope Inventory leaves a record", () => {
  toPhase5();
  for (const c of engine.getExitCriteriaWithDefs(5)) engine.markExitCriterion(5, c.criterion, true);
  const r = engine.advancePhase(6);
  assert.strictEqual(r.ok, false, "MUST DISPLAY was never a record (ESJUD crossed 5→6 without it)");
  if (r.ok) return;
  assert.ok(r.error.missingCriteria.some((m) => m.includes("scope-inventory")));
  engine.recordDecision(5, "scope-inventory", "all good");
  assert.strictEqual(engine.advancePhase(6).ok, false, "an inventory without ✅/❌ items is not an inventory");
  engine.recordDecision(5, "scope-inventory", "M-01 auth ✅\nM-02 ui ✅\nUC-1 end-to-end ✅");
  assert.strictEqual(engine.advancePhase(6).ok, true);
});

test("lessons: each says whether it became a guard; 'none' ones are listed for the human", () => {
  engine.initProject("Test", "Desc");
  const lp = path.join(workspace, "specs", "references", "lessons.md");
  // heading form (the ESJUD lessons file's shape), with a backlog section that is NOT a lesson
  fs.writeFileSync(lp,
    "# Lições\n\n## 1. Domínio — dependências externas\ntexto\nguard: T-07\n\n## 2. Stack — ViewModel recriado\ntexto\n\n" +
    "## 3. mTLS\ntexto\nguard: none\n\n## Backlog para o ciclo v2.0\n1. item\n");
  const ls = engine.lessons();
  assert.deepStrictEqual(ls.map((l) => l.guard), ["T-07", null, "none"], "3 lessons; the backlog is not one");
  // bullet form
  fs.writeFileSync(lp, "# Lessons\n\n- first lesson\n  guard: T-01\n- second lesson\nguard: none\n");
  assert.deepStrictEqual(engine.lessons().map((l) => l.guard), ["T-01", "none"]);
});

test("start_new_cycle is blocked while a lesson lacks its guard line", () => {
  toPhase6Ready();
  assert.ok(engine.advancePhase(7).ok);
  for (const c of engine.getExitCriteriaWithDefs(7)) engine.markExitCriterion(7, c.criterion, true);
  approve(7);
  const lp = path.join(workspace, "specs", "references", "lessons.md");
  fs.writeFileSync(lp, "# Lessons\n\n- The session TTL assumption from P0 was wrong; refreshed tokens broke it.\n- The ORM lacked batch upsert; had to hand-roll it.\n  guard: none\n");
  const r = engine.startNewCycle();
  assert.strictEqual(r.ok, false);
  if (r.ok) return;
  assert.ok(String(r.error).includes("guard") && String(r.error).includes("session TTL"));
  const m = JSON.parse(handleMarkExitCriterion(engine, { phase: 7, criterion: "lessons_documented", met: true }));
  assert.ok(m._lessonsWithoutGuard.lessons.some((t: string) => t.includes("ORM")), "guard: none lessons go to the human");
  assert.ok(m._lessonsMissingGuardLine.lessons.some((t: string) => t.includes("session TTL")));
  fs.writeFileSync(lp, fs.readFileSync(lp, "utf-8").replace("broke it.\n", "broke it.\n  guard: T-07\n"));
  assert.strictEqual(engine.startNewCycle().ok, true);
});

test("guidance teaches the new records before the gates fire (items 4, 6, 9, 12, scope inventory, checks)", () => {
  const g5 = handleGetPhaseGuidance(engine, { phase: 5 });
  engine.initProject("Test", "Desc");
  const get = (p: number) => JSON.parse(handleGetPhaseGuidance(engine, { phase: p })).guidance as string;
  assert.ok(get(1).includes("T-01"), "Phase 1: promised tests get ids");
  assert.ok(get(5).includes("scope-inventory") && get(5).includes("undiscussed-choices"), "Phase 5: inventory record + undiscussed choices");
  assert.ok(get(6).includes("## Desvios") && get(6).includes("check_command"), "Phase 6: deviations + declared checks");
  assert.ok(get(7).includes("guard: <test id>"), "Phase 7: lesson guards");
  void g5;
});

test("lessons accumulated across cycles: only the CURRENT cycle's section is asked for guards", () => {
  engine.initProject("Test", "Desc");
  const st = engine.getPhaseState()!;
  st.history.push({ from: 7, to: 0, timestamp: new Date().toISOString(), criteriaMet: [] });   // now in cycle 2
  fs.writeFileSync(path.join(workspace, "specs", "references", "lessons.md"),
    "# Lições\n\n# Ciclo 1 — MVP\n\n## Lição 1 — antiga, sem guard\ntexto\n\n## Métricas do ciclo\n- 12 testes\n\n" +
    "# Ciclo 2 — v2\n\n## Lição 1 — nova\nguard: T-03\n\n## Referências acumuladas\n- doc X\n");
  const ls = engine.lessons();
  assert.deepStrictEqual(ls.map((l) => l.guard), ["T-03"], "cycle 1's pre-0.19 lessons and the metrics/references sections are not asked");
});

// --- Packaging: shipped code must not import from directories the .vsix excludes ---
// 0.18.2 made state/engine.ts import ../hooks/shell-parse. The hook BUNDLES were fine (esbuild
// inlines it), but .vscodeignore excludes out/hooks/**, so the extension's own engine.js failed
// at runtime ("Cannot find module '../hooks/shell-parse'" on initProject) through 0.19.0.

console.log("\n=== Packaging ===\n");

test("code that ships in the .vsix imports nothing from a directory the .vsix excludes", () => {
  const root = path.join(__dirname, "..", "..");
  const ignore = fs.readFileSync(path.join(root, ".vscodeignore"), "utf-8").split(/\r?\n/);
  const excluded = new Set(ignore.map((l) => /^out\/([\w-]+)\/\*\*$/.exec(l.trim())?.[1]).filter((x): x is string => !!x));
  assert.ok(excluded.has("hooks"), "sanity: out/hooks is excluded (hooks ship as bundles)");
  const src = path.join(root, "src");
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith(".ts")) continue;
      const rel = path.relative(src, full).split(path.sep);
      if (rel.length > 1 && excluded.has(rel[0])) continue;          // excluded code may import anything
      for (const m of fs.readFileSync(full, "utf-8").matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
        const target = path.relative(src, path.resolve(path.dirname(full), m[1])).split(path.sep);
        if (target.length > 1 && excluded.has(target[0])) bad.push(`${rel.join("/")} → ${m[1]}`);
      }
    }
  };
  walk(src);
  assert.deepStrictEqual(bad, [], "these imports resolve to files that are not in the .vsix");
});
