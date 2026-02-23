// Definições de fases e exit criteria da Convergência Iterativa v3.6

export interface PhaseDefinition {
  number: number;
  name: string;
  description: string;
  iterative: boolean;  // se permite múltiplas iterações
}

export interface ExitCriterionDef {
  phase: number;
  criterion: string;
  description: string;
  required: boolean;  // obrigatório para avançar
}

export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    number: 0,
    name: "Problem Discovery",
    description: "Loop iterativo de descoberta do problema. Score >= 90/100 para avançar.",
    iterative: true,
  },
  {
    number: 1,
    name: "Architecture",
    description: "Definição de módulos, interfaces, padrões e princípios.",
    iterative: false,
  },
  {
    number: 2,
    name: "Adversarial Critique",
    description: "Ataque à arquitetura com lentes especializadas. Gera matriz de cobertura.",
    iterative: true,
  },
  {
    number: 3,
    name: "Simplification",
    description: "Simplificar arquitetura. Endereçar críticos de Phase 2.",
    iterative: true,
  },
  {
    number: 4,
    name: "Convergence Gate",
    description: "Validar convergência: exit criteria de Phases 2-3 + salvaguardas S1-S5.",
    iterative: false,
  },
  {
    number: 5,
    name: "Code Implementation",
    description: "Implementar arquitetura final. Um arquivo por resposta.",
    iterative: false,
  },
  {
    number: 6,
    name: "Tests",
    description: "100% testes passando + teste manual exploratório.",
    iterative: false,
  },
  {
    number: 7,
    name: "Post-Review",
    description: "Lições aprendidas, atualizar specs/, meta-iteração da metodologia.",
    iterative: false,
  },
];

export const EXIT_CRITERIA: ExitCriterionDef[] = [
  // Phase 0
  { phase: 0, criterion: "score_90", description: "Score >= 90/100", required: true },
  { phase: 0, criterion: "usuario_confirmou", description: "Usuário confirmou síntese", required: true },
  { phase: 0, criterion: "ambiguidades_zero", description: "Ambiguidades = 0 (ou aceitas)", required: true },
  { phase: 0, criterion: "casos_uso_completos", description: "Casos de uso completos", required: true },
  { phase: 0, criterion: "vocabulario_acordado", description: "Vocabulário acordado", required: true },
  { phase: 0, criterion: "fora_escopo_claro", description: "Fora de escopo claro", required: true },
  { phase: 0, criterion: "viabilidade_tech", description: "Viabilidade tech da plataforma-alvo VERIFICADA: capacidades fundamentais confirmadas (não assumidas). Em projetos de porte: a plataforma destino suporta os mecanismos essenciais?", required: true },
  { phase: 0, criterion: "viabilidade_implementacao", description: "Componentes avaliados Tier 1/2/3. Se Tier 3 complexo → PoC antes de Phase 1", required: true },
  { phase: 0, criterion: "pesquisa_tecnica_cientifica", description: "Se domínio especializado: pesquisa técnica E científica completa (F.2) — papers, algoritmos, parâmetros com fonte", required: false },
  { phase: 0, criterion: "specs_populado", description: "specs/ populado com referências técnicas e científicas", required: true },

  // Phase 1
  { phase: 1, criterion: "padroes_definidos", description: "Padrões/princípios definidos e confirmados", required: true },
  { phase: 1, criterion: "modulos_responsabilidade", description: "Cada módulo com responsabilidade clara", required: true },
  { phase: 1, criterion: "interfaces_definidas", description: "Interfaces definidas (assinaturas, tipos I/O)", required: true },
  { phase: 1, criterion: "dependencias_explicitas", description: "Dependências entre módulos explícitas", required: true },
  { phase: 1, criterion: "premissas_listadas", description: "Premissas listadas", required: true },
  { phase: 1, criterion: "doc_arquitetura", description: "Doc de arquitetura cabe em ~2k tokens", required: true },
  { phase: 1, criterion: "tech_100_escopo", description: "Tech suporta 100% do escopo, premissas tech verificadas", required: true },
  { phase: 1, criterion: "modulos_aderentes_padroes", description: "Módulos aderentes aos padrões escolhidos", required: true },

  // Phase 2
  { phase: 2, criterion: "lentes_aplicadas", description: "Todas as lentes aplicadas a cada módulo", required: true },
  { phase: 2, criterion: "matriz_cobertura", description: "Matriz de cobertura módulos x lentes", required: true },
  { phase: 2, criterion: "criticos_identificados", description: "Críticos identificados e classificados", required: true },
  { phase: 2, criterion: "concentracao_analisada", description: "Análise de concentração realizada (por módulo e por lente)", required: true },

  // Phase 3
  { phase: 3, criterion: "criticos_endereçados", description: "Todos críticos endereçados", required: true },
  { phase: 3, criterion: "importantes_decididos", description: "Todos importantes com decisão", required: true },
  { phase: 3, criterion: "escopo_preservado", description: "Escopo Phase 0 preservado (anti-scope-creep)", required: true },
  { phase: 3, criterion: "arquitetura_simplificada", description: "Arquitetura mais simples que anterior", required: true },

  // Phase 4
  { phase: 4, criterion: "exit_criteria_23", description: "Exit criteria Phases 2-3 verificados", required: true },
  { phase: 4, criterion: "salvaguardas_s1_s5", description: "Salvaguardas S1-S5 atingidas", required: true },

  // Phase 5
  { phase: 5, criterion: "todos_modulos", description: "Todos os módulos implementados", required: true },
  { phase: 5, criterion: "specs_consultado", description: "specs/ consultado antes de cada módulo", required: true },
  { phase: 5, criterion: "s6_aplicado", description: "S6 aplicado (Tier 1/2/3 por módulo)", required: true },

  // Phase 6
  { phase: 6, criterion: "testes_passando", description: "100% testes passando", required: true },
  { phase: 6, criterion: "teste_manual", description: "Teste manual exploratório realizado", required: true },
  { phase: 6, criterion: "edge_cases", description: "Edge cases testados", required: true },

  // Phase 7
  { phase: 7, criterion: "specs_atualizado", description: "specs/ atualizado com resultados", required: true },
  { phase: 7, criterion: "licoes_documentadas", description: "Lições aprendidas documentadas", required: true },
  { phase: 7, criterion: "feedback_humano", description: "Feedback humano coletado", required: true },
];

export function getPhaseDefinition(phase: number): PhaseDefinition | undefined {
  return PHASE_DEFINITIONS.find((p) => p.number === phase);
}

export function getExitCriteriaForPhase(phase: number): ExitCriterionDef[] {
  return EXIT_CRITERIA.filter((c) => c.phase === phase);
}

// Transições válidas: só avança sequencialmente, exceto 2↔3 (loop)
export function isValidTransition(from: number, to: number): boolean {
  if (to === from + 1) return true;      // avançar 1 fase
  if (from === 3 && to === 2) return true; // loop Phase 2-3
  if (from === 2 && to === 3) return true; // loop Phase 2-3
  return false;
}
