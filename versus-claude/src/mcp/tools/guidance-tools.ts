// MCP Tools: instruções comportamentais detalhadas por fase

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";
import { getFullGuidance } from "../../rules/guidance";

export const getPhaseGuidanceTool: Tool = {
  name: "get_phase_guidance",
  description:
    "Retorna instruções COMPLETAS da fase atual ou especificada: regras globais, " +
    "perguntas obrigatórias, templates, protocolos, checklists, e critérios. " +
    "Chame ao entrar em cada nova fase para saber exatamente o que fazer. " +
    "Complementa get_phase_state que retorna apenas o estado.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Número da fase (0-7). Se omitido, usa a fase atual.",
      },
    },
    required: [],
  },
};

export function handleGetPhaseGuidance(engine: StateEngine, args: { phase?: number }): string {
  const state = engine.getPhaseState();
  if (!state) {
    return JSON.stringify({
      error: "Projeto não inicializado. Chame init_project primeiro.",
    });
  }

  const phase = args.phase ?? state.currentPhase;

  if (phase < 0 || phase > 7) {
    return JSON.stringify({ error: `Fase inválida: ${phase}. Use 0-7.` });
  }

  const guidance = getFullGuidance(phase);

  return JSON.stringify({
    phase,
    currentPhase: state.currentPhase,
    guidance,
  });
}
