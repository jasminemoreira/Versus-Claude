// Definições de salvaguardas S0-S7 da Convergência Iterativa v3.6

import { PhaseState } from "../state/types";

export interface SafeguardDef {
  id: string;
  name: string;
  description: string;
  applicablePhases: number[];  // fases onde se aplica
}

export interface SafeguardResult {
  id: string;
  status: "ok" | "warning" | "violated";
  details: string;
}

export const SAFEGUARD_DEFINITIONS: SafeguardDef[] = [
  {
    id: "S0",
    name: "Convergência no Problema",
    description: "Nunca avançar para Phase 1 sem score >= 90/100. Problema errado custa 100x.",
    applicablePhases: [0],
  },
  {
    id: "S1",
    name: "Anti-Bug",
    description: "Simplificação nunca introduz bugs. Funcionalidades mantidas após cada Phase 3.",
    applicablePhases: [3],
  },
  {
    id: "S2",
    name: "Critério de Parada",
    description: "Critério de parada é do USUÁRIO, não da IA.",
    applicablePhases: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  {
    id: "S3",
    name: "Custo de Convergência Prematura",
    description: "Parar cedo = -400% a -600% ROI. Preferir iterar quando em dúvida.",
    applicablePhases: [0, 2, 3],
  },
  {
    id: "S4",
    name: "Verificação Explícita (AV-humano obrigatório)",
    description:
      "O AV-humano é insubstituível em cada gate. " +
      "Testes automáticos verificam propriedades formalizáveis. " +
      "Adequação semântica, usabilidade e correção de domínio REQUEREM julgamento humano. " +
      "P0: humano valida síntese. P2: humano arbitrou trade-offs. P4: humano confirma convergência. " +
      "P6: NUNCA assumir que testes passaram — executar e verificar + teste manual exploratório obrigatório.",
    applicablePhases: [0, 2, 4, 6],
  },
  {
    id: "S5",
    name: "Preservação de Escopo",
    description:
      "Phase 2-3 opera DENTRO do escopo de Phase 0. Sub-regras: " +
      "5.1 Escopo é do usuário — Phase 2-3 sugere, nunca decide mudança. " +
      "5.2 Se não foi pedido, não adicione. Se útil, documente como sugestão v2.0. " +
      "5.3 Detector: 'Se o usuário comparar V(N) com Phase 0, diria não é o que pedi?' Se sim → violou escopo.",
    applicablePhases: [2, 3],
  },
  {
    id: "S6",
    name: "Não Reimplemente o que Já Existe",
    description:
      "Tier 1: lib madura → USAR. Tier 2: algoritmo com ref → PORTAR literalmente (mesma estrutura, mesmos nomes, testar contra mesmos inputs). " +
      "Tier 3: nenhum anterior. Se domínio complexo → PoC (~2h max). " +
      "STOP imediato se: criando heurísticas p/ problema com solução conhecida, debugando lógica complexa do zero, " +
      "trial-and-error em algo determinístico, ou >2 iterações no mesmo módulo. " +
      "Checklist por módulo: lib madura? → se não, por quê? → algoritmo documentado? → ref portável? → decisão.",
    applicablePhases: [5, 6],
  },
  {
    id: "S7",
    name: "Disciplina de Sequência",
    description: "Após cada arquivo: marcar completed, identificar próximo, anunciar progresso, iniciar imediatamente.",
    applicablePhases: [5],
  },
];

export function getSafeguardDefinition(id: string): SafeguardDef | undefined {
  return SAFEGUARD_DEFINITIONS.find((s) => s.id === id);
}

export function getSafeguardsForPhase(phase: number): SafeguardDef[] {
  return SAFEGUARD_DEFINITIONS.filter((s) => s.applicablePhases.includes(phase));
}

export function validateSafeguard(id: string, state: PhaseState): SafeguardResult {
  const def = getSafeguardDefinition(id);
  if (!def) {
    return { id, status: "ok", details: `Salvaguarda ${id} não encontrada.` };
  }

  switch (id) {
    case "S0":
      return validateS0(state);
    case "S1":
      return validateS1(state);
    case "S5":
      return validateS5(state);
    case "S6":
      return validateS6(state);
    case "S7":
      return validateS7(state);
    default:
      // S2, S3, S4 são comportamentais — não validáveis automaticamente
      return {
        id,
        status: "ok",
        details: `${def.name}: verificação comportamental — requer atenção do agente. ${def.description}`,
      };
  }
}

function validateS0(state: PhaseState): SafeguardResult {
  if (state.currentPhase === 0) {
    return { id: "S0", status: "ok", details: "Ainda na Phase 0. Score atual: " + (state.phase0Score ?? "não avaliado") };
  }
  if (state.phase0Score === null || state.phase0Score < 90) {
    return {
      id: "S0",
      status: "violated",
      details: `Phase 0 score ${state.phase0Score ?? "null"} < 90. Não deveria ter avançado.`,
    };
  }
  return { id: "S0", status: "ok", details: `Phase 0 score ${state.phase0Score}/100. OK.` };
}

function validateS1(state: PhaseState): SafeguardResult {
  if (state.currentPhase !== 3) {
    return { id: "S1", status: "ok", details: "Não está na Phase 3." };
  }
  return {
    id: "S1",
    status: "warning",
    details: "Phase 3 ativa: verificar que simplificação não introduziu bugs. Funcionalidades devem ser mantidas.",
  };
}

function validateS5(state: PhaseState): SafeguardResult {
  if (state.currentPhase !== 2 && state.currentPhase !== 3) {
    return { id: "S5", status: "ok", details: "Não está em Phase 2-3." };
  }
  return {
    id: "S5",
    status: "warning",
    details: "Phase 2-3 ativa: escopo de Phase 0 deve ser preservado. Não cortar requisitos, não adicionar features.",
  };
}

function validateS6(state: PhaseState): SafeguardResult {
  if (state.currentPhase < 5) {
    return { id: "S6", status: "ok", details: "Não está em implementação." };
  }
  return {
    id: "S6",
    status: "warning",
    details: "Implementação ativa: verificar Tier 1/2/3 por módulo. STOP se criando heurísticas para problemas com solução conhecida.",
  };
}

function validateS7(state: PhaseState): SafeguardResult {
  if (state.currentPhase !== 5) {
    return { id: "S7", status: "ok", details: "Não está na Phase 5." };
  }
  return {
    id: "S7",
    status: "warning",
    details: "Phase 5 ativa: após cada arquivo, marcar completed e anunciar progresso. Não iniciar discussões tangenciais.",
  };
}
