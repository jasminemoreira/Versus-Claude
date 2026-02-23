// Tipos centrais do IACDM Claude

export interface PhaseState {
  projectName: string;
  projectDescription: string;
  projectSpec: ProjectSpec;      // contexto técnico estruturado
  currentPhase: number;          // 0-7
  currentIteration: number;      // dentro da fase
  phase0Score: number | null;    // 0-100
  phase0Breakdown: ScoreBreakdown | null;
  decisions: Decision[];
  exitCriteria: ExitCriterionState[];
  safeguards: SafeguardState[];
  loopCounter: LoopCounter;
  lastPhaseStateCheck?: string;  // ISO timestamp — gateway guard para modelos menores
  createdAt: string;             // ISO timestamp
  updatedAt: string;
  history: PhaseTransition[];    // log de transições
}

/** Contexto técnico estruturado — sobrevive a trocas de modelo */
export interface ProjectSpec {
  stack: string[];               // tecnologias aprovadas (ex: "TypeScript", "Node 18+")
  outOfScope: string[];          // explicitamente excluído (ex: "Modelos locais")
  patterns: string[];            // padrões arquiteturais (ex: "MCP server standalone")
  constraints: string[];         // restrições rígidas (ex: "Copilot-only, sem Claude Code artifacts")
}

export interface LoopCounter {
  pattern: string;             // padrão do comando detectado
  count: number;               // quantas vezes repetiu
  firstSeen: string;           // ISO timestamp
  lastSeen: string;
}

export interface ScoreBreakdown {
  clarezaProblema: number;       // peso 10
  casosDeUso: number;            // peso 15
  vocabulario: number;           // peso 10
  ambiguidades: number;          // peso 15
  foraDeEscopo: number;          // peso 10
  criteriosSucesso: number;      // peso 10
  premissas: number;             // peso 10
  documentacao: number;          // peso 5
  usuarioConfirmou: number;      // peso 10
  iaConfiante: number;           // peso 5
}

export interface Decision {
  id: string;
  phase: number;
  category: string;
  content: string;
  timestamp: string;
}

export interface ExitCriterionState {
  phase: number;
  criterion: string;
  met: boolean;
  details?: string;
}

export interface SafeguardState {
  id: string;                  // "S0" a "S7"
  status: "ok" | "warning" | "violated";
  details?: string;
  lastChecked?: string;
}

export interface SpecsStatus {
  [directory: string]: {
    populated: boolean;
    fileCount: number;
  };
}

export interface PhaseTransition {
  from: number;
  to: number;
  timestamp: string;
  criteriaMet: string[];
}

export interface TransitionError {
  message: string;
  missingCriteria: string[];
  specsWarnings?: string[];
}

export interface IterationInfo {
  phase: number;
  iterationNumber: number;
  previousSummary?: string;
}

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function createDefaultState(name: string, description: string): PhaseState {
  return {
    projectName: name,
    projectDescription: description,
    projectSpec: { stack: [], outOfScope: [], patterns: [], constraints: [] },
    currentPhase: 0,
    currentIteration: 1,
    phase0Score: null,
    phase0Breakdown: null,
    decisions: [],
    exitCriteria: [],
    safeguards: [
      { id: "S0", status: "ok" },
      { id: "S1", status: "ok" },
      { id: "S2", status: "ok" },
      { id: "S3", status: "ok" },
      { id: "S4", status: "ok" },
      { id: "S5", status: "ok" },
      { id: "S6", status: "ok" },
      { id: "S7", status: "ok" },
    ],
    loopCounter: { pattern: "", count: 0, firstSeen: "", lastSeen: "" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
  };
}
