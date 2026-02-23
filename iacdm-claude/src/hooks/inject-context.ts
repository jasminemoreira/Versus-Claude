#!/usr/bin/env node

// Camada 1: Injeção de contexto — UserPromptSubmit
// Injeta estado da metodologia antes de TODA mensagem do usuário.

import { StateEngine } from "../state/engine";
import { getCompactGuidance } from "../rules/guidance";

const PHASE_NAMES: Record<number, string> = {
  0: "Problem Discovery",
  1: "Architecture",
  2: "Adversarial Critique",
  3: "Simplification",
  4: "Convergence Gate",
  5: "Code Implementation",
  6: "Tests",
  7: "Post-Review",
};

function main() {
  const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const engine = new StateEngine(workspacePath);
  const state = engine.getPhaseState();

  if (!state) {
    // Sem projeto, sem injeção
    process.exit(0);
  }

  const phase = state.currentPhase;
  const phaseName = PHASE_NAMES[phase] ?? "Desconhecida";

  // Resumo compacto (não gastar tokens demais)
  const lines: string[] = [
    `[Versus] Phase ${phase} — ${phaseName} | Iteração ${state.currentIteration}`,
  ];

  if (state.phase0Score !== null) {
    lines.push(`Score Phase 0: ${state.phase0Score}/100`);
  }

  // Últimas 3 decisões relevantes
  const recentDecisions = state.decisions.slice(-3);
  if (recentDecisions.length > 0) {
    lines.push("Decisões recentes:");
    for (const d of recentDecisions) {
      lines.push(`  [P${d.phase}/${d.category}] ${d.content.substring(0, 100)}`);
    }
  }

  // Restrição de código em Phases 0-4
  if (phase < 5) {
    lines.push("RESTRIÇÃO: Phases 0-4 — NÃO implemente código. Use as MCP tools para gerenciar a metodologia.");
  }

  // Instruções comportamentais compactas por fase
  const compactGuidance = getCompactGuidance(phase);
  for (const line of compactGuidance) {
    lines.push(line);
  }

  // Lembrete de get_phase_guidance para instruções completas
  lines.push("Para instruções detalhadas da fase: chame get_phase_guidance().");

  // Loop counter warning
  const loop = engine.getLoopCounter();
  if (loop.count >= 2) {
    lines.push(`⚠ Loop detector: padrão "${loop.pattern}" executado ${loop.count}x. Limiar: 3.`);
  }

  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}

main();
