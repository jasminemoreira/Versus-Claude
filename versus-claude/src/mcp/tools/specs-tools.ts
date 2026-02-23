// MCP Tools: verificação do diretório specs/

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";

export const checkSpecsStatusTool: Tool = {
  name: "check_specs_status",
  description:
    "Verifica quais subdiretórios de specs/ estão populados. " +
    "Retorna contagem de arquivos por diretório (excluindo README.md). " +
    "Use antes de implementar para garantir que referências técnicas existem.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export function handleCheckSpecsStatus(engine: StateEngine): string {
  const status = engine.checkSpecsStatus();
  const populated = Object.entries(status).filter(([, s]) => s.populated).length;
  const total = Object.keys(status).length;
  return JSON.stringify({
    populated,
    total,
    directories: status,
  });
}
