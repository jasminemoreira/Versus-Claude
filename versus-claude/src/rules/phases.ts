// Phase definitions and exit criteria for Iterative Convergence v3.6

export interface PhaseDefinition {
  number: number;
  name: string;
  description: string;
  iterative: boolean;  // whether it allows multiple iterations
}

export interface ExitCriterionDef {
  phase: number;
  criterion: string;
  description: string;
  required: boolean;  // required to advance
}

export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    number: 0,
    name: "Problem Discovery",
    description: "Iterative problem discovery loop. Score >= 90/100 to advance.",
    iterative: true,
  },
  {
    number: 1,
    name: "Architecture",
    description: "Module, interface, pattern, and principle definitions.",
    iterative: false,
  },
  {
    number: 2,
    name: "Adversarial Critique",
    description: "Attack architecture with specialized lenses. Generates coverage matrix.",
    iterative: true,
  },
  {
    number: 3,
    name: "Simplification",
    description: "Simplify architecture. Address Phase 2 critical findings.",
    iterative: true,
  },
  {
    number: 4,
    name: "Convergence Gate",
    description: "Validate convergence: exit criteria from Phases 2-3 + safeguards S1-S5.",
    iterative: false,
  },
  {
    number: 5,
    name: "Code Implementation",
    description: "Implement final architecture. One file per response.",
    iterative: false,
  },
  {
    number: 6,
    name: "Tests",
    description: "100% tests passing + manual exploratory testing.",
    iterative: false,
  },
  {
    number: 7,
    name: "Post-Review",
    description: "Lessons learned, update specs/, methodology meta-iteration.",
    iterative: false,
  },
];

export const EXIT_CRITERIA: ExitCriterionDef[] = [
  // Phase 0
  { phase: 0, criterion: "score_90", description: "Score >= 90/100", required: true },
  { phase: 0, criterion: "usuario_confirmou", description: "User confirmed synthesis", required: true },
  { phase: 0, criterion: "ambiguidades_zero", description: "Ambiguities = 0 (or accepted)", required: true },
  { phase: 0, criterion: "casos_uso_completos", description: "Use cases complete", required: true },
  { phase: 0, criterion: "vocabulario_acordado", description: "Vocabulary agreed upon", required: true },
  { phase: 0, criterion: "fora_escopo_claro", description: "Out of scope clear", required: true },
  { phase: 0, criterion: "viabilidade_tech", description: "Target platform tech feasibility VERIFIED: fundamental capabilities confirmed (not assumed). In porting projects: does the destination platform support essential mechanisms?", required: true },
  { phase: 0, criterion: "viabilidade_implementacao", description: "Components evaluated Tier 1/2/3. If complex Tier 3 → PoC before Phase 1", required: true },
  { phase: 0, criterion: "pesquisa_tecnica_cientifica", description: "If specialized domain: complete technical AND scientific research (F.2) — papers, algorithms, parameters with source", required: false },
  { phase: 0, criterion: "specs_populado", description: "specs/ populated with technical and scientific references", required: true },

  // Phase 1
  { phase: 1, criterion: "padroes_definidos", description: "Patterns/principles defined and confirmed", required: true },
  { phase: 1, criterion: "modulos_responsabilidade", description: "Each module with clear responsibility", required: true },
  { phase: 1, criterion: "interfaces_definidas", description: "Interfaces defined (signatures, I/O types)", required: true },
  { phase: 1, criterion: "dependencias_explicitas", description: "Dependencies between modules explicit", required: true },
  { phase: 1, criterion: "premissas_listadas", description: "Assumptions listed", required: true },
  { phase: 1, criterion: "doc_arquitetura", description: "Architecture doc fits in ~2k tokens", required: true },
  { phase: 1, criterion: "tech_100_escopo", description: "Tech supports 100% of scope, tech assumptions verified", required: true },
  { phase: 1, criterion: "modulos_aderentes_padroes", description: "Modules adherent to chosen patterns", required: true },

  // Phase 2
  { phase: 2, criterion: "lentes_aplicadas", description: "All lenses applied to each module", required: true },
  { phase: 2, criterion: "matriz_cobertura", description: "Coverage matrix modules x lenses", required: true },
  { phase: 2, criterion: "criticos_identificados", description: "Critical findings identified and classified", required: true },
  { phase: 2, criterion: "concentracao_analisada", description: "Concentration analysis performed (by module and by lens)", required: true },

  // Phase 3
  { phase: 3, criterion: "criticos_endereçados", description: "All critical findings addressed", required: true },
  { phase: 3, criterion: "importantes_decididos", description: "All important findings with decision", required: true },
  { phase: 3, criterion: "escopo_preservado", description: "Phase 0 scope preserved (anti-scope-creep)", required: true },
  { phase: 3, criterion: "arquitetura_simplificada", description: "Architecture simpler than previous", required: true },

  // Phase 4
  { phase: 4, criterion: "exit_criteria_23", description: "Exit criteria Phases 2-3 verified", required: true },
  { phase: 4, criterion: "salvaguardas_s1_s5", description: "Safeguards S1-S5 met", required: true },

  // Phase 5
  { phase: 5, criterion: "todos_modulos", description: "All modules implemented", required: true },
  { phase: 5, criterion: "specs_consultado", description: "specs/ consulted before each module", required: true },
  { phase: 5, criterion: "s6_aplicado", description: "S6 applied (Tier 1/2/3 per module)", required: true },

  // Phase 6
  { phase: 6, criterion: "testes_passando", description: "100% tests passing", required: true },
  { phase: 6, criterion: "teste_manual", description: "Manual exploratory testing performed", required: true },
  { phase: 6, criterion: "edge_cases", description: "Edge cases tested", required: true },

  // Phase 7
  { phase: 7, criterion: "specs_atualizado", description: "specs/ updated with results", required: true },
  { phase: 7, criterion: "licoes_documentadas", description: "Lessons learned documented", required: true },
  { phase: 7, criterion: "feedback_humano", description: "Human feedback collected", required: true },
];

export function getPhaseDefinition(phase: number): PhaseDefinition | undefined {
  return PHASE_DEFINITIONS.find((p) => p.number === phase);
}

export function getExitCriteriaForPhase(phase: number): ExitCriterionDef[] {
  return EXIT_CRITERIA.filter((c) => c.phase === phase);
}

// Valid transitions: sequential only, except 2↔3 (loop)
export function isValidTransition(from: number, to: number): boolean {
  if (to === from + 1) return true;      // advance 1 phase
  if (from === 3 && to === 2) return true; // Phase 2-3 loop
  if (from === 2 && to === 3) return true; // Phase 2-3 loop
  return false;
}
