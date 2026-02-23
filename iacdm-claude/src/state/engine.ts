// State Engine — gerencia estado persistente da metodologia

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import {
  PhaseState,
  Decision,
  ExitCriterionState,
  ScoreBreakdown,
  SpecsStatus,
  TransitionError,
  IterationInfo,
  Result,
  createDefaultState,
  SafeguardState,
} from "./types";
import {
  validatePhaseTransition,
  checkSafeguard as ruleSafeguard,
  checkAllSafeguards as ruleAllSafeguards,
  getExitCriteria,
  SafeguardResult,
} from "../rules/methodology";

export class StateEngine {
  private state: PhaseState | null = null;
  private statePath: string;
  private specsPath: string;

  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.statePath = path.join(workspacePath, ".iacdm", "state.json");
    this.specsPath = path.join(workspacePath, "specs");
  }

  getWorkspace(): string {
    return this.workspacePath;
  }

  // --- Lifecycle ---

  load(): PhaseState | null {
    try {
      if (fs.existsSync(this.statePath)) {
        const raw = fs.readFileSync(this.statePath, "utf-8");
        this.state = JSON.parse(raw) as PhaseState;
        return this.state;
      }
    } catch (err) {
      // state.json corrompido — retorna null
    }
    return null;
  }

  private save(): void {
    if (!this.state) return;
    this.state.updatedAt = new Date().toISOString();
    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), "utf-8");
  }

  // --- Projeto ---

  initProject(name: string, description: string): PhaseState {
    this.state = createDefaultState(name, description);
    this.save();
    return this.state;
  }

  // --- Gateway Guard ---

  touchPhaseStateCheck(): void {
    if (!this.state) return;
    this.state.lastPhaseStateCheck = new Date().toISOString();
    this.save();
  }

  isContextStale(thresholdMinutes = 30): boolean {
    if (!this.state) return true;
    if (!this.state.lastPhaseStateCheck) return true;
    const last = new Date(this.state.lastPhaseStateCheck).getTime();
    return (Date.now() - last) > thresholdMinutes * 60 * 1000;
  }

  // --- Consulta ---

  getPhaseState(): PhaseState | null {
    if (!this.state) this.load();
    return this.state;
  }

  getDecisions(phase?: number): Decision[] {
    if (!this.state) return [];
    if (phase !== undefined) {
      return this.state.decisions.filter((d) => d.phase === phase);
    }
    return this.state.decisions;
  }

  getExitCriteriaState(phase: number): ExitCriterionState[] {
    if (!this.state) return [];
    return this.state.exitCriteria.filter((c) => c.phase === phase);
  }

  getExitCriteriaWithDefs(phase: number): Array<{ criterion: string; description: string; met: boolean; details?: string }> {
    const defs = getExitCriteria(phase);
    const states = this.getExitCriteriaState(phase);
    return defs.map((def) => {
      const state = states.find((s) => s.criterion === def.criterion);
      return {
        criterion: def.criterion,
        description: def.description,
        met: state?.met ?? false,
        details: state?.details,
      };
    });
  }

  // --- Transições ---

  advancePhase(targetPhase: number): Result<void, TransitionError> {
    if (!this.state) {
      return { ok: false, error: { message: "Projeto não inicializado.", missingCriteria: [] } };
    }

    const from = this.state.currentPhase;
    const exitCriteriaMet = new Map<string, boolean>();
    for (const c of this.state.exitCriteria) {
      if (c.phase === from) {
        exitCriteriaMet.set(c.criterion, c.met);
      }
    }

    const validation = validatePhaseTransition(from, targetPhase, this.state, exitCriteriaMet);

    // Verificar specs/ (alerta, não bloqueia)
    const specsWarnings: string[] = [];
    if (targetPhase >= 1) {
      const specsStatus = this.checkSpecsStatus();
      const expectedDirs = this.getExpectedSpecsDirs(from);
      for (const dir of expectedDirs) {
        if (specsStatus[dir] && !specsStatus[dir].populated) {
          specsWarnings.push(`specs/${dir}/ está vazio (esperado antes de Phase ${targetPhase})`);
        }
      }
    }

    if (!validation.valid) {
      return {
        ok: false,
        error: {
          message: `Não é possível avançar de Phase ${from} para Phase ${targetPhase}.`,
          missingCriteria: validation.missingCriteria,
          specsWarnings,
        },
      };
    }

    // Transição válida
    this.state.history.push({
      from,
      to: targetPhase,
      timestamp: new Date().toISOString(),
      criteriaMet: Array.from(exitCriteriaMet.entries())
        .filter(([, met]) => met)
        .map(([criterion]) => criterion),
    });

    this.state.currentPhase = targetPhase;
    this.state.currentIteration = 1;
    this.state.loopCounter = { pattern: "", count: 0, firstSeen: "", lastSeen: "" };
    this.save();

    // Retorna OK com warnings de specs se houver
    return { ok: true, value: undefined };
  }

  startIteration(phase: number): Result<IterationInfo, string> {
    if (!this.state) {
      return { ok: false, error: "Projeto não inicializado." };
    }
    if (this.state.currentPhase !== phase) {
      return { ok: false, error: `Fase atual é ${this.state.currentPhase}, não ${phase}.` };
    }

    this.state.currentIteration += 1;
    this.save();

    return {
      ok: true,
      value: {
        phase,
        iterationNumber: this.state.currentIteration,
      },
    };
  }

  // --- Registro ---

  recordDecision(phase: number, category: string, content: string): Decision {
    if (!this.state) throw new Error("Projeto não inicializado.");

    const decision: Decision = {
      id: randomUUID(),
      phase,
      category,
      content,
      timestamp: new Date().toISOString(),
    };

    this.state.decisions.push(decision);
    this.save();
    return decision;
  }

  updateProjectSpec(spec: Partial<{ stack: string[]; outOfScope: string[]; patterns: string[]; constraints: string[] }>): void {
    if (!this.state) throw new Error("Projeto não inicializado.");
    if (!this.state.projectSpec) {
      this.state.projectSpec = { stack: [], outOfScope: [], patterns: [], constraints: [] };
    }
    const ps = this.state.projectSpec;
    if (spec.stack) ps.stack = dedupe([...ps.stack, ...spec.stack]);
    if (spec.outOfScope) ps.outOfScope = dedupe([...ps.outOfScope, ...spec.outOfScope]);
    if (spec.patterns) ps.patterns = dedupe([...ps.patterns, ...spec.patterns]);
    if (spec.constraints) ps.constraints = dedupe([...ps.constraints, ...spec.constraints]);
    this.save();
  }

  getProjectSpec(): { stack: string[]; outOfScope: string[]; patterns: string[]; constraints: string[] } {
    if (!this.state) throw new Error("Projeto não inicializado.");
    return this.state.projectSpec ?? { stack: [], outOfScope: [], patterns: [], constraints: [] };
  }

  updateScore(score: number, breakdown: ScoreBreakdown): void {
    if (!this.state) throw new Error("Projeto não inicializado.");
    this.state.phase0Score = score;
    this.state.phase0Breakdown = breakdown;
    this.save();
  }

  markExitCriterion(phase: number, criterion: string, met: boolean, details?: string): void {
    if (!this.state) throw new Error("Projeto não inicializado.");

    const existing = this.state.exitCriteria.find(
      (c) => c.phase === phase && c.criterion === criterion
    );

    if (existing) {
      existing.met = met;
      existing.details = details;
    } else {
      this.state.exitCriteria.push({ phase, criterion, met, details });
    }

    this.save();
  }

  // --- Salvaguardas ---

  checkSafeguard(id: string): SafeguardResult {
    if (!this.state) {
      return { id, status: "ok", details: "Projeto não inicializado." };
    }
    const result = ruleSafeguard(id, this.state);

    // Atualizar estado interno da salvaguarda
    const sg = this.state.safeguards.find((s) => s.id === id);
    if (sg) {
      sg.status = result.status;
      sg.details = result.details;
      sg.lastChecked = new Date().toISOString();
      this.save();
    }

    return result;
  }

  checkAllSafeguards(): SafeguardResult[] {
    if (!this.state) return [];
    const results = ruleAllSafeguards(this.state);

    for (const result of results) {
      const sg = this.state.safeguards.find((s) => s.id === result.id);
      if (sg) {
        sg.status = result.status;
        sg.details = result.details;
        sg.lastChecked = new Date().toISOString();
      }
    }
    this.save();

    return results;
  }

  // --- Specs ---

  checkSpecsStatus(): SpecsStatus {
    const dirs = [
      "references", "domain", "technical", "examples",
      "design", "models", "datasets", "validation", "competitors",
    ];

    const status: SpecsStatus = {};
    for (const dir of dirs) {
      const dirPath = path.join(this.specsPath, dir);
      try {
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath).filter((f) => f !== "README.md");
          status[dir] = { populated: files.length > 0, fileCount: files.length };
        } else {
          status[dir] = { populated: false, fileCount: 0 };
        }
      } catch {
        status[dir] = { populated: false, fileCount: 0 };
      }
    }
    return status;
  }

  // --- Loop Counter ---

  incrementLoopCounter(pattern: string): { count: number; blocked: boolean } {
    if (!this.state) return { count: 0, blocked: false };

    const normalized = this.normalizeCommandPattern(pattern);
    if (!this.state.loopCounter) {
      this.state.loopCounter = { pattern: "", count: 0, firstSeen: "", lastSeen: "" };
    }
    const counter = this.state.loopCounter;

    if (counter.pattern === normalized && counter.count > 0) {
      counter.count += 1;
      counter.lastSeen = new Date().toISOString();
    } else {
      this.state.loopCounter = {
        pattern: normalized,
        count: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };
    }

    this.save();
    return { count: this.state.loopCounter.count, blocked: this.state.loopCounter.count > 3 };
  }

  resetLoopCounter(): void {
    if (!this.state) return;
    this.state.loopCounter = { pattern: "", count: 0, firstSeen: "", lastSeen: "" };
    this.save();
  }

  getLoopCounter(): { pattern: string; count: number } {
    if (!this.state || !this.state.loopCounter) return { pattern: "", count: 0 };
    return { pattern: this.state.loopCounter.pattern, count: this.state.loopCounter.count };
  }

  private normalizeCommandPattern(cmd: string): string {
    // Normaliza comandos de teste para detectar repetições
    // "npm test", "npm run test", "npx jest" → "test"
    // "pytest src/test_foo.py", "python -m pytest" → "pytest"
    const trimmed = cmd.trim().toLowerCase();
    if (/\b(npm\s+test|npx\s+jest|jest|vitest|mocha)\b/.test(trimmed)) return "test:js";
    if (/\b(pytest|python\s+-m\s+pytest|unittest)\b/.test(trimmed)) return "test:py";
    if (/\b(cargo\s+test)\b/.test(trimmed)) return "test:rust";
    if (/\b(go\s+test)\b/.test(trimmed)) return "test:go";
    if (/\bnpm\s+run\s+build\b/.test(trimmed)) return "build";
    if (/\btsc\b/.test(trimmed)) return "compile";
    // Fallback: primeiros 50 chars
    return trimmed.substring(0, 50);
  }

  // --- Helpers privados ---

  private getExpectedSpecsDirs(phase: number): string[] {
    switch (phase) {
      case 0: return ["references", "domain", "competitors"];
      case 1: return ["technical", "models", "examples"];
      case 5: return ["technical", "examples", "datasets"];
      case 6: return ["datasets", "validation"];
      default: return [];
    }
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
