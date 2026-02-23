#!/usr/bin/env node

// Camada 2: Bloqueio de ferramentas — PreToolUse (Edit|Write)
// Bloqueia edição de código em Phases 0-4.
// Exceções: specs/, .versus/, .claude/, package.json, tsconfig.json, README

import { StateEngine } from "../state/engine";

interface HookInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
    content?: string;
  };
}

function isAllowedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const allowed = [
    "/specs/",
    "/.versus/",
    "/.claude/",
    "/package.json",
    "/tsconfig",
    "/readme",
    "/.gitignore",
    "/.mcp.json",
    "/.env",
  ];
  return allowed.some((p) => normalized.includes(p));
}

function deny(reason: string): void {
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(output) + "\n");
  process.exit(0);
}

function allow(): void {
  process.exit(0);
}

function main() {
  const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const engine = new StateEngine(workspacePath);
  const state = engine.getPhaseState();

  // Sem projeto inicializado — permitir tudo
  if (!state) {
    allow();
    return;
  }

  // Phase 5+ permite edição
  if (state.currentPhase >= 5) {
    allow();
    return;
  }

  // Phase 0-4: ler input para verificar o arquivo
  let input = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    try {
      const hookInput: HookInput = JSON.parse(input);
      const filePath = hookInput.tool_input?.file_path || "";

      if (isAllowedPath(filePath)) {
        allow();
      } else {
        deny(
          `[Versus] Bloqueado: Phase ${state.currentPhase} não permite edição de código. ` +
          `Arquivo: ${filePath}. ` +
          `Complete Phases 0→4 antes de implementar. ` +
          `Use get_exit_criteria() para ver o que falta.`
        );
      }
    } catch {
      // Se não conseguir parsear input, permitir (fail-open)
      allow();
    }
  });
}

main();
