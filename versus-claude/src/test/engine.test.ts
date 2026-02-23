// Testes do State Engine e Methodology Rules

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { StateEngine } from "../state/engine";
import { ScoreBreakdown } from "../state/types";

function createTempWorkspace(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "versus-test-"));
  // Criar specs/ para testes de checkSpecsStatus
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
  // Distribui o score proporcionalmente aos pesos
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

// ===== Testes =====

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

// --- Projeto ---

test("initProject cria state.json", () => {
  const state = engine.initProject("Test", "Desc");
  assert.strictEqual(state.projectName, "Test");
  assert.strictEqual(state.currentPhase, 0);
  assert.strictEqual(state.currentIteration, 1);
  assert.strictEqual(state.phase0Score, null);
  assert.strictEqual(state.decisions.length, 0);
  assert.strictEqual(state.safeguards.length, 8);

  // Verifica persistência
  const statePath = path.join(workspace, ".versus", "state.json");
  assert.ok(fs.existsSync(statePath));
});

test("initProject rejeita se já existe", () => {
  engine.initProject("Test", "Desc");
  const loaded = engine.getPhaseState();
  assert.ok(loaded !== null);
  // Segundo init não deve sobrescrever (testado via MCP tool)
});

test("getPhaseState retorna null sem projeto", () => {
  const state = engine.getPhaseState();
  assert.strictEqual(state, null);
});

test("load recupera estado de disco", () => {
  engine.initProject("Persist", "Test");
  const engine2 = new StateEngine(workspace);
  const state = engine2.getPhaseState();
  assert.ok(state !== null);
  assert.strictEqual(state!.projectName, "Persist");
});

// --- Decisões ---

test("recordDecision persiste e é consultável", () => {
  engine.initProject("Test", "Desc");
  const d = engine.recordDecision(0, "scope", "Fora de escopo: i18n");
  assert.ok(d.id);
  assert.strictEqual(d.phase, 0);
  assert.strictEqual(d.category, "scope");

  const decisions = engine.getDecisions(0);
  assert.strictEqual(decisions.length, 1);
  assert.strictEqual(decisions[0].content, "Fora de escopo: i18n");
});

test("getDecisions filtra por fase", () => {
  engine.initProject("Test", "Desc");
  engine.recordDecision(0, "scope", "D1");
  engine.recordDecision(1, "arch", "D2");
  engine.recordDecision(0, "req", "D3");

  assert.strictEqual(engine.getDecisions(0).length, 2);
  assert.strictEqual(engine.getDecisions(1).length, 1);
  assert.strictEqual(engine.getDecisions().length, 3);
});

// --- Score ---

test("updateScore salva e é consultável", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(85, makeFullBreakdown(85));

  const state = engine.getPhaseState()!;
  assert.strictEqual(state.phase0Score, 85);
  assert.ok(state.phase0Breakdown !== null);
});

// --- Exit Criteria ---

test("markExitCriterion cria e atualiza", () => {
  engine.initProject("Test", "Desc");
  engine.markExitCriterion(0, "score_90", true, "Score 92");

  const criteria = engine.getExitCriteriaState(0);
  assert.strictEqual(criteria.length, 1);
  assert.strictEqual(criteria[0].met, true);

  // Atualizar existente
  engine.markExitCriterion(0, "score_90", false, "Reavaliado");
  const updated = engine.getExitCriteriaState(0);
  assert.strictEqual(updated[0].met, false);
});

test("getExitCriteriaWithDefs mostra defs e estado", () => {
  engine.initProject("Test", "Desc");
  engine.markExitCriterion(0, "score_90", true);

  const criteria = engine.getExitCriteriaWithDefs(0);
  assert.ok(criteria.length > 0);
  const score = criteria.find((c) => c.criterion === "score_90");
  assert.ok(score);
  assert.strictEqual(score!.met, true);

  const other = criteria.find((c) => c.criterion === "usuario_confirmou");
  assert.ok(other);
  assert.strictEqual(other!.met, false);
});

// --- Transições ---

test("advancePhase bloqueia sem exit criteria", () => {
  engine.initProject("Test", "Desc");
  const result = engine.advancePhase(1);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error.missingCriteria.length > 0);
  }
});

test("advancePhase bloqueia sem score 90", () => {
  engine.initProject("Test", "Desc");
  engine.updateScore(75, makeFullBreakdown(75));
  // Marcar todos exit criteria
  const criteria = engine.getExitCriteriaWithDefs(0);
  for (const c of criteria) {
    engine.markExitCriterion(0, c.criterion, true);
  }
  const result = engine.advancePhase(1);
  assert.strictEqual(result.ok, false);
});

test("advancePhase permite com score >= 90 e criteria", () => {
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

test("advancePhase bloqueia transição inválida (0→2)", () => {
  engine.initProject("Test", "Desc");
  const result = engine.advancePhase(2);
  assert.strictEqual(result.ok, false);
});

test("loop Phase 2↔3 permitido", () => {
  engine.initProject("Test", "Desc");
  // Fast-forward para Phase 2
  engine.updateScore(95, makeFullBreakdown(95));
  for (const c of engine.getExitCriteriaWithDefs(0)) engine.markExitCriterion(0, c.criterion, true);
  engine.advancePhase(1);
  for (const c of engine.getExitCriteriaWithDefs(1)) engine.markExitCriterion(1, c.criterion, true);
  engine.advancePhase(2);

  assert.strictEqual(engine.getPhaseState()!.currentPhase, 2);

  // Phase 2 → 3
  for (const c of engine.getExitCriteriaWithDefs(2)) engine.markExitCriterion(2, c.criterion, true);
  const to3 = engine.advancePhase(3);
  assert.strictEqual(to3.ok, true);

  // Phase 3 → 2 (loop)
  for (const c of engine.getExitCriteriaWithDefs(3)) engine.markExitCriterion(3, c.criterion, true);
  const to2 = engine.advancePhase(2);
  assert.strictEqual(to2.ok, true);
  assert.strictEqual(engine.getPhaseState()!.currentPhase, 2);
});

// --- Iterações ---

test("startIteration incrementa contador", () => {
  engine.initProject("Test", "Desc");
  assert.strictEqual(engine.getPhaseState()!.currentIteration, 1);

  const r = engine.startIteration(0);
  assert.strictEqual(r.ok, true);
  if (r.ok) {
    assert.strictEqual(r.value.iterationNumber, 2);
  }
  assert.strictEqual(engine.getPhaseState()!.currentIteration, 2);
});

test("startIteration rejeita fase errada", () => {
  engine.initProject("Test", "Desc");
  const r = engine.startIteration(1); // está na phase 0
  assert.strictEqual(r.ok, false);
});

// --- Salvaguardas ---

test("checkSafeguard S0 ok quando na Phase 0", () => {
  engine.initProject("Test", "Desc");
  const r = engine.checkSafeguard("S0");
  assert.strictEqual(r.status, "ok");
});

test("checkAllSafeguards retorna aplicáveis", () => {
  engine.initProject("Test", "Desc");
  const results = engine.checkAllSafeguards();
  assert.ok(results.length > 0);
});

// --- Specs ---

test("checkSpecsStatus detecta dirs vazios e populados", () => {
  engine.initProject("Test", "Desc");

  // Tudo vazio (só README.md)
  let status = engine.checkSpecsStatus();
  assert.strictEqual(status["domain"].populated, false);

  // Popular domain/
  fs.writeFileSync(path.join(workspace, "specs", "domain", "glossario.md"), "# Glossário");
  status = engine.checkSpecsStatus();
  assert.strictEqual(status["domain"].populated, true);
  assert.strictEqual(status["domain"].fileCount, 1);
});

console.log("\n=== Todos os testes concluídos ===\n");
