// MCP Tools: registro de decisões, scores e exit criteria

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";
import { ScoreBreakdown } from "../../state/types";

export const recordDecisionTool: Tool = {
  name: "record_decision",
  description:
    "Registra uma decisão tomada durante qualquer fase. Decisões persistem entre sessões " +
    "e podem ser consultadas com get_decisions. Use para não perder decisões arquiteturais, " +
    "de escopo, de padrões, etc.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Fase em que a decisão foi tomada (0-7).",
      },
      category: {
        type: "string",
        description: "Categoria: 'architecture', 'pattern', 'constraint', 'scope', 'technology', 'requirement'.",
      },
      content: {
        type: "string",
        description: "Conteúdo da decisão em texto livre.",
      },
    },
    required: ["phase", "category", "content"],
  },
};

export const updateScoreTool: Tool = {
  name: "update_score",
  description:
    "Atualiza o score de convergência da Phase 0 (0-100) com breakdown por critério. " +
    "Score >= 90 é necessário para avançar para Phase 1.",
  inputSchema: {
    type: "object" as const,
    properties: {
      score: {
        type: "number",
        description: "Score total (0-100).",
      },
      breakdown: {
        type: "object",
        description: "Breakdown por critério.",
        properties: {
          clarezaProblema: { type: "number", description: "Peso 10" },
          casosDeUso: { type: "number", description: "Peso 15" },
          vocabulario: { type: "number", description: "Peso 10" },
          ambiguidades: { type: "number", description: "Peso 15" },
          foraDeEscopo: { type: "number", description: "Peso 10" },
          criteriosSucesso: { type: "number", description: "Peso 10" },
          premissas: { type: "number", description: "Peso 10" },
          documentacao: { type: "number", description: "Peso 5" },
          usuarioConfirmou: { type: "number", description: "Peso 10" },
          iaConfiante: { type: "number", description: "Peso 5" },
        },
      },
    },
    required: ["score", "breakdown"],
  },
};

export const markExitCriterionTool: Tool = {
  name: "mark_exit_criterion",
  description:
    "Marca um exit criterion como atendido ou pendente. Use get_exit_criteria para ver " +
    "os critérios disponíveis e seus IDs.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Fase (0-7).",
      },
      criterion: {
        type: "string",
        description: "ID do critério (ex: 'score_90', 'usuario_confirmou').",
      },
      met: {
        type: "boolean",
        description: "true se atendido, false se pendente.",
      },
      details: {
        type: "string",
        description: "Detalhes opcionais sobre como foi atendido.",
      },
    },
    required: ["phase", "criterion", "met"],
  },
};

export function handleRecordDecision(
  engine: StateEngine,
  args: { phase: number; category: string; content: string }
): string {
  try {
    const decision = engine.recordDecision(args.phase, args.category, args.content);
    return JSON.stringify({
      success: true,
      id: decision.id,
      timestamp: decision.timestamp,
    });
  } catch (err) {
    return JSON.stringify({ success: false, error: String(err) });
  }
}

export function handleUpdateScore(
  engine: StateEngine,
  args: { score: number; breakdown: ScoreBreakdown }
): string {
  try {
    engine.updateScore(args.score, args.breakdown);
    return JSON.stringify({
      success: true,
      score: args.score,
      meetsThreshold: args.score >= 90,
    });
  } catch (err) {
    return JSON.stringify({ success: false, error: String(err) });
  }
}

export function handleMarkExitCriterion(
  engine: StateEngine,
  args: { phase: number; criterion: string; met: boolean; details?: string }
): string {
  try {
    engine.markExitCriterion(args.phase, args.criterion, args.met, args.details);
    const criteria = engine.getExitCriteriaWithDefs(args.phase);
    const met = criteria.filter((c) => c.met).length;
    return JSON.stringify({
      success: true,
      phase: args.phase,
      criterion: args.criterion,
      met: args.met,
      totalMet: met,
      totalCriteria: criteria.length,
    });
  } catch (err) {
    return JSON.stringify({ success: false, error: String(err) });
  }
}
