// MCP Tools: transições de fase

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";

export const advancePhaseTool: Tool = {
  name: "advance_phase",
  description:
    "Solicita transição para a próxima fase. O servidor valida todos os exit criteria " +
    "e salvaguardas antes de permitir. Se critérios não estão atendidos, retorna erro " +
    "com lista detalhada do que falta. Use get_exit_criteria antes para verificar pendências.",
  inputSchema: {
    type: "object" as const,
    properties: {
      target_phase: {
        type: "number",
        description: "Fase destino (0-7). Transições válidas: sequencial ou loop 2↔3.",
      },
    },
    required: ["target_phase"],
  },
};

export const startIterationTool: Tool = {
  name: "start_iteration",
  description:
    "Inicia nova iteração dentro de uma fase cíclica (Phase 0, 2 ou 3). " +
    "Incrementa o contador de iteração e retorna informações da iteração anterior.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Fase atual (0, 2 ou 3).",
      },
    },
    required: ["phase"],
  },
};

export function handleAdvancePhase(engine: StateEngine, args: { target_phase: number }): string {
  const result = engine.advancePhase(args.target_phase);
  if (result.ok) {
    const newState = engine.getPhaseState();
    return JSON.stringify({
      success: true,
      message: `Avançou para Phase ${args.target_phase}.`,
      currentPhase: newState?.currentPhase,
      currentIteration: newState?.currentIteration,
    });
  } else {
    return JSON.stringify({
      success: false,
      error: result.error.message,
      missingCriteria: result.error.missingCriteria,
      specsWarnings: result.error.specsWarnings,
    });
  }
}

export function handleStartIteration(engine: StateEngine, args: { phase: number }): string {
  const result = engine.startIteration(args.phase);
  if (result.ok) {
    return JSON.stringify({
      success: true,
      phase: result.value.phase,
      iterationNumber: result.value.iterationNumber,
    });
  } else {
    return JSON.stringify({ success: false, error: result.error });
  }
}
