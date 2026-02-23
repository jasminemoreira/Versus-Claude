// MCP Tools: verificação de salvaguardas S0-S7

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";

export const checkSafeguardTool: Tool = {
  name: "check_safeguard",
  description:
    "Verifica uma salvaguarda específica (S0-S7). Retorna status e recomendações. " +
    "Salvaguardas protegem contra erros comuns: S0=convergência, S1=anti-bug, " +
    "S2=parada do usuário, S3=convergência prematura, S4=verificação explícita, " +
    "S5=preservação de escopo, S6=não reimplementar, S7=disciplina de sequência.",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: {
        type: "string",
        description: "ID da salvaguarda: 'S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6' ou 'S7'.",
      },
    },
    required: ["id"],
  },
};

export const checkAllSafeguardsTool: Tool = {
  name: "check_all_safeguards",
  description:
    "Verifica TODAS as salvaguardas aplicáveis à fase atual. " +
    "Retorna panorama completo de status. Use antes de transições de fase.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export function handleCheckSafeguard(engine: StateEngine, args: { id: string }): string {
  const result = engine.checkSafeguard(args.id);
  return JSON.stringify(result);
}

export function handleCheckAllSafeguards(engine: StateEngine): string {
  const results = engine.checkAllSafeguards();
  const violated = results.filter((r) => r.status === "violated").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  return JSON.stringify({
    total: results.length,
    violated,
    warnings,
    ok: results.length - violated - warnings,
    safeguards: results,
  });
}
