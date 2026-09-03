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
import { handleGetPhaseState, handleGetDecisions } from "../mcp/tools/state-tools";
import { handleGetPhaseGuidance } from "../mcp/tools/guidance-tools";
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
    "## Assumptions\n- single-threaded runtime\n";
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
  engine.advancePhase(6);
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 6);
  writeCriticalCoverage(workspace); // III.1: leaving Phase 6 requires every 🔴 finding traced
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
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  assert.strictEqual(engine.advancePhase(7).ok, false, "the pass must be witnessed IN phase 6");
});

test("start_new_cycle BLOCKED until lessons.md is persisted", () => {
  toPhase6();
  for (const c of engine.getExitCriteriaWithDefs(6)) engine.markExitCriterion(6, c.criterion, true);
  engine.recordTestOutcome("npm test", "pass");
  engine.advancePhase(7);
  for (const c of engine.getExitCriteriaWithDefs(7)) engine.markExitCriterion(7, c.criterion, true);

  const blocked = engine.startNewCycle();
  assert.strictEqual(blocked.ok, false);
  if (blocked.ok) return;
  assert.ok(String(blocked.error).includes("references/lessons.md"));

  fs.writeFileSync(
    path.join(workspace, "specs", "references", "lessons.md"),
    "# Lessons\n\n- The auth module's session TTL assumption from P0 was wrong; refreshed tokens broke it.\n- The chosen ORM lacked batch upsert; had to hand-roll it.\n"
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
    "## Premissas\n| id | premissa | consequência |\n|---|---|---|\n| A-1 | single-thread | races |\n| A-2 | streaming migration | memory spike |\n"
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
  assert.strictEqual(o.decisionsCount, 20);
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

test("get_phase_guidance returns a pointer, not the full ~8KB text (no spill)", () => {
  toPhase5();
  const out = handleGetPhaseGuidance(engine, {});
  const o = JSON.parse(out) as any;
  assert.ok(out.length < 1000, `must be a small pointer, not the full phase text; got ${out.length}`);
  assert.ok(o.guidancePointer && o.guidancePointer.includes("## Phase 5"), "points at the injected phase section");
  assert.ok(!("guidance" in o), "no longer carries the full guidance inline");
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

// --- projectSpec entries are timestamped (item 4), back-compat with strings ---

test("updateProjectSpec timestamps new entries and dedups by value", () => {
  engine.initProject("Test", "Desc");
  engine.updateProjectSpec({ stack: ["TypeScript"] });
  const e = engine.getPhaseState()!.projectSpec.stack[0];
  assert.ok(typeof e === "object" && e.value === "TypeScript" && !!e.at, "new entry carries value + timestamp");

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
