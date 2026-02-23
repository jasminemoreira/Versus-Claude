// MCP Tools: consulta de estado

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";

export const getPhaseStateTool: Tool = {
  name: "get_phase_state",
  description:
    "DEVE ser chamada no início de cada interação. Retorna a fase atual, iteração, score, " +
    "decisões e salvaguardas da metodologia Convergência Iterativa. " +
    "Sem chamar esta ferramenta, você não sabe em que fase está nem o que fazer.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export const getDecisionsTool: Tool = {
  name: "get_decisions",
  description:
    "Consulta decisões tomadas em qualquer fase da metodologia. " +
    "Use para recuperar decisões anteriores antes de tomar novas decisões.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Número da fase (0-7). Se omitido, retorna todas as decisões.",
      },
    },
    required: [],
  },
};

export const getExitCriteriaTool: Tool = {
  name: "get_exit_criteria",
  description:
    "Retorna os exit criteria de uma fase com status (atendido/pendente). " +
    "Use para saber o que falta antes de tentar avançar de fase.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Número da fase (0-7).",
      },
    },
    required: ["phase"],
  },
};

export function handleGetPhaseState(engine: StateEngine): string {
  const state = engine.getPhaseState();
  if (!state) {
    return JSON.stringify({
      error: "Projeto não inicializado. Chame init_project primeiro.",
    });
  }
  // Marcar que o modelo carregou contexto (gateway guard)
  engine.touchPhaseStateCheck();

  // Incluir projectSpec e últimas decisões para que qualquer modelo tenha contexto completo
  const recentDecisions = state.decisions.slice(-10).map((d) => ({
    phase: d.phase,
    category: d.category,
    content: d.content,
  }));

  return JSON.stringify({
    projectName: state.projectName,
    projectDescription: state.projectDescription,
    projectSpec: state.projectSpec ?? { stack: [], outOfScope: [], patterns: [], constraints: [] },
    currentPhase: state.currentPhase,
    currentIteration: state.currentIteration,
    phase0Score: state.phase0Score,
    decisionsCount: state.decisions.length,
    recentDecisions,
    safeguards: state.safeguards.map((s) => ({ id: s.id, status: s.status })),
    updatedAt: state.updatedAt,
  });
}

export function handleGetDecisions(engine: StateEngine, args: { phase?: number }): string {
  const decisions = engine.getDecisions(args.phase);
  return JSON.stringify({ count: decisions.length, decisions });
}

export function handleGetExitCriteria(engine: StateEngine, args: { phase: number }): string {
  const criteria = engine.getExitCriteriaWithDefs(args.phase);
  const met = criteria.filter((c) => c.met).length;
  const total = criteria.length;
  return JSON.stringify({ phase: args.phase, met, total, criteria });
}

export const updateProjectSpecTool: Tool = {
  name: "update_project_spec",
  description:
    "Atualiza o contexto técnico estruturado do projeto (stack, fora-de-escopo, padrões, restrições). " +
    "Use para registrar decisões técnicas de forma estruturada. " +
    "Itens são adicionados (merge), nunca sobrescritos. Duplicatas são ignoradas.",
  inputSchema: {
    type: "object" as const,
    properties: {
      stack: {
        type: "array",
        items: { type: "string" },
        description: "Tecnologias aprovadas para o projeto (ex: ['TypeScript', 'Node 18+', 'MCP SDK']).",
      },
      outOfScope: {
        type: "array",
        items: { type: "string" },
        description: "Itens explicitamente excluídos do escopo (ex: ['Modelos locais', 'UI web']).",
      },
      patterns: {
        type: "array",
        items: { type: "string" },
        description: "Padrões arquiteturais a seguir (ex: ['MCP server standalone', 'state.json compartilhado']).",
      },
      constraints: {
        type: "array",
        items: { type: "string" },
        description: "Restrições rígidas do projeto (ex: ['Copilot-only', 'Sem dependências externas']).",
      },
    },
    required: [],
  },
};

export function handleUpdateProjectSpec(
  engine: StateEngine,
  args: { stack?: string[]; outOfScope?: string[]; patterns?: string[]; constraints?: string[] }
): string {
  engine.updateProjectSpec(args);
  const spec = engine.getProjectSpec();
  return JSON.stringify({
    success: true,
    projectSpec: spec,
    message: "Project spec atualizado. Este contexto é retornado em toda chamada a get_phase_state.",
  });
}
