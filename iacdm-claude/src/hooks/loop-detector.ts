#!/usr/bin/env node

// Camada 3: Detecção de loop — PreToolUse (Bash)
// Detecta comandos repetitivos (especialmente testes) e bloqueia após 3 iterações.
// Salvaguarda S6: "STOP se gastando >2 iterações no mesmo módulo"

import { StateEngine } from "../state/engine";

interface HookInput {
  tool_name: string;
  tool_input: {
    command?: string;
  };
}

const TEST_PATTERNS = [
  /\bnpm\s+test\b/i,
  /\bnpx\s+(jest|vitest|mocha)\b/i,
  /\bpytest\b/i,
  /\bpython\s+-m\s+(pytest|unittest)\b/i,
  /\bcargo\s+test\b/i,
  /\bgo\s+test\b/i,
  /\bnpm\s+run\s+test\b/i,
  /\bnode\s+.*test/i,
];

function isTestCommand(cmd: string): boolean {
  return TEST_PATTERNS.some((p) => p.test(cmd));
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

  // Sem projeto ou fora de Phase 5-6 — sem detecção
  if (!state || state.currentPhase < 5) {
    allow();
    return;
  }

  let input = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    try {
      const hookInput: HookInput = JSON.parse(input);
      const command = hookInput.tool_input?.command || "";

      // Só monitorar comandos de teste/build
      if (!isTestCommand(command)) {
        allow();
        return;
      }

      const result = engine.incrementLoopCounter(command);

      if (result.blocked) {
        deny(
          `[Versus] Salvaguarda S6 ativada: comando de teste executado ${result.count}x. ` +
          `Loop detectado. PARE e:\n` +
          `1. Verifique se o bug tem solução conhecida (Tier 2 — busque implementação de referência)\n` +
          `2. Consulte specs/technical/ e specs/examples/\n` +
          `3. Se não encontrar, reconsidere a abordagem\n` +
          `4. Use record_decision() para documentar o que descobriu\n` +
          `O contador será resetado quando avançar de fase.`
        );
      } else {
        allow();
      }
    } catch {
      allow();
    }
  });
}

main();
